// Cierre de CRIT-02: la autorización ya NO se basa en `usuario_id` (lo elige el
// cliente) sino en el token de sesión emitido por `auth:login`. Todo local, sin
// red: el token vive en `sesiones_activas` de la BD SQLite del equipo.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { registrarSesion } from '../../services/red-session'

const holder = vi.hoisted(() => ({ db: null as any }))

vi.mock('../../db/database', () => ({ getDatabase: () => holder.db }))

function crearDb() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DatabaseSync }: any = require('node:sqlite')
  const raw = new DatabaseSync(':memory:')
  raw.exec(`
    CREATE TABLE usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT, contrasena TEXT, nombre TEXT, rol TEXT,
      activo INTEGER DEFAULT 1, permisos TEXT
    );
    CREATE TABLE sesiones_activas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL UNIQUE,
      par_id TEXT NOT NULL,
      sesion_token TEXT NOT NULL UNIQUE,
      opened_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_heartbeat TEXT
    );
  `)
  return raw
}

// Ids distintos por test: el cache de permisos (TTL 5 s) es a nivel módulo.
let proximoId = 1
function crearUsuario(rol: 'admin' | 'cajero') {
  const id = proximoId++
  holder.db
    .prepare('INSERT INTO usuarios (id, usuario, contrasena, nombre, rol) VALUES (?, ?, ?, ?, ?)')
    .run(id, `${rol}${id}`, 'x', `Usuario ${id}`, rol)
  return id
}

function sesionDe(usuarioId: number, parId = 'base') {
  const res = registrarSesion(holder.db, usuarioId, parId)
  if (!res.ok) throw new Error(`no se pudo abrir sesión: ${res.error}`)
  return res.sesionToken
}

// Se importan después de definir el mock.
import { checkPermissionOrFail, resolveAuthenticatedUserId, extractSessionToken, endSession } from './permissions'

describe('autorización por token de sesión', () => {
  beforeEach(() => {
    holder.db = crearDb()
  })

  it('deniega si no hay token, aunque el cliente mande un usuario_id', () => {
    const fail = checkPermissionOrFail({ usuario_id: 1 }, 'config:set', 'config_edit')
    expect(fail).not.toBeNull()
    expect(fail?.error).toContain('sesión activa')
  })

  it('deniega con un token que no existe (sesión cerrada o inventada)', () => {
    const fail = checkPermissionOrFail(
      { usuario_id: 1, session_token: 'token-inventado' },
      'config:set',
      'config_edit',
    )
    expect(fail).not.toBeNull()
    expect(fail?.error).toContain('sesión activa')
  })

  it('ignora el usuario_id falsificado: un cajero no puede actuar como admin', () => {
    const cajeroId = crearUsuario('cajero')
    const adminId = crearUsuario('admin')
    const token = sesionDe(cajeroId)

    // El cliente intenta hacerse pasar por el admin (config_db_reset es admin-only)
    const payload: any = { usuario_id: adminId, session_token: token }
    const fail = checkPermissionOrFail(payload, 'db:reset', 'config_db_reset')

    expect(fail).not.toBeNull()
    expect(fail?.error).toContain('Permiso denegado')
    // Y el actor se normalizó al de la sesión, no al que mandó el cliente
    expect(payload.usuario_id).toBe(cajeroId)
  })

  it('normaliza el usuario_id al de la sesión también cuando el permiso pasa', () => {
    const cajeroId = crearUsuario('cajero')
    const token = sesionDe(cajeroId)

    const payload: any = { usuario_id: 999, session_token: token }
    const fail = checkPermissionOrFail(payload, 'ventas:list', 'pos_access')

    expect(fail).toBeNull()
    // Así los handlers que persisten `usuario_id` (ventas, caja, auditoría) no
    // pueden ser suplantados.
    expect(payload.usuario_id).toBe(cajeroId)
  })

  it('el admin sigue pasando todos los permisos con su token', () => {
    const adminId = crearUsuario('admin')
    const token = sesionDe(adminId)
    expect(checkPermissionOrFail({ session_token: token }, 'db:reset', 'config_db_reset')).toBeNull()
  })

  it('el token deja de servir cuando se cierra la sesión', () => {
    const adminId = crearUsuario('admin')
    const token = sesionDe(adminId)

    expect(checkPermissionOrFail({ session_token: token }, 'db:reset', 'config_db_reset')).toBeNull()

    endSession({ session_token: token })

    const fail = checkPermissionOrFail({ session_token: token }, 'db:reset', 'config_db_reset')
    expect(fail).not.toBeNull()
    expect(fail?.error).toContain('sesión activa')
  })

  it('resolveAuthenticatedUserId distingue token válido, inválido y ausente', () => {
    const adminId = crearUsuario('admin')
    const token = sesionDe(adminId)

    expect(resolveAuthenticatedUserId({ session_token: token })).toBe(adminId)
    expect(resolveAuthenticatedUserId({ session_token: 'nope' })).toBeNull()
    expect(resolveAuthenticatedUserId({ usuario_id: adminId })).toBeNull()
    expect(resolveAuthenticatedUserId(undefined)).toBeNull()
    expect(resolveAuthenticatedUserId('texto')).toBeNull()
  })

  it('extractSessionToken solo acepta strings no vacíos', () => {
    expect(extractSessionToken({ session_token: 'abc' })).toBe('abc')
    expect(extractSessionToken({ session_token: '' })).toBeNull()
    expect(extractSessionToken({ session_token: 42 })).toBeNull()
    expect(extractSessionToken(null)).toBeNull()
  })
})

import { handleIpc } from './ipc-guard'
import bcrypt from 'bcryptjs'
import { getDatabase } from '../../db/database'
import { t } from '../../i18n'
import { ROLE_DEFAULTS, type PermissionKey } from '../../../shared/permissions'
import { checkPermissionOrFail } from './permissions'
import { login } from './auth-service'

export function registerAuthHandlers(): void {
  handleIpc('auth:login', async (_event, data: { usuario: string; contrasena: string }) => {
    try {
      return await login(data)
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}

export function registerUsuariosHandlers(): void {
  handleIpc('usuarios:change-password', async (_event, data: { usuario_id: number; contrasena_actual: string; contrasena_nueva: string }) => {
    const fail = checkPermissionOrFail(data, 'usuarios:change-password', 'usuarios_change_own_password')
    if (fail) return fail
    const db = getDatabase()
    const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(data.usuario_id) as any
    if (!user) return { success: false, error: t('errors.notFound') }
    const validPassword = bcrypt.compareSync(data.contrasena_actual, user.contrasena)
    if (!validPassword) return { success: false, error: t('errors.wrongCurrentPassword') }
    if (!data.contrasena_nueva || data.contrasena_nueva.length < 6) return { success: false, error: t('errors.passwordMinLength') }
    const newHash = bcrypt.hashSync(data.contrasena_nueva, 10)
    db.prepare(`UPDATE usuarios SET contrasena = ?, debe_cambiar_contrasena = 0, actualizado_en = datetime('now') WHERE id = ?`).run(newHash, data.usuario_id)
    return { success: true }
  })

  handleIpc('usuarios:list', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'usuarios:list', 'usuarios_access')
    if (fail) return fail
    const db = getDatabase()
    return db.prepare('SELECT id, usuario, nombre, rol, activo, creado_en FROM usuarios ORDER BY nombre').all()
  })

  handleIpc('usuarios:create', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'usuarios:create', 'usuarios_access')
    if (fail) return fail
    const db = getDatabase()
    const hash = bcrypt.hashSync(data.contrasena, 10)
    const result = db.prepare(
      'INSERT INTO usuarios (usuario, contrasena, nombre, rol) VALUES (?, ?, ?, ?)'
    ).run(data.usuario, hash, data.nombre, data.rol || 'cajero')
    return { id: result.lastInsertRowid }
  })

  handleIpc('usuarios:update', async (_event, data: { id: number; data: any; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'usuarios:update', 'usuarios_access')
    if (fail) return fail
    const db = getDatabase()
    const fields: string[] = []
    const values: any[] = []

    if (data.data.nombre !== undefined) { fields.push('nombre = ?'); values.push(data.data.nombre) }
    if (data.data.rol !== undefined) { fields.push('rol = ?'); values.push(data.data.rol) }
    if (data.data.activo !== undefined) { fields.push('activo = ?'); values.push(data.data.activo) }
    if (data.data.contrasena && data.data.contrasena.trim()) {
      const hash = bcrypt.hashSync(data.data.contrasena, 10)
      fields.push('contrasena = ?'); values.push(hash)
    }

    fields.push("actualizado_en = datetime('now')")
    values.push(data.id)

    db.prepare(`UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return { success: true }
  })

  handleIpc('usuarios:delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'usuarios:delete', 'usuarios_access')
    if (fail) return fail
    const db = getDatabase()
    db.prepare(`UPDATE usuarios SET activo = 0, actualizado_en = datetime('now') WHERE id = ?`).run(data.id)
    return { success: true }
  })

  handleIpc('usuarios:getPermissions', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'usuarios:getPermissions', 'usuarios_access')
    if (fail) return fail
    const db = getDatabase()
    const user = db.prepare('SELECT id, usuario, nombre, rol, permisos FROM usuarios WHERE id = ?').get(data.id) as any
    if (!user) return { success: false, error: 'Usuario no encontrado' }

    let permisos: string[] = []
    if (user.rol === 'admin') {
      permisos = ROLE_DEFAULTS.admin
    } else if (user.permisos) {
      try { permisos = JSON.parse(user.permisos) } catch { permisos = ROLE_DEFAULTS[user.rol] || [] }
    } else {
      permisos = ROLE_DEFAULTS[user.rol] || []
    }

    return { success: true, permisos, rol: user.rol }
  })

  handleIpc('usuarios:setPermissions', async (_event, data: { id: number; permisos: PermissionKey[]; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'usuarios:setPermissions', 'usuarios_manage_roles')
    if (fail) return fail
    const db = getDatabase()
    const user = db.prepare('SELECT id, rol FROM usuarios WHERE id = ?').get(data.id) as any
    if (!user) return { success: false, error: 'Usuario no encontrado' }

    if (user.rol === 'admin') {
      return { success: true, message: 'Admin tiene todos los permisos automáticamente' }
    }

    const permisosJson = JSON.stringify(data.permisos)
    db.prepare(`UPDATE usuarios SET permisos = ?, actualizado_en = datetime('now') WHERE id = ?`).run(permisosJson, data.id)
    return { success: true }
  })
}
// MED-05: restaurar un backup REEMPLAZA la base viva. Antes sólo se miraba la
// cabecera `SQLite format`, que acepta cualquier SQLite del mundo. Ahora se
// verifica que sea una base de TOG Admin.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { validarArchivoBackup, TABLAS_REQUERIDAS } from './backup-validacion'

// `better-sqlite3` está compilado contra el ABI de Electron, así que en vitest
// (Node pelado) no puede instanciarse y la validación caería siempre en
// 'no-se-pudo-abrir'. Se reemplaza por `node:sqlite`, que abre exactamente los
// mismos archivos con el mismo motor: lo único simulado es el *driver*, la
// lógica de validación (cabecera, esquema, modo lectura) se ejercita de verdad.
vi.mock('better-sqlite3', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DatabaseSync }: any = require('node:sqlite')
  class DatabaseFake {
    private raw: any
    constructor(ruta: string, opciones?: { readonly?: boolean }) {
      this.raw = new DatabaseSync(ruta, { readOnly: opciones?.readonly === true })
    }
    prepare(sql: string) {
      return this.raw.prepare(sql)
    }
    close() {
      this.raw.close()
    }
  }
  return { default: DatabaseFake }
})

let dir: string

/** Crea un SQLite real usando otro driver (node:sqlite) para no autovalidarse. */
function crearSqlite(ruta: string, tablas: string[], filas = false) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DatabaseSync }: any = require('node:sqlite')
  const db = new DatabaseSync(ruta)
  for (const t of tablas) db.exec(`CREATE TABLE ${t} (id INTEGER PRIMARY KEY)`)
  if (filas) db.exec('INSERT INTO usuarios (id) VALUES (1)')
  db.close()
}

function rutaTmp(nombre: string): string {
  return path.join(dir, nombre)
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tog-backup-test-'))
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('validación de un backup antes de restaurar', () => {
  it('acepta una base con las tablas de TOG Admin', () => {
    const archivo = rutaTmp('bueno.db')
    crearSqlite(archivo, [...TABLAS_REQUERIDAS])

    const res = validarArchivoBackup(archivo)

    expect(res.ok).toBe(true)
    if (res.ok) expect(res.tablas).toEqual(expect.arrayContaining([...TABLAS_REQUERIDAS]))
  })

  it('rechaza un archivo que no existe', () => {
    const res = validarArchivoBackup(rutaTmp('no-esta.db'))
    expect(res).toEqual({ ok: false, motivo: 'no-existe' })
  })

  it('rechaza un archivo que no es SQLite (cabecera ajena)', () => {
    const archivo = rutaTmp('notas.txt')
    fs.writeFileSync(archivo, 'esto es un txt cualquiera, no una base de datos')

    expect(validarArchivoBackup(archivo)).toEqual({ ok: false, motivo: 'no-es-sqlite' })
  })

  it('rechaza un archivo demasiado chico para tener cabecera', () => {
    const archivo = rutaTmp('corto.db')
    fs.writeFileSync(archivo, 'SQL')
    expect(validarArchivoBackup(archivo)).toEqual({ ok: false, motivo: 'no-es-sqlite' })
  })

  it('rechaza un SQLite válido pero de otra aplicación', () => {
    const archivo = rutaTmp('otra-app.db')
    crearSqlite(archivo, ['contactos', 'mensajes'])

    const res = validarArchivoBackup(archivo)

    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.motivo).toBe('esquema-ajeno')
      // El detalle nombra las tablas que faltan, útil para el mensaje al usuario
      expect(res.detalle).toContain('_migrations')
    }
  })

  it('rechaza un backup parcial (le falta una tabla de negocio)', () => {
    const archivo = rutaTmp('parcial.db')
    crearSqlite(archivo, ['_migrations', 'usuarios', 'configuracion'])

    const res = validarArchivoBackup(archivo)

    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.detalle).toContain('productos')
  })

  it('no modifica el archivo que valida (se abre en solo lectura)', () => {
    const archivo = rutaTmp('intacto.db')
    crearSqlite(archivo, [...TABLAS_REQUERIDAS], true)
    const antes = fs.readFileSync(archivo)
    const mtimeAntes = fs.statSync(archivo).mtimeMs

    validarArchivoBackup(archivo)

    expect(fs.readFileSync(archivo)).toEqual(antes)
    expect(fs.statSync(archivo).mtimeMs).toBe(mtimeAntes)
    // Validar en modo escritura dejaría estos archivos auxiliares
    expect(fs.existsSync(archivo + '-wal')).toBe(false)
    expect(fs.existsSync(archivo + '-journal')).toBe(false)
  })

  it('un archivo truncado no rompe la validación (devuelve error, no excepción)', () => {
    const archivo = rutaTmp('truncado.db')
    crearSqlite(archivo, [...TABLAS_REQUERIDAS])
    // Rompe el archivo dejando sólo la primera página
    const contenido = fs.readFileSync(archivo)
    fs.writeFileSync(archivo, contenido.subarray(0, 200))

    const res = validarArchivoBackup(archivo)
    expect(res.ok).toBe(false)
  })
})

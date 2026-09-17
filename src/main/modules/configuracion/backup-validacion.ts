/**
 * Validación de un archivo de backup antes de restaurarlo.
 *
 * `backup:restore` **reemplaza la base viva**: si el archivo elegido no es un
 * backup de TOG Admin, el negocio queda con una base inservible (y con datos de
 * otra cosa). Antes sólo se comprobaba la cabecera `SQLite format`, que acepta
 * cualquier SQLite del mundo — incluidas bases de otras apps.
 *
 * Se abre siempre en **solo lectura**: validar nunca debe modificar el archivo
 * del usuario (abrir un SQLite en modo escritura crea `-wal`/`-shm`/`-journal` y
 * puede recuperar el diario).
 */

import fs from 'node:fs'
import Database from 'better-sqlite3'

/** Cabecera de todo archivo SQLite (`SQLite format 3\0`). */
const SQLITE_MAGIC = 'SQLite format'

/**
 * Tablas que debe tener un backup de TOG Admin.
 *
 * `_migrations` es la que distingue una base de TOG Admin de cualquier otra
 * SQLite: es la que permite saber qué esquema tiene y migrarla al arrancar.
 * Las demás son las de negocio que siempre existen en cualquier instalación.
 */
export const TABLAS_REQUERIDAS = ['_migrations', 'usuarios', 'productos', 'ventas', 'configuracion'] as const

export type MotivoInvalido = 'no-existe' | 'no-es-sqlite' | 'esquema-ajeno' | 'no-se-pudo-abrir'

export type ValidacionBackup =
  | { ok: true; tablas: string[] }
  | { ok: false; motivo: MotivoInvalido; detalle?: string }

export function validarArchivoBackup(ruta: string): ValidacionBackup {
  if (!fs.existsSync(ruta)) return { ok: false, motivo: 'no-existe' }

  // 1) Cabecera: descarta cualquier cosa que ni siquiera sea SQLite.
  try {
    const fd = fs.openSync(ruta, 'r')
    try {
      const buf = Buffer.alloc(16)
      const leidos = fs.readSync(fd, buf, 0, 16, 0)
      if (leidos < 16 || !buf.toString('utf8', 0, 16).startsWith(SQLITE_MAGIC)) {
        return { ok: false, motivo: 'no-es-sqlite' }
      }
    } finally {
      fs.closeSync(fd)
    }
  } catch (err: any) {
    return { ok: false, motivo: 'no-se-pudo-abrir', detalle: err?.message }
  }

  // 2) Esquema: que sea una base de TOG Admin, no un SQLite cualquiera.
  let candidata: Database.Database | null = null
  try {
    candidata = new Database(ruta, { readonly: true, fileMustExist: true })
    const tablas = (
      candidata.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>
    ).map((fila) => fila.name)
    const faltantes = TABLAS_REQUERIDAS.filter((tabla) => !tablas.includes(tabla))
    if (faltantes.length > 0) {
      return { ok: false, motivo: 'esquema-ajeno', detalle: faltantes.join(', ') }
    }
    return { ok: true, tablas }
  } catch (err: any) {
    return { ok: false, motivo: 'no-se-pudo-abrir', detalle: err?.message }
  } finally {
    try {
      candidata?.close()
    } catch {
      // best-effort
    }
  }
}

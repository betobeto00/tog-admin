/**
 * Contraseña inicial del admin: generación (CSPRNG) y borrado del texto plano.
 *
 * Vive aparte de `db/database.ts` y `core/auth/auth-service.ts` para poder
 * testearse **por comportamiento** sin arrastrar electron ni better-sqlite3.
 * Antes de esto, los únicos tests de esta funcionalidad leían el archivo de
 * origen y afirmaban que el texto `crypto.randomInt` aparecía en él: eso pasa
 * aunque el código no se ejecute nunca.
 */

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

/** Largo de la contraseña inicial que se muestra una sola vez. */
export const PASSWORD_INICIAL_LARGO = 12

/** Alfabeto sin caracteres ambiguos de tipear (0/O, 1/l/I no se confunden acá). */
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export const ARCHIVO_PASSWORD_INICIAL = 'admin-initial-password.txt'

/**
 * Genera la contraseña inicial con `crypto.randomInt` (CSPRNG).
 *
 * `crypto.randomInt` es uniforme (descarta el sesgo de módulo) y no predecible;
 * `Math.random()` no sirve para material de credenciales.
 */
export function generarPasswordInicial(largo: number = PASSWORD_INICIAL_LARGO): string {
  let password = ''
  for (let i = 0; i < largo; i++) {
    password += ALFABETO.charAt(crypto.randomInt(0, ALFABETO.length))
  }
  return password
}

/** Ruta del archivo donde se deja la contraseña inicial en claro. */
export function rutaPasswordInicial(userDataDir: string): string {
  return path.join(userDataDir, ARCHIVO_PASSWORD_INICIAL)
}

/**
 * Escribe la contraseña inicial en `userData` con permisos de dueño únicamente
 * (`0600`): mientras exista, sólo la cuenta del usuario que corre la app la lee.
 *
 * Ojo: **Windows ignora `mode`** (el archivo termina siendo legible por
 * cualquiera que pueda acceder a la carpeta). Ahí la protección real es que
 * `%APPDATA%` es por usuario; por eso, además, el archivo se borra en el primer
 * login del admin en vez de quedar para siempre.
 */
export function escribirPasswordInicial(userDataDir: string, password: string): string {
  const filePath = rutaPasswordInicial(userDataDir)
  fs.writeFileSync(filePath, password, { encoding: 'utf8', mode: 0o600 })
  return filePath
}

/**
 * Borra el archivo en texto plano. Se llama cuando el admin ya demostró tener la
 * contraseña (primer login exitoso), que es cuando dejó de ser necesario.
 *
 * No se borra al revelarla en la UI para no dejar al usuario afuera si cierra la
 * app antes de entrar. Best-effort: no debe romper el login.
 *
 * @returns `true` si borró un archivo existente.
 */
export function borrarPasswordInicial(userDataDir: string): boolean {
  try {
    const filePath = rutaPasswordInicial(userDataDir)
    if (!fs.existsSync(filePath)) return false
    fs.unlinkSync(filePath)
    return true
  } catch {
    return false
  }
}

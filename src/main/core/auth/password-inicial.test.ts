/* eslint-disable security/detect-non-literal-fs-filename */
// Fase 3 — hardening del seed de la base.
//
// Antes estos tests leían `db/database.ts` y afirmaban que el TEXTO
// `crypto.randomInt` aparecía en el archivo. Eso pasa aunque el código nunca se
// ejecute (y el test original afirmaba lo contrario: exigía `Math.random()`).
// Ahora la generación y el borrado viven en `password-inicial.ts` y se prueban
// ejecutándolos de verdad.

import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  generarPasswordInicial,
  escribirPasswordInicial,
  borrarPasswordInicial,
  rutaPasswordInicial,
  ARCHIVO_PASSWORD_INICIAL,
  PASSWORD_INICIAL_LARGO,
} from './password-inicial'

const dirsTemporales: string[] = []
function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tog-pass-test-'))
  dirsTemporales.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirsTemporales.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('contraseña inicial del admin', () => {
  it('tiene el largo esperado y sólo caracteres alfanuméricos', () => {
    const password = generarPasswordInicial()
    expect(password).toHaveLength(PASSWORD_INICIAL_LARGO)
    expect(password).toMatch(/^[A-Za-z0-9]{12}$/)
  })

  it('respeta un largo distinto si se pide', () => {
    expect(generarPasswordInicial(20)).toHaveLength(20)
  })

  it('no repite valores (no es una constante ni un generador con estado fijo)', () => {
    const generadas = new Set(Array.from({ length: 200 }, () => generarPasswordInicial()))
    expect(generadas.size).toBe(200)
  })

  it('no es ninguna de las contraseñas por defecto históricas', () => {
    const prohibidas = ['admin123', 'empleado123', 'password', '123456', 'admin', '123456789012']
    for (let i = 0; i < 100; i++) {
      expect(prohibidas).not.toContain(generarPasswordInicial())
    }
  })

  it('todas las posiciones del alfabeto pueden salir (no está sesgado a una parte)', () => {
    const vistas = new Set<string>()
    for (let i = 0; i < 500; i++) {
      for (const ch of generarPasswordInicial()) vistas.add(ch)
    }
    // 62 caracteres posibles; con 6000 muestras deberían aparecer todos
    expect(vistas.size).toBe(62)
  })
})

describe('archivo de la contraseña inicial', () => {
  it('se escribe con permisos sólo para el dueño (POSIX) y con el contenido exacto', () => {
    const dir = tempDir()
    const password = generarPasswordInicial()

    const filePath = escribirPasswordInicial(dir, password)

    expect(path.basename(filePath)).toBe(ARCHIVO_PASSWORD_INICIAL)
    expect(fs.readFileSync(filePath, 'utf8')).toBe(password)

    // En POSIX el archivo queda 0600 (sólo el dueño). En Windows `mode` no se
    // aplica: `statSync` reporta 0o666 siempre y la protección real es que
    // `%APPDATA%` es por usuario. No se puede afirmar la misma condición en las
    // dos plataformas, así que la aserción es POSIX-only a propósito.
    if (process.platform !== 'win32') {
      const modo = fs.statSync(filePath).mode & 0o777
      expect(modo & 0o077).toBe(0)
    }
  })

  it('se borra cuando el admin ya entró', () => {
    const dir = tempDir()
    escribirPasswordInicial(dir, generarPasswordInicial())
    expect(fs.existsSync(rutaPasswordInicial(dir))).toBe(true)

    expect(borrarPasswordInicial(dir)).toBe(true)
    expect(fs.existsSync(rutaPasswordInicial(dir))).toBe(false)
  })

  it('borrarlo dos veces no falla (segundo login, reinstalación)', () => {
    const dir = tempDir()
    escribirPasswordInicial(dir, generarPasswordInicial())
    expect(borrarPasswordInicial(dir)).toBe(true)
    expect(borrarPasswordInicial(dir)).toBe(false)
    expect(() => borrarPasswordInicial(dir)).not.toThrow()
  })

  it('borrar en un directorio inexistente no rompe el login', () => {
    expect(borrarPasswordInicial(path.join(tempDir(), 'no-existe'))).toBe(false)
  })
})

describe('guarda de texto: el seed no puede volver a credenciales conocidas', () => {
  // Guarda barata de regresión (no prueba comportamiento: prueba que nadie
  // reescriba un default en el archivo). Se mantiene a propósito.
  const dbContent = fs.readFileSync(path.join(process.cwd(), 'src', 'main', 'db', 'database.ts'), 'utf8')

  it('no contiene contraseñas por defecto', () => {
    for (const prohibida of ["'admin123'", "'empleado123'", "'123456'"]) {
      expect(dbContent).not.toContain(prohibida)
    }
  })

  it('no volvió a usar Math.random() para material de credenciales', () => {
    expect(dbContent).not.toContain('Math.random()')
  })

  it('la migración que crea las tablas del seed protegido sigue existiendo', () => {
    // Instalaciones existentes ya tienen `usuarios`: la migración es lo que les
    // agrega `admin_initial_password` / `initial_password_shown`.
    expect(dbContent).toContain('044_security_default_passwords')
    expect(dbContent).toContain('admin_initial_password')
  })

  it('el borrado del texto plano sigue cableado al login del admin', () => {
    const authContent = fs.readFileSync(
      path.join(process.cwd(), 'src', 'main', 'core', 'auth', 'auth-service.ts'),
      'utf8',
    )
    expect(authContent).toMatch(/rol === 'admin'[\s\S]{0,200}discardInitialPasswordFile\(\)/)
  })
})

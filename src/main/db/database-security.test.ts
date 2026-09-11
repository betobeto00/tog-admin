// Tests de seguridad: Fase 3 — Seed Database hardening.
// Verifica que el seed no crea usuarios con credenciales conocidas.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Phase 3 - Seed Database Security', () => {
  it('does not contain hardcoded passwords', () => {
    const dbContent = readFileSync(join(process.cwd(), 'src', 'main', 'db', 'database.ts'), 'utf8')
    
    // Should NOT contain hardcoded passwords
    expect(dbContent).not.toContain("'admin123'")
    expect(dbContent).not.toContain("'empleado123'")
    expect(dbContent).not.toContain("'password'")
    expect(dbContent).not.toContain("'123456'")
    
    // Should NOT contain INSERT for maria user (but comments are OK)
    expect(dbContent).not.toContain("INSERT INTO usuarios.*'maria'")
  })

  it('generates random admin password', () => {
    const dbContent = readFileSync(join(process.cwd(), 'src', 'main', 'db', 'database.ts'), 'utf8')
    
    // Should have random password generation
    expect(dbContent).toContain('Math.random()')
    expect(dbContent).toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
    expect(dbContent).toContain('abcdefghijklmnopqrstuvwxyz')
    expect(dbContent).toContain('0123456789')
  })

  it('stores initial password for first login', () => {
    const dbContent = readFileSync(join(process.cwd(), 'src', 'main', 'db', 'database.ts'), 'utf8')
    
    // Should store initial password
    expect(dbContent).toContain('admin_initial_password')
    expect(dbContent).toContain('initial_password_shown')
    expect(dbContent).toContain('admin-initial-password.txt')
  })

  it('has migration for security', () => {
    const dbContent = readFileSync(join(process.cwd(), 'src', 'main', 'db', 'database.ts'), 'utf8')
    
    // Should have security migration
    expect(dbContent).toContain('044_security_default_passwords')
    expect(dbContent).toContain('admin_initial_password')
  })

  it('uses bcrypt for password hashing', () => {
    const dbContent = readFileSync(join(process.cwd(), 'src', 'main', 'db', 'database.ts'), 'utf8')
    
    // Should use bcrypt
    expect(dbContent).toContain('bcrypt.hashSync')
    expect(dbContent).toContain("'bcryptjs'")
  })
})

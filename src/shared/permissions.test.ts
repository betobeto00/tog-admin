import { describe, it, expect } from 'vitest'
import {
  PERMISSIONS,
  ROLE_DEFAULTS,
  hasPermission,
  getEffectivePermissions,
  type PermissionKey,
} from './permissions'

describe('PERMISSIONS', () => {
  it('has all expected permission keys', () => {
    const keys = Object.keys(PERMISSIONS)
    expect(keys.length).toBeGreaterThanOrEqual(25)
    expect(keys).toContain('pos_access')
    expect(keys).toContain('caja_access')
    expect(keys).toContain('inventario_access')
    expect(keys).toContain('compras_access')
    expect(keys).toContain('quotes_access')
    expect(keys).toContain('reportes_access')
    expect(keys).toContain('config_access')
    expect(keys).toContain('usuarios_access')
  })

  it('every permission has label, category, and description in es and en', () => {
    for (const [key, perm] of Object.entries(PERMISSIONS)) {
      expect(perm.label.es).toBeTruthy()
      expect(perm.label.en).toBeTruthy()
      expect(perm.category.es).toBeTruthy()
      expect(perm.category.en).toBeTruthy()
      expect(perm.description.es).toBeTruthy()
      expect(perm.description.en).toBeTruthy()
    }
  })

  it('categories are from a known set', () => {
    const validCategories = new Set([
      'Ventas', 'Caja', 'Inventario', 'Compras', 'Cotizaciones', 'Reportes', 'Administración',
    ])
    for (const perm of Object.values(PERMISSIONS)) {
      expect(validCategories.has(perm.category.es)).toBe(true)
    }
  })
})

describe('ROLE_DEFAULTS', () => {
  it('admin has ALL permissions', () => {
    const allKeys = Object.keys(PERMISSIONS) as PermissionKey[]
    expect(ROLE_DEFAULTS.admin.length).toBe(allKeys.length)
    for (const key of allKeys) {
      expect(ROLE_DEFAULTS.admin).toContain(key)
    }
  })

  it('cajero has a subset of permissions', () => {
    expect(ROLE_DEFAULTS.cajero.length).toBeGreaterThan(0)
    expect(ROLE_DEFAULTS.cajero.length).toBeLessThan(Object.keys(PERMISSIONS).length)
  })

  it('admin defaults are the real permission keys, not array indexes (regression: Object.keys over an array)', () => {
    const allKeys = Object.keys(PERMISSIONS)
    expect(ROLE_DEFAULTS.admin).toEqual(allKeys)
    for (const key of ROLE_DEFAULTS.admin) {
      expect(key in PERMISSIONS).toBe(true)
      expect(/^\d+$/.test(key)).toBe(false)
    }
  })

  it('every default permission in cajero exists in PERMISSIONS', () => {
    for (const key of ROLE_DEFAULTS.cajero) {
      expect(key in PERMISSIONS).toBe(true)
    }
  })

  it('cajero has pos_access', () => {
    expect(ROLE_DEFAULTS.cajero).toContain('pos_access')
  })

  it('cajero does NOT have dangerous permissions', () => {
    expect(ROLE_DEFAULTS.cajero).not.toContain('config_db_reset')
    expect(ROLE_DEFAULTS.cajero).not.toContain('usuarios_manage_roles')
    expect(ROLE_DEFAULTS.cajero).not.toContain('pos_void_sale')
  })

  it('cajero has basic operational permissions', () => {
    expect(ROLE_DEFAULTS.cajero).toContain('caja_access')
    expect(ROLE_DEFAULTS.cajero).toContain('caja_open')
    expect(ROLE_DEFAULTS.cajero).toContain('caja_close')
    expect(ROLE_DEFAULTS.cajero).toContain('inventario_access')
    expect(ROLE_DEFAULTS.cajero).toContain('compras_access')
    expect(ROLE_DEFAULTS.cajero).toContain('reportes_access')
  })
})

describe('hasPermission', () => {
  it('admin always has all permissions regardless of userPermissions', () => {
    expect(hasPermission([], 'pos_access', 'admin')).toBe(true)
    expect(hasPermission(null, 'config_db_reset', 'admin')).toBe(true)
    expect(hasPermission(['pos_access'], 'usuarios_manage_roles', 'admin')).toBe(true)
  })

  it('cajero with explicit permissions checks correctly', () => {
    const perms: PermissionKey[] = ['pos_access', 'caja_access']
    expect(hasPermission(perms, 'pos_access', 'cajero')).toBe(true)
    expect(hasPermission(perms, 'caja_access', 'cajero')).toBe(true)
    expect(hasPermission(perms, 'config_edit', 'cajero')).toBe(false)
  })

  it('cajero with null permissions uses ROLE_DEFAULTS', () => {
    expect(hasPermission(null, 'pos_access', 'cajero')).toBe(true)
    expect(hasPermission(null, 'config_db_reset', 'cajero')).toBe(false)
  })

  it('unknown role with null permissions returns false', () => {
    expect(hasPermission(null, 'pos_access', 'unknown_role')).toBe(false)
  })

  it('cajero without the permission returns false', () => {
    const perms: PermissionKey[] = ['pos_access']
    expect(hasPermission(perms, 'config_edit', 'cajero')).toBe(false)
  })
})

describe('getEffectivePermissions', () => {
  it('admin returns all permissions', () => {
    const result = getEffectivePermissions(null, 'admin')
    expect(result.length).toBe(Object.keys(PERMISSIONS).length)
  })

  it('admin ignores stored permissions', () => {
    const result = getEffectivePermissions('["pos_access"]', 'admin')
    expect(result.length).toBe(Object.keys(PERMISSIONS).length)
  })

  it('cajero with null permissions returns defaults', () => {
    const result = getEffectivePermissions(null, 'cajero')
    expect(result).toEqual(ROLE_DEFAULTS.cajero)
  })

  it('cajero with valid JSON permissions parses them', () => {
    const stored = JSON.stringify(['pos_access', 'caja_access'])
    const result = getEffectivePermissions(stored, 'cajero')
    expect(result).toEqual(['pos_access', 'caja_access'])
  })

  it('cajero with invalid JSON falls back to defaults', () => {
    const result = getEffectivePermissions('not-valid-json', 'cajero')
    expect(result).toEqual(ROLE_DEFAULTS.cajero)
  })

  it('unknown role with null permissions returns empty', () => {
    const result = getEffectivePermissions(null, 'unknown')
    expect(result).toEqual([])
  })

  it('unknown role with valid JSON returns parsed permissions', () => {
    const stored = JSON.stringify(['pos_access'])
    const result = getEffectivePermissions(stored, 'unknown')
    expect(result).toEqual(['pos_access'])
  })
})

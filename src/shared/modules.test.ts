import { describe, it, expect } from 'vitest'
import {
  BASE_MODULE,
  ADDON_MODULES,
  MODULE_CATALOG,
  normalizeModules,
  type ModuleId,
} from './modules'

describe('MODULE_CATALOG', () => {
  it('has unique ids and covers base + addons', () => {
    const ids = MODULE_CATALOG.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('comercializador')
    expect(ADDON_MODULES.length).toBeGreaterThanOrEqual(4)
  })

  it('marks only comercializador as base and names every module', () => {
    for (const m of MODULE_CATALOG) {
      expect(m.nombre).toBeTruthy()
      expect(m.descripcion).toBeTruthy()
    }
    expect(BASE_MODULE.base).toBe(true)
    expect(BASE_MODULE.id).toBe('comercializador')
    for (const m of ADDON_MODULES) {
      expect(m.base).toBe(false)
    }
  })

  it('references only known modules in requires', () => {
    const known = new Set<string>(MODULE_CATALOG.map((m) => m.id))
    for (const m of MODULE_CATALOG) {
      for (const dep of m.requiere) {
        expect(known.has(dep)).toBe(true)
      }
    }
  })
})

describe('normalizeModules', () => {
  it('returns [] for missing or non-array values (license v1)', () => {
    expect(normalizeModules(undefined)).toEqual([])
    expect(normalizeModules(null)).toEqual([])
    expect(normalizeModules('distribuidor')).toEqual([])
    expect(normalizeModules({ 0: 'distribuidor' })).toEqual([])
  })

  it('keeps valid module ids and drops unknown ones', () => {
    expect(normalizeModules(['distribuidor', 'productor'])).toEqual(['distribuidor', 'productor'])
    expect(normalizeModules(['distribuidor', 'nave-espacial', ''])).toEqual(['distribuidor'])
  })

  it('dedupes repeated ids', () => {
    expect(normalizeModules(['postventa', 'postventa', 'distribuidor'])).toEqual(['postventa', 'distribuidor'])
  })

  it('accepts comercializador if explicitly present', () => {
    expect(normalizeModules(['comercializador'])).toEqual(['comercializador'])
  })

  it('returns a ModuleId[] typed list usable for gating', () => {
    const list: ModuleId[] = normalizeModules(['distribuidor'])
    expect(list).toContain('distribuidor')
  })
})

# Moneda, símbolo y tasa de cambio

> 🕓 **Documento de planificación** — esto **no está implementado como flujo
> completo**. La base (columnas `currency_symbol`, `tasa_cambio` en `configuracion`)
> existe, pero el servicio que las aplica a toda la app no. Define cómo se
> cierra Fase 8 sin sobrediseñar.

---

## Estado actual (verificado contra código)

| Pieza | Estado | Archivo |
|-------|--------|---------|
| Columna `currency_symbol` en `configuracion` | ✅ existe | `src/main/db/database.ts:770` (seed `$`) |
| Columna `tasa_cambio` en `configuracion` | ✅ existe | `src/renderer/pages/ConfigPage.tsx:31,111` (form, get) |
| UI Configuración → "Negocio" con `currency_symbol` y `tasa_cambio` | ✅ existe, no conectado al renderer | `src/renderer/pages/ConfigPage.tsx:392` |
| Servicio `currency.ts` que devuelve símbolo + tasa | ❌ no existe | — |
| `formatCurrency(amount, symbol)` recibe símbolo por parámetro | ✅ existe, default `$` hardcoded | `src/renderer/lib/utils.ts:14` |
| `formatCurrency` aplicado a toda la app con símbolo dinámico | ❌ no: 176 usos llaman `formatCurrency(x)` sin símbolo | múltiples archivos |
| `currency_name` (USD, Bs, EUR…) en DB | ❌ no existe | — |
| Impuesto (`sales_tax_rate`) reacciona a la moneda | ❌ no se ve impactado | — |

## Objetivo

Que el usuario configure en `Configuración → Negocio`:
- **Símbolo** de la moneda que se ve en toda la app (`$`, `Bs`, `€`, `S/`, `Q`…)
- **Tasa de cambio** (si es 0 = 1:1 con el monto guardado; si es 800, todos los precios se muestran multiplicados por 800)
- **Nombre** de la moneda (opcional, para tickets)

Y que toda la app (POS, ventas, reportes, tickets, cotizaciones, etc.) use esos valores sin que cada pantalla tenga que pedirlos.

## Diseño propuesto

### 1) Servicio único `currency.ts` (síncrono, lectura al boot)

Ubicación: `src/renderer/services/currency.ts`. **Inicializado en el boot** con un `useCurrency()` hook que llama `config:get` una vez y cachea.

```ts
// src/renderer/services/currency.ts
import { callApi } from '../lib/api-client'

let _symbol = '$'
let _rate = 1
let _name = 'USD'

export async function loadCurrency() {
  const cfg = await callApi<any[]>('config:get')
  const get = (k: string) => cfg.find((c) => c.clave === k)?.valor
  _symbol = get('currency_symbol') || '$'
  _rate = parseFloat(get('tasa_cambio') || '0') || 0
  _name = get('currency_name') || 'USD'
}

export function getSymbol() { return _symbol }
export function getRate() { return _rate }
export function getName() { return _name }

/** Formatea un monto aplicando la tasa y el símbolo. amount es el valor en USD base. */
export function formatMoney(amount: number | null | undefined): string {
  const safe = typeof amount === 'number' && !isNaN(amount) ? amount : 0
  const rate = _rate > 0 ? _rate : 1
  const value = safe * rate
  return `${_symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
```

**Se llama `loadCurrency()` en `App.tsx` al montar** (igual que ya se hace con `i18n`). Si la tasa cambia (cambio en Config), invalidar con un evento o un método `setCurrency(symbol, rate, name)`.

### 2) Reemplazar los 176 usos de `formatCurrency(x)` por `formatMoney(x)`

- **Sustitución mecánica** con `grep` + `sed` (script puntual, no parte de la app).
- Cualquier `formatCurrency(x, '$')` hardcodeado se reemplaza por `formatMoney(x)`.
- El parámetro `symbol` de `formatCurrency` se conserva para casos puntuales (ej. ticket de regalo con otra moneda), pero el default es leer del cache.
- Tickets impresos (POS, remito, mesa) usan `formatMoney` también — un solo símbolo coherente.

### 3) Migración 030 (número siguiente) — `currency_name`

```sql
INSERT OR IGNORE INTO configuracion (clave, valor, descripcion) VALUES
  ('currency_name', 'USD', 'Nombre de la moneda (USD, Bs, EUR, etc.)');
```

### 4) UI Configuración → Negocio

Extender el form existente con un campo `currency_name`. El símbolo y la tasa ya están, agregar nombre y un preview: "Los precios se muestran como: **Bs 8,000.00**".

### 5) Ticket: cómo imprimir la moneda

Decisión recomendada: el ticket imprime **el símbolo + monto en la moneda del local**. No imprime el monto en USD + tasa (eso confunde al cliente). Si el cliente quiere ver la conversión, eso va en el PDF/reporte, no en el ticket.

## Decisiones pendientes

| Decisión | Opciones | Recomendación |
|----------|----------|---------------|
| Tasa: ¿se guarda en DB o en archivo? | DB (configuracion) · archivo JSON | DB — ya está, consistente con el resto |
| ¿La tasa afecta precios guardados o solo la visualización? | Visualización · Recalcular todo | **Visualización** (precios guardados en USD base, display con tasa). No recalcular ventas históricas. |
| ¿El impuesto (sales_tax_rate) se aplica antes o después de la tasa? | Antes (USD × tax × rate) · Después (USD × rate × tax) | **Antes** — el impuesto es sobre el precio base, la tasa es solo display. |
| ¿Multi-moneda por venta? | Sí, snapshot por venta · No, una sola moneda local | **Una sola** — el modelo es "todo el local opera en la misma moneda". Si el cliente necesita multi-moneda, va como fase futura. |
| ¿Qué pasa si la tasa cambia a mitad del día? | Las ventas del día mantienen la tasa con que se cobraron (snapshot) | **Snapshot**: guardar `tasa_aplicada` en `ventas` (nullable, default 0) para auditoría. |
| ¿Tickets con otra moneda? | Selector de moneda al cobrar | **No** en v1 — fuera de alcance. |
| ¿locale de `toLocaleString`? | 'en-US' (siempre) · dinámico por moneda | **en-US** (separador `.` para miles, `,` para decimales, consistente con el dominio) |

## Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| `src/renderer/services/currency.ts` | **NUEVO** — servicio + `loadCurrency()` + `formatMoney()` |
| `src/renderer/lib/utils.ts` | Conservar `formatCurrency` (con símbolo explícito) pero marcar como deprecated; agregar comentario que diga "para v2 usar formatMoney de services/currency" |
| `src/renderer/App.tsx` | Llamar `loadCurrency()` en `useEffect` de boot |
| `src/renderer/pages/ConfigPage.tsx` | Agregar campo `currency_name` al form |
| `src/renderer/pages/ConfigPage.tsx` (en `saveConfig`) | Persistir `currency_name` |
| `src/renderer/components/pos/CartItem.tsx` y 175 más | Reemplazar `formatCurrency(x)` por `formatMoney(x)` (script de migración) |
| `src/main/db/database.ts` | Migración 030 con `currency_name` |
| `src/renderer/i18n/locales/{es,en}/translation.json` | Keys: `config.currencyName`, `config.currencyPreview` |
| `src/renderer/lib/utils.test.ts` | Test del nuevo servicio `formatMoney` |

## Anti-patrones (NO hacer)

- ❌ **NO** usar `Intl.NumberFormat` con `style: 'currency'`: trae el símbolo de la locale y se rompe cuando el usuario quiere `Bs` en Venezuela.
- ❌ **NO** leer `currency_symbol` en cada `render` de cada componente (lento, race conditions). El servicio cachea.
- ❌ **NO** hacer la tasa async en el render: el monto no puede "cambiar" mientras el usuario está mirando. Cache al boot, refresh explícito.
- ❌ **NO** convertir los precios guardados en DB. La moneda base siempre es la del guardado. La tasa es display.
- ❌ **NO** agregar un selector de moneda por venta en este PR. Es alcance separado.

## Test mínimo viable

```ts
// src/renderer/services/currency.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { loadCurrency, formatMoney, getRate } from './currency'

describe('currency service', () => {
  beforeEach(() => { /* mock callApi to return config */ })

  it('formatea con símbolo y tasa por defecto', async () => {
    await loadCurrency() // con config: symbol=Bs rate=800
    expect(formatMoney(10)).toBe('Bs8,000.00')
  })

  it('sin tasa (rate=0) usa 1:1', async () => {
    await loadCurrency() // con config: symbol=$ rate=0
    expect(formatMoney(10)).toBe('$10.00')
  })

  it('monto null/undefined devuelve 0', async () => {
    await loadCurrency()
    expect(formatMoney(null)).toBe('$0.00')
    expect(formatMoney(undefined)).toBe('$0.00')
  })
})
```

## Tareas concretas (orden de ejecución)

1. Migración 030 (`currency_name`).
2. Servicio `currency.ts` + tests.
3. Llamar `loadCurrency()` en `App.tsx`.
4. Script de migración: `grep -rl "formatCurrency(" src/renderer --include="*.ts*" | xargs sed -i 's/formatCurrency(\([^,)]*\))/formatMoney(\1)/g'`.
5. Agregar `currency_name` al form de Config + tests.
6. Verificar que no quedó ningún `$` hardcoded en el renderer que escape al servicio.
7. Correr `npm test` + `npm run typecheck:all` + smoke test manual.
8. Commit + push.

## Documentos relacionados

- `FEATURES.md` — la fila "Fase 8.1 Tasa de cambio" lista este feature.
- `ROADMAP.md` — tiene la migración 019 original (ahora obsoleta porque la 030 la reemplaza). Marcar la 019 como "absorbida por 030" cuando se implemente.
- `INTERCONEXION-RED.md` — mismo formato, otra feature pendiente.

## Estado

🕓 Pendiente. La base existe (símbolo, tasa, form en Config). El servicio de display es lo que falta. Estimación: 1 sesión de trabajo (servicio + migración + script + tests).
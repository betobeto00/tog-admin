# Knowledge Base — TOG Admin: Papelería, Centro de Copiado e Impresión

## El Negocio

Una papelería/centro de copiado e impresión es un negocio que ofrece:

### Productos Físicos (se venden del mostrador)
- **Papelería:** cuadernos, lápices, bolígrafos, marcadores, gomas, tijeras, reglas, folders, archivadores
- **Artículos de oficina:** clips, chinches, cinta adhesiva, sobres, hojas blancas/colores
- **Útiles escolares:** mochilas, estuches, calculadoras
- **Impresión de fotos:** impresiones tamaño photo, posters, lonas

### Servicios (se cobran por trabajo)
- **Copiado:** B/N y color, por página, tamaño Letter/Legal/A4
- **Impresión:** documentos, fotos, planos, carteles
- **Escaneo:** digitalización de documentos
- **Encuadernación:** laminado, wire-o, espiral, tapa dura
- **Laminado/Plastificado:** documentos, tarjetas
- **Fotocopias de documentos:** IDs, títulos, documentos legales
- **Servicios de internet:** Impresión desde USB, envío de correos
- **Venta de suministros de oficina**

---

## Flujo de Caja Típico

### Apertura de Caja (Inicio del día)
1. El cajero abre la caja (Register)
2. Registra el **fondo inicial** (ej: $50, $100)
3. Empieza a atender clientes

### Durante el Día
- Cada venta se registra en el sistema
- Se imprime ticket para el cliente
- Se puede hacer **entrada extra** (ej: cliente devuelve dinero, pago extra)
- Se puede hacer **salida** (ej: retiro de efectivo, gasto menor)

### Cierre de Caja (Final del día)
1. El cajero cuenta todo el efectivo physical
2. El sistema muestra lo que **debería** haber (fondo + ventas - salidas)
3. El cajero ingresa lo que **realmente** tiene
4. El sistema calcula la **diferencia** (sobra/falta)
5. Se genera el **reporte del día**
6. Se cierra la caja

---

## Tipos de Pago

| Método | Descripción |
|--------|------------|
| **Efectivo** | Billetes y monedas |
| **Transferencia** | Pago bancario (se registra referencia) |
| **Pago Móvil** | Pago móvil venezolano (se registra referencia) |
| **Mixto** | Parte efectivo + parte otro método |

---

## Categorías de Productos Comunes

### Papelería
- Hojas blancas (resma 500 hojas)
- Hojas de color (resma)
- Cuadernos
- Libretas
- Block de dibujo
- Cartulinas
- Folderes / Archivadores

### Útiles
- Lápices (Nº2, de colores)
- Bolígrafos (azul, negro, rojo)
- Marcadores (permanente, pizarra)
- Resaltadores
- Gomas de borrar
- Sacapuntas
- Reglas / Compases
- Tijeras
- Cinta adhesiva / Doble cara
- Clips / Chinches
- Cajas de bossos

### Impresión
- Tóner / Cartuchos
- Rollos de papel térmico
- Papel foto

### Services (per page/flat rate)
| Service | Size | Reference Price |
|---------|------|----------------|
| B/W Copy | Letter | $0.10 - $0.25 |
| Color Copy | Letter | $0.50 - $1.00 |
| B/W Print | Letter | $0.10 - $0.25 |
| Color Print | Letter | $0.50 - $1.50 |
| Scan | Letter | $0.25 - $0.50 |
| Photo Print 4x6 | Photo | $1.00 - $3.00 |
| Laminating | Letter | $0.50 - $1.00 |
| Spiral Binding | Various | $2.00 - $5.00 |

*Prices vary by location and market.*

---

## El Problema que Resuelve el Software

Sin el sistema, el papelero:
- ❌ No sabe cuánto vendió al día
- ❌ No controla el inventario (se queda sin stock sin saber)
- ❌ No sabe qué productos se venden más
- ❌ No tiene historial de ventas
- ❌ No puede hacer cierre de caja rápido
- ❌ Calcula todo en la cabeza o en cuaderno
- ❌ Se pierde dinero por fallos de caja
- ❌ No sabe a quién le debe o quién le debe

Con el sistema:
- ✅ Registro rápido de cada venta con código de barras o búsqueda
- ✅ Control automático de inventario con alertas de stock mínimo
- ✅ Reportes de ventas diarias, semanales, mensuales
- ✅ Top productos más vendidos
- ✅ Cierre de caja automático con conciliación
- ✅ Historial completo de transacciones
- ✅ Gestión de proveedores y compras
- ✅ Respaldo de datos con un clic

---

## Glossary (US Terms)

| Term | Definition |
|------|-----------|
| **POS** | Point of Sale — system to process transactions |
| **SKU** | Stock Keeping Unit — internal product code |
| **Barcode** | UPC/EAN code scanned at checkout |
| **Register** | Cash register — where sales are processed |
| **Opening Fund** | Cash in drawer at start of shift |
| **Closeout / Z-Report** | End-of-day cash reconciliation |
| **Receipt** | Printed proof of purchase |
| **Sales Tax** | Tax charged on taxable goods (varies by state/county) |
| **EIN** | Employer Identification Number (Tax ID for businesses) |
| **On Account** | Sale without immediate payment (credit/fiado) |
| **Consignment** | Products given to store to sell and pay later |
| **Shrinkage** | Inventory loss (theft, damage, errors) |
| **Markup** | (Sale Price / Cost) × 100 |
| **Devolución** | Producto que el cliente regresa |
| **Merma** | Pérdida de producto (roto, vencido, regalado) |
| **Traslado** | Mover producto de una ubicación a otra |
| **Inventario físico** | Conteo manual para verificar stock real |
| **Margen** | Ganancia = Precio venta - Precio compra |
| **Markup** | (Precio venta / Precio compra) × 100 |

---

## Casos de Uso Diarios del Cajero

### Caso 1: Venta Normal
```
1. Cliente pide 2 cuadernos y 1 resma de hojas
2. Cajero busca por código o nombre
3. Agrega items al carrito
4. Confirma total
5. Cobra en efectivo
6. Imprime ticket
7. Da vuelto
```

### Caso 2: Servicio de Copiado
```
1. Cliente trae documento para copiar 10 páginas en color
2. Cajero selecciona "Servicio > Copia Color"
3. Ingresa cantidad: 10
4. Sistema calcula: 10 × $0.75 = $7.50
5. Cobra e imprime ticket
```

### Caso 3: Cierre de Caja
```
1. Es hora de cerrar
2. Cajero hace clic en "Cerrar Caja"
3. Sistema muestra: Total ventas del día = $450.00
4. Cajero cuenta efectivo: $445.00
5. Diferencia: -$5.00 (falta)
6. Cajero agrega nota: "Falta $5, probable cambio mal dado"
7. Se cierra y genera reporte
```

### Caso 4: Compra a Proveedor
```
1. Llegan 50 resmas de hojas del proveedor
2. Cajero va a "Compras"
3. Selecciona proveedor
4. Agrega producto: 50 resmas × $3.00 = $150.00
5. Registra pago
6. Stock se actualiza automáticamente: +50
```

---

## Electron Production Build — Resuelto ✅

### El Problema (RESUELTO)
La app funcionaba perfectamente en `npm run dev` pero mostraba pantalla blanca en el build de producción (`TOG Admin.exe`).

### Causas Raíz (IDENTIFICADAS Y CORREGIDAS)

1. **`BrowserRouter` no funciona con `file://`** — Usa HTML5 History API que requiere un servidor HTTP. Solución: `HashRouter`.
2. **`crossorigin` en tags HTML** — Vite agrega `crossorigin` que rompe la carga desde asar. Solución: plugin `removeCrossorigin`.
3. **`<script type="module">`** — ES modules requieren CORS headers que no existen en `file://`. Solución: `type="text/javascript"`.
4. **CSS via `<link>`** — No carga desde asar. Solución: CSS inline en `<style>` via post-build script.
5. **`document.getElementById('root')` = null** — El script carga antes del DOM. Solución: `DOMContentLoaded` wrapper en `main.tsx`.

### Soluciones Aplicadas

| # | Solución | Resultado |
|---|----------|-----------|
| 1 | `BrowserRouter` → `HashRouter` | ✅ React Router funciona |
| 2 | Plugin quita `crossorigin` | ✅ Tags HTML limpios |
| 3 | `type="module"` → `type="text/javascript"` | ✅ Script se ejecuta |
| 4 | CSS inline via `inline-css.js` | ✅ Tailwind aplica |
| 5 | `DOMContentLoaded` wrapper | ✅ Root element encontrado |
| 6 | Imports estáticos (sin lazy loading) | ✅ Sin code splitting |
| 7 | ErrorBoundary global | ✅ Errores visibles |

### Configuración Actual de Build

**vite.config.ts:**
- `base: './'` — Paths relativos
- `build.rollupOptions.output.format: 'iife'` — Sin módulos ES
- `target: 'es2020'` — Chrome 126+ (Electron 31)
- Plugin `removeCrossorigin` — Limpia tags HTML

**scripts/inline-css.js:**
- Genera Tailwind CSS standalone (30KB)
- Inyecta como `<style>` en el HTML
- Quita `<link>` de CSS externo
- Cambia `type="module"` a `type="text/javascript"`

**src/renderer/main.tsx:**
- `DOMContentLoaded` wrapper para esperar al DOM
- Error logging para diagnóstico

### Lecciones Aprendidas

1. **Electron + Vite no es trivial** — Hay muchos pits entre dev y production
2. **`file://` protocol es muy limitado** — No soporta CORS, modules, ni links externos
3. **`BrowserRouter` requiere servidor** — Usa `HashRouter` para Electron production
4. **Siempre probar el build de producción** — Dev mode puede ocultar problemas
5. **El debug remoto es difícil** — Necesitas DevTools o logging en main process
6. **CSS inline es la solución más robusta** — Evita dependencia de archivos externos
7. **i18n debe implementarse desde el inicio** — Traducir strings hardcoded después es más trabajo
8. **Tests automatizados previenen regresiones** — Vitest + React Testing Library son la combinación ideal
9. **Crash reports son esenciales para debugging en producción** — Los usuarios no pueden describir errores técnicos

### Referencia: Comandos de build

```bash
# Build de desarrollo
npm run dev

# Build de producción
npm run build:renderer   # Vite build + CSS inline (30KB)
npm run build:main       # TypeScript → JavaScript

# Empaquetado portable
npm run build:win        # → release/win-unpacked/TOG Admin.exe

# Instalador NSIS
npm run build:installer  # → release/TOG Admin Setup 1.0.8.exe
```

### Flujo de distribución a clientes

```
1. Generar claves RSA (una vez)
   $ node scripts/generate-keys.js

2. Generar instalador
   $ npm run build:installer
   → release/TOG Admin Setup 1.0.8.exe

3. Entregar .exe al cliente

4. Cliente instala → Abre la app → Ve pantalla de bloqueo

5. Cliente te envía su Machine ID

6. Tú generas la licencia
   $ node scripts/generate-license.js "Cliente" "2027-08-28" "machine_id"

7. Envías license.key al cliente → Lo importa → Todo funciona ✅
```

### Referencias

- [Electron Security](https://electronjs.org/docs/tutorial/security)
- [Vite for Electron](https://vitejs.dev/guide/build.html)
- [electron-builder NSIS](https://www.electron.build/configuration/nsis) — Configuración del instalador
- [LICENCIAMIENTO.md](./LICENCIAMIENTO.md) — Sistema de licencias RSA-2048
- [PRODUCTION_BUILD_REPORT.md](./PRODUCTION_BUILD_REPORT.md) — Reporte detallado

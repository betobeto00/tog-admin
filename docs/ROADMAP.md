# Roadmap — TOG Admin

## Visión General

```
FASE 0 ✅   FASE 1 ✅   FASE 2 ✅   FASE 2.5 ✅  FASE 2.7 ✅  FASE 2.8 ✅  FASE 3 (🟡)    FASE 4 ✅
CRÍTICOS    CORE        SEGURIDAD   P0+P1+P2     i18n        TESTS+ASSETS PREMIUM+BC    DEPLOY+AUTOUPDATE
             +UX
─────────   ─────────   ─────────   ──────────   ─────────   ─────────   ────────────   ─────────
✅ Stock    ✅ Zod      ✅ Timeout  ✅ Precio    ✅ ES/EN     ✅ Vitest    ✅ Barcode     ✅ Auto-update
✅ Backup   ✅ Dctos    ✅ Rate     ✅ Venta     ✅ ~1277keys ✅ 112 tests ✅ Permisos    ✅ Hero-bg
✅ Passwd   ✅ Subcomp  ✅ VP800    ✅ Reporte X ✅ HelpPage  ✅ Favicons  ✅ i18n full   ✅ Logo real
✅ Toast    ✅ Ajuste   ✅ License  ✅ CSV I/O   ✅ Config    ✅ jest-dom  ⏳ Touch       ✅ Icono transparente
                         ✅ Help     ✅ Hist.Ajuste ✅ Tutorial ✅ jsdom    ⏳ Crédito     ✅ NSIS language fix
                         ✅ Alerts   ✅ Backup auto ✅ AllPages ✅ setup    ⏳ Etiquetas   ✅ Release Notes
                         ✅ TermCfg  ✅ Printer/Fondo ✅ Backend           ⏳ Adv Reports ✅ Developer Guide
                                                         ✅ Met.Pago       ⏳ VP800 WiFi
─────────────────────────────────────────────────────────────────────────────────────────────────────────
FASE 5 (⏳)    FASE 6 (⏳)     FASE 7 (⏳)       FASE 8 (⏳)         FASE 9 (⏳)        FASE 10 (⏳)
PRODUCTO+EXP   COMBOS+PDF     MULTI-SUCURSAL    FISCAL+LEGAL        TOG ADMIN ADAPTABLE MARKETING
────────────   ────────────   ────────────────   ─────────────────   ─────────────────   ────────────
⏳ Tipo Prod   ⏳ Combos       ⏳ Multi-caja      ⏳ Tasa Cambio      ⏳ Papelería         ⏳ Landing
⏳ Subcateg    ⏳ PDF Quote    ⏳ DB compartida   ⏳ Símbolo Moneda   ⏳ Centro Copiado   ⏳ Video Demo
⏳ Marca       ⏳ Convert Q→V  ⏳ Intersucursal   ⏳ CSV SENIAT       ⏳ Imprenta         ⏳ Testimonios
⏳ Imagen Prod                                        ⏳ Facturación    ⏳ Ferretería       ⏳ Tutorial Video
                                                     ⏳ Inst X32/X64    ⏳ Farmacia
```

**Estado actual del proyecto (v1.0.8):** Fases 0, 1, 2, 2.5, 2.7, 2.8, 4 completadas — Fase 3 parcialmente completada (Barcode ✅, Permisos ✅, i18n full ✅, MetodosPago ✅, Touch ⏳, Crédito ⏳, Etiquetas ⏳)

---

## 🎯 Visión Expandida: TOG Admin — Sistema Adaptable

TOG Admin no es solo un POS para papelerías. Es una **plataforma adaptable** que se configura según la necesidad del cliente:

| Negocio | Módulos Activos | Personalizaciones |
|---------|----------------|-------------------|
| **Papelería / Centro de Copiado** | POS + Inventario + Compras + Reportes + Caja | Categorías de servicio (copiado, impresión, encuadernación) |
| **Ferretería** | POS + Inventario + Compras + Proveedores + Reportes | Unidades (kg, m, L, par), stock por ubicación |
| **Farmacia** | POS + Inventario + Reportes + Lotes | Control de lotes, fechas de vencimiento, recetas |
| **Tienda de Ropa** | POS + Inventario + Cotizaciones | Tallas, colores, variantes de producto |
| **Restaurante** | POS + Caja + Reportes | Mesas, comandas, cocina |
| **Librería** | POS + Inventario + Compras | ISBN, autores, editoriales |
| **Papelería + Imprenta** | POS + Inventario + Compras + Cotizaciones | Servicios de impresión, tiradas, acabados |

**Premisa fundamental:** El sistema se adapta al cliente, no al revés. Cada negocio activa/desactiva módulos y configura categorías, unidades y campos según su operación.

---

## ✅ FASE 0: CRÍTICOS DE SEGURIDAD — COMPLETADA

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| 0.1 | Validación de stock negativo en ventas | ✅ | `ipc-handlers.ts`, `POSPage.tsx` |
| 0.2 | Implementar Backup/Restore | ✅ | `ipc-handlers.ts`, `ConfigPage.tsx`, `preload.ts` |
| 0.3 | Cambiar password admin y obligar cambio | ✅ | `database.ts`, `ipc-handlers.ts`, `preload.ts`, `auth.store.ts`, `App.tsx`, `ForcePasswordChange.tsx` |
| 0.4 | Sistema de notificaciones Toast | ✅ | `Toast.tsx`, `index.css`, `App.tsx`, `POSPage.tsx`, `ConfigPage.tsx` |

---

## ✅ FASE 1: CORE COMPLETADO — COMPLETADA

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| 1.1 | Validación Zod en IPC handlers | ✅ | `shared/validations.ts`, `ipc-handlers.ts` |
| 1.2 | Descuentos en POS (por item + global) | ✅ | `POSPage.tsx`, `ipc-handlers.ts` |
| 1.3 | Extraer subcomponentes | ✅ | `pos/CartItem.tsx`, `POSPage.tsx` |
| 1.4 | Dashboard mejorado (últimas ventas) | ✅ | `DashboardPage.tsx`, `ipc-handlers.ts`, `preload.ts` |
| 1.5 | Ajuste manual de inventario | ✅ | `InventarioPage.tsx`, `ipc-handlers.ts`, `database.ts`, `preload.ts` |

---

## ✅ FASE 2: SEGURIDAD + UX — COMPLETADA

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| 2.1 | Session timeout por inactividad | ✅ | `auth.store.ts` (30 min auto-logout) |
| 2.2 | Rate limiting en login | ✅ | `ipc-handlers.ts` (5 intentos / 15 min) |
| 2.3 | Imports estáticos (compat Electron) | ✅ | `App.tsx` |
| 2.4 | Integración Terminal VP800 | ✅ | `services/valorTerminal.ts`, `ipc-handlers.ts`, `preload.ts` |
| 2.5 | Impresión de cierre de caja | ✅ | `CajaPage.tsx` |
| 2.6 | Sistema de licencias RSA-2048 | ✅ | `services/license.ts`, `LicenseGate.tsx`, `scripts/generate-keys.js`, `scripts/generate-license.js` |
| 2.7 | Centro de Ayuda detallado | ✅ | `HelpPage.tsx` (12 secciones con búsqueda) |
| 2.8 | Tutorial de onboarding | ✅ | `Tutorial.tsx`, `App.tsx`, `ConfigPage.tsx` |
| 2.9 | Campana de notificaciones real | ✅ | `Header.tsx` (stock bajo + caja cerrada) |
| 2.10 | Configuración del terminal VP800 | ✅ | `ConfigPage.tsx` (puerto COM, baud rate, conectar/desconectar) |
| 2.11 | POS bloqueado sin caja abierta | ✅ | `POSPage.tsx` |

---

## ✅ FASE 2.5: P0 + P1 + P2 — COMPLETADA

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| 2.12 | Precio unitario editable en POS | ✅ | `CartItem.tsx`, `POSPage.tsx` |
| 2.13 | Venta rápida sin producto (servicio) | ✅ | `POSPage.tsx` |
| 2.14 | Reporte X (parcial sin cerrar caja) | ✅ | `CajaPage.tsx`, `ipc-handlers.ts` |
| 2.15 | Importar productos CSV | ✅ | `InventarioPage.tsx`, `ipc-handlers.ts` |
| 2.16 | Exportar productos CSV | ✅ | `InventarioPage.tsx`, `ipc-handlers.ts` |
| 2.17 | Historial de ajustes de inventario | ✅ | `InventarioPage.tsx` |
| 2.18 | Filtro productos con stock bajo | ✅ | `InventarioPage.tsx` |
| 2.19 | Backup automático al cerrar caja | ✅ | `CajaPage.tsx` |
| 2.20 | Configurar impresora en Config | ✅ | `ConfigPage.tsx` |
| 2.21 | Fondo inicial default en Config | ✅ | `ConfigPage.tsx`, `CajaPage.tsx` |
| 2.22 | Exportar reportes CSV + PDF | ✅ | `ReportesPage.tsx` |

---

## ✅ FASE 2.7: INTERNACIONALIZACIÓN (i18n) — COMPLETADA

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| 2.23 | Archivos de traducción ES/EN completos | ✅ | `i18n/locales/es/translation.json`, `en/translation.json` |
| 2.24 | Keys de traducción para ForcePasswordChange | ✅ | `ForcePasswordChange.tsx` |
| 2.25 | Keys de traducción para Tutorial | ✅ | `Tutorial.tsx` |
| 2.26 | Keys de traducción para Dashboard | ✅ | `DashboardPage.tsx` |
| 2.27 | Keys de traducción para POS (carrito, cobro, ticket) | ✅ | `POSPage.tsx` |
| 2.28 | Keys de traducción para Compras | ✅ | `ComprasPage.tsx` |
| 2.29 | Keys de traducción para Help | ✅ | `HelpPage.tsx` |
| 2.30 | Keys de traducción para Inventario | ✅ | `InventarioPage.tsx` |
| 2.31 | Keys de traducción para Reportes | ✅ | `ReportesPage.tsx` |
| 2.32 | Keys de traducción para Ventas | ✅ | `VentasPage.tsx` |
| 2.33 | Keys de traducción para Config (tabs, forms, terminal, backup) | ✅ | `ConfigPage.tsx` |
| 2.34 | Keys de traducción para crash reports | ✅ | `ErrorBoundary.tsx` |
| 2.35 | Keys de traducción para legal modals | ✅ | `LoginPage.tsx` |
| 2.36 | Auth store error messages en inglés | ✅ | `auth.store.ts` |

---

## ✅ FASE 2.7-i18n: INTERNACIONALIZACIÓN COMPLETA — COMPLETADA (30-Ago-2026)

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| I1 | Fix `datetime("now")` SQLite bug (4 ubicaciones en ipc-handlers.ts) | ✅ | `src/main/ipc-handlers.ts` |
| I2 | Fix TDZ: `quickSaleOpen` antes de declaración en POSPage | ✅ | `src/renderer/pages/POSPage.tsx` |
| I3 | Fix TDZ: `addItem` antes de declaración en ComprasPage | ✅ | `src/renderer/pages/ComprasPage.tsx` |
| I4 | Fix TDZ: `i18n` no desestructurado en ComprasPage | ✅ | `src/renderer/pages/ComprasPage.tsx` |
| I5 | Reemplazar `i18n.language === 'en'` con `t()` en CajaPage (43 reemplazos) | ✅ | `src/renderer/pages/CajaPage.tsx` |
| I6 | Reemplazar `i18n.language === 'en'` con `t()` en ConfigPage (32+ reemplazos) | ✅ | `src/renderer/pages/ConfigPage.tsx` |
| I7 | Reemplazar `i18n.language === 'en'` con `t()` en InventarioPage (13 reemplazos) | ✅ | `src/renderer/pages/InventarioPage.tsx` |
| I8 | Reemplazar `i18n.language === 'en'` con `t()` en ReportesPage (7+ reemplazos) | ✅ | `src/renderer/pages/ReportesPage.tsx` |
| I9 | Reemplazar `i18n.language === 'en'` con `t()` en VentasPage (17 reemplazos) | ✅ | `src/renderer/pages/VentasPage.tsx` |
| I10 | Reemplazar `i18n.language === 'en'` con `t()` en LoginPage (11+ reemplazos) | ✅ | `src/renderer/pages/LoginPage.tsx` |
| I11 | Reemplazar `i18n.language === 'en'` con `t()` en QuotesPage (5 reemplazos) | ✅ | `src/renderer/pages/QuotesPage.tsx` |
| I12 | Agregar 130+ keys de traducción a ambos locale files | ✅ | `i18n/locales/es/translation.json`, `en/translation.json` |
| I13 | Agregar `useTranslation` a QuotesPage y ConfigPage | ✅ | `QuotesPage.tsx`, `ConfigPage.tsx` |

---

## ✅ FASE 2.8: TESTS + ASSETS — COMPLETADA

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| 2.37 | Vitest configurado | ✅ | `vite.config.ts`, `package.json` |
| 2.38 | Tests de validaciones Zod (28 tests) | ✅ | `shared/validations.test.ts` |
| 2.39 | Favicon y apple-touch-icon en index.html | ✅ | `index.html` |
| 2.40 | Assets públicos (logo, hero-bg) en /public | ✅ | `public/` |
| 2.41 | Tests de permisos (24 tests) | ✅ | `shared/permissions.test.ts` |
| 2.42 | Tests de utilidades (15 tests) | ✅ | `renderer/lib/utils.test.ts` |
| 2.43 | Tests de ErrorBoundary (7 tests) | ✅ | `components/ErrorBoundary.test.tsx` |
| 2.44 | Tests de ForcePasswordChange (9 tests) | ✅ | `components/ForcePasswordChange.test.tsx` |
| 2.45 | Tests de Tutorial (11 tests) | ✅ | `components/Tutorial.test.tsx` |
| 2.46 | Tests de PermissionsModal (13 tests) | ✅ | `components/ui/PermissionsModal.test.tsx` |
| 2.47 | Tests de units (Validations + Permissions + Utils + Components = 112 tests; suite completa) | ✅ | Múltiples archivos |

---

## ✅ SISTEMA DE PERMISOS — COMPLETADO (30-Ago-2026)

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| RP1 | Definición de permisos en 7 categorías (35 claves) | ✅ | `src/shared/permissions.ts` |
| RP2 | Migración DB: campo `permisos` en tabla usuarios | ✅ | `src/main/db/database.ts` (migración 013) |
| RP3 | IPC handlers: `getPermissions` / `setPermissions` | ✅ | `src/main/core/auth/handlers.ts` |
| RP4 | Preload API: `usuarios.getPermissions` / `setPermissions` | ✅ | `src/main/preload.ts` |
| RP5 | Hook `usePermissions` (has, hasAny, hasAll) | ✅ | `src/renderer/hooks/usePermissions.ts` |
| RP6 | Modal de permisos (toggles por categoría) | ✅ | `src/renderer/components/ui/PermissionsModal.tsx` |
| RP7 | Sidebar: ocultar módulos según permisos | ✅ | `src/renderer/components/layout/Sidebar.tsx` |
| RP8 | ConfigPage: proteger botones Backup/Reset/Usuarios | ✅ | `src/renderer/pages/ConfigPage.tsx` |
| RP9 | InventarioPage: proteger crear/editar/eliminar/ajustar | ✅ | `src/renderer/pages/InventarioPage.tsx` |
| RP10 | ComprasPage: proteger nueva compra | ✅ | `src/renderer/pages/ComprasPage.tsx` |
| RP11 | Empleada de prueba "maria" con permisos limitados | ✅ | `src/main/db/database.ts` (seed) |
| RP12 | Backend service: `getUserPermissions` / `checkPermission` | ✅ | `src/main/core/auth/permissions.ts` (wired en todos los handlers vía `checkPermissionOrFail`, commit d3f9d27) |

### Categorías de permisos

| Categoría | Permisos |
|-----------|----------|
| 🛒 Ventas | POS, Anular, Descuentos, Editar precio, Venta rápida |
| 💰 Caja | Abrir, Cerrar, Movimientos, Reporte X |
| 📦 Inventario | Acceso, Crear, Editar, Eliminar, Ajustar, Categorías, Unidades |
| 🚚 Compras | Acceso, Registrar, Proveedores |
| 📝 Cotizaciones | Acceso, Crear |
| 📊 Reportes | Ver, Exportar |
| ⚙️ Administración | Config, Terminal, Backups, Reset DB, Usuarios, Asignar permisos |

---

## ✅ EMPAQUETADO: INSTALADOR NSIS — COMPLETADO

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| E1 | Configurar electron-builder NSIS | ✅ | `package.json` (build:installer) |
| E2 | Instalador con acceso directo | ✅ | Escritorio + Menú Inicio |
| E3 | Idioma automático del sistema | ✅ | `installer.nsh` (auto-detect Windows locale) |
| E4 | Desinstalador | ✅ | Panel de Control |
| E5 | Matar procesos pre/post install | ✅ | taskkill automático |
| E6 | Icono de la empresa en instalador | ✅ | `resources/icon.ico`, `resources/icon.png` |
| E7 | Icono transparente (sin fondo blanco) | ✅ | Generado con Python/Pillow |

---

## ✅ FASE 4: DEPLOY + AUTO-UPDATE — COMPLETADA

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| 4.1 | Sistema de auto-actualizaciones | ✅ | `services/updater.ts`, `preload.ts`, `ipc-handlers.ts` |
| 4.2 | Configuración publish en GitHub | ✅ | `package.json` (publish config) |
| 4.3 | Check for updates en login | ✅ | `LoginPage.tsx` |
| 4.4 | Hero-bg.jpg en login | ✅ | `LoginPage.tsx`, `public/hero-bg.jpg` |
| 4.5 | Logo real en Login y Sidebar | ✅ | `LoginPage.tsx`, `Sidebar.tsx` |
| 4.6 | Release Notes en login | ✅ | `LoginPage.tsx` |
| 4.7 | Corregido error 't is not defined' en Inventario | ✅ | `InventarioPage.tsx` |
| 4.8 | i18n fixes en Inventario, Ventas, Caja, Proveedores | ✅ | Múltiples páginas |
| 4.9 | Overlay del login no tapa banner de licencia | ✅ | `LoginPage.tsx` |
| 4.10 | Links legales en una sola línea | ✅ | `LoginPage.tsx` |
| 4.11 | NSIS: eliminado diálogo de idioma manual | ✅ | `installer.nsh` |
| 4.12 | NSIS: auto-detección de idioma del sistema | ✅ | `installer.nsh` |
| 4.13 | Corregido owner en publish config | ✅ | `package.json` |
| 4.14 | Guía completa del desarrollador | ✅ | `docs/GUIA_DESARROLLADOR.md` |
| 4.15 | Configuración de métodos de pago (tabla `metodos_pago`) | ✅ | `ipc-handlers.ts`, `ConfigPage.tsx`, `database.ts` (migración 014) |

---

## ✅ FASE 3.7: INTEGRACIÓN LECTOR CÓDIGOS DE BARRAS (USB HID) — COMPLETADA

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| 3.7.1 | Hook `useBarcodeScanner` (captura global keydown, buffer + timeout 50ms, Enter = procesar) | ✅ | `src/renderer/hooks/useBarcodeScanner.ts` |
| 3.7.2 | Handler IPC `productos:buscar-por-codigo` (busca por código_barras y SKU) | ✅ | `src/main/ipc-handlers.ts` |
| 3.7.3 | Exponer API en preload `productos.buscarPorCodigo(codigo)` | ✅ | `src/main/preload.ts` |
| 3.7.4 | Integración en `POSPage.tsx` - escáner global, scan → buscar → agregar al carrito | ✅ | `src/renderer/pages/POSPage.tsx` |
| 3.7.5 | Escáner en formulario de creación de producto (InventarioPage) | ✅ | `src/renderer/pages/InventarioPage.tsx` |
| 3.7.6 | Escáner en módulo de compras (ComprasPage) | ✅ | `src/renderer/pages/ComprasPage.tsx` |
| 3.7.7 | Indicadores visuales: toggle button, dot verde parpadeante, badge "Escanea ahora" | ✅ | POSPage, InventarioPage, ComprasPage |
| 3.7.8 | i18n keys para scanner en ES/EN | ✅ | `i18n/locales/es/translation.json`, `en/translation.json` |

### Detalle Técnico (basado en `Sistema-COD-BARRAS.md`)

**Arquitectura:**
- Los lectores USB HID actúan como teclado → envían caracteres + Enter
- Hook `useBarcodeScanner` escucha `keydown` global (window)
- Buffer acumula caracteres; timeout 50ms distingue escaneo vs tipeo manual
- Al recibir `Enter` con buffer > 0 → dispara callback `onScan(barcode)`
- Ignora eventos si foco está en `<input>` o `<textarea>`

---

## 🟡 FASE 3: PREMIUM — PARCIALMENTE COMPLETADA

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| 3.1 | Modo touch | ⏳ | `POSPage.tsx` — Botones grandes para pantalla táctil, optimizado para tablets |
| 3.2 | Imprimir etiquetas | ⏳ | `InventarioPage.tsx` — Etiquetas con código de barras |
| 3.3 | Venta a crédito/fiado | ⏳ | `VentasPage.tsx` — Registrar venta sin cobro inmediato, deudores |
| 3.4 | Convertir quote a venta | ⏳ | `QuotesPage.tsx` — Conversión directa de cotización a venta |
| 3.5 | Reportes avanzados | ⏳ | `ReportesPage.tsx` — Gráficas de tendencia, comparativas, exportación |
| 3.6 | WiFi para VP800 | ⏳ | `services/valorTerminal.ts` — Comunicación WiFi vía Valor Connect |
| 3.7 | **Integración Lector Códigos de Barras (USB HID)** | ✅ | Ver Fase 3.7 arriba |
| 3.8 | **Sistema de permisos por usuario** | ✅ | Ver sección "Sistema de Permisos" arriba |
| 3.9 | **Métodos de pago configurables** | ✅ | `database.ts` (migración 014), `ipc-handlers.ts`, `ConfigPage.tsx` |

---

## ⏳ FASE 5: PRODUCTO + EXPANSIÓN DE CATÁLOGO — PENDIENTE

*Objetivo: Enriquecer el modelo de producto para soportar servicios, variantes y catálogo visual.*
*Referencia: ROADMAP-INTEGRACION.md Fase 1*

| # | Tarea | Estado | Prioridad | Dependencias | Observaciones |
|---|-------|--------|-----------|--------------|---------------|
| 5.1 | **Tipo de producto: Producto vs Servicio** | ⏳ | 🔴 Alta | Ninguna | Migración DB: columna `tipo` ENUM ('producto', 'servicio'). Requiere modificar tabla `productos` y todas las pantallas (POS, Inventario, Reportes). Base para todo. |
| 5.2 | **Subcategorías de productos** | ⏳ | 🔴 Alta | Ninguna | Tabla `subcategorias` con `id`, `nombre`, `categoria_id`. Mejora organización del inventario. |
| 5.3 | **Marca del producto (opcional)** | ⏳ | 🟡 Media | Ninguna | Campo `marca` (TEXT) en tabla `productos`. Simple de implementar. |
| 5.4 | **Subir imagen del producto (opcional)** | ⏳ | 🟡 Media | Ninguna | Almacenar rutas de imágenes en DB (`image_path`), gestionar archivos en el sistema de archivos local. |
| 5.5 | **Actualizar schemas Zod** | ⏳ | 🔴 Alta | 5.1-5.4 | Agregar validación para los nuevos campos en `shared/validations.ts`. |
| 5.6 | **Actualizar formulario de producto** | ⏳ | 🔴 Alta | 5.1-5.5 | Modificar formulario de creación/edición en InventarioPage para incluir tipo, marca, imagen, subcategoría. |
| 5.7 | **Actualizar POS para servicios** | ⏳ | 🔴 Alta | 5.1 | POS debe manejar productos y servicios de forma diferente (servicios no descuentan stock). |
| 5.8 | **Actualizar reportes para servicios** | ⏳ | 🟡 Media | 5.1 | Los reportes deben distinguir ventas de productos vs servicios. |

### Detalle Técnico

**Migración 015 — Tipo de producto:**
```sql
ALTER TABLE productos ADD COLUMN tipo TEXT NOT NULL DEFAULT 'producto';
-- 'producto' = bien físico (descuenta stock)
-- 'servicio' = trabajo/servicio (no descuenta stock)
```

**Migración 016 — Subcategorías:**
```sql
CREATE TABLE IF NOT EXISTS subcategorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id),
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE productos ADD COLUMN subcategoria_id INTEGER REFERENCES subcategorias(id);
CREATE INDEX IF NOT EXISTS idx_productos_subcategoria ON productos(subcategoria_id);
```

**Migración 017 — Marca:**
```sql
ALTER TABLE productos ADD COLUMN marca TEXT;
```

**Migración 018 — Imagen:**
```sql
ALTER TABLE productos ADD COLUMN image_path TEXT;
```

---

## ⏳ FASE 6: COMBOS + EXPORTACIÓN PDF — PENDIENTE

*Objetivo: Ofrecer paquetes de productos y exportación profesional de cotizaciones.*
*Referencia: ROADMAP-INTEGRACION.md Fase 2*

| # | Tarea | Estado | Prioridad | Dependencias | Observaciones |
|---|-------|--------|-----------|--------------|---------------|
| 6.1 | **Armar Combos de productos** | ⏳ | 🔴 Alta | Fase 5 | Tablas `combos` y `combo_products` (relación muchos a muchos). Lógica en POS para aplicar descuentos y gestionar stock de componentes. |
| 6.2 | **Exportar Cotización a PDF** | ⏳ | 🔴 Alta | Fase 5 | Usar librería (`pdf-lib` o `jsPDF`). Template profesional con datos del negocio, logo,-items, totales. |
| 6.3 | **Convertir cotización a venta** | ⏳ | 🟡 Media | Fase 5 | From QuotesPage: botón "Convertir a Venta" que crea una venta con los items de la cotización. |

### Detalle Técnico — Combos

**Tablas:**
```sql
CREATE TABLE IF NOT EXISTS combos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio_combo REAL NOT NULL,
  descuento_porc REAL DEFAULT 0,
  imagen TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS combo_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  combo_id INTEGER NOT NULL REFERENCES combos(id),
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad REAL NOT NULL DEFAULT 1,
  UNIQUE(combo_id, producto_id)
);
```

**Consideraciones de diseño:**
- ¿El combo tiene precio fijo o descuento sobre la suma?
- ¿Cómo afecta al stock al vender un combo?
- ¿Se puede vender la mitad de un combo?

---

## ⏳ FASE 7: MULTI-SUCURSAL — PENDIENTE

*Objetivo: Transformar TOG Admin de una app de una sola PC a un sistema multi-sucursal.*
*Referencia: ROADMAP-INTEGRACION.md Fase 3*

| # | Tarea | Estado | Prioridad | Dependencias | Observaciones |
|---|-------|--------|-----------|--------------|---------------|
| 7.1 | **Arquitectura: Elegir estrategia** | ⏳ | 🟡 Media | Ninguna | Opción A: SQLite en red (simple, limitado). Opción B: ORM agnóstico + PostgreSQL/MySQL (correcto, más trabajo). |
| 7.2 | **Multi-caja con DB compartida** | ⏳ | 🟡 Media | 7.1 | Migrar de SQLite local a servidor SQL. Manejar concurrencia. |
| 7.3 | **Conexión intersucursal** | ⏳ | 🟡 Media | 7.2 | Sincronización de datos (inventario, ventas, clientes) entre diferentes bases de datos/servidores. |

### Análisis de Arquitectura

- **Opción A (Corto plazo):** SQLite con acceso en red (archivo .db en unidad de red compartida). Más simple, pero problemas de rendimiento y bloqueo.
- **Opción B (Largo plazo):** Refactorizar capa de DB para usar un ORM (Prisma o Drizzle). Migrar a PostgreSQL/MySQL en servidor central. Más robusto y escalable.

---

## ⏳ FASE 8: CUMPLIMIENTO FISCAL + INSTALADOR — PENDIENTE

*Objetivo: Cumplir con requisitos legales en Venezuela y expandir compatibilidad.*
*Referencia: ROADMAP-INTEGRACION.md Fase 4, Caso-Venezuela.md*

| # | Tarea | Estado | Prioridad | Dependencias | Observaciones |
|---|-------|--------|-----------|--------------|---------------|
| 8.1 | **Configurar Tasa de Cambio** | ⏳ | 🔴 Alta | Ninguna | Campo en Config: si es 0.00 = 1:1 con dólar. Ejemplo: Venezuela tasa 800 → 1$ = 800Bs. Modifica todos los montos en la App. |
| 8.2 | **Símbolo de Moneda configurable** | ⏳ | 🔴 Alta | 8.1 | Cambiar `$` por `Bs`, `€`, etc. El símbolo debe verse en toda la App: Dashboard, facturas, cotizaciones, reportes, donde se vea monto. |
| 8.3 | **Descargar CSV formato SENIAT** | ⏳ | 🟡 Media | Ninguna | Investigar formato exacto del SENIAT. Generar reporte CSV con columnas necesarias para declaración de impuestos. |
| 8.4 | **Sistema de facturación flexible** | ⏳ | 🔴 Alta | 8.1, 8.2 | Generar comprobante fiscal válido. Mantener modular para adaptarse a futura normativa (Providencia 2026/00084). |
| 8.5 | **Instalador X32 y X64** | ⏳ | 🟡 Media | Ninguna | Configurar electron-builder: `target: ['nsis', 'nsis:x64']`. Probar en ambas arquitecturas. |
| 8.6 | **Monitorear normativa SENIAT** | ⏳ | 🟡 Media | Ninguna | Cuando se publique nuevo reglamento de facturación electrónica, adaptar el sistema. |

### Detalle Técnico — Tasa de Cambio

**Migración 019 — Configuración de moneda:**
```sql
INSERT OR IGNORE INTO configuracion (clave, valor, descripcion) VALUES
  ('currency_symbol', '$', 'Símbolo de moneda mostrado en toda la App'),
  ('exchange_rate', '0.00', 'Tasa de cambio: 0.00 = 1:1 con USD. Ej: 800 = 800 Bs/$'),
  ('currency_name', 'USD', 'Nombre de la moneda (USD, Bs, EUR, etc.)');
```

**Implementación:**
- ConfigPage: nuevo tab "Moneda" con campos: Símbolo, Tasa de Cambio, Nombre
- Crear servicio `currency.ts` que lee la config y expone `formatMoney(amount)` con el símbolo correcto
- Reemplazar todos los `$` hardcoded por la función `formatMoney()`
- Dashboard, POS, Ventas, Caja, Reportes, Cotizaciones: todos usan la misma función

---

## ⏳ FASE 9: TOG ADMIN ADAPTABLE — PENDIENTE

*Objetivo: Expandir TOG Admin para soportar múltiples tipos de negocio con la premisa de que el sistema se adapta al cliente.*

### Concepto

TOG Admin debe funcionar como una **plataforma configurable** donde cada cliente activa los módulos que necesita:

| Módulo | Negocios que lo necesitan | Estado actual |
|--------|--------------------------|---------------|
| POS / Venta | Todos | ✅ Implementado |
| Inventario | Todos | ✅ Implementado |
| Caja | Todos | ✅ Implementado |
| Compras / Proveedores | Tiendas, ferreterías, papelerías | ✅ Implementado |
| Cotizaciones | Imprentas, papelerías, servicios | ✅ Implementado |
| Reportes | Todos | ✅ Implementado |
| **Servicios** (copiado, impresión, etc.) | Papelerías, centros de copiado | ❌ Pendiente (Fase 5) |
| **Combos / Paquetes** | Tiendas, restaurantes | ❌ Pendiente (Fase 6) |
| **Multi-sucursal** | Negocios con varias ubicaciones | ❌ Pendiente (Fase 7) |
| **Facturación fiscal** | Todos (Venezuela) | ❌ Pendiente (Fase 8) |
| **Pantalla auxiliar** | Papelerías, tiendas | ❌ Pendiente |

### Tareas Pendientes

| # | Tarea | Estado | Prioridad |
|---|-------|--------|-----------|
| 9.1 | **Pantalla auxiliar para clientes** | ⏳ | 🟢 Baja |
| 9.2 | **Configuración de módulos por cliente** | ⏳ | 🟡 Media |
| 9.3 | **Templates de negocio predefinidos** | ⏳ | 🟡 Media |
| 9.4 | **Personalización de categorías por industria** | ⏳ | 🟡 Media |

### Detalle: Pantalla Auxiliar

**Objetivo:** Segunda ventana de Electron que muestra en tiempo real los productos agregados al carrito y el total. El cliente ve su compra mientras el cajero la procesa.

**Enfoque Técnico:**
1. Crear una nueva ventana de Electron (sin controles de ventana, a pantalla completa) en un monitor secundario
2. Comunicación IPC con el proceso principal para recibir actualizaciones del carrito
3. Interfaz atractiva y minimalista para que el cliente vea su compra

---

## ⏳ FASE 10: MARKETING / LANDING — PENDIENTE

*Referencia: benchmarkin-Integra-POS.md*

| # | Tarea | Estado | Origen |
|---|-------|--------|--------|
| M1 | Video demostrativo de 1-2 min para landing | ⏳ | Benchmarking §3.1 |
| M2 | Testimonios de clientes reales | ⏳ | Benchmarking §3.1 |
| M3 | Tutorial en video + casos de éxito | ⏳ | Benchmarking §5 |
| M4 | Landing page profesional | ⏳ | Benchmarking §3.1 |
| M5 | Estrategia de precios (soporte, instalación, personalización) | ⏳ | Benchmarking §3.1 |

---

## 🔒 SEGURIDAD ADICIONAL (post-V2) — PENDIENTE

| # | Tarea | Estado | Prioridad |
|---|-------|--------|-----------|
| S1 | Implementar CSP headers (meta tag) | ⏳ | 🟢 Baja |
| S2 | Validar origen en IPC handlers (webContents.getURL) | ⏳ | 🟢 Baja |

---

## 🟡 RECOMENDACIONES V3 — MIGRADAS

| # | Tarea | Estado | Origen |
|---|-------|--------|--------|
| V3.1 | Cobertura de tests al 80% (actualmente 112 tests, V3 P0#1) | ⏳ | V3 P0 #1 |
| V3.2 | Logging estructurado (winston en main, V3 P0#2) | ⏳ | V3 P0 #2 |
| V3.3 | Optimizar queries SQL — cache de productos (V3 P0#3) | ⏳ | V3 P0 #3 |
| V3.4 | Integration tests (V3 P1#6) | ⏳ | V3 P1 #6 |
| V3.5 | Expansión multi-plataforma (Mac/Linux, V3 P1#4) | ⏳ | V3 P1 #4 |

### Detalle Técnico

**V3.2 — Logging estructurado (winston):**
```typescript
// src/main/services/logger.ts
import winston from 'winston'

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
})
```
**Esfuerzo estimado:** 1 semana · **Impacto:** Alta trazabilidad de errores.

**V3.3 — Cache de productos:**
Cachear `productos:list` con invalidación en `productos:create/update/delete` y en handlers de stock (ventas, compras, ajustes). Migración simple desde `configCache.ts` (ya implementado).

**V3.4 — Integration tests:**
Tests end-to-end con better-sqlite3 in-memory para flujos completos (login → venta → cierre caja → backup).

---

## Hitos de Decisión

| Hito | Cuándo | Estado |
|------|--------|--------|
| ✅ MVP funcional | Semana 4 | Completado |
| ✅ Core features | Semana 8 | Completado |
| ✅ Seguridad cerrada | Fase 0 | Completado |
| ✅ Integración VP800 | Fase 2 | Completado |
| ✅ Sistema de licencias | Fase 2 | Completado |
| ✅ Help + Tutorial | Fase 2 | Completado |
| ✅ Terminal Config UI | Fase 2 | Completado |
| ✅ P0 + P1 + P2 features | Fase 2.5 | Completado |
| ✅ Instalador NSIS | Empaquetado | Completado |
| ✅ Auto-update system | Fase 4 | Completado |
| ✅ i18n completo | Fase 4 | Completado |
| ✅ UI/UX polish | Fase 4 | Completado |
| ✅ Lector códigos de barras (USB HID) | Fase 3.7 | Completado |
| ✅ Sistema de permisos por usuario | 30-Ago-2026 | Completado |
| ✅ i18n completo (todos los componentes) | 30-Ago-2026 | Completado |
| ✅ Métodos de pago configurables | 01-Sep-2026 | Completado |
| ⏳ Productos vs Servicios | — | Pendiente |
| ⏳ Tasa de cambio + símbolo moneda | — | Pendiente |
| ⏳ Facturación fiscal Venezuela | — | Pendiente |
| ⏳ Multi-sucursal | — | Pendiente |

---

## Resumen de Estado (Verificado contra Código)

### ✅ Confirmado implementado (verificado en código fuente)

| Feature | Evidencia en código |
|---------|-------------------|
| Login + bcrypt + rate limiting | `ipc-handlers.ts`, `auth.store.ts` |
| Session timeout 30min | `auth.store.ts` |
| Zod validation (19 schemas) | `shared/validations.ts` |
| Descuentos (item + global) | `POSPage.tsx` |
| Precio editable en POS | `CartItem.tsx` |
| Venta rápida (servicio) | `POSPage.tsx` |
| Reporte X | `CajaPage.tsx` |
| CSV import/export | `InventarioPage.tsx` |
| Backup/Restore | `ipc-handlers.ts` |
| VP800 integration (serial) | `services/valorTerminal.ts` |
| Licencias RSA-2048 | `services/license.ts` |
| Help page (12 secciones) | `HelpPage.tsx` |
| Tutorial (5 pasos) | `Tutorial.tsx` |
| Toast notifications | `Toast.tsx` |
| Barcode scanner (USB HID) | `hooks/useBarcodeScanner.ts` |
| Permisos (35 permisos, 7 categorías) | `shared/permissions.ts` |
| i18n (~1,277 keys por idioma, ES/EN) | `i18n/locales/` |
| Auto-update (electron-updater) | `services/updater.ts` |
| NSIS installer | `package.json` (build config) |
| ErrorBoundary + crash reports | `ErrorBoundary.tsx`, `services/crash-reporter.ts` |
| 112 tests | `*.test.ts`, `*.test.tsx` |
| Métodos de pago configurables | `database.ts` (migración 014), `ipc-handlers.ts` |

### ❌ NO implementado (confirmado ausente en código)

| Feature | Evidencia |
|---------|-----------|
| Tipo producto/servicio | Sin columna `tipo` en tabla `productos` |
| Subcategorías | Sin tabla `subcategorias` |
| Marca de producto | Sin columna `marca` en tabla `productos` |
| Imagen de producto | Solo campo `imagen` básico, sin gestión de archivos |
| Combos de productos | Sin tablas `combos`/`combo_products` |
| PDF export de cotizaciones | Sin librería PDF instalada |
| Modo touch | Sin implementación en POSPage |
| Venta a crédito/fiado | Sin tabla `creditos`/`cuentas_por_cobrar` |
| Tasa de cambio | Sin configuración de exchange rate |
| Símbolo moneda configurable | Solo `currency_symbol` en config (no global) |
| Pantalla auxiliar | Sin segunda ventana de Electron |
| Multi-sucursal | Arquitectura single-PC actual |
| CSV formato SENIAT | Sin implementación |
| Facturación fiscal | Sin implementación |
| Instalador X32/X64 | Solo NSIS x64 actual |
| WiFi VP800 | Solo serial/COM actual |
| Reportes avanzados (gráficas) | Solo recharts básico en ReportesPage |

---

## Riesgos

| Riesgo | Impacto | Estado |
|--------|---------|--------|
| Pérdida de datos sin backup | 🔴 Alto | ✅ Resuelto (Fase 0 + auto-backup) |
| Stock negativo por carrera | 🔴 Alto | ✅ Resuelto (Fase 0) |
| Acceso no autorizado | 🟡 Medio | ✅ Resuelto (Fase 2) |
| VP800 incompatible | 🟡 Medio | ✅ Implementado (Fase 2) |
| Licencias falsificadas | 🟡 Medio | ✅ RSA-2048 (Fase 2) |
| Pantalla blanca producción | 🔴 Alto | ✅ Resuelto (HashRouter + DOMContentLoaded) |
| Auto-update no funciona | 🟡 Medio | ✅ Resuelto (owner corregido) |
| Instalador sin icono | 🟡 Medio | ✅ Resuelto (icon.ico regenerado) |
| Normativa fiscal cambia | 🟡 Medio | ⏳ Pendiente (Fase 8) |
| Competencia aumenta | 🟡 Medio | ⏳ Pendiente (Fase 10) |

---

## Flujo de Despliegue (Desarrollador → Cliente)

```
1. Generar claves RSA (una vez)
   $ node scripts/generate-keys.js

2. Generar instalador
   $ npm run build:installer
   → release/TOG Admin Setup X.X.X.exe

3. Publicar release en GitHub
   $ git tag -a vX.X.X -m "vX.X.X"
   $ git push origin vX.X.X
   $ gh release create vX.X.X --repo betobeto00/tog-admin --title "TOG Admin vX.X.X" --notes "..."
   $ gh release upload vX.X.X "release/TOG Admin Setup X.X.X.exe" --repo betobeto00/tog-admin --clobber

4. Entregar al cliente el .exe del instalador

5. Cliente instala → Abre la app → Ve pantalla de bloqueo

6. Cliente te envía su Machine ID

7. Tú generas la licencia
   $ node scripts/generate-license.js "Cliente" "2027-08-28" "machine_id"

8. Envías license.key al cliente → Lo importa → Todo funciona ✅

9. A partir de ahí, el auto-update funciona para futuras versiones
```

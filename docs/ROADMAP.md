# Roadmap — TOG Admin

## Visión General (Actualizado: 30-Ago-2026)

```
FASE 0 ✅   FASE 1 ✅   FASE 2 ✅   FASE 2.5 ✅  FASE 2.7 ✅  FASE 2.8 ✅  FASE 3 (🟡)    FASE 4 ✅
CRÍTICOS    CORE        SEGURIDAD   P0+P1+P2     i18n        TESTS+ASSETS PREMIUM+BC    DEPLOY+AUTOUPDATE
             +UX
─────────   ─────────   ─────────   ──────────   ─────────   ─────────   ────────────   ─────────
✅ Stock    ✅ Zod      ✅ Timeout  ✅ Precio    ✅ ES/EN     ✅ Vitest    ⏳ Touch      ✅ Auto-update
✅ Backup   ✅ Dctos    ✅ Rate     ✅ Venta     ✅ 630+keys  ✅ 104 tests ⏳ Crédito    ✅ Hero-bg
✅ Passwd   ✅ Subcomp  ✅ VP800    ✅ Reporte X ✅ HelpPage  ✅ Favicons  ⏳ Etiquetas  ✅ Logo real
✅ Toast    ✅ Ajuste   ✅ License  ✅ CSV I/O   ✅ Config  ✅ jest-dom  ✅ **Barcode** ✅ Icono transparente
                         ✅ Help     ✅ Hist.Ajuste ✅ Tutorial ✅ jsdom    ⏳ VP800 WiFi  ✅ NSIS language fix
                         ✅ Alerts   ✅ Backup auto ✅ AllPages ✅ setup    ⏳ Adv Reports ✅ Release Notes
                         ✅ TermCfg  ✅ Printer/Fondo ✅ Backend  ✅ **Permisos**  ✅ Developer Guide
                                                         ✅ **i18n full**
```

**Estado actual del proyecto:** Fases 0, 1, 2, 2.5, 2.7, 2.8, 4 completadas — Fase 3 parcialmente completada (Barcode ✅, Permisos ✅, i18n full ✅, Touch ⏳, Crédito ⏳, Etiquetas ⏳)

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

## ✅ FASE 2.8: TESTS + ASSETS — COMPLETADA

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| 2.37 | Vitest configurado | ✅ | `vite.config.ts`, `package.json` |
| 2.38 | Tests de validaciones Zod (28 tests) | ✅ | `shared/validations.test.ts` |
| 2.39 | Favicon y apple-touch-icon en index.html | ✅ | `index.html` |
| 2.40 | Assets públicos (logo, hero-bg) en /public | ✅ | `public/` |

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

## 🟡 FASE 3: PREMIUM — PARCIALMENTE COMPLETADA

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| 3.1 | Modo touch | ⏳ | `POSPage.tsx` |
| 3.2 | Imprimir etiquetas | ⏳ | `InventarioPage.tsx` |
| 3.3 | Venta a crédito/fiado | ⏳ | `VentasPage.tsx` |
| 3.4 | Convertir quote a venta | ⏳ | `QuotesPage.tsx` |
| 3.5 | Reportes avanzados | ⏳ | `ReportesPage.tsx` |
| 3.6 | WiFi para VP800 | ⏳ | `services/valorTerminal.ts` |
| 3.7 | **Integración Lector Códigos de Barras (USB HID)** | ✅ | `hooks/useBarcodeScanner.ts`, `POSPage.tsx`, `ipc-handlers.ts`, `preload.ts` |

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

**IPC Handler (main):**
```typescript
// productos:buscar-por-codigo
// 1. Buscar por codigo_barras exacto
// 2. Fallback: buscar por SKU
// 3. Retornar producto o null
```

**Integración POS:**
- `useBarcodeScanner({ onScan: handleBarcodeScan, timeout: 50, enabled: true })`
- `handleBarcodeScan`: busca producto → si existe `addToCart()` + toast success
- Si no existe → setSearchQuery(barcode) + toast warning "Producto no encontrado"

**Estimación:** 4-5 horas (hook 1-2h, integración POS 1h, IPC/DB 0.5h, edge cases 1h, testing 0.5-1h)

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

### Resumen i18n

- **Antes:** ~500 keys, muchos strings hardcoded con `i18n.language === 'en'`
- **Ahora:** ~630 keys, todos los componentes usan `t()` calls
- **Archivos modificados:** 10 páginas + 2 locale files = 12 archivos

---

## ✅ SISTEMA DE PERMISOS — COMPLETADO (30-Ago-2026)

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| RP1 | Definición de 28 permisos en 7 categorías | ✅ | `src/shared/permissions.ts` |
| RP2 | Migración DB: campo `permisos` en tabla usuarios | ✅ | `src/main/db/database.ts` (migración 013) |
| RP3 | IPC handlers: `getPermissions` / `setPermissions` | ✅ | `src/main/ipc-handlers.ts` |
| RP4 | Preload API: `usuarios.getPermissions` / `setPermissions` | ✅ | `src/main/preload.ts` |
| RP5 | Hook `usePermissions` (has, hasAny, hasAll) | ✅ | `src/renderer/hooks/usePermissions.ts` |
| RP6 | Modal de permisos (toggles por categoría) | ✅ | `src/renderer/components/ui/PermissionsModal.tsx` |
| RP7 | Sidebar: ocultar módulos según permisos | ✅ | `src/renderer/components/layout/Sidebar.tsx` |
| RP8 | ConfigPage: proteger botones Backup/Reset/Usuarios | ✅ | `src/renderer/pages/ConfigPage.tsx` |
| RP9 | InventarioPage: proteger crear/editar/eliminar/ajustar | ✅ | `src/renderer/pages/InventarioPage.tsx` |
| RP10 | ComprasPage: proteger nueva compra | ✅ | `src/renderer/pages/ComprasPage.tsx` |
| RP11 | Empleada de prueba "maria" con permisos limitados | ✅ | `src/main/db/database.ts` (seed) |
| RP12 | Backend service: `getUserPermissions` / `checkPermission` | ✅ | `src/main/services/permissions.ts` |

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

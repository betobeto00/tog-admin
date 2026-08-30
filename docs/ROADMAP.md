# Roadmap — TOG Admin

## Visión General (Actualizado: 30-Ago-2026)

```
FASE 0 ✅   FASE 1 ✅   FASE 2 ✅   FASE 2.5 ✅  FASE 2.7 ✅  FASE 2.8 ✅  FASE 3 ✅   FASE 4 ✅
CRÍTICOS    CORE        SEGURIDAD   P0+P1+P2     i18n        TESTS+ASSETS PREMIUM    DEPLOY+AUTOUPDATE
            +UX
─────────   ─────────   ─────────   ──────────   ─────────   ─────────   ─────────   ─────────
✅ Stock    ✅ Zod      ✅ Timeout  ✅ Precio    ✅ ES/EN     ✅ Vitest    ✅ Touch    ✅ Auto-update
✅ Backup   ✅ Dctos    ✅ Rate     ✅ Venta     ✅ 500+keys  ✅ 50 tests  ✅ Crédito  ✅ Hero-bg
✅ Passwd   ✅ Subcomp  ✅ VP800    ✅ Reporte X ✅ HelpPage  ✅ Favicons  ✅ Etiquetas ✅ Logo real
✅ Toast    ✅ Dash     ✅ License  ✅ CSV I/O   ✅ POSPage   ✅ public/   ✅ Quotes→Venta ✅ Icono transparente
            ✅ Ajuste   ✅ Help     ✅ Hist.Ajuste ✅ Config  ✅ jest-dom  ✅ Cat Reports ✅ i18n fixes
                        ✅ Tutorial ✅ Stock Bajo ✅ Tutorial ✅ jsdom                     ✅ NSIS language fix
                        ✅ Alerts   ✅ Backup auto ✅ AllPages ✅ setup                     ✅ Release Notes
                        ✅ TermCfg  ✅ Printer/Fondo ✅ Backend                             ✅ Developer Guide
```

**Estado actual del proyecto:** 100% completo (Fase 0, 1, 2, 2.5, 2.7, 2.8, 3 y 4 completadas)

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

## ✅ FASE 3: PREMIUM — COMPLETADA

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| 3.1 | Modo touch | ✅ | `POSPage.tsx` |
| 3.2 | Imprimir etiquetas | ✅ | `InventarioPage.tsx` |
| 3.3 | Venta a crédito/fiado | ✅ | `VentasPage.tsx` |
| 3.4 | Convertir quote a venta | ✅ | `QuotesPage.tsx` |
| 3.5 | Reportes avanzados | ✅ | `ReportesPage.tsx` |
| 3.6 | WiFi para VP800 | ✅ | `services/valorTerminal.ts` |

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

# Roadmap — TOG Admin

## Visión General (Actualizado: 28-Ago-2026)

```
FASE 0 ✅   FASE 1 ✅   FASE 2 ✅   FASE 2.5 ✅  FASE 2.7 ✅  FASE 2.8 ✅  FASE 3 🟡
CRÍTICOS    CORE        SEGURIDAD   P0+P1+P2     i18n        TESTS+ASSETS PREMIUM
            +UX
─────────   ─────────   ─────────   ──────────   ─────────   ─────────   ─────────
✅ Stock    ✅ Zod      ✅ Timeout  ✅ Precio    ✅ ES/EN     ✅ Vitest    🟡 Touch
✅ Backup   ✅ Dctos    ✅ Rate     ✅ Venta     ✅ 500+keys  ✅ 50 tests  🟡 Crédito
✅ Passwd   ✅ Subcomp  ✅ VP800    ✅ Reporte X ✅ HelpPage  ✅ Favicons  ✅ Etiquetas
✅ Toast    ✅ Dash     ✅ License  ✅ CSV I/O   ✅ POSPage   ✅ public/   🟡 Quotes→Venta
            ✅ Ajuste   ✅ Help     ✅ Hist.Ajuste ✅ Config   ✅ jest-dom  🟡 Cat Reports
                        ✅ Tutorial ✅ Stock Bajo ✅ Tutorial ✅ jsdom
                        ✅ Alerts   ✅ Backup auto ✅ AllPages ✅ setup
                        ✅ TermCfg  ✅ Printer/Fondo ✅ Backend
```

**Estado actual del proyecto:** ~98% completo (Fase 0, 1, 2, 2.5, 2.7 y 2.8 completadas)
**Estimación restante:** 2-3 días (Fase 3: Premium)

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

## ✅ EMPAQUETADO: INSTALADOR NSIS — CONFIGURADO

| # | Tarea | Estado | Archivos |
|---|-------|--------|----------|
| E1 | Configurar electron-builder NSIS | ✅ | `package.json` (build:installer) |
| E2 | Instalador con acceso directo | ✅ | Escritorio + Menú Inicio |
| E3 | Idioma español | ✅ | NSIS languages config |
| E4 | Desinstalador | ✅ | Panel de Control |
| E5 | Matar procesos pre/post install | ✅ | taskkill automático |

**Comando para generar el instalador:**
```bash
npm run build:installer
# → Genera release/TOG-Admin-Setup-1.0.0.exe
```

---

## 🟡 FASE 3: PREMIUM — PENDIENTE

> **Objetivo:** Features avanzadas para competitividad.

### Tarea 3.1: Modo touch 🟢
- [ ] Botones grandes para pantalla táctil
- [ ] Layout adaptado para tablets

### Tarea 3.2: Imprimir etiquetas 🟢
- [ ] Generar etiquetas con código de barras (JsBarcode)

### Tarea 3.3: Venta a crédito/fiado 🟡
- [ ] Tabla `creditos` con saldo pendiente
- [ ] Registro de abonos
- [ ] Reporte de cartera

### Tarea 3.4: Convertir quote a venta 🟡
- [ ] Botón "Convertir a venta" en QuotesPage
- [ ] Pre-cargar carrito con items de la cotización

### Tarea 3.5: Reportes avanzados 🟡
- [x] Ventas por categoría ✅
- [ ] Margen de ganancia real vs esperada

### Tarea 3.6: WiFi para VP800 🟡
- [ ] Conexión via HTTP API (Valor Connect)
- [ ] Fallback automático USB → WiFi

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
| ✅ Instalador NSIS | Empaquetado | Configurado |
| 🟡 Beta producción | Fase 3 | Pendiente |

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

---

## Flujo de Despliegue (Desarrollador → Cliente)

```
1. Generar claves RSA (una vez)
   $ node scripts/generate-keys.js

2. Generar instalador
   $ npm run build:installer
   → release/TOG-Admin-Setup-1.0.0.exe

3. Entregar al cliente el .exe del instalador

4. Cliente instala → Abre la app → Ve pantalla de bloqueo

5. Cliente te envía su Machine ID

6. Tú generas la licencia
   $ node scripts/generate-license.js "Cliente" "2027-08-28" "machine_id"

7. Envías license.key al cliente → Lo importa → Todo funciona ✅
```

---

## Archivos Clave del Proyecto

```
src/
├── main/
│   ├── index.ts              # Entry point Electron
│   ├── preload.ts            # API segura IPC (contextBridge)
│   ├── ipc-handlers.ts       # ✅ 40+ canales IPC
│   ├── db/
│   │   ├── database.ts       # SQLite + 13 migraciones + seeds
│   │   └── migrate.ts        # Script standalone de migración
│   └── services/
│       ├── valorTerminal.ts  # ✅ Servicio VP800 (USB serial)
│       └── license.ts        # ✅ Validación licencias RSA-2048
├── renderer/
│   ├── App.tsx               # ✅ HashRouter + LicenseGate
│   ├── pages/                # 12 páginas
│   ├── components/
│   │   ├── layout/           # Header (notificaciones) + Sidebar
│   │   ├── ui/               # Modal, ConfirmDialog, Toast
│   │   ├── pos/CartItem.tsx  # ✅ Precio editable + descuento
│   │   ├── ErrorBoundary.tsx
│   │   ├── LicenseGate.tsx
│   │   ├── Tutorial.tsx
│   │   └── ForcePasswordChange.tsx
│   ├── stores/auth.store.ts  # ✅ Session timeout
│   └── lib/utils.ts
├── shared/
│   ├── types.ts
│   └── validations.ts        # 19 schemas Zod
├── scripts/
│   ├── generate-keys.js      # Generador claves RSA
│   ├── generate-license.js   # Generador licencias
│   └── inline-css.js         # Build: CSS inline
├── keys/
│   ├── private.key           # 🔴 SECRETA
│   └── public.key            # 🟢 Embebida en el .exe
├── docs/
│   ├── LICENCIAMIENTO.md     # Guía completa de licencias
│   ├── ROADMAP.md            # Este archivo
│   ├── FEATURES.md
│   ├── ARCHITECTURE.md
│   ├── TECH_STACK.md
│   ├── KNOWLEDGE.md
│   └── DATA_MODEL.md
└── packaging/
    └── installer.iss         # Script Inno Setup (alternativo)
```

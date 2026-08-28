# Roadmap — TOG Admin

## Visión General (Actualizado: 28-Ago-2026)

```
FASE 0 ✅          FASE 1 ✅          FASE 2 ✅          FASE 3
CRÍTICOS           CORE               SEGURIDAD/UX       PREMIUM
(2-3 días)         (2-3 días)         (2-3 días)         (3-4 días)
─────────────      ─────────────      ─────────────      ─────────────
✅ Stock valid     ✅ Zod validation  ✅ Session timeout  🟡 Modo touch
✅ Backup/Restore  ✅ Descuentos POS  ✅ Rate limiting    🟡 Crédito/Fiado
✅ Password change ✅ Subcomponentes  ✅ Lazy loading     🟡 Import/Export
✅ Toast system    ✅ Dashboard+      ✅ VP800 terminal   🟡 Labels print
                   ✅ Ajuste invent.  ✅ Cierre print
```

**Estado actual del proyecto:** ~85% completo (Fase 0, 1 y 2 completadas)
**Estimación restante:** 3-4 días (Fase 3: Premium)

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
| 2.3 | Lazy loading de rutas | ✅ | `App.tsx` (React.lazy + Suspense) |
| 2.4 | Integración Terminal VP800 | ✅ | `services/valorTerminal.ts`, `ipc-handlers.ts`, `preload.ts` |
| 2.5 | Impresión de cierre de caja | ✅ | `CajaPage.tsx` |

---

## 🟡 FASE 3: PREMIUM — PENDIENTE

> **Objetivo:** Features avanzadas para competitividad.

### Tarea 3.1: Modo touch 🟢
- [ ] Botones grandes para pantalla táctil
- [ ] Layout adaptado para tablets
- **Archivos:** `src/renderer/pages/POSPage.tsx`

### Tarea 3.2: Import/Export productos 🟡
- [ ] Exportar inventario a CSV
- [ ] Importar productos desde CSV con validación
- **Archivos:** `src/renderer/pages/InventarioPage.tsx`, `src/main/ipc-handlers.ts`

### Tarea 3.3: Imprimir etiquetas 🟢
- [ ] Generar etiquetas con código de barras
- [ ] Usar librería JsBarcode o similar
- **Archivos:** Nuevos componentes

### Tarea 3.4: Venta a crédito/fiado 🟡
- [ ] Tabla `creditos` con saldo pendiente
- [ ] Registrar venta sin cobro inmediato
- [ ] Registro de abonos
- [ ] Reporte de cartera
- **Archivos:** Múltiples nuevos archivos

### Tarea 3.5: Convertir quote a venta 🟡
- [ ] Botón "Convertir a venta" en QuotesPage
- [ ] Pre-cargar carrito con items de la cotización
- **Archivos:** `src/renderer/pages/QuotesPage.tsx`, `src/renderer/pages/POSPage.tsx`

### Tarea 3.6: Reportes avanzados 🟡
- [ ] Ventas por categoría
- [ ] Margen de ganancia real vs esperada
- [ ] Exportar reportes a PDF/CSV
- **Archivos:** `src/renderer/pages/ReportesPage.tsx`, `src/main/ipc-handlers.ts`

---

## Hitos de Decisión

| Hito | Cuándo | Estado |
|------|--------|--------|
| ✅ MVP funcional | Semana 4 | Completado |
| ✅ Core features | Semana 8 | Completado |
| ✅ Seguridad cerrada | Fase 0 | Completado |
| ✅ Integración VP800 | Fase 2 | Completado |
| 🟡 Beta producción | Fase 3 | Pendiente |

---

## Riesgos

| Riesgo | Impacto | Estado |
|--------|---------|--------|
| Pérdida de datos sin backup | 🔴 Alto | ✅ Resuelto (Fase 0) |
| Stock negativo por carrera | 🔴 Alto | ✅ Resuelto (Fase 0) |
| Acceso no autorizado | 🟡 Medio | ✅ Resuelto (Fase 2) |
| VP800 incompatible | 🟡 Medio | ✅ Implementado (Fase 2) |
| Componentes muy grandes | 🟡 Medio | ✅ Parcialmente resuelto (Fase 1) |

---

## Archivos Clave del Proyecto

```
src/
├── main/
│   ├── index.ts              # Entry point Electron
│   ├── preload.ts            # API segura IPC (contextBridge)
│   ├── ipc-handlers.ts       # ✅ Todos los handlers IPC
│   ├── db/
│   │   ├── database.ts       # SQLite + 12 migraciones + seeds
│   │   └── migrate.ts        # Script standalone de migración
│   └── services/
│       └── valorTerminal.ts  # ✅ Servicio VP800
├── renderer/
│   ├── App.tsx               # ✅ Router + lazy loading + toast
│   ├── pages/
│   │   ├── POSPage.tsx       # ✅ Con descuentos por item/global
│   │   ├── InventarioPage.tsx # ✅ Con ajuste de inventario
│   │   ├── DashboardPage.tsx  # ✅ Con últimas ventas
│   │   ├── VentasPage.tsx
│   │   ├── CajaPage.tsx      # ✅ Con impresión de cierre
│   │   ├── ComprasPage.tsx
│   │   ├── ProveedoresPage.tsx
│   │   ├── ReportesPage.tsx
│   │   ├── QuotesPage.tsx
│   │   ├── ConfigPage.tsx    # ✅ Con backup/restore
│   │   └── LoginPage.tsx
│   ├── components/
│   │   ├── layout/
│   │   ├── ui/               # Modal, ConfirmDialog, Toast
│   │   └── pos/              # ✅ CartItem (extraído)
│   ├── stores/
│   │   └── auth.store.ts     # ✅ Con session timeout
│   └── lib/
│       └── utils.ts
├── shared/
│   ├── types.ts              # ✅ Tipos completos
│   └── validations.ts        # ✅ Schemas Zod
```

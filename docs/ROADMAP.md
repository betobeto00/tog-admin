# Roadmap — TOG Admin

## Visión General (Actualizado: 28-Ago-2026)

```
FASE 0               FASE 1               FASE 2              FASE 3
CRÍTICOS             CORE                 SEGURIDAD/UX        PREMIUM
(2-3 días)           (2-3 días)           (2-3 días)          (3-4 días)
─────────────        ─────────────        ─────────────       ─────────────
🔴 Stock negativo    🔴 Toast system      🔴 Session timeout  🟡 Modo touch
🔴 Backup/Restore    🔴 Zod validation    🔴 Lazy loading     🟡 Crédito/Fiado
🔴 Password admin    🔴 Extract components 🔴 Rate limiting    🟡 Import/Export
                     🔴 Dashboard+        🔴 VP800 terminal   🟡 Labels print
```

**Estado actual del proyecto:** ~75% completo (Fase 1 y 2 del roadmap original completadas)
**Estimación restante:** 8-12 días de desarrollo

---

## Estado Real Verificado (Auditoría 28-Ago-2026)

### ✅ Lo que SÍ funciona correctamente
- Arquitectura Electron + React + TypeScript + SQLite ✅
- Autenticación con bcrypt, roles admin/cajero ✅
- IPC con contextIsolation + contextBridge ✅
- 10 migraciones SQLite con WAL mode + foreign keys ✅
- POS: carrito, búsqueda, métodos de pago, cambio, ticket ✅
- Inventario: CRUD completo, categorías, unidades de medida ✅
- Caja: apertura, cierre, movimientos, historial ✅
- Ventas: lista, detalle, anulación, re-impresión ✅
- Compras: registro, proveedor, auto-actualización stock ✅
- Proveedores: CRUD completo con tarjetas ✅
- Reportes: gráficos (líneas, barras, pie), tarjetas resumen ✅
- Cotizaciones: CRUD, estados, impresión ✅
- Configuración: negocio, usuarios, tax, moneda ✅
- Transacciones DB en ventas ✅ (auditoría decía FALSO)
- Build automatizado con Inno Setup ✅

### 🔴 Lo que está roto o CRÍTICO
| # | Bug | Ubicación | Descripción |
|---|-----|-----------|-------------|
| 1 | **Stock negativo posible** | `ipc-handlers.ts:ventas:create` | No valida stock suficiente antes de venta |
| 2 | **Backup NO funciona** | `ipc-handlers.ts` | Canales expuestos en preload pero sin handlers |
| 3 | **Password admin123 débil** | `database.ts:seedDatabase` | Sin obligar cambio al primer login |
| 4 | **alert() genéricos** | Múltiples páginas | UX horrible para errores |
| 5 | **Sin validación Zod** | Todos los forms | React Hook Form + Zod instalados, cero uso |

### ⚠️ Deuda Técnica Importante
| # | Item | Prioridad | Esfuerzo |
|---|------|-----------|----------|
| 1 | Extraer subcomponentes (POSPage 470 líneas, InventarioPage 440 líneas) | 🟡 | 2 días |
| 2 | Lazy loading de rutas | 🟡 | 0.5 días |
| 3 | Dashboard con últimas ventas | 🟡 | 0.5 días |
| 4 | Descuentos en POS (por item + global) | 🟡 | 2 días |
| 5 | Ajuste manual de inventario | 🟡 | 1 día |
| 6 | Timeout de sesión por inactividad | 🟡 | 0.5 días |
| 7 | Rate limiting en login | 🟡 | 0.5 días |

### 📋 Features P0 no implementadas
| # | Feature | Descripción |
|---|---------|-------------|
| 1 | Precio unitario editable en POS | Cambiar precio al vender |
| 2 | Descuento por item | Descuento individual por línea |
| 3 | Descuento global | Descuento sobre el total |
| 4 | Venta rápida sin producto | Ingreso manual de monto (servicios) |
| 5 | Ajuste de inventario | Corregir stock manualmente con justificación |
| 6 | Últimas ventas en Dashboard | Lista de las últimas ventas |
| 7 | Backup manual/restore | Crear y restaurar copias de seguridad |

---

## FASE 0: CRÍTICOS DE SEGURIDAD (Días 1-2)

> **Objetivo:** Cerrar agujeros de seguridad y datos que pueden causar pérdida de información.

### Tarea 0.1: Validación de stock en ventas 🔴
- [ ] Agregar validación en `ipc-handlers.ts:ventas:create`
- [ ] Antes de insertar, verificar que `stock >= cantidad` para cada producto
- [ ] Retornar error descriptivo si stock insuficiente
- **Archivo:** `src/main/ipc-handlers.ts`

### Tarea 0.2: Implementar Backup/Restore 🔴
- [ ] Implementar handler `backup:create` en ipc-handlers.ts
- [ ] Implementar handler `backup:restore` en ipc-handlers.ts
- [ ] Usar `dialog.showSaveDialog` / `dialog.showOpenDialog` de Electron
- [ ] Copiar archivo SQLite (.db) a ruta seleccionada
- [ ] Para restore: cerrar DB, copiar archivo, reiniciar DB
- [ ] Actualizar ConfigPage.tsx con botones de backup/restore
- **Archivos:** `src/main/ipc-handlers.ts`, `src/renderer/pages/ConfigPage.tsx`

### Tarea 0.3: Cambiar password admin y obligar cambio 🔴
- [ ] Agregar campo `debe_cambiar_contrasena` en tabla usuarios (migración 011)
- [ ] Seed: admin123 → forzar cambio en primer login
- [ ] Mostrar modal de cambio de contraseña si `debe_cambiar_contrasena = 1`
- **Archivos:** `src/main/db/database.ts`, `src/main/ipc-handlers.ts`, `src/renderer/pages/ConfigPage.tsx`

### Tarea 0.4: Sistema de Notificaciones Toast 🔴
- [ ] Instalar `react-hot-toast` (o similar ligero)
- [ ] Crear componente toast global en App.tsx
- [ ] Reemplazar todos los `alert()` por toast.success/error/warning
- [ ] Agregar feedback visual para todas las operaciones CRUD
- **Archivos:** `src/renderer/App.tsx`, múltiples páginas

---

## FASE 1: CORE COMPLETADO (Días 3-5)

> **Objetivo:** Completar features P0 faltantes y mejorar UX.

### Tarea 1.1: Validación Zod en IPC handlers 🔴
- [ ] Crear schemas de validación en `src/shared/validations.ts`
- [ ] Aplicar en handlers: productos, usuarios, ventas, compras
- [ ] Validar tipos, longitudes, rangos numéricos
- [ ] Retornar errores claros al frontend
- **Archivos:** `src/shared/validations.ts` (nuevo), `src/main/ipc-handlers.ts`

### Tarea 1.2: Descuentos en POS 🔴
- [ ] Descuento por línea (por item en el carrito)
- [ ] Descuento global (sobre subtotal)
- [ ] Campo descuento en UI del POS
- [ ] Guardar descuento en venta_detalles y ventas
- **Archivos:** `src/renderer/pages/POSPage.tsx`, `src/main/ipc-handlers.ts`

### Tarea 1.3: Extraer subcomponentes 🟡
- [ ] POSPage → `Cart.tsx`, `ProductSearch.tsx`, `PaymentModal.tsx`, `TicketModal.tsx`
- [ ] InventarioPage → `ProductTable.tsx`, `ProductModal.tsx`, `CategoryPanel.tsx`, `UnitPanel.tsx`
- [ ] VentasPage → `SalesTable.tsx`, `SaleDetailModal.tsx`, `AnularModal.tsx`
- **Archivos:** `src/renderer/components/` (nuevos subdirectorios)

### Tarea 1.4: Dashboard mejorado 🟡
- [ ] Agregar tabla de últimas 10 ventas
- [ ] Agregar "Productos más vendidos hoy"
- [ ] Agregar comparative con ayer (ventas hoy vs ayer)
- **Archivos:** `src/renderer/pages/DashboardPage.tsx`, `src/main/ipc-handlers.ts`

### Tarea 1.5: Ajuste manual de inventario 🟡
- [ ] Modal para ajustar stock con justificación obligatoria
- [ ] Historial de ajustes de inventario
- [ ] Tabla `ajustes_inventario` (migración 012)
- **Archivos:** `src/renderer/pages/InventarioPage.tsx`, `src/main/ipc-handlers.ts`, `src/main/db/database.ts`

---

## FASE 2: SEGURIDAD + UX (Días 6-8)

> **Objetivo:** Hacer la app segura y profesional para producción.

### Tarea 2.1: Session timeout 🔴
- [ ] Configurar timeout de 30 minutos por inactividad
- [ ] Detectar actividad del mouse/teclado en renderer
- [ ] Notificar al usuario antes de cerrar sesión
- [ ] Auto-logout después del timeout
- **Archivos:** `src/renderer/stores/auth.store.ts`, `src/renderer/App.tsx`

### Tarea 2.2: Rate limiting en login 🔴
- [ ] Almacenar intentos fallidos en memoria (Map)
- [ ] Bloquear después de 5 intentos fallidos por 15 minutos
- [ ] Mostrar mensaje claro al usuario
- **Archivos:** `src/main/ipc-handlers.ts`

### Tarea 2.3: Lazy loading de rutas 🟡
- [ ] Usar `React.lazy()` para todas las páginas
- [ ] Envolver en `<Suspense>` con loading spinner
- [ ] Mejorar tiempo de carga inicial
- **Archivos:** `src/renderer/App.tsx`

### Tarea 2.4: Integración Terminal VP800 🟡
- [ ] Instalar `serialport` para comunicación USB
- [ ] Crear servicio `src/main/services/valorTerminal.ts`
- [ ] Implementar conexión por puerto COM
- [ ] Implementar envío de cobro y recepción de respuesta
- [ ] Registrar handlers IPC: `terminal:conectar`, `terminal:procesar-pago`
- [ ] Exponer canales en preload.ts
- [ ] Agregar opción "Tarjeta (VP800)" en modal de cobro del POS
- [ ] Agregar configuración de puerto COM en ConfigPage
- **Archivos:** `src/main/services/valorTerminal.ts` (nuevo), `src/main/ipc-handlers.ts`, `src/main/preload.ts`, `src/renderer/pages/POSPage.tsx`, `src/renderer/pages/ConfigPage.tsx`

### Tarea 2.5: Impresión de cierre de caja 🟡
- [ ] Generar HTML de cierre con detalle de movimientos
- [ ] Botón "Imprimir cierre" en CajaPage
- **Archivos:** `src/renderer/pages/CajaPage.tsx`

---

## FASE 3: PREMIUM (Días 9-12)

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

| Hito | Cuándo | Decisión |
|------|--------|---------|
| ✅ MVP funcional | Semana 4 | El sistema ya puede vender y operar |
| ✅ Core features | Semana 8 | Sistema completo para operación diaria |
| 🔴 Seguridad cerrada | Fase 0 | ¿Listo para datos reales sin riesgo? |
| 🔴 Integración VP800 | Fase 2 | ¿Terminal de pago funcionando? |
| 🟡 Beta producción | Fase 3 | ¿Listo para distribuir? |

---

## Riesgos

| Riesgo | Impacto | Mitigación |
|--------|---------|-----------|
| **Pérdida de datos sin backup** | 🔴 Alto | Fase 0: Implementar backup ANTES de todo |
| **Stock negativo por carrera** | 🔴 Alto | Fase 0: Validación server-side en ventas |
| **Acceso no autorizado** | 🟡 Medio | Fase 2: Timeout + rate limiting |
| **VP800 incompatible** | 🟡 Medio | Investigar protocolo antes de implementar |
| **Componentes muy grandes** | 🟡 Medio | Fase 1: Extracción de subcomponentes |
| **Rendimiento con muchos productos** | 🟢 Bajo | SQLite maneja miles sin problema |

---

## Archivos Clave del Proyecto

```
src/
├── main/
│   ├── index.ts              # Entry point Electron
│   ├── preload.ts            # API segura IPC (contextBridge)
│   ├── ipc-handlers.ts       # ⚠️ Handlers IPC (backup faltante)
│   ├── db/
│   │   ├── database.ts       # SQLite + migraciones + seeds
│   │   └── migrate.ts        # Script standalone de migración
│   └── services/
│       └── valorTerminal.ts  # 🔴 NUEVO: Servicio VP800
├── renderer/
│   ├── App.tsx               # Router + lazy loading
│   ├── pages/
│   │   ├── POSPage.tsx       # ⚠️ 470 líneas, necesita extracción
│   │   ├── InventarioPage.tsx # ⚠️ 440 líneas, necesita extracción
│   │   ├── VentasPage.tsx
│   │   ├── CajaPage.tsx
│   │   ├── ComprasPage.tsx
│   │   ├── ProveedoresPage.tsx
│   │   ├── ReportesPage.tsx
│   │   ├── QuotesPage.tsx
│   │   ├── ConfigPage.tsx    # ⚠️ Agregar backup/restore
│   │   ├── DashboardPage.tsx # ⚠️ Agregar últimas ventas
│   │   └── LoginPage.tsx
│   ├── components/
│   │   ├── layout/
│   │   └── ui/               # Modal, ConfirmDialog
│   ├── stores/
│   │   └── auth.store.ts     # ⚠️ Agregar session timeout
│   └── lib/
│       └── utils.ts
├── shared/
│   ├── types.ts              # ✅ Tipos completos
│   └── validations.ts        # 🔴 NUEVO: Schemas Zod
```

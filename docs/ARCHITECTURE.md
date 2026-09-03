# Arquitectura — TOG Admin

## Visión General

TOG Admin es una **plataforma POS adaptable** que se configura según la necesidad del cliente. Papelerías, ferreterías, farmacias, tiendas de ropa — el sistema se adapta al negocio, no al revés.

```
┌─────────────────────────────────────────────────────────────┐
│                      ELECTRON APP                           │
│                                                              │
│  ┌──────────────┐         ┌─────────────────────────────┐   │
│  │  MAIN PROCESS │◄───────►│      RENDERER PROCESS       │   │
│  │  (Node.js)    │  IPC    │      (React + Vite)         │   │
│  │               │         │                             │   │
│  │  • SQLite DB  │         │  • UI / Dashboard           │   │
│  │  • File I/O   │         │  • Punto de Venta           │   │
│  │  • Print      │         │  • Inventario               │   │
│  │  • Backup     │         │  • Reportes                 │   │
│  │  • VP800      │         │  • Configuración            │   │
│  │  • License    │         │  • Centro de Ayuda          │   │
│  └──────────────┘         └─────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              SQLite Database                         │    │
│  │         (tog-admin.db — archivo local)               │    │
│  │         14 migraciones · 16 tablas · 22+ índices     │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Capas de Arquitectura

### 1. Process Principal (Main Process)
**Responsabilidad:** Node.js puro, sin DOM.

| Módulo | Función |
|--------|---------|
| `index.ts` | Entry point, ventana principal, DevTools |
| `preload.ts` | API segura IPC (contextBridge) |
| `ipc-handlers.ts` | Registro central: delega en los `register*Handlers()` de cada módulo |
| `core/auth/` | Login (`auth-service.ts`) + permisos (`permissions.ts` → `checkPermissionOrFail`) |
| `modules/<modulo>/` | Handlers IPC por módulo: inventario, ventas, configuracion, caja-extra, license, distribuidor, terminal, crash-report, shared |
| `db/database.ts` | SQLite + migraciones + seeds |
| `services/valorTerminal.ts` | Comunicación serial VP800 (USB/COM) |
| `services/license.ts` | Validación licencias RSA-2048 |
| `services/crash-reporter.ts` | Sistema de reportes de error |
| `services/updater.ts` | Auto-actualizaciones vía GitHub (`update:*`) |
| `services/configCache.ts` | Cache de configuración |
| `i18n/` | Traducciones ES/EN para main process |

El **catálogo de permisos** vive en `src/shared/permissions.ts` (fuente única: `PERMISSIONS` + `ROLE_DEFAULTS`; el admin tiene todas las claves). Los canales IPC se tipan en `src/shared/ipc-channels.ts` (`IpcChannel` + `PREAUTH_CHANNELS`). Ya **no** existe `services/permissions.ts`: la lógica de autorización es `core/auth/permissions.ts` y se invoca desde cada handler con `checkPermissionOrFail(data, channel, permission)`.

### 2. Process de Renderizado (Renderer Process)
**Responsabilidad:** UI completamente en React.

```
Router (HashRouter)
├── /login              → LoginPage (con botones legales)
├── /                   → DashboardPage
├── /pos                → POSPage (precio editable + venta rápida + validación caja + barcode scanner)
├── /inventario         → InventarioPage (CSV import/export + ajustes + stock bajo + barcode scanner)
├── /ventas             → VentasPage
├── /caja               → CajaPage (Reporte X + backup automático)
├── /compras            → ComprasPage (barcode scanner)
├── /proveedores        → ProveedoresPage
├── /reportes           → ReportesPage (exportar CSV + PDF)
├── /cotizaciones       → QuotesPage
├── /configuracion      → ConfigPage (Terminal + Licencia + Impresora + Tutorial + Métodos de Pago)
└── /ayuda              → HelpPage (12 secciones)
```

### 3. Capa de Datos (SQLite)
**Responsabilidad:** Persistencia, integridad, respaldo.

- **Un solo archivo:** `tog-admin.db` en `%APPDATA%/tog-admin/`
- **Sin servidor:** No necesita MySQL ni nada externo
- **Respaldo:** Copiar el archivo `.db` = respaldo completo
- **Migraciones:** Sistema de versionado de esquema (14 migraciones)
- **WAL mode:** Permite lectura mientras escribe

### 4. Comunicación IPC
**Responsabilidad:** Puente seguro entre Main y Renderer.

```
Renderer (React)                    Main (Node.js)
     │                                    │
     │  window.api.ventas.create(data)    │
     │ ──────────────────────────────────► │
     │                                    │
     │  ipcMain.handle('ventas:create')   │
     │                                    │ Validar → Insertar DB → Responder
     │                                    │
     │  ◄────────────────────────────────── │
     │  { success: true, ventaId: 123 }   │
```

**Canales IPC completos:**

| Categoría | Canales |
|-----------|---------|
| Auth | `auth:login` |
| Usuarios | `usuarios:list`, `create`, `update`, `delete`, `change-password`, `getPermissions`, `setPermissions` |
| App | `app:version` |
| Productos | `productos:list`, `getById`, `create`, `update`, `delete`, `low-stock`, `ajustar`, `ajustes-historial`, `buscar-por-codigo`, `export-csv`, `import-csv` |
| Categorías | `categorias:list`, `create`, `update`, `delete` |
| Unidades | `unidades:list`, `create`, `update`, `delete` |
| Proveedores | `proveedores:list`, `create`, `update`, `delete` |
| Ventas | `ventas:list`, `getById`, `create`, `anular`, `resumen-dia` |
| Compras | `compras:list`, `create` |
| Caja | `caja:status`, `abrir`, `cerrar`, `movimiento`, `historial`, `reporte-x`, `backup-auto` |
| Quotes | `quotes:list`, `getById`, `create`, `update`, `delete` |
| Reportes | `reportes:ventas-periodo`, `productos-mas-vendidos`, `ultimas-ventas`, `ventas-por-categoria` |
| Config | `config:get`, `config:set` |
| Métodos de Pago | `metodos-pago:list`, `create`, `update`, `delete`, `procesar-tarjeta` |
| Backup / DB | `backup:create`, `backup:restore`, `db:reset` |
| Terminal | `terminal:conectar`, `desconectar`, `estado`, `procesar-pago` |
| Licencia | `license:status`, `validate`, `import`, `reset-state` |
| Crash Reports | `crash-report:save`, `list`, `read`, `delete`, `open-folder`, `path` |
| i18n | `i18n:get-lang`, `i18n:set-lang` |
| Updater | `update:check`, `download`, `install` |

> **Autorización:** salvo los canales de `PREAUTH_CHANNELS` (ver `src/shared/ipc-channels.ts`), cada handler exige sesión y permiso vía `checkPermissionOrFail`. El renderer inyecta `usuario_id` automáticamente por `callApi` (`src/renderer/lib/api-client.ts`) y lanza un error si el main devuelve `{ success: false }`.

---

## Modelo de Datos (14 Migraciones)

### Migraciones

| # | Migración | Tablas creadas/modificadas |
|---|-----------|---------------------------|
| 001 | usuarios | `usuarios` |
| 002 | categorias | `categorias` |
| 003 | productos | `productos` + 3 índices |
| 004 | proveedores | `proveedores` |
| 005 | ventas | `ventas`, `venta_detalles` + 4 índices |
| 006 | compras | `compras`, `compra_detalles` + 2 índices |
| 007 | caja | `caja`, `movimientos_caja` + 2 índices |
| 008 | configuracion | `configuracion` |
| 009 | unidades_medida | `unidades_medida` |
| 010 | quotes | `quotes`, `quote_detalles` + 3 índices |
| 011 | usuarios_debe_cambiar | `usuarios.debe_cambiar_contrasena` |
| 012 | ajustes_inventario | `ajustes_inventario` + 2 índices |
| 013 | usuario_permisos | `usuarios.permisos` |
| 014 | metodos_pago | `metodos_pago` |

### Tablas Principales

| Tabla | Registros típicos | Descripción |
|-------|-------------------|-------------|
| `usuarios` | 2-10 | Usuarios del sistema con roles y permisos |
| `productos` | 100-5000 | Inventario de productos |
| `categorias` | 5-50 | Categorías de productos |
| `unidades_medida` | 10-20 | Unidades de medida (seeded: ud, paq, cj, res, etc.) |
| `proveedores` | 5-30 | Proveedores del negocio |
| `ventas` | 100-10000 | Historial de ventas |
| `venta_detalles` | 500-50000 | Items de cada venta |
| `compras` | 10-500 | Historial de compras |
| `compra_detalles` | 50-2500 | Items de cada compra |
| `caja` | 50-500 | Sesiones de caja (apertura/cierre) |
| `movimientos_caja` | 100-5000 | Entradas/salidas de caja |
| `quotes` | 10-200 | Cotizaciones/presupuestos |
| `quote_detalles` | 50-1000 | Items de cada cotización |
| `configuracion` | 5-15 | Configuración del sistema |
| `ajustes_inventario` | 10-200 | Historial de ajustes de stock |
| `metodos_pago` | 2-10 | Métodos de pago configurables |

### Índices (22+)

Todos los índices están optimizados para los patrones de consulta típicos del POS.

---

## Componentes Clave del Renderer

| Componente | Archivo | Función |
|------------|---------|---------|
| `LicenseGate` | `LicenseGate.tsx` | Bloquea la app si no hay licencia válida |
| `ErrorBoundary` | `ErrorBoundary.tsx` | Captura errores React + genera reporte automático |
| `Tutorial` | `Tutorial.tsx` | Onboarding de 5 pasos para nuevos usuarios |
| `ForcePasswordChange` | `ForcePasswordChange.tsx` | Obliga cambio de contraseña en primer login |
| `Toast` | `ui/Toast.tsx` | Sistema de notificaciones |
| `CartItem` | `pos/CartItem.tsx` | Precio editable + descuento por item |
| `PermissionsModal` | `ui/PermissionsModal.tsx` | Gestión de permisos por usuario |
| `Layout` | `layout/Layout.tsx` | Sidebar + Header + Outlet |
| `Header` | `layout/Header.tsx` | Campana de notificaciones (stock bajo + caja) |
| `Sidebar` | `layout/Sidebar.tsx` | Navegación principal (oculta módulos según permisos) |

### Hooks

| Hook | Archivo | Función |
|------|---------|---------|
| `useBarcodeScanner` | `hooks/useBarcodeScanner.ts` | Captura global de escáner USB HID |
| `usePermissions` | `hooks/usePermissions.ts` | Verificación de permisos (has, hasAny, hasAll) |

---

## Seguridad

| Medida | Implementación |
|--------|---------------|
| Autenticación | Login con usuario + contraseña (bcrypt hash, 10 salt rounds) |
| Rate limiting | 5 intentos fallidos → lockout 15 min |
| Session timeout | 30 min de inactividad → auto-logout |
| Context isolation | `contextIsolation: true`, `nodeIntegration: false` |
| contextBridge | API expuesta de forma controlada y tipada |
| Validación IPC | 19 schemas Zod en handlers críticos |
| Licencias | RSA-2048 con validación offline |
| Error handling | ErrorBoundary global + crash reports + logging diagnóstico |
| Internacionalización | i18n con 2 idiomas (ES/EN), ~1,277 keys por idioma |
| Backup automático | Al cerrar caja se crea backup de la DB |
| Permisos | 35 permisos en 7 categorías, control granular por usuario |

---

## Flujo Principal: Venta

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Cliente  │───►│  Caja    │───►│  Pago    │───►│  Ticket  │
│  llega    │    │  abre    │    │  cobra   │    │  imprime │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │                │                │
                     ▼                ▼                ▼
               ┌──────────┐    ┌──────────┐    ┌──────────┐
               │  Agrega  │    │  Registra│    │  Descuenta│
               │  items   │    │  venta   │    │  stock   │
               └──────────┘    └──────────┘    └──────────┘
```

**Pasos detallados:**

1. **Abrir caja** → Se registra el fondo de caja inicial (con default configurable)
2. **Escanear/buscar producto** → Se agrega al carrito (USB HID barcode scanner)
3. **Cantidad / Precio** → Precio editable directamente en el carrito
4. **Venta rápida** → Botón para servicios por cobrar sin crear producto
5. **Confirmar venta** → Se inserta en tabla `ventas` + `venta_detalles`
6. **Pago** → Efectivo, transferencia, pago móvil, tarjeta (VP800), mixto (configurable)
7. **Descuento de stock** → Se actualiza `productos.stock` (solo para productos, no servicios)
8. **Imprimir ticket** → Se genera y envía a impresora
9. **Reporte X** → Ver totales parciales sin cerrar caja
10. **Cierre de caja** → Backup automático + totalización del día

---

## Despliegue

```
Desarrollo:
  npm run dev  →  Vite (renderer) + Electron (main)

Build de producción:
  npm run build:renderer  →  Vite build + inline CSS (30KB Tailwind)
  npm run build:main      →  tsc (TypeScript → JavaScript)

Empaquetado portable:
  npm run build:win       →  release/win-unpacked/TOG Admin.exe

Instalador NSIS:
  npm run build:installer →  release/TOG Admin Setup 1.0.8.exe

Instalación en cliente:
  1. Ejecutar TOG Admin Setup 1.0.8.exe
  2. Siguiente → Siguiente → Instalar
  3. Se crea acceso directo en escritorio
  4. Abrir TOG Admin
  5. Importar license.key
  6. Login: admin / admin123
```

### Flujo completo de distribución:

```
Desarrollador                          Cliente
─────────────                          ───────
1. generate-keys.js (una vez)
2. npm run build:installer
3. Entregar TOG Admin Setup 1.0.8.exe  ──►  4. Instalar
                                      5. Abrir app
                                      6. Ver pantalla bloqueo
                                      7. Enviar Machine ID  ──►
8. generate-license.js               9. Importar license.key
10. Enviar license.key  ──────────►  11. Todo funciona ✅
```

---

## Roadmap de Expansión

Para el roadmap completo con todas las fases (incluyendo pendientes), ver:
- **[ROADMAP.md](./ROADMAP.md)** — Roadmap principal con 10 fases
- **[ROADMAP-INTEGRACION.md](./ROADMAP-INTEGRACION.md)** — Detalle de features pendientes
- **[Caso-Venezuela.md](./Caso-Venezuela.md)** — Análisis regulatorio Venezuela
- **[benchmarkin-Integra-POS.md](./benchmarkin-Integra-POS.md)** — Benchmarking competitivo

### Próximas prioridades (Fase 5-8)

1. **Producto vs Servicio** — Base para todo (Fase 5)
2. **Subcategorías + Marca** — Organización del catálogo (Fase 5)
3. **Tasa de cambio + Símbolo moneda** — Expansión internacional (Fase 8)
4. **Combos de productos** — Paquetes con descuento (Fase 6)
5. **Exportar cotización a PDF** — Profesionalismo (Fase 6)
6. **Facturación fiscal Venezuela** — Cumplimiento legal (Fase 8)

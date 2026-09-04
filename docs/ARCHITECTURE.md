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
│  │         23 migraciones · 27 tablas · 27+ índices     │    │
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
| `services/license.ts` | Validación de licencias (consume `license-crypto`) |
| `services/license-crypto.ts` | Cripto RSA pura (clave pública embebida, verificación de firma) — testeable fuera de Electron |
| `services/license-sync.ts` | Sincronización con TOG Platform (canal `license:sync`): descarga, re-valida firma RSA y guarda |
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
├── /creditos           → CreditosPage (cuentas por cobrar: saldos + abonos)
├── /caja               → CajaPage (Reporte X + backup automático)
├── /compras            → ComprasPage (barcode scanner)
├── /proveedores        → ProveedoresPage
├── /clientes           → ClientesPage (módulo Distribuidor — gating por licencia + permisos)
├── /pedidos            → PedidosPage (módulo Distribuidor — gating por licencia + permisos)
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
- **Migraciones:** Sistema de versionado de esquema (23 migraciones)
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
| Subcategorías | `subcategorias:list`, `create`, `update`, `delete` |
| Unidades | `unidades:list`, `create`, `update`, `delete` |
| Proveedores | `proveedores:list`, `create`, `update`, `delete` |
| Ventas | `ventas:list`, `getById`, `create`, `anular`, `resumen-dia` |
| Créditos / Fiado | `creditos:list`, `getById`, `abono` |
| Compras | `compras:list`, `create` |
| Caja | `caja:status`, `abrir`, `cerrar`, `movimiento`, `historial`, `reporte-x`, `backup-auto` |
| Quotes | `quotes:list`, `getById`, `create`, `update`, `delete` |
| Distribuidor | `clientes:list`, `create`, `update`, `delete` · `pedidos:list`, `catalogo`, `create`, `update` (cambio de estado / notas) |
| Reportes | `reportes:ventas-periodo`, `productos-mas-vendidos`, `ultimas-ventas`, `ventas-por-categoria` |
| Config | `config:get`, `config:set` |
| Métodos de Pago | `metodos-pago:list`, `create`, `update`, `delete`, `procesar-tarjeta` |
| Backup / DB | `backup:create`, `backup:restore`, `db:reset` |
| Terminal | `terminal:conectar`, `desconectar`, `estado`, `procesar-pago` |
| Licencia | `license:status`, `validate`, `import`, `sync` (pre-auth), `reset-state` |
| Crash Reports | `crash-report:save`, `list`, `read`, `delete`, `open-folder`, `path` |
| i18n | `i18n:get-lang`, `i18n:set-lang` |
| Updater | `update:check`, `download`, `install` |

> **Autorización:** salvo los canales de `PREAUTH_CHANNELS` (ver `src/shared/ipc-channels.ts`), cada handler exige sesión y permiso vía `checkPermissionOrFail`. El renderer inyecta `usuario_id` automáticamente por `callApi` (`src/renderer/lib/api-client.ts`) y lanza un error si el main devuelve `{ success: false }`.

---

## Modelo de Datos (22 Migraciones)

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
| 015 | distribuidor | `clientes`, `pedidos`, `pedido_detalles`, `remitos`, `listas_precio` + 3 índices |
| 016 | clientes_documento | renombra `clientes.rif` → `clientes.documento` (identidad internacional) |
| 017 | producto_tipo | `productos.tipo` (`producto`/`servicio`) + backfill desde `unidad` |
| 018 | subcategorias | `subcategorias` + `productos.subcategoria_id` + 2 índices |
| 019 | producto_marca | `productos.marca` |
| 020 | venta_detalles_libre | reconstruye `venta_detalles`: `producto_id` nullable + `descripcion` (venta rápida / servicios sin producto) |
| 021 | creditos | `creditos`, `credito_abonos` + 4 índices |
| 022 | metodo_pago_fiado | inserta método de pago `fiado` |
| 023 | productos_compuestos | `producto_componentes`, `venta_detalle_componentes` + 4 índices |

### Tablas Principales

| Tabla | Registros típicos | Descripción |
|-------|-------------------|-------------|
| `usuarios` | 2-10 | Usuarios del sistema con roles y permisos |
| `productos` | 100-5000 | Inventario (incl. `tipo` producto/servicio, `marca`, `subcategoria_id`, `imagen`) |
| `categorias` | 5-50 | Categorías de productos |
| `subcategorias` | 10-200 | Subcategorías por categoría |
| `unidades_medida` | 10-20 | Unidades de medida (seeded: ud, paq, cj, res, etc.) |
| `proveedores` | 5-30 | Proveedores del negocio |
| `ventas` | 100-10000 | Historial de ventas |
| `venta_detalles` | 500-50000 | Items de cada venta (`producto_id` nullable + `descripcion` para venta rápida/servicios) |
| `compras` | 10-500 | Historial de compras |
| `compra_detalles` | 50-2500 | Items de cada compra |
| `caja` | 50-500 | Sesiones de caja (apertura/cierre) |
| `movimientos_caja` | 100-5000 | Entradas/salidas de caja |
| `quotes` | 10-200 | Cotizaciones/presupuestos |
| `quote_detalles` | 50-1000 | Items de cada cotización |
| `configuracion` | 5-15 | Configuración del sistema |
| `ajustes_inventario` | 10-200 | Historial de ajustes de stock |
| `metodos_pago` | 2-10 | Métodos de pago configurables |
| `clientes` | 10-1000 | Clientes del Distribuidor — `documento` de registro libre (RIF, RFC, EIN, CNPJ…) |
| `pedidos` | 10-5000 | Pedidos de clientes (estados: `pendiente`, `despachado`, `entregado`, `anulado`) |
| `pedido_detalles` | 50-25000 | Líneas de cada pedido |
| `remitos` | 10-1000 | Remitos (creada en 015; sin UI aún) |
| `listas_precio` | 1-20 | Listas de precio (creada en 015; sin UI aún) |
| `creditos` | 10-2000 | Ventas a crédito/fiado con saldo pendiente (`pendiente`/`pagado`/`anulado`) |
| `credito_abonos` | 10-10000 | Abonos parciales contra cada crédito |

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
| `useActiveModules` | `hooks/useModules.ts` | Módulos activos según la licencia (refresca en vivo con el evento `tog:license-updated`) |

---

## Seguridad

| Medida | Implementación |
|--------|---------------|
| Autenticación | Login con usuario + contraseña (bcrypt hash, 10 salt rounds) |
| Rate limiting | 5 intentos fallidos → lockout 15 min |
| Session timeout | 30 min de inactividad → auto-logout |
| Context isolation | `contextIsolation: true`, `nodeIntegration: false` |
| contextBridge | API expuesta de forma controlada y tipada |
| Validación IPC | 24 schemas Zod en handlers críticos |
| Licencias | RSA-2048 con validación offline |
| Error handling | ErrorBoundary global + crash reports + logging diagnóstico |
| Internacionalización | i18n con 2 idiomas (ES/EN), ~1,382 keys por idioma en el renderer (+97 en main) |
| Backup automático | Al cerrar caja se crea backup de la DB |
| Permisos | 41 permisos en 8 categorías (ventas+créditos, caja, inventario, compras, cotizaciones, reportes, administración, distribuidor), control granular por usuario |

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
4. **Venta rápida** → Botón para servicios por cobrar sin crear producto (se guarda como línea con `descripcion`, sin `producto_id`)
5. **Confirmar venta** → Se inserta en tabla `ventas` + `venta_detalles`
6. **Pago** → Efectivo, transferencia, pago móvil, tarjeta (VP800), mixto o **fiado/crédito** (configurable)
7. **Descuento de stock** → Se actualiza `productos.stock` (solo para productos, no servicios)
8. **Imprimir ticket** → Se genera y envía a impresora (el ticket fiado muestra deudor y saldo pendiente)
9. **Reporte X** → Ver totales parciales sin cerrar caja
10. **Cierre de caja** → Backup automático + totalización del día
11. **Fiado / Créditos** → si el pago fue fiado se crea un registro en `creditos` (saldo = total − abono inicial); los cobros posteriores son **abonos** que se registran en la página Créditos y, con caja abierta, entran como movimiento de caja (entrada)

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

Para el histórico completo con todas las fases (incluyendo pendientes), ver:
- **[ROADMAP.md](./ROADMAP.md)** — Roadmap histórico (referencia; no aplicar sus migraciones propuestas)
- **[ROADMAP-INTEGRACION.md](./ROADMAP-INTEGRACION.md)** — Borrador histórico de planificación
- **[Caso-Venezuela.md](./Caso-Venezuela.md)** — Análisis regulatorio Venezuela (referencia)
- **[benchmarkin-Integra-POS.md](./benchmarkin-Integra-POS.md)** — Benchmarking competitivo (referencia)

### Próximas prioridades

1. ✅ **Producto vs Servicio** — implementado: columna `tipo`, servicios sin control de stock (migración 017)
2. ✅ **Subcategorías + Marca** — implementado: tabla `subcategorias`, `productos.marca` (migraciones 018/019)
3. ✅ **Venta a crédito/fiado** — implementado: método Fiado + página Créditos con abonos (migraciones 020-022)
4. ✅ **Combos / productos compuestos** — implementado: componentes en el modal de producto, costo real + margen, stock por componentes y desglose en ticket (migración 023)
5. **Tasa de cambio + Símbolo moneda** — Expansión internacional (Fase 8)
6. **Exportar cotización a PDF** — Profesionalismo (Fase 6)
7. **Facturación fiscal Venezuela** — Cumplimiento legal (Fase 8)

> El estado por feature vive en `FEATURES.md`; `ROADMAP.md` y `ROADMAP-INTEGRACION.md` son históricos (sus SQL de migraciones propuestas no coinciden con la numeración real).

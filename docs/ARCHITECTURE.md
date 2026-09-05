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
│  │         32 migraciones · 30 tablas · 30+ índices     │    │
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
| `core/auth/` | Login (`auth-service.ts`) + permisos (`permissions.ts` → `checkPermissionOrFail`) + guard de origen IPC (`ipc-guard.ts` → `handleIpc`) |
| `modules/<modulo>/` | Handlers IPC por módulo: inventario, ventas, configuracion, caja-extra, license, distribuidor, restaurant, terminal, crash-report, red, shared |
| `db/database.ts` | SQLite + migraciones + seeds |
| `services/valorTerminal.ts` | Comunicación serial VP800 (USB/COM) |
| `services/license.ts` | Validación de licencias (consume `license-crypto`) |
| `services/license-crypto.ts` | Cripto RSA pura (clave pública embebida, verificación de firma) — testeable fuera de Electron |
| `services/license-sync.ts` | Sincronización con TOG Platform (canal `license:sync`): descarga, re-valida firma RSA y guarda |
| `services/imagenes.ts` | Imágenes de producto en filesystem (`%APPDATA%/tog-admin/imagenes/`) — valida magic bytes (JPG/PNG/WebP, ≤2MB) |
| `services/logger.ts` | Wrapper sobre `electron-log` (degrada a `console` fuera de Electron) |
| `services/red-config.ts` | Modo de la PC (`base`/`hija`/`local`) leyendo `red_modo` + licencia activa |
| `services/red-server.ts` | Servidor HTTP local `:3002` que levanta la **PC Base** para atender PCs hijas (vincular / rpc / logout) |
| `services/red-client.ts` | Cliente HTTP de la **PC Hija** hacia la Base (vincular / rpc / logout) |
| `services/red-session.ts` | Sesión única por usuario en todo el grupo de PCs (`registrarSesion`, `liberarSesionesDePar`) |
| `modules/red/` | Handlers IPC del módulo red (`red:status`, `vincular`, `desvincular`, `generar-codigo`, `listar-pcs`, `logout`) — registro análogo a otros módulos |
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
├── /restaurant-mesas   → MesasPage (módulo Restaurant — salón, comanda, cobro)
├── /restaurant-cocina  → CocinaPage (módulo Restaurant — pantalla de cocina)
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
| Restaurant | `mesas:list`, `create`, `update`, `delete` · `comandas:open`, `add-item`, `update-item`, `remove-item`, `send-kitchen`, `mark-item`, `move`, `list`, `checkout` (reusa `createVenta`) |
| Reportes | `reportes:ventas-periodo`, `productos-mas-vendidos`, `ultimas-ventas`, `ventas-por-categoria` |
| Config | `config:get`, `config:set` |
| Métodos de Pago | `metodos-pago:list`, `create`, `update`, `delete`, `procesar-tarjeta` |
| Backup / DB | `backup:create`, `backup:restore`, `db:reset` |
| Terminal | `terminal:conectar`, `desconectar`, `estado`, `procesar-pago` |
| Licencia | `license:status`, `validate`, `import`, `sync` (pre-auth), `reset-state` |
| Productos (imagen) | `productos:set-imagen`, `get-imagen`, `delete-imagen` (filesystem, `%APPDATA%/tog-admin/imagenes/<id>.<ext>`) |
| Red local (PC Base + hijas) | `red:status` (pre-auth), `red:vincular` (pre-auth), `red:desvincular` (pre-auth), `red:generar-codigo`, `red:listar-pcs`, `red:logout` |
| Crash Reports | `crash-report:save`, `list`, `read`, `delete`, `open-folder`, `path` |
| i18n | `i18n:get-lang`, `i18n:set-lang` |
| Updater | `update:check`, `download`, `install` |

> **Autorización:** salvo los canales de `PREAUTH_CHANNELS` (ver `src/shared/ipc-channels.ts`), cada handler exige sesión y permiso vía `checkPermissionOrFail`. El renderer inyecta `usuario_id` automáticamente por `callApi` (`src/renderer/lib/api-client.ts`) y lanza un error si el main devuelve `{ success: false }`.
> **Origen (SEC8):** todo handler se registra con `handleIpc` (`src/main/core/auth/ipc-guard.ts`), que valida que el sender sea el main-frame y venga de `file://` (empaquetado) o del dev-server (localhost:5173); un origen ajeno lanza error y no ejecuta la lógica. **CSP (SEC7):** meta tag en `index.html`, estricta en producción (sin inline scripts) y relajada en dev por el plugin `inject-csp` de Vite. **Ventas compartidas:** `createVenta` (`modules/ventas/ventas.ts`) es la lógica única de alta de venta (stock, combos, fiado, caja) usada por `ventas:create` y por el cobro de mesas `comandas:checkout`.

---

## Modelo de Datos (31 Migraciones)

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
| 024 | restaurant | `mesas`, `comandas`, `comanda_detalles`, `comanda_detalle_estados` + índices |
| 025 | reportes_visuales | `reportes_visuales` (guardar reportes personalizados) |
| 026 | ventas_cliente_id | `ventas.cliente_id` (cliente opcional en el POS) |
| 027 | ventas_tipo_comprobante | `ventas.tipo_comprobante` (`factura`/`nota_entrega`) |
| 028 | almacenes_y_listas_precio | `almacenes`, `producto_almacen`, `lista_precio_productos.precio_override`, `cliente_lista_precio` (stock por depósito + listas con overrides por producto y asignación por cliente) |
| 029 | currency_name | `configuracion.currency_name` (USD/Bs/EUR… para tickets) |
| 030 | producto_imagen_path | `productos.imagen_path` (ruta a filesystem; imagen vive en `%APPDATA%/tog-admin/imagenes/`) |
| 031 | red_local | `pcs_enlazadas`, `sesiones_activas`, `codigos_enlace` + 2 índices (interconexión PC Base + hijas) |

### Tablas Principales

| Tabla | Registros típicos | Descripción |
|-------|-------------------|-------------|
| `usuarios` | 2-10 | Usuarios del sistema con roles y permisos |
| `productos` | 100-5000 | Inventario (incl. `tipo` producto/servicio, `marca`, `subcategoria_id`, `imagen_path` apuntando a filesystem) |
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
| `pcs_enlazadas` | 0-20 | PCs hijas enlazadas a la Base (migración 031): `par_id`, `nombre`, `ip`, `cert_hash`, `last_seen` |
| `sesiones_activas` | 0-20 | Sesión única por usuario en todo el grupo (migración 031): `usuario_id` UNIQUE, `par_id`, `sesion_token`, `opened_at` |
| `codigos_enlace` | 0-100 | Códigos de enlace de un solo uso con expiración (5 min) |
| `almacenes` | 1-10 | Almacenes/depósitos (seed `Principal`) |
| `producto_almacen` | 100-50000 | Stock por (producto, almacén) |

### Índices (35+)

Todos los índices están optimizados para los patrones de consulta típicos del POS.

> **Migraciones 024–031 (resumen):** Restaurant (024), Reportes Visuales (025),
> Cliente opcional en POS (026), Nota de entrega como comprobante (027),
> Almacenes con stock por depósito + listas de precio con overrides y
> asignación por cliente (028), `currency_name` para tickets (029),
> `imagen_path` apuntando a filesystem (030), e interconexión de red local
> `pcs_enlazadas` / `sesiones_activas` / `codigos_enlace` (031).

---

## Componentes Clave del Renderer

| Componente | Archivo | Función |
|------------|---------|---------|
| `LicenseGate` | `LicenseGate.tsx` | Bloquea la app si no hay licencia válida. En modo PC Hija muestra botón **"Conectar a una PC Base"** y renderiza `SetupPage` |
| `SetupPage` | `pages/SetupPage.tsx` | Pantalla de primer inicio para PC Hija: pide IP de la Base + código de enlace + nombre de PC |
| `ProductImage` | `components/ProductImage.tsx` | Thumbnail de producto con fallback y skeleton, consume `productos:get-imagen` |
| `ErrorBoundary` | `ErrorBoundary.tsx` | Captura errores React + genera reporte automático |
| `Tutorial` | `Tutorial.tsx` | Onboarding de 5 pasos para nuevos usuarios |
| `ForcePasswordChange` | `ForcePasswordChange.tsx` | Obliga cambio de contraseña en primer login |
| `Toast` | `ui/Toast.tsx` | Sistema de notificaciones |
| `CartItem` | `pos/CartItem.tsx` | Precio editable + descuento por item |
| `PermissionsModal` | `ui/PermissionsModal.tsx` | Gestión de permisos por usuario |
| `LicenseSyncForm` | `LicenseSyncForm.tsx` | Form de Sincronizar (URL + empresa_id + api_key) — usado en pantalla de bloqueo y Config → Licencia |
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

## Módulo Red Local (PC Base + PC Hijas)

Permite interconectar varias PCs de un mismo cliente en la **misma LAN** para que operen contra una sola base de datos y compartan la misma licencia. Activado por el campo `max_pcs` (1–20) de la licencia firmada RSA.

### Topología

```
        ┌──────────────────────────────────────────────┐
        │  PC Base (tiene licencia local + DB)         │
        │  • servidor HTTP local :3002 (Node http)     │
        │  • sqlite en %APPDATA%/tog-admin/            │
        │  • expone /api/red/vincular|rpc|logout       │
        └────────────────────┬─────────────────────────┘
                             │  HTTP (LAN)
        ┌────────────────────┼─────────────────────────┐
        ▼                    ▼                         ▼
   PC Hija 1            PC Hija 2                 PC Hija N
   (mismo .exe,         misma app,                misma app
    sin licencia)        sin licencia              sin licencia
   • ipc-handlers.ts    reenvía IPC               reenvía IPC
     reenvía cada        vía rpcABase()            vía rpcABase()
     canal no-local      → handlers de la Base
     vía HTTP al server
```

### Modos de la app

`src/main/services/red-config.ts` define `getRedModo()`:

| Modo | Cómo se determina | Comportamiento |
|---|---|---|
| `base` | `red_modo = 'base'` **o** licencia activa válida (con `max_pcs ≥ 1`) | Levanta el servidor `:3002` y registra todos los handlers |
| `hija` | `red_modo = 'hija'` (guardada al vincularse) | Solo handlers locales + reenvío a la Base |
| `local` | Licencia sin `max_pcs > 1` y sin config hija | Modo tradicional: una PC, sin red |

El modo **se evalúa en cada import** de `red-config.ts` (no requiere restart). El cambio se persiste en la tabla `configuracion` (`red_modo`, `red_base_url`, `red_par_id`, `red_cert_hash`, `red_pc_nombre`).

### Servicios clave

| Servicio | Rol |
|---|---|
| `services/red-config.ts` | Lee/escribe la config de red; provee `getRedModo()`, `isBase()`, `isHija()`, `getHijaConfig()` |
| `services/red-server.ts` | `createRedServer({getDb, getHandler, getMaxPcs, port})` — HTTP server singleton, `startRedServerIfBase()`, `stopRedServer()`, `generarCodigoEnlace(db)` (códigos de 6 chars hex, TTL 5 min, un solo uso) |
| `services/red-client.ts` | Cliente de la Hija: `vincularABase()`, `desvincularDeBase()`, `rpcABase()` (timeout 15s), `logoutEnBase()` |
| `services/red-session.ts` | `registrarSesion(db, usuarioId, parId)` rechaza si el usuario ya tiene sesión en otro `par_id`; `liberarSesionesDePar(db, parId)`; `parTieneSesionActiva(db, parId)`; `generarToken(bytes=16)` |
| `modules/red/handlers.ts` | Handlers IPC del módulo: `red:status`, `red:vincular`, `red:desvincular`, `red:generar-codigo`, `red:listar-pcs`, `red:logout` |

### Endpoints HTTP del servidor (PC Base)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/red/vincular` | código de enlace (header body) | Handshake: valida código no usado y vigente, persiste `pcs_enlazadas`, devuelve `{ par_id, cert_hash }` |
| POST | `/api/red/logout` | par_id + cert_hash (body) | Libera las sesiones del par (logout de la hija) |
| POST | `/api/red/rpc` | par_id + cert_hash + sesión activa (body) | Despacho genérico de cualquier canal IPC: reenvía a los mismos handlers locales; si el canal es pre-auth, basta con `par_id`+`cert_hash`; si no, requiere sesión activa en ese par |

### Flujo de uso

```
[PC Base]                            [PC Hija]
                                      • instalar .exe (sin licencia)
                                      • abrir app → LicenseGate muestra
                                        botón "Conectar a una PC Base"
                                      • completa IP + código + nombre → SetupPage
                                      • POST /api/red/vincular → par_id + cert_hash
                                      • guarda red_modo='hija'
                                      • reenvía TODOS los IPC vía rpcABase()

[PC Base] admin genera código:
  • Config → Sistema → Red Local
  • "Generar código de enlace" → ABC123 (5 min)
  • el admin lo transcribe a la hija

[PC Hija] sesión única:
  • login → auth:login (con __par_id) → registrarSesion() en la Base
  • si el mismo usuario ya tiene sesión en otra par → 401
  • al cerrar sesión → red:logout → libera sesiones del par en la Base
  • al cerrar la app → before-quit → logoutEnBase() best-effort
```

### Tests y smoke

- `src/main/services/red-session.test.ts` — sesión única (mismo par OK, par distinto → error).
- `src/main/services/red-server.test.ts` — handshake / rpc / logout / tope `max_pcs` con `DbLike` en memoria.
- `src/main/services/red-client.test.ts` — `vincularABase` con `fetch` mockeado.

Pendientes (no en spike actual): **TLS local** con cert autofirmado por Base al primer arranque y **heartbeat 60s** para expulsar sesiones huérfanas. Ver `tog-platform/docs/INTERCONEXION-RED.md`.

---

## Servicios transversales nuevos

### `services/imagenes.ts` — Imágenes de producto en filesystem

Las imágenes se guardan fuera de SQLite para evitar inflar la DB. Validación por **magic bytes** (no por `Content-Type`), límite 2 MB, formatos JPG/PNG/WebP.

```
%APPDATA%/tog-admin/imagenes/
└── <producto_id>.jpg | .png | .webp
```

Funciones exportadas: `saveImagen(id, buffer)`, `deleteImagen(id)`, `getImagenPath(id)`, `getImagenDataUrl(id)` (data URL para `<img>`). El handler `productos:get-imagen` usa `getImagenDataUrl` para servir al renderer sin exponer el filesystem.

### `services/logger.ts` — Wrapper sobre `electron-log`

API: `logger.info|warn|error|debug('módulo', msg, ...args)`. Degrada a `console` cuando el binario no es Electron (modo CLI: `tsx scripts/*.ts`, `npm run db:migrate`) para no romper la consola con `app.getPath()`.

### `renderer/services/currency.ts` — Moneda global en el renderer

Estado en memoria (`symbol`, `rate`, `name`) inicializado por `loadCurrency()` desde `configuracion` (`currency_symbol`, `currency_name`, `tasa_cambio`). Se llama en `App.tsx` al autenticar. Helpers: `formatMoney(amount)` aplica símbolo + tasa; `getSymbol()`, `getRate()`, `getName()`, `setCurrency()`.

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
| Internacionalización | i18n con 2 idiomas (ES/EN), ~1,329 keys por idioma en el renderer (+97 en main) |
| Backup automático | Al cerrar caja se crea backup de la DB |
| Permisos | 48 permisos en 9 categorías (ventas+créditos, caja, inventario, compras, cotizaciones, reportes, distribuidor, restaurant, administración), control granular por usuario (incluye `red_manage` para gestión de PC Base) |
| Sesión única en red local | Un usuario solo puede estar activo en una PC del grupo a la vez (`services/red-session.ts`) |
| Validación origen IPC | `handleIpc` (`core/auth/ipc-guard.ts`): rechaza cualquier sender que no sea main-frame `file://` (empaquetado) o `localhost:5173` (dev) |

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
5. ✅ **Interconexión por red local (PC Base + hijas)** — implementado: módulo `red/`, sesión única, tope por `max_pcs` de la licencia (migración 032)
6. ✅ **Imagen de producto en filesystem** — implementado: `src/main/services/imagenes.ts` valida magic bytes, persiste en `%APPDATA%/tog-admin/imagenes/` (migración 031)
7. ✅ **Moneda, símbolo y tasa de cambio** — implementado: `src/renderer/services/currency.ts` aplica símbolo + tasa de `configuracion` a toda la app (migración 030)
8. **Exportar cotización a PDF** — Profesionalismo (Fase 6)
9. **Facturación fiscal Venezuela** — Cumplimiento legal (Fase 8)

> El estado por feature vive en `FEATURES.md`; `ROADMAP.md` y `ROADMAP-INTEGRACION.md` son históricos (sus SQL de migraciones propuestas no coinciden con la numeración real).

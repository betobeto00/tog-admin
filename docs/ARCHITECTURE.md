# Arquitectura — TOG Admin

## Visión General

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
| `ipc-handlers.ts` | 30+ canales IPC registrados |
| `db/database.ts` | SQLite + 13 migraciones + seeds |
| `services/valorTerminal.ts` | Comunicación serial VP800 (USB/COM) |
| `services/license.ts` | Validación licencias RSA-2048 |

### 2. Process de Renderizado (Renderer Process)
**Responsabilidad:** UI completamente en React.

```
Router (HashRouter)
├── /login              → LoginPage (con botones legales)
├── /                   → DashboardPage
├── /pos                → POSPage (con validación caja)
├── /inventario         → InventarioPage (con ajuste)
├── /ventas             → VentasPage
├── /caja               → CajaPage (con impresión cierre)
├── /compras            → ComprasPage
├── /proveedores        → ProveedoresPage
├── /reportes           → ReportesPage
├── /cotizaciones       → QuotesPage
├── /configuracion      → ConfigPage (Terminal + Licencia + Tutorial)
└── /ayuda              → HelpPage (12 secciones)
```

### 3. Capa de Datos (SQLite)
**Responsabilidad:** Persistencia, integridad, respaldo.

- **Un solo archivo:** `tog-admin.db` en `%APPDATA%/tog-admin/`
- **Sin servidor:** No necesita MySQL ni nada externo
- **Respaldo:** Copiar el archivo `.db` = respaldo completo
- **Migraciones:** Sistema de versionado de esquema (13 migraciones)

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

**Canales IPC principales:**

| Categoría | Canales |
|-----------|---------|
| Auth | `auth:login` |
| Usuarios | `usuarios:list`, `create`, `update`, `delete`, `change-password` |
| Productos | `productos:list`, `create`, `update`, `delete`, `low-stock`, `ajustar`, `ajustes-historial` |
| Categorías | `categorias:list`, `create`, `update`, `delete` |
| Unidades | `unidades:list`, `create`, `update`, `delete` |
| Proveedores | `proveedores:list`, `create`, `update`, `delete` |
| Ventas | `ventas:list`, `getById`, `create`, `anular`, `resumen-dia` |
| Compras | `compras:list`, `create` |
| Caja | `caja:status`, `abrir`, `cerrar`, `movimiento`, `historial` |
| Quotes | `quotes:list`, `getById`, `create`, `update`, `delete` |
| Reportes | `reportes:ventas-periodo`, `productos-mas-vendidos`, `ultimas-ventas` |
| Config | `config:get`, `config:set` |
| Backup | `backup:create`, `backup:restore` |
| Terminal | `terminal:conectar`, `desconectar`, `estado`, `procesar-pago` |
| Licencia | `license:status`, `validate`, `import` |

---

## Componentes Clave del Renderer

| Componente | Archivo | Función |
|------------|---------|---------|
| `LicenseGate` | `LicenseGate.tsx` | Bloquea la app si no hay licencia válida |
| `ErrorBoundary` | `ErrorBoundary.tsx` | Captura errores React con UI amigable |
| `Tutorial` | `Tutorial.tsx` | Onboarding de 5 pasos para nuevos usuarios |
| `ForcePasswordChange` | `ForcePasswordChange.tsx` | Obliga cambio de contraseña en primer login |
| `Toast` | `ui/Toast.tsx` | Sistema de notificaciones |
| `Layout` | `layout/Layout.tsx` | Sidebar + Header + Outlet |
| `Header` | `layout/Header.tsx` | Campana de notificaciones (stock bajo + caja) |
| `Sidebar` | `layout/Sidebar.tsx` | Navegación principal |

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
| Error handling | ErrorBoundary global + logging diagnóstico |

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

1. **Abrir caja** → Se registra el fondo de caja inicial
2. **Escanear/buscar producto** → Se agrega al carrito
3. **Cantidad / Precio** → Se calcula subtotal
4. **Confirmar venta** → Se inserta en tabla `ventas` + `venta_detalles`
5. **Pago** → Efectivo, transferencia, pago móvil, tarjeta (VP800), mixto
6. **Descuento de stock** → Se actualiza `productos.stock`
7. **Imprimir ticket** → Se genera y envía a impresora
8. **Cierre de caja** → Se totaliza el día

---

## Despliegue

```
Desarrollo:
  npm run dev  →  Vite (renderer) + Electron (main)

Producción:
  npm run build:renderer  →  Vite build + inline CSS
  npm run build:main      →  tsc (TypeScript → JavaScript)
  npx electron-builder    →  TOG Admin.exe (portable)

Instalación en cliente:
  Copiar carpeta release/win-unpacked/ a la PC del cliente
  Colocar license.key junto al .exe
  Ejecutar TOG Admin.exe
```

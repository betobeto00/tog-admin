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
| `ipc-handlers.ts` | 40+ canales IPC registrados |
| `db/database.ts` | SQLite + 13 migraciones + seeds |
| `services/valorTerminal.ts` | Comunicación serial VP800 (USB/COM) |
| `services/license.ts` | Validación licencias RSA-2048 |
| `services/crash-reporter.ts` | Sistema de reportes de error |
| `i18n/` | Traducciones ES/EN para main process |

### 2. Process de Renderizado (Renderer Process)
**Responsabilidad:** UI completamente en React.

```
Router (HashRouter)
├── /login              → LoginPage (con botones legales)
├── /                   → DashboardPage
├── /pos                → POSPage (precio editable + venta rápida + validación caja)
├── /inventario         → InventarioPage (CSV import/export + ajustes + stock bajo)
├── /ventas             → VentasPage
├── /caja               → CajaPage (Reporte X + backup automático)
├── /compras            → ComprasPage
├── /proveedores        → ProveedoresPage
├── /reportes           → ReportesPage (exportar CSV + PDF)
├── /cotizaciones       → QuotesPage
├── /configuracion      → ConfigPage (Terminal + Licencia + Impresora + Tutorial)
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

**Canales IPC completos:**

| Categoría | Canales |
|-----------|---------|
| Auth | `auth:login` |
| Usuarios | `usuarios:list`, `create`, `update`, `delete`, `change-password` |
| Productos | `productos:list`, `create`, `update`, `delete`, `low-stock`, `ajustar`, `ajustes-historial`, `export-csv`, `import-csv` |
| Categorías | `categorias:list`, `create`, `update`, `delete` |
| Unidades | `unidades:list`, `create`, `update`, `delete` |
| Proveedores | `proveedores:list`, `create`, `update`, `delete` |
| Ventas | `ventas:list`, `getById`, `create`, `anular`, `resumen-dia` |
| Compras | `compras:list`, `create` |
| Caja | `caja:status`, `abrir`, `cerrar`, `movimiento`, `historial`, `reporte-x`, `backup-auto` |
| Quotes | `quotes:list`, `getById`, `create`, `update`, `delete` |
| Reportes | `reportes:ventas-periodo`, `productos-mas-vendidos`, `ultimas-ventas` |
| Config | `config:get`, `config:set` |
| Backup | `backup:create`, `backup:restore` |
| Terminal | `terminal:conectar`, `desconectar`, `estado`, `procesar-pago` |
| Licencia | `license:status`, `validate`, `import` |
| Crash Reports | `crash-report:save`, `list`, `read`, `delete`, `open-folder`, `path` |
| i18n | `i18n:get-lang`, `i18n:set-lang` |

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
| Error handling | ErrorBoundary global + crash reports + logging diagnóstico |
| Internacionalización | i18n con 2 idiomas (ES/EN), ~500 keys de traducción |
| Backup automático | Al cerrar caja se crea backup de la DB |

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
2. **Escanear/buscar producto** → Se agrega al carrito
3. **Cantidad / Precio** → Precio editable directamente en el carrito
4. **Venta rápida** → Botón para servicios por cobrar sin crear producto
5. **Confirmar venta** → Se inserta en tabla `ventas` + `venta_detalles`
6. **Pago** → Efectivo, transferencia, pago móvil, tarjeta (VP800), mixto
7. **Descuento de stock** → Se actualiza `productos.stock`
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
  npm run build:installer →  release/TOG-Admin-Setup-1.0.0.exe

Instalación en cliente:
  1. Ejecutar TOG-Admin-Setup-1.0.0.exe
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
3. Entregar TOG-Admin-Setup.exe  ──►  4. Instalar
                                      5. Abrir app
                                      6. Ver pantalla bloqueo
                                      7. Enviar Machine ID  ──►
8. generate-license.js               9. Importar license.key
10. Enviar license.key  ──────────►  11. Todo funciona ✅
```

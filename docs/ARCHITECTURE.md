# Arquitectura — TOG Admin

## Visión General

```
┌─────────────────────────────────────────────────┐
│                 ELECTRON APP                     │
│                                                  │
│  ┌──────────────┐       ┌─────────────────────┐ │
│  │  MAIN PROCESS │◄─────►│  RENDERER PROCESS   │ │
│  │  (Node.js)    │ IPC   │  (React + Vite)     │ │
│  │               │       │                     │ │
│  │  • SQLite DB  │       │  • UI / Dashboard   │ │
│  │  • File I/O   │       │  • Punto de Venta   │ │
│  │  • Print      │       │  • Inventario       │ │
│  │  • Backup     │       │  • Reportes         │ │
│  │  • System     │       │  • Configuración    │ │
│  └──────────────┘       └─────────────────────┘ │
│                                                  │
│  ┌─────────────────────────────────────────────┐ │
│  │              SQLite Database                 │ │
│  │         (archivo local: data.db)            │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## Capas de Arquitectura

### 1. Process Principal (Main Process)
**Responsabilidad:** Node.js puro, sin DOM.

| Módulo | Función |
|--------|---------|
| `database.ts` | Conexión SQLite, migraciones, queries preparados |
| `ipc-handlers.ts` | Registrar todos los canales IPC ( productos.create, ventas.create, etc. ) |
| `backup.ts` | Copias de seguridad automáticas a carpeta elegida |
| `print.ts` | Generar tickets PDF, enviar a impresora térmica |
| `tray.ts` | Icono en system tray (minimizar a bandeja) |
| `window.ts` | Crear y gestionar la ventana principal |

### 2. Process de Renderizado (Renderer Process)
**Responsabilidad:** UI completamente en React.

```
Renderer
├── Router (React Router)
│   ├── /                    → Login
│   ├── /dashboard           → Panel principal
│   ├── /pos                 → Punto de venta (pantalla principal de caja)
│   ├── /inventario          → Gestión de productos
│   ├── /ventas              → Historial de ventas
│   ├── /compras             → Registro de compras a proveedores
│   ├── /proveedores         → Gestión de proveedores
│   ├── /reportes            → Reportes y gráficas
│   ├── /cierre-caja         → Cierre del día
│   └── /configuracion       → Ajustes del sistema
```

### 3. Capa de Datos (SQLite)
**Responsabilidad:** Persistencia, integridad, respaldo.

- **Un solo archivo:** `data.db` en la carpeta del usuario (`%APPDATA%/papeleria-pos/`)
- **Sin servidor:** No necesita MySQL ni nada externo
- **Respaldo:** Copiar el archivo `.db` = respaldo completo
- **Migraciones:** Sistema de versionado de esquema

### 4. Comunicación IPC
**Responsabilidad:** Puente seguro entre Main y Renderer.

```
Renderer (React)                    Main (Node.js)
     │                                    │
     │  ipcRenderer.invoke('ventas.create', data)
     │ ──────────────────────────────────► │
     │                                    │
     │  ipcMain.handle('ventas.create', handler)
     │                                    │ Validar → Insertar DB → Responder
     │                                    │
     │  ◄────────────────────────────────── │
     │  { success: true, ventaId: 123 }   │
```

**Canales IPC principales:**
- `productos:list`, `productos:create`, `productos:update`, `productos:delete`
- `ventas:create`, `ventas:list`, `ventas:getById`
- `compras:create`, `compras:list`
- `proveedores:list`, `proveedores:create`, `proveedores:update`
- `caja:abrir`, `caja:cerrar`, `caja:status`
- `reportes:ventas-dia`, `reportes:ventas-periodo`, `reportes:productos-mas-vendidos`
- `backup:create`, `backup:restore`
- `config:get`, `config:set`

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
5. **Pago** → Efectivo, transferencia, mixto
6. **Descuento de stock** → Se actualiza `productos.stock`
7. **Imprimir ticket** → Se genera y envía a impresora
8. **Cierre de caja** → Se totaliza el día

---

## Seguridad

| Medida | Implementación |
|--------|---------------|
| Autenticación | Login con usuario + contraseña (bcrypt hash) |
| Sesión | Token JWT local con expiración |
| Datos | SQLite encriptado (opcional: SQLCipher) |
| Backup | Automático al cerrar caja + manual |
| Auditoría | Log de acciones críticas (quién, qué, cuándo) |

---

## Despliegue

```
Desarrollo:
  npm run dev  →  Vite (renderer) + Electron (main)

Producción:
  npm run build  →  electron-builder  →  papeleria-pos-Setup-1.0.0.exe
```

El cliente solo ejecuta el `.exe` y se instala como cualquier programa de Windows.

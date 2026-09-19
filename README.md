# TOG Admin

**Ecosistema modular de punto de venta y gestión — de la producción a la postventa**

Desktop app construida con Electron + React + TypeScript + SQLite. Una PC, una caja, cero servidores. Activa solo los módulos que tu negocio necesita (Comercializador, Distribuidor, y más).

---

## Features

### Core
- 🔐 Login with role-based access (admin / cashier / manager) + rate limiting
- 🛒 Point of Sale with cart, search, checkout & receipt printing
- 💳 **Terminal integration (Valor VP800)** — cobro con tarjeta por USB
- 🏷️ **Discounts** — per-item (%) and global (%)
- 📦 Inventory: products, categories, subcategories, brands, custom units of measure, barcodes
- 🔧 **Inventory adjustment** — manual stock correction with justification
- 💰 Cash Register: open, entries/withdrawals, closeout with reconciliation
- 🖨️ **Print closeout report** — detailed cash register closing
- 📊 Dashboard with daily summary, low stock alerts, **and latest sales**
- 🧾 Sales history with detail view, void, re-print, credit/fiado tracking
- 📝 Quotes: create, edit, approve/reject, print, **convert to sale**
- 🚚 Purchases with suppliers and automatic stock updates
- 👥 Supplier management (international tax/reg. document, phone, email, address)
- 📈 Reports with charts: daily sales, top products, payment methods
- 🏬 **Multi-warehouse** — `almacenes` + `producto_almacen` (stock por depósito)
- 📋 **Price lists** — listas de precio con factor global, overrides por producto y asignación por cliente
- 🧾 **Clientes con deuda a la vista y datos validados** — la lista muestra el saldo pendiente del fiado; el documento (CI/RIF) no se puede repetir entre clientes activos y la edición permite **borrar** datos
- 🧮 **Numeración de comprobantes configurable** — la próxima factura y el N° de control fiscal se fijan desde Configuración → Negocio o Impresión (solo admin + confirmación); la numeración es continua, nunca se repite y sale en ticket y A4
- 📦 **Distribuidor module** (license-gated): client registry (international tax/reg. document) + sales orders with sequential numbering and states (pendiente → despachado/entregado/anulado), remitos con impresión detallada y listas de precio por cliente
- 🍽️ **Restaurant module** (license-gated): tables, table-side orders, kitchen screen, table billing
- 📊 **Accounting module** (license-gated `administracion`): executive summary, sales/purchases/inventory books, journal ledger with automatic entries
- 👥 **HR module** (license-gated `rrhh`): employees CRUD, attendance tracking, payroll processing con **vista previa antes de confirmar**, paystubs; **nómina por capas** (catálogo de conceptos, grupos de empleados con sus propios conceptos, históricos de asistencia y de nómina por trabajador) e impresión A4 de asistencias y recibos
- 🌾 **Producer module** (license-gated `productor`): crops, plantings, harvests, field costs
- 🔄 **After-sales module** (license-gated `postventa`): support tickets, returns, warranties
- 🐎 **Racing module** (license-gated `hipico`): owners, horses, races, results, betting system with odds
- 🖨️ **Print module** (license-gated): thermal ticket printing (ESC/POS), A4 document printing con vista previa del comprobante desde POS y Ventas, comandas a la impresora de cocina y datos fiscales configurables. Un único generador de documentos imprime y **escapa** todos los datos del usuario
- 🖼️ **Product image on filesystem** — JPG/PNG/WebP, máx.2MB, magic-byte validation
- 💱 **Currency symbol + exchange rate** — `currency_symbol` + `currency_name` + `tasa_cambio` se aplican a toda la app
- 🔐 **Licensing v2**: offline RSA-2048 keys **and** a **Sincronizar** button that downloads the active license from the TOG Platform backend and re-validates its signature locally. Soporta `max_pcs` (1–20) para activar el módulo de red local
- 🌐 **LAN interconnection (PC Base + PC hijas)** (license-gated by `max_pcs` ≥ 2): una sola licencia, una sola DB, una sesión activa por usuario en todo el grupo
- ⚙️ Settings: business name, EIN, address, Sales Tax, currency
- 👤 User management with roles (admin / cashier / manager) + password change
- 🔒 **Forced password change** on first login (admin)

### Seguridad
- 💾 **Data backup & restore** — copy SQLite database
- 🔔 **Toast notifications** — feedback for all operations
- ✅ **Zod validation** on critical IPC handlers
- 🛡️ **Session timeout** — 30 min auto-logout
- 🐛 **Crash reports** — automatic error reports with system info
- 🔑 **License sync** — pre-auth channel `license:sync` (works from the lock screen): URL + empresa ID + api key → download → RSA re-validation → save
- 🔐 **Validación de origen IPC** — `handleIpc` (`core/auth/ipc-guard.ts`): solo main-frame `file://` (producción) o `localhost:5173` (dev); un origen ajeno lanza error y no ejecuta el handler
- ✅ **633 automated tests** — validations, services, IPC handlers, React components, sesión única, servidor HTTP de red local, nómina por capas e impresión

### UI/UX
- 🎨 **Hero background** — imagen de fondo en pantalla de login
- 🏷️ **Logo real** — logo de la empresa en Login, Sidebar e instalador
- 🖼️ **Icono transparente** — icono sin fondo para el instalador
- 🌐 **i18n (Internationalization)** — English/Spanish with ~2,143 translation keys per language
- 📋 **Release Notes** — historial de versiones visible desde el login
- 🖧 **PC Hija setup screen** — al instalar el `.exe` sin licencia, la pantalla de bloqueo ofrece "Conectar a una PC Base" con input de IP + código + nombre

### Actualizaciones
- 🔄 **Auto-update system** — notificación automática de nuevas versiones via GitHub Releases
- 📥 **Descarga e instalación** — el usuario puede actualizar sin reinstall manual
- 🔍 **Check for updates** — botón para verificar actualizaciones desde el login

### Empaquetado
- 📱 Windows installer via NSIS
- ⚡ **Lazy loading** — optimized initial load time

## Screenshots

> Screenshots coming soon.

## Requisitos

- **Node.js** 20+ (https://nodejs.org)
- **GitHub CLI** (`gh`) — para publicar releases

## Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Ejecutar tests (Vitest: 633 tests en 56 archivos)
npm test

# Tests en watch mode
npm run test:watch

# Verificar tipos (renderer + main)
npm run typecheck:all

# Correr migraciones manualmente (CLI, sin Electron)
npm run db:migrate
```

Esto arranca Vite (renderer) y Electron (main process) con hot-reload.

## Build

### Desarrollo (rápido)
```bash
npm run dev
```

### Producción completa (app + instalador)
```bash
npm run build:installer
```

Esto ejecuta:
1. `npm run rebuild` — compila módulos nativos (better-sqlite3, serialport)
2. `npm run build:renderer` — compila React + Tailwind CSS
3. `npm run build:main` — compila main process TypeScript
4. `electron-builder --win nsis` — genera el instalador NSIS

### Solo la app (sin instalador)
```bash
npm run build:win
```

### Publicar release
```bash
# 1. Actualizar versión en package.json y Manual del Usuario
# 2. Commit y push
git add -A && git commit -m "v1.0.x: cambios" && git push origin master

# 3. Crear tag y pushearlo
git tag -a v1.0.x -m "Release v1.0.x"
git push origin v1.0.x

# 4. Build del instalador (genera .exe + latest.yml + .blockmap)
npm run build:installer

# 5. Subir los TRES archivos con el nombre que declara latest.yml
#    (electrón-builder escribe el asset con guiones; GitHub los espacios los
#    convierte en puntos y el updater pide guiones -> 404 si no coincide)
mkdir -p release/_upload
cp "release/TOG Admin Setup 1.0.x.exe" "release/_upload/TOG-Admin-Setup-1.0.x-x64.exe"
cp "release/TOG Admin Setup 1.0.x.exe.blockmap" "release/_upload/TOG-Admin-Setup-1.0.x-x64.exe.blockmap"
cp release/latest.yml release/_upload/latest.yml

# 6. Crear el Release con esos nombres
gh release create v1.0.x --repo betobeto00/tog-admin --title "TOG Admin v1.0.x" \
  --notes-file release/RELEASE_NOTES.md \
  "release/_upload/TOG-Admin-Setup-1.0.x-x64.exe" \
  "release/_upload/TOG-Admin-Setup-1.0.x-x64.exe.blockmap" \
  "release/_upload/latest.yml"
```

> ⚠️ **Crítico**: subir `latest.yml` y `.blockmap` además del `.exe` — sin ellos electron-updater no detecta la actualización — y **respetar el nombre del asset**: si el `.exe` queda como `TOG.Admin.Setup.1.0.x.x64.exe` (puntos, lo que hace GitHub con los espacios) la URL que pide el updater (`TOG-Admin-Setup-1.0.x-x64.exe`, guiones) responde **404** y la app no puede actualizarse. Ver [docs/UPDATER_NOTES.md](docs/UPDATER_NOTES.md).

Para más detalles, ver [docs/GUIA_DESARROLLADOR.md](docs/GUIA_DESARROLLADOR.md).

## Estructura

```
tog-admin/
├── docs/                    # Documentación del proyecto
│   ├── ARCHITECTURE.md       # Arquitectura real (migraciones, IPC, módulos, red local)
│   ├── FEATURES.md           # Estado por feature (fuente de verdad operativa)
│   ├── historia/             # Docs históricos: roadmaps, auditorías, planes (no operativos)
│   ├── LICENCIAMIENTO.md     # Guía de licencias (offline + Sincronizar + max_pcs)
│   ├── MODULOS.md            # Catálogo de módulos (espejo de tog-platform/docs/MODULOS.md)
│   ├── QA-SYNC.md            # QA del flujo Sincronizar
│   └── ...
├── packaging/
│   └── installer.nsh        # Script NSIS (custom)
├── public/                  # Assets estáticos
│   ├── hero-bg.jpg          # Fondo del login
│   ├── logo.jpg             # Logo de la empresa
│   └── favicon-*.png
├── resources/               # Iconos para Electron
│   ├── icon.ico             # Icono del instalador (Windows)
│   └── icon.png             # Icono de la app
├── src/
│   ├── main/                # Electron main process (Node.js)
│   │   ├── index.ts         # Entry point
│   │   ├── preload.ts       # API segura para renderer
│   │   ├── ipc-handlers.ts  # Registro central: delega en cada register*Handlers()
│   │   ├── core/auth/       # auth-service.ts + permissions.ts (checkPermissionOrFail) + ipc-guard.ts (handleIpc, origen seguro)
│   │   ├── modules/         # Handlers IPC por módulo (inventario, ventas, configuracion, caja-extra, license, terminal, distribuidor, restaurant, administracion, rrhh, productor, postventa, hipico, print, red, shared…)
│   │   ├── db/
│   │   │   ├── database.ts  # SQLite + 55 migraciones (001–055) + seeds
│   │   │   └── migrate.ts
│   │   ├── i18n/            # Traducciones main process
│   │   │   └── locales/     # es.json, en.json
│   │   └── services/
│   │       ├── valorTerminal.ts  # Servicio VP800
│   │       ├── license.ts        # Validación de licencias
│   │       ├── license-crypto.ts # Cripto RSA pura (tests sin Electron)
│   │       ├── license-sync.ts   # Sync con TOG Platform (license:sync)
│   │       ├── imagenes.ts       # Imágenes de producto en filesystem (magic bytes, ≤2MB)
│   │       ├── logger.ts         # Wrapper electron-log (degrada a console fuera de Electron)
│   │       ├── red-config.ts     # Modo PC (base / hija / local)
│   │       ├── red-server.ts     # Servidor HTTP :3002 (PC Base)
│   │       ├── red-client.ts     # Cliente HTTP (PC Hija)
│   │       ├── red-session.ts    # Sesión única por usuario (grupo de PCs)
│   │       ├── red-cert.ts       # Certificado TLS autofirmado (PC Base)
│   │       ├── crash-reporter.ts # Reportes de error
│   │       └── updater.ts        # Auto-actualizaciones
│   ├── renderer/            # React frontend
│   │   ├── main.tsx         # Entry point React
│   │   ├── App.tsx          # Router + lazy loading
│   │   ├── pages/           # Vistas (Core + Clientes/Pedidos + Almacenes + ListasPrecio + SetupPage para PC Hija)
│   │   ├── components/      # Componentes UI (ProductImage, LicenseGate, SetupPage, ErrorBoundary, Tutorial, ForcePasswordChange, PageErrorBoundary…)
│   │   ├── stores/          # Estado (Zustand + session timeout)
│   │   ├── hooks/           # useBarcodeScanner, usePermissions, useActiveModules, useRedHeartbeat
│   │   ├── services/        # currency.ts (símbolo + tasa en toda la app)
│   │   ├── i18n/            # Traducciones renderer
│   │   │   └── locales/     # es/, en/
│   │   └── lib/             # Utilidades
│   └── shared/              # Tipos y validaciones
│       ├── types.ts
│       ├── papeleria-api.d.ts  # Tipos de la API expuesta al renderer
│       ├── validations.ts   # Schemas Zod
│       ├── permissions.ts   # Catálogo de 69 permisos en 16 categorías
│       ├── permissions.test.ts
│       ├── ipc-channels.ts  # Canales IPC + PREAUTH_CHANNELS
│       ├── ipc-channels.test.ts
│       ├── modules.ts       # Catálogo de módulos TOG Platform
│       ├── modules.test.ts
│       ├── fiscal.ts        # Datos fiscales (RIF, razón social, N° de control)
│       ├── fiscal.test.ts
│       ├── print.ts         # Lógica de impresión térmica y A4
│       └── print.test.ts
├── keys/                    # Claves RSA (licencias) — fuera del repo (.gitignore)
├── package.json
├── tsconfig.json
├── tsconfig.main.json
├── vite.config.ts
└── tailwind.config.ts
```

## Stack

| Capa | Tecnología |
|------|-----------|
| Desktop | Electron 31 |
| Frontend | React 18 + TypeScript |
| Estilos | Tailwind CSS |
| Estado | Zustand |
| Base de datos | SQLite (better-sqlite3) |
| Validación | Zod |
| Build | Vite + electron-builder |
| Instalador | NSIS (electron-builder) |
| Terminal pago | Serialport (VP800) |
| Red local (LAN) | Node `http` (servidor :3002 PC Base + cliente PC Hija) |
| Testing | Vitest + React Testing Library |
| i18n | i18next + react-i18next |
| Licencias | RSA-2048 (Node.js crypto) |
| Auto-update | electron-updater + GitHub Releases |
| Logging | electron-log (degrada a `console` en CLI) |

## Default Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |
| maria | empleado123 | Cajero (prueba) |

> ⚠️ You will be forced to change the admin password on first login.

## Seguridad

- ✅ **bcrypt** password hashing (10 salt rounds)
- ✅ **contextIsolation** + contextBridge (Electron IPC seguro)
- ✅ **Validación de origen IPC** — `handleIpc` rechaza cualquier sender que no sea main-frame `file://` (producción) o `localhost:5173` (dev)
- ✅ **Sesión por token (CSPRNG)** — cada llamada IPC resuelve al usuario desde `sesiones_activas`; el `usuario_id` que manda el renderer se sobrescribe y nunca se usa para autorizar
- ✅ **Certificado TLS del servidor de red** — autofirmado, generado y persistido al primer arranque de la PC Base (`services/red-cert.ts`)
- ✅ **Rate limiting** — 5 intentos fallidos → bloqueo 15 min
- ✅ **Session timeout** — 30 min auto-logout por inactividad
- ✅ **Sesión única en red local** — un usuario solo puede estar activo en una PC del grupo a la vez (`services/red-session.ts`)
- ✅ **Zod validation** en handlers críticos
- ✅ **Stock validation** — previene stock negativo
- ✅ **Backup/Restore** — copia de seguridad de la base de datos
- ✅ **Auto-update** — actualizaciones verificadas desde GitHub Releases

## Licencia

MIT

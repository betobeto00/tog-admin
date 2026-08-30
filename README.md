# TOG Admin

**Sistema de Punto de Venta para Papelería, Centro de Copiado e Impresión**

Desktop app construida con Electron + React + TypeScript + SQLite. Una PC, una caja, cero servidores.

---

## Features

### Core
- 🔐 Login with role-based access (admin / cashier) + rate limiting
- 🛒 Point of Sale with cart, search, checkout & receipt printing
- 💳 **Terminal integration (Valor VP800)** — cobro con tarjeta por USB
- 🏷️ **Discounts** — per-item (%) and global (%)
- 📦 Inventory: products, categories, custom units of measure, barcodes
- 🔧 **Inventory adjustment** — manual stock correction with justification
- 💰 Cash Register: open, entries/withdrawals, closeout with reconciliation
- 🖨️ **Print closeout report** — detailed cash register closing
- 📊 Dashboard with daily summary, low stock alerts, **and latest sales**
- 🧾 Sales history with detail view, void, and re-print
- 📝 Quotes: create, edit, approve/reject, print
- 🚚 Purchases with suppliers and automatic stock updates
- 👥 Supplier management (EIN, phone, email, address)
- 📈 Reports with charts: daily sales, top products, payment methods
- ⚙️ Settings: business name, EIN, address, Sales Tax, currency
- 👤 User management with roles (admin / cashier) + password change
- 🔒 **Forced password change** on first login (admin)

### Seguridad
- 💾 **Data backup & restore** — copy SQLite database
- 🔔 **Toast notifications** — feedback for all operations
- ✅ **Zod validation** on critical IPC handlers
- 🛡️ **Session timeout** — 30 min auto-logout
- 🐛 **Crash reports** — automatic error reports with system info
- ✅ **50 automated tests** — validation schemas + React components

### UI/UX
- 🎨 **Hero background** — imagen de fondo en pantalla de login
- 🏷️ **Logo real** — logo de la empresa en Login, Sidebar e instalador
- 🖼️ **Icono transparente** — icono sin fondo para el instalador
- 🌐 **i18n (Internationalization)** — English/Spanish with 500+ translation keys
- 📋 **Release Notes** — historial de versiones visible desde el login

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

# Ejecutar tests
npm test

# Tests en watch mode
npm run test:watch

# Verificar tipos
npm run typecheck
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

# 5. Crear Release en GitHub
gh release create v1.0.x --repo betobeto00/tog-admin --title "TOG Admin v1.0.x" --notes-file release/RELEASE_NOTES.md

# 6. Subir los TRES archivos (no solo el .exe)
gh release upload v1.0.x \
  "release/TOG Admin Setup 1.0.x.exe" \
  "release/latest.yml" \
  "release/TOG Admin Setup 1.0.x.exe.blockmap" \
  --repo betobeto00/tog-admin --clobber
```

> ⚠️ **Crítico**: el paso 6 debe subir `latest.yml` y `.blockmap` además del `.exe`. Sin estos archivos, electron-updater no detecta la actualización. Ver [docs/UPDATER_NOTES.md](docs/UPDATER_NOTES.md) para detalles.

Para más detalles, ver [docs/GUIA_DESARROLLADOR.md](docs/GUIA_DESARROLLADOR.md).

## Estructura

```
tog-admin/
├── docs/                    # Documentación del proyecto
│   ├── GUIA_DESARROLLADOR.md
│   ├── ROADMAP.md
│   └── LICENCIAMIENTO.md
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
│   │   ├── ipc-handlers.ts  # Todos los handlers IPC
│   │   ├── db/
│   │   │   ├── database.ts  # SQLite + migraciones + seeds
│   │   │   └── migrate.ts
│   │   ├── i18n/            # Traducciones main process
│   │   │   └── locales/     # es.json, en.json
│   │   └── services/
│   │       ├── valorTerminal.ts  # Servicio VP800
│   │       ├── license.ts        # Validación licencias
│   │       ├── crash-reporter.ts # Reportes de error
│   │       └── updater.ts        # Auto-actualizaciones
│   ├── renderer/            # React frontend
│   │   ├── main.tsx         # Entry point React
│   │   ├── App.tsx          # Router + lazy loading
│   │   ├── pages/           # Vistas (12 páginas)
│   │   ├── components/      # Componentes UI
│   │   │   ├── pos/         # CartItem
│   │   │   ├── ui/          # Modal, ConfirmDialog, Toast
│   │   │   └── layout/      # Layout, Header, Sidebar
│   │   ├── stores/          # Estado (Zustand + session timeout)
│   │   ├── i18n/            # Traducciones renderer
│   │   │   └── locales/     # es/, en/
│   │   └── lib/             # Utilidades
│   └── shared/              # Tipos y validaciones
│       ├── types.ts
│       └── validations.ts   # Schemas Zod
├── keys/                    # Claves RSA (licencias)
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
| Testing | Vitest + React Testing Library |
| i18n | i18next + react-i18next |
| Licencias | RSA-2048 (Node.js crypto) |
| Auto-update | electron-updater + GitHub Releases |

## Default Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |

> ⚠️ You will be forced to change the password on first login.

## Seguridad

- ✅ **bcrypt** password hashing (10 salt rounds)
- ✅ **contextIsolation** + contextBridge (Electron IPC seguro)
- ✅ **Rate limiting** — 5 intentos fallidos → bloqueo 15 min
- ✅ **Session timeout** — 30 min auto-logout por inactividad
- ✅ **Zod validation** en handlers críticos
- ✅ **Stock validation** — previene stock negativo
- ✅ **Backup/Restore** — copia de seguridad de la base de datos
- ✅ **Auto-update** — actualizaciones verificadas desde GitHub Releases

## Licencia

MIT

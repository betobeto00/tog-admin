# TOG Admin

**Sistema de Punto de Venta para Papelería, Centro de Copiado e Impresión**

Desktop app construida con Electron + React + TypeScript + SQLite. Una PC, una caja, cero servidores.

---

## Features

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
- 💾 **Data backup & restore** — copy SQLite database
- 🔔 **Toast notifications** — feedback for all operations
- ✅ **Zod validation** on critical IPC handlers
- 🛡️ **Session timeout** — 30 min auto-logout
- 📱 Windows installer via Inno Setup
- ⚡ **Lazy loading** — optimized initial load time

## Screenshots

> Screenshots coming soon.

## Requisitos

- **Node.js** 20+ (https://nodejs.org)
- **Inno Setup** 6 (https://jrsoftware.org/isinfo.php) — para generar el instalador

## Desarrollo

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev
```

Esto arranca Vite (renderer) y Electron (main process) con hot-reload.

## Build

### Desarrollo (rápido)
```bash
npm run dev
```

### Producción completa (app + instalador)
```bash
build.bat 1.0.0
```

Esto ejecuta:
1. `npm install` — dependencias
2. `vite build` — compila React
3. `tsc` — compila main process
4. `electron-builder --win --dir` — empaqueta la app
5. `Inno Setup` — genera `release/TOG-Admin-Setup.exe`

### Solo la app (sin instalador)
```bash
npm run build:win
```

## Estructura

```
tog-admin/
├── docs/                    # Documentación del proyecto
├── packaging/
│   └── installer.iss        # Script Inno Setup
├── src/
│   ├── main/                # Electron main process (Node.js)
│   │   ├── index.ts         # Entry point
│   │   ├── preload.ts       # API segura para renderer
│   │   ├── ipc-handlers.ts  # Todos los handlers IPC
│   │   ├── db/
│   │   │   ├── database.ts  # SQLite + 12 migraciones + seeds
│   │   │   └── migrate.ts   # Script standalone de migración
│   │   └── services/
│   │       └── valorTerminal.ts  # Servicio VP800
│   ├── renderer/            # React frontend
│   │   ├── main.tsx         # Entry point React
│   │   ├── App.tsx          # Router + lazy loading
│   │   ├── pages/           # Vistas (10 páginas)
│   │   ├── components/      # Componentes UI
│   │   │   ├── pos/         # CartItem (extraído)
│   │   │   ├── ui/          # Modal, ConfirmDialog, Toast
│   │   │   └── layout/      # Layout, Header, Sidebar
│   │   ├── stores/          # Estado (Zustand + session timeout)
│   │   └── lib/             # Utilidades
│   └── shared/              # Tipos y validaciones
│       ├── types.ts
│       └── validations.ts   # Schemas Zod
├── resources/               # Iconos y assets
├── build.bat                # Script de build completo
├── package.json
├── tsconfig.json
├── tsconfig.main.json       # TS config para main process
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
| Instalador | Inno Setup 6 |
| Terminal pago | Serialport (VP800) |

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

## Licencia

MIT

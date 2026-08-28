# TOG Admin

**Sistema de Punto de Venta para Papelería, Centro de Copiado e Impresión**

Desktop app construida con Electron + React + TypeScript + SQLite. Una PC, una caja, cero servidores.

---

## Features

- 🔐 Login with role-based access (admin / cashier)
- 🛒 Point of Sale with cart, search, checkout & receipt printing
- 📦 Inventory: products, categories, custom units of measure, barcodes
- 💰 Cash Register: open, entries/withdrawals, closeout with reconciliation
- 📊 Dashboard with daily summary and low stock alerts
- 🧾 Sales history with detail view, void, and re-print
- 📝 Quotes: create, edit, approve/reject, print, convert to sale
- 🚚 Purchases with suppliers and automatic stock updates
- 👥 Supplier management (EIN, phone, email, address)
- 📈 Reports with charts: daily sales, top products, payment methods
- 📝 Quotes / Estimates: create, edit, approve, print, send to clients
- ⚙️ Settings: business name, EIN, address, Sales Tax, currency
- 👤 User management with roles (admin / cashier) + password change
- 💵 Currency: USD ($) — configurable
- 📊 Sales Tax configurable by state (default 0%)
- 📏 Dynamic units of measure (Unit, Gallon, Liter, Package, custom...)
- 💾 Data backup
- 📱 Windows installer via Inno Setup

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
│   │   └── db/
│   │       ├── database.ts  # SQLite + migraciones + seeds
│   │       └── migrate.ts   # Script standalone de migración
│   ├── renderer/            # React frontend
│   │   ├── main.tsx         # Entry point React
│   │   ├── App.tsx          # Router principal
│   │   ├── pages/           # Vistas
│   │   ├── components/      # Componentes UI
│   │   ├── stores/          # Estado (Zustand)
│   │   └── lib/             # Utilidades
│   └── shared/              # Tipos compartidos
│       └── types.ts
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
| Build | Vite + electron-builder |
| Instalador | Inno Setup 6 |

## Default Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin123 | Admin |

> ⚠️ Change the password after first login.

## Licencia

MIT

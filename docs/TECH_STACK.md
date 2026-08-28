# Tech Stack — TOG Admin

## Resumen

TOG Admin - Sistema de punto de venta de escritorio para papelería, centro de copiado e impresión.
Una PC, una caja, un usuario.

---

## Stack Elegido

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| **Framework Desktop** | Electron 31+ | Empaquetar como app instalable en Windows. MAD e HIDIS compatibles. |
| **Frontend** | React 18 + TypeScript | UI reactiva, tipado fuerte, ecosistema enorme. |
| **Estilos** | Tailwind CSS + shadcn/ui | Componentes listos, diseño rápido, profesional. |
| **Base de Datos** | SQLite (via better-sqlite3) | Archivo único, sin servidor, respaldo fácil (copiar .db). |
| **Estado** | Zustand | Ligero, simple, sin boilerplate. |
| **Gráficos** | Recharts | Reportes y gráficas de ventas. |
| **Formularios** | React Hook Form + Zod | Validación robusta de formularios. |
| **Impresión** | Electron print + thermal printer support | Tickets térmicos + reportes a PDF. |
| **Terminal Pago** | serialport (USB) | Comunicación serial con VP800 via puerto COM. |
| **Licencias** | crypto (Node.js nativo) | RSA-2048 para firmar y validar licencias offline. |
| **Empaquetado** | electron-builder | Generar instalador .exe para Windows. |
| **Node** | Node.js 20 LTS | Runtime estable para Electron. |

---

## Por qué NO otras opciones

| Alternativa | Por qué no |
|------------|-----------|
| **Tauri** | Requiere Rust, más complejo de deployar para este caso. Electron es más maduro para POS. |
| **Python (PyQt/Tkinter)** | UI menos moderna, empaquetado más difícil, menor ecosistema web. |
| **C# WPF** | Solo Windows, licencia .NET, menos flexible para UI moderna. |
| **Web app (Next.js)** | Requiere servidor, internet, más complejo de instalar en una PC. |
| **Firebase/Supabase** | Requiere internet, costs recurrentes, overkill para una caja. |
| **MySQL/PostgreSQL** | Servidor separado, más pesado de mantener. |

---

## Dependencias Principales

### Runtime
```json
{
  "electron": "^31.0.0",
  "better-sqlite3": "^11.0.0",
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "react-router-dom": "^6.23.0",
  "zustand": "^4.5.0",
  "react-hook-form": "^7.51.0",
  "zod": "^3.23.0",
  "@hookform/resolvers": "^3.6.0",
  "recharts": "^3.10.1",
  "date-fns": "^3.6.0",
  "lucide-react": "^0.378.0",
  "clsx": "^2.1.0",
  "tailwind-merge": "^2.3.0",
  "bcryptjs": "^2.4.3"
}
```

### Desarrollo
```json
{
  "typescript": "5.4",
  "vite": "^5.2.0",
  "@vitejs/plugin-react": "^4.3.0",
  "tailwindcss": "^3.4.0",
  "electron-builder": "^24.13.0",
  "concurrently": "^8.2.0",
  "@electron/rebuild": "^4.2.0"
}
```

### Módulos Nativos
```json
{
  "serialport": "latest",
  "@electron/rebuild": "^4.2.0"
}
```

---

## Estructura de Archivos del Proyecto

```
D-E/
├── docs/                    # Documentación
│   ├── ARCHITECTURE.md
│   ├── DATA_MODEL.md
│   ├── FEATURES.md
│   ├── KNOWLEDGE.md
│   ├── LICENCIAMIENTO.md    # ✅ Guía de licencias
│   ├── PRODUCTION_BUILD_REPORT.md
│   ├── ROADMAP.md
│   └── TECH_STACK.md        # Este archivo
├── keys/                    # ✅ Claves RSA (private.key secreta)
│   ├── private.key
│   └── public.key
├── licenses/                # ✅ Licencias generadas para clientes
├── scripts/
│   ├── generate-keys.js     # ✅ Generador de claves RSA
│   ├── generate-license.js  # ✅ Generador de licencias
│   └── inline-css.js        # Build: inline CSS para Electron
├── packaging/
│   └── installer.iss        # Script Inno Setup
├── src/
│   ├── main/                # Process principal de Electron
│   │   ├── index.ts
│   │   ├── preload.ts
│   │   ├── ipc-handlers.ts  # 30+ canales IPC
│   │   ├── db/
│   │   │   ├── database.ts
│   │   │   └── migrate.ts
│   │   └── services/
│   │       ├── valorTerminal.ts  # ✅ VP800 USB serial
│   │       └── license.ts        # ✅ RSA-2048 validation
│   ├── renderer/            # Frontend React
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── layout/      # Sidebar, Header (notificaciones)
│   │   │   ├── ui/          # Modal, ConfirmDialog, Toast
│   │   │   ├── pos/         # CartItem
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── LicenseGate.tsx
│   │   │   ├── Tutorial.tsx
│   │   │   └── ForcePasswordChange.tsx
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── POSPage.tsx
│   │   │   ├── InventarioPage.tsx
│   │   │   ├── VentasPage.tsx
│   │   │   ├── CajaPage.tsx
│   │   │   ├── ComprasPage.tsx
│   │   │   ├── ProveedoresPage.tsx
│   │   │   ├── ReportesPage.tsx
│   │   │   ├── QuotesPage.tsx
│   │   │   ├── ConfigPage.tsx  # Backup + Terminal + Licencia
│   │   │   ├── HelpPage.tsx
│   │   │   └── LoginPage.tsx
│   │   ├── stores/
│   │   │   └── auth.store.ts
│   │   └── lib/
│   │       └── utils.ts
│   └── shared/
│       ├── types.ts
│       └── validations.ts   # 19 schemas Zod
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

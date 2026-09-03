# Tech Stack — TOG Admin

## Resumen

TOG Admin - Sistema de punto de venta de escritorio para papelería, centro de copiado e impresión.
Una PC, una caja, un usuario.

---

## Stack Elegido

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| **Framework Desktop** | Electron 31+ | Empaquetar como app instalable en Windows. |
| **Frontend** | React 18 + TypeScript | UI reactiva, tipado fuerte, ecosistema enorme. |
| **Estilos** | Tailwind CSS | Framework utilitario, diseño rápido y profesional. |
| **Base de Datos** | SQLite (via better-sqlite3) | Archivo único, sin servidor, respaldo fácil. |
| **Estado** | Zustand | Ligero, simple, sin boilerplate. |
| **Gráficos** | Recharts | Reportes y gráficas de ventas. |
| **Formularios** | React Hook Form + Zod | Validación robusta de formularios. |
| **Terminal Pago** | serialport (USB) | Comunicación serial con VP800 via puerto COM. |
| **Licencias** | crypto (Node.js nativo) | RSA-2048 offline (import) + sincronización con backend TOG Platform (canal pre-auth `license:sync`). |
| **Instalador** | electron-builder NSIS | Genera .exe instalable con acceso directo. |
| **Node** | Node.js 20 LTS | Runtime estable para Electron. |

---

## Comandos de Build

```bash
# Desarrollo
npm run dev

# Build de producción (renderer + main)
npm run build:renderer   # Vite build + CSS inline
npm run build:main       # TypeScript → JavaScript

# Empaquetado portable (carpeta suelta)
npm run build:win        # → release/win-unpacked/TOG Admin.exe

# Instalador NSIS (.exe instalable)
npm run build:installer  # → release/TOG.Admin.Setup.1.0.8.exe
```

---

## Configuración del Instalador NSIS

| Opción | Valor |
|--------|-------|
| Idioma | Español + Inglés |
| Instalación | Carpeta personalizable (default: Program Files) |
| Acceso directo | ✅ Escritorio + Menú Inicio |
| Desinstalador | ✅ Panel de Control |
| Matar procesos | ✅ Antes de instalar/desinstalar |
| Nombre app | TOG Admin |
| Publisher | Bet00 Nardieu |

---

## Por qué NO otras opciones

| Alternativa | Por qué no |
|------------|-----------|
| **Tauri** | Requiere Rust, más complejo de deployar. Electron es más maduro para POS. |
| **Python (PyQt/Tkinter)** | UI menos moderna, empaquetado más difícil. |
| **C# WPF** | Solo Windows, licencia .NET, menos flexible. |
| **Web app (Next.js)** | Requiere servidor, internet, más complejo de instalar. |
| **Firebase/Supabase** | Requiere internet, costs recurrentes, overkill. |
| **MySQL/PostgreSQL** | Servidor separado, más pesado de mantener. |

---

## Dependencias Principales

### Runtime
| Paquete | Versión | Uso |
|---------|---------|-----|
| electron | ^31.0.0 | Framework desktop |
| react | ^18.3.0 | UI |
| react-dom | ^18.3.0 | DOM |
| react-router-dom | ^6.23.0 | Routing (HashRouter) |
| zustand | ^4.5.0 | State management |
| better-sqlite3 | ^11.10.0 | Base de datos SQLite |
| bcryptjs | ^2.4.3 | Hash de contraseñas |
| react-hook-form | ^7.51.0 | Formularios (con zod resolver) |
| @hookform/resolvers | ^3.6.0 | Resolver zod para RHF |
| recharts | ^3.10.1 | Gráficos |
| zod | ^3.23.0 | Validación de schemas |
| lucide-react | ^0.378.0 | Iconos |
| serialport | ^13.0.0 | Comunicación serial VP800 |
| date-fns | ^3.6.0 | Manipulación de fechas |
| i18next + react-i18next | ^23.16.8 / ^15.7.4 | Internacionalización (ES/EN) |
| electron-updater | ^6.8.9 | Auto-actualizaciones vía GitHub Releases |
| electron-log | ^5.4.4 | Logging en main process |

### Desarrollo
| Paquete | Versión | Uso |
|---------|---------|-----|
| typescript | 5.4 | Compilador |
| vite | ^5.2.0 | Bundler |
| vitest | ^4.1.11 | Testing framework |
| @testing-library/react | latest | Tests de componentes React |
| @testing-library/jest-dom | latest | Matchers DOM para tests |
| jsdom | latest | Entorno DOM para tests |
| tailwindcss | ^3.4.0 | CSS framework |
| electron-builder | ^24.13.0 | Empaquetado + NSIS |
| @electron/rebuild | ^4.2.0 | Rebuild módulos nativos |

---

## Estructura de Archivos del Proyecto

```
D-E/
├── docs/                    # Documentación
│   ├── ARCHITECTURE.md      # Este archivo
│   ├── DATA_MODEL.md
│   ├── FEATURES.md
│   ├── KNOWLEDGE.md
│   ├── LICENCIAMIENTO.md    # Guía de licencias
│   ├── PRODUCTION_BUILD_REPORT.md
│   ├── ROADMAP.md
│   └── TECH_STACK.md
├── keys/                    # Claves RSA
│   ├── private.key          # 🔴 SECRETA
│   └── public.key           # 🟢 Embebida en el .exe
├── licenses/                # Licencias generadas
├── scripts/
│   ├── generate-keys.js     # Generador de claves RSA
│   ├── generate-license.js  # Generador de licencias
│   └── inline-css.js        # Build: CSS inline
├── packaging/
│   ├── installer.nsh        # NSIS include usado por electron-builder
│   └── installer.iss        # Inno Setup (alternativo)
├── src/
│   ├── main/                # Process principal
│   │   ├── index.ts
│   │   ├── preload.ts
│   │   ├── ipc-handlers.ts  # Registro central: delega en los register*Handlers() de cada módulo
│   │   ├── core/
│   │   │   └── auth/        # auth-service.ts, handlers.ts, permissions.ts (checkPermissionOrFail)
│   │   ├── modules/         # Handlers IPC por módulo
│   │   │   ├── inventario/  # productos, categorias, unidades, csv
│   │   │   ├── ventas/      # ventas, compras, proveedores, caja, reportes, quotes
│   │   │   ├── configuracion/  # config, metodos-pago, backup
│   │   │   ├── caja-extra/  # reporte-x, backup-auto
│   │   │   ├── license/     # status, validate, import, sync, reset-state
│   │   │   ├── distribuidor/ # clientes, pedidos (canales clientes:*, pedidos:*; gating por licencia)
│   │   │   ├── terminal/
│   │   │   ├── crash-report/
│   │   │   └── shared/      # app:version, i18n
│   │   ├── db/
│   │   │   ├── database.ts  # SQLite + migraciones
│   │   │   └── migrate.ts
│   │   ├── i18n/            # Traducciones main process
│   │   │   ├── index.ts
│   │   │   └── locales/
│   │   └── services/        # Lógica transversal
│   │       ├── valorTerminal.ts
│   │       ├── license.ts         # Validación de licencias (usa license-crypto)
│   │       ├── license-crypto.ts  # Cripto RSA pura (clave pública + verificación), testeable sin Electron
│   │       ├── license-sync.ts    # Descarga de licencia desde TOG Platform (license:sync)
│   │       ├── crash-reporter.ts
│   │       ├── updater.ts
│   │       └── configCache.ts
│   ├── renderer/            # Frontend React
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/      # 10+ componentes (incl. LicenseGate, LicenseSyncForm)
│   │   ├── pages/           # 14 páginas (Core + Clientes/Pedidos del Distribuidor)
│   │   ├── core/auth/store.ts  # Store de sesión (Zustand) — antes en stores/
│   │   ├── hooks/           # usePermissions, useBarcodeScanner, useModules (useActiveModules)
│   │   ├── i18n/            # Traducciones renderer
│   │   │   └── locales/     # es/, en/
│   │   └── lib/             # api-client.ts (callApi), utils.ts
│   └── shared/              # Código compartido main+renderer
│       ├── permissions.ts   # Catálogo de permisos (39 claves, 10 categorías)
│       ├── ipc-channels.ts  # Tipos de canales + PREAUTH_CHANNELS (license:import y license:sync pre-auth)
│       ├── modules.ts       # Catálogo de módulos TOG Platform (ModuleId + CATALOGO)
│       ├── papeleria-api.d.ts
│       ├── types.ts
│       ├── validations.ts   # Schemas Zod
│       └── validations.test.ts  # Tests de schemas
├── package.json             # Config build NSIS
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

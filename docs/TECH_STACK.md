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
| **Licencias** | crypto (Node.js nativo) | RSA-2048 para licencias offline. |
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
npm run build:installer  # → release/TOG-Admin-Setup-1.0.0.exe
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
| better-sqlite3 | ^11.0.0 | Base de datos SQLite |
| bcryptjs | ^2.4.3 | Hash de contraseñas |
| recharts | ^3.10.1 | Gráficos |
| zod | ^3.23.0 | Validación de schemas |
| lucide-react | ^0.378.0 | Iconos |
| serialport | ^13.0.0 | Comunicación serial VP800 |
| date-fns | ^3.6.0 | Manipulación de fechas |

### Desarrollo
| Paquete | Versión | Uso |
|---------|---------|-----|
| typescript | 5.4 | Compilador |
| vite | ^5.2.0 | Bundler |
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
│   └── installer.iss        # Inno Setup (alternativo)
├── src/
│   ├── main/                # Process principal
│   │   ├── index.ts
│   │   ├── preload.ts
│   │   ├── ipc-handlers.ts  # 40+ canales IPC
│   │   ├── db/
│   │   │   ├── database.ts
│   │   │   └── migrate.ts
│   │   └── services/
│   │       ├── valorTerminal.ts
│   │       └── license.ts
│   ├── renderer/            # Frontend React
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/      # 10+ componentes
│   │   ├── pages/           # 12 páginas
│   │   ├── stores/
│   │   └── lib/
│   └── shared/
│       ├── types.ts
│       └── validations.ts   # 19 schemas Zod
├── package.json             # Config build NSIS
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

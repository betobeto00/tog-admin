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

## Estructura de Archivos del Proyecto

```
papeleria-pos/
├── docs/                    # Documentación
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   ├── KNOWLEDGE.md
│   ├── DATA_MODEL.md
│   ├── FEATURES.md
│   └── TECH_STACK.md        # Este archivo
├── src/
│   ├── main/                # Process principal de Electron
│   │   ├── index.ts
│   │   ├── database.ts      # Conexión SQLite + migraciones
│   │   ├── ipc-handlers.ts  # Comunicación main <-> renderer
│   │   └── tray.ts          # System tray
│   ├── renderer/            # Frontend React
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/      # Componentes reutilizables
│   │   │   ├── ui/          # shadcn/ui primitives
│   │   │   ├── layout/      # Sidebar, Header, etc.
│   │   │   └── POS/         # Componentes específicos del POS
│   │   ├── pages/           # Vistas principales
│   │   │   ├── Dashboard.tsx
│   │   │   ├── PuntoDeVenta.tsx
│   │   │   ├── Inventario.tsx
│   │   │   ├── Ventas.tsx
│   │   │   ├── Compras.tsx
│   │   │   ├── Proveedores.tsx
│   │   │   ├── Reportes.tsx
│   │   │   ├── Configuracion.tsx
│   │   │   └── CierreDeCaja.tsx
│   │   ├── stores/          # Zustand stores
│   │   ├── hooks/           # Custom hooks
│   │   ├── lib/             # Utilidades
│   │   └── types/           # Tipos TypeScript
│   └── shared/              # Tipos compartidos main/renderer
│       └── types.ts
├── resources/               # Iconos, fuentes, assets
├── electron-builder.yml     # Config de empaquetado
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.ts
```

---

## Dependencias Principales

### Runtime
```json
{
  "electron": "^31.0.0",
  "better-sqlite3": "^11.0.0",
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "zustand": "^4.5.0",
  "react-router-dom": "^6.23.0",
  "react-hook-form": "^7.51.0",
  "zod": "^3.23.0",
  "@hookform/resolvers": "^3.6.0",
  "recharts": "^2.12.0",
  "date-fns": "^3.6.0",
  "lucide-react": "^0.378.0",
  "clsx": "^2.1.0",
  "tailwind-merge": "^2.3.0"
}
```

### Desarrollo
```json
{
  "typescript": "^5.4.0",
  "vite": "^5.2.0",
  "@vitejs/plugin-react": "^4.3.0",
  "tailwindcss": "^3.4.0",
  "electron-builder": "^24.13.0",
  "concurrently": "^8.2.0",
  "electron-devtools-installer": "^3.2.0"
}
```

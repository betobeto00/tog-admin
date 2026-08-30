# 🛠️ Guía del Desarrollador — TOG Admin

Guía completa de comandos, scripts y procedimientos para el desarrollo de TOG Admin.

---

## 📋 Tabla de Contenidos

1. [Primeros Pasos](#1-primeros-pasos)
2. [Scripts de Desarrollo](#2-scripts-de-desarrollo)
3. [Construcción (Build)](#3-construcción-build)
4. [Git y Control de Versiones](#4-git-y-control-de-versiones)
5. [Publicar Release en GitHub](#5-publicar-release-en-github)
6. [Base de Datos](#6-base-de-datos)
7. [Traducciones (i18n)](#7-traducciones-i18n)
8. [Estructura del Proyecto](#8-estructura-del-proyecto)
9. [Flujo Completo de Actualización](#9-flujo-completo-de-actualización)
10. [Comandos Útiles de Terminal](#10-comandos-útiles-de-terminal)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Primeros Pasos

### Instalar dependencias

```bash
npm install
```

### Ejecutar en modo desarrollo

```bash
npm run dev
```

Esto compila el main process, inicia Vite dev server, y abre Electron conectado al dev server con hot reload.

### Verificar que todo compila sin errores

```bash
npm run typecheck
```

---

## 2. Scripts de Desarrollo

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Ejecutar en modo desarrollo (Vite + Electron) |
| `npm run typecheck` | Verificar errores de TypeScript |
| `npm run test` | Ejecutar tests (una vez) |
| `npm run test:watch` | Ejecutar tests en modo watch |
| `npm run preview` | Previsualizar el build del renderer |

---

## 3. Construcción (Build)

### Build completo del renderer (frontend)

```bash
npm run build:renderer
```

Compila el código React con Vite y ejecuta el inline-css script.

### Build del main process (backend Electron)

```bash
npm run build:main
```

Compila TypeScript del main process con `tsc`.

### Rebuild de módulos nativos

```bash
npm run rebuild
```

Necesario porque `better-sqlite3` y `serialport` son módulos nativos que deben compilarse para la versión de Electron.

### Build para desarrollo (sin instalador)

```bash
npm run build:win
```

Genera una carpeta `release/win-unpacked/` con el ejecutable portable.

### Build del instalador NSIS

```bash
npm run build:installer
```

Genera `release/TOG Admin Setup X.X.X.exe` — el instalador completo.

### Build portable

```bash
npm run build:portable
```

Genera una versión portable sin instalador.

### Build completo (recomendado para release)

```bash
npm run rebuild && npm run build:renderer && npm run build:main && electron-builder --win nsis
```

Esto es lo que ejecuta `npm run build:installer` internamente.

---

## 4. Git y Control de Versiones

### Ver estado actual

```bash
git status
```

### Ver cambios pendientes

```bash
git diff
```

### Ver historial reciente

```bash
git log --oneline -10
```

### Agregar archivos y commitear

```bash
# Agregar todos los cambios
git add -A

# O agregar archivos específicos
git add src/renderer/pages/LoginPage.tsx src/main/index.ts

# Commitear con mensaje descriptivo
git commit -m "feat: descripción del cambio"
```

### Push a GitHub

```bash
git push origin master
```

### Crear tag (para releases)

```bash
git tag -a v1.0.3 -m "v1.0.3 - Descripción del release"
git push origin v1.0.3
```

### Flujo completo de commit + push

```bash
git add -A
git commit -m "feat: mi cambio"
git push origin master
```

---

## 5. Publicar Release en GitHub

### Paso 1: Actualizar versión en package.json

```bash
# Cambiar manualmente la versión en package.json
# Ejemplo: de "1.0.2" a "1.0.3"
```

### Paso 2: Commit y push del código

```bash
git add -A
git commit -m "v1.0.3: descripción de los cambios"
git push origin master
```

### Paso 3: Build del instalador

```bash
npm run build:installer
```

### Paso 4: Crear tag

```bash
git tag -a v1.0.3 -m "v1.0.3 - Descripción"
git push origin v1.0.3
```

### Paso 5: Crear Release en GitHub

```bash
gh release create v1.0.6 \ --repo betobeto00/tog-admin \ --title "TOG Admin v1.0.6" \ --notes "## Cambios - Descripción del cambio 1 - Descripción del cambio 2"
```




### Paso 6: Subir el instalador al Release

```bash
gh release upload v1.0.3 "release/TOG Admin Setup 1.0.3.exe" \ --repo betobeto00 tog-admin --clobber
```

### Verificar que el Release está correcto

```bash
gh release view v1.0.3 --repo betobeto00/tog-admin
```

---

## 6. Base de Datos

### Migrar la base de datos

```bash
npm run db:migrate
```

### Ubicación de la DB

- **Desarrollo:** `data/tog-admin.db`
- **Producción:** `%APPDATA%/tog-admin/tog-admin.db`

### Archivos de la DB

- `tog-admin.db` — Base de datos principal
- `tog-admin.db-wal` — Write-Ahead Log
- `tog-admin.db-shm` — Shared memory file

---

## 7. Traducciones (i18n)

### Archivos de traducción

- **Renderer (frontend):**
  - `src/renderer/i18n/locales/es/translation.json`
  - `src/renderer/i18n/locales/en/translation.json`

- **Main process (backend):**
  - `src/main/i18n/locales/es.json`
  - `src/main/i18n/locales/en.json`

### Cómo usar traducciones en React

```tsx
import { useTranslation } from 'react-i18next'

function MiComponente() {
  const { t, i18n } = useTranslation()

  return (
    <div>
      <h1>{t('login.title')}</h1>
      <p>{i18n.language === 'es' ? 'Texto en español' : 'Text in English'}</p>
    </div>
  )
}
```

### Cambiar idioma programáticamente

```tsx
import { changeLang } from '../i18n'

await changeLang('es') // Español
await changeLang('en') // Inglés
```

### Keys de traducción más usadas

| Key | Español | Inglés |
|-----|---------|--------|
| `common.save` | Guardar | Save |
| `common.cancel` | Cancelar | Cancel |
| `common.delete` | Eliminar | Delete |
| `common.edit` | Editar | Edit |
| `common.create` | Crear | Create |
| `common.search` | Buscar | Search |
| `common.loading` | Cargando... | Loading... |
| `common.actions` | Acciones | Actions |
| `common.export` | Exportar | Export |
| `common.import` | Importar | Import |
| `common.print` | Imprimir | Print |
| `common.status` | Estado | Status |
| `common.notes` | Notas | Notes |

---

## 8. Estructura del Proyecto

```
tog-admin/
├── docs/                       # Documentación
├── packaging/                  # Configuración del instalador NSIS
│   ├── installer.nsh
│   └── installer.iss
├── public/                     # Assets estáticos (se copian al build)
│   ├── hero-bg.jpg             # Fondo del login
│   ├── logo.jpg                # Logo de la empresa
│   └── favicon-*.png           # Faviconos
├── resources/                  # Recursos para Electron
│   ├── icon.ico                # Icono del instalador (Windows)
│   └── icon.png                # Icono de la app
├── scripts/                    # Scripts auxiliares
│   └── inline-css.js
├── src/
│   ├── main/                   # Main process (Node.js/Electron)
│   │   ├── index.ts            # Entry point de Electron
│   │   ├── preload.ts          # Bridge entre main y renderer
│   │   ├── ipc-handlers.ts     # Handlers de IPC
│   │   ├── db/                 # Base de datos SQLite
│   │   │   ├── database.ts
│   │   │   └── migrate.ts
│   │   ├── i18n/               # Traducciones del main process
│   │   │   ├── index.ts
│   │   │   └── locales/
│   │   └── services/           # Servicios
│   │       ├── license.ts      # Licenciamiento
│   │       ├── crash-reporter.ts
│   │       ├── updater.ts      # Auto-actualizaciones
│   │       └── valorTerminal.ts # Terminal de pago
│   ├── renderer/               # Renderer process (React)
│   │   ├── main.tsx            # Entry point de React
│   │   ├── App.tsx             # Router principal
│   │   ├── index.css           # Estilos globales
│   │   ├── components/         # Componentes React
│   │   │   ├── layout/         # Layout, Sidebar, Header
│   │   │   ├── ui/             # Modal, ConfirmDialog, Toast
│   │   │   ├── pos/            # Componentes del POS
│   │   │   ├── ErrorBoundary.tsx
│   │   │   ├── ForcePasswordChange.tsx
│   │   │   ├── LicenseGate.tsx
│   │   │   └── Tutorial.tsx
│   │   ├── pages/              # Páginas de la app
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── POSPage.tsx
│   │   │   ├── InventarioPage.tsx
│   │   │   ├── VentasPage.tsx
│   │   │   ├── CajaPage.tsx
│   │   │   ├── ComprasPage.tsx
│   │   │   ├── ProveedoresPage.tsx
│   │   │   ├── ReportesPage.tsx
│   │   │   ├── QuotesPage.tsx
│   │   │   ├── ConfigPage.tsx
│   │   │   └── HelpPage.tsx
│   │   ├── stores/             # Estado global (Zustand)
│   │   │   └── auth.store.ts
│   │   ├── i18n/               # Traducciones del renderer
│   │   │   ├── index.ts
│   │   │   └── locales/
│   │   │       ├── es/translation.json
│   │   │       └── en/translation.json
│   │   └── lib/                # Utilidades
│   │       └── utils.ts
│   └── shared/                 # Código compartido (main + renderer)
│       ├── types.ts
│       └── validations.ts
├── data/                       # Base de datos (desarrollo)
├── dist/                       # Build del renderer (Vite)
├── dist-electron/              # Build del main process (tsc)
├── release/                    # Instaladores generados
├── package.json
├── tsconfig.json               # TypeScript renderer
├── tsconfig.main.json          # TypeScript main process
├── vite.config.ts              # Configuración de Vite
└── tailwind.config.ts          # Configuración de Tailwind
```

---

## 9. Flujo Completo de Actualización

Para publicar una nueva versión con auto-update:

```bash
# 1. Cambiar versión en package.json
#    "version": "1.0.3"

# 2. Commit y push del código
git add -A
git commit -m "v1.0.3: descripción de los cambios"
git push origin master

# 3. Build del instalador
npm run build:installer

# 4. Crear tag
git tag -a v1.0.3 -m "v1.0.3"
git push origin v1.0.3

# 5. Crear Release en GitHub
gh release create v1.0.3 \
  --repo betobeto00/tog-admin \
  --title "TOG Admin v1.0.3" \
  --notes "Changelog aquí..."

# 6. Subir el instalador
gh release upload v1.0.3 "release/TOG Admin Setup 1.0.3.exe" \
  --repo betobeto00/tog-admin --clobber
```

Los usuarios con versiones anteriores recibirán la notificación de actualización automáticamente al abrir la app.

---

## 10. Comandos Útiles de Terminal

### Desarrollo

```bash
# Iniciar en modo desarrollo
npm run dev

# Verificar tipos
npm run typecheck

# Ejecutar tests
npm run test

# Tests en watch mode
npm run test:watch
```

### Build

```bash
# Build completo con instalador
npm run build:installer

# Build sin instalador (carpeta portable)
npm run build:win

# Solo renderer
npm run build:renderer

# Solo main process
npm run build:main

# Rebuild módulos nativos
npm run rebuild
```

### Git

```bash
# Estado
git status

# Historial
git log --oneline -10

# Diffs
git diff
git diff --staged

# Commit
git add -A && git commit -m "msg"

# Push
git push origin master

# Tags
git tag -a v1.0.3 -m "v1.0.3"
git push origin v1.0.3

# Ver todos los tags
git tag -l
```

### GitHub CLI (gh)

```bash
# Ver un release
gh release view v1.0.3 --repo betobeto00/tog-admin

# Listar releases
gh release list --repo betobeto00/tog-admin

# Crear release
gh release create v1.0.3 --repo betobeto00/tog-admin --title "v1.0.3" --notes "..."

# Subir asset al release
gh release upload v1.0.3 "archivo.exe" --repo betobeto00/tog-admin --clobber

# Eliminar release (cuidado)
gh release delete v1.0.3 --repo betobeto00/tog-admin --yes
```

### Base de datos

```bash
# Migrar DB
npm run db:migrate

# Abrir DB con sqlite3 (si está instalado)
sqlite3 data/tog-admin.db ".tables"
sqlite3 data/tog-admin.db "SELECT * FROM usuarios;"
```

---

## 11. Troubleshooting

### Error: "Serial port not found"

```bash
npm run rebuild
```

### Error: "Module not found" después de instalar dependencias

```bash
rm -rf node_modules package-lock.json
npm install
```

### El instalador no tiene el icono

Verificar que existan los archivos:
```bash
ls resources/icon.ico
ls resources/icon.png
```

Si no existen, regenerarlos:
```bash
ffmpeg -y -i public/logo.jpg -vf "scale=256:256" resources/icon.png
ffmpeg -y -i public/logo.jpg -vf "scale=256:256" resources/icon.ico
```

### TypeScript errores TS6305

Son archivos `.d.ts` de una build anterior. Limpiar:
```bash
rm -rf dist-electron
npm run build:main
```

### Auto-update no funciona

1. Verificar que la versión en `package.json` sea mayor a la instalada
2. Verificar que exista un Release en GitHub con el tag correcto (`vX.Y.Z`)
3. Verificar que el `.exe` esté subido como asset del Release
4. Verificar la configuración `publish` en `package.json`:
   ```json
   "publish": {
     "provider": "github",
     "owner": "betobeto00",
     "repo": "tog-admin"
   }
   ```
5. Verificar que el usuario tenga v1.0.3 o superior (versions anteriores no tienen auto-update)

### El logo no aparece en el instalador

Verificar que `package.json` tenga las rutas correctas:
```json
"win": {
  "icon": "resources/icon.ico"
},
"nsis": {
  "installerIcon": "resources/icon.ico",
  "uninstallerIcon": "resources/icon.ico",
  "installerHeaderIcon": "resources/icon.ico"
}
```

### La app no encuentra la DB en producción

La DB en producción está en: `%APPDATA%/tog-admin/tog-admin.db`

En desarrollo está en: `data/tog-admin.db`

### Error NSIS: "Variable not referenced"

El script `installer.nsh` tiene una variable declarada que NSIS no detecta como usada. Solución:

```nsh
; NO usar Var a nivel de archivo si solo se usa en macros
; En su lugar, usar registros temporales $0, $1 directamente
!macro customInit
  System::Call 'kernel32::GetUserDefaultUILanguage() i .r0'
  IntOp $1 $0 & 0x3FF
  ${If} $1 == 0x0A
    StrCpy $0 "es"
  ${Else}
    StrCpy $0 "en"
  ${EndIf}
!macroend
```

### El instalador muestra diálogo de idioma después de Finalizar

Esto era un bug del script NSIS anterior. Se resolvió eliminando la página manual de idioma y usando auto-detección del sistema Windows. Ver `packaging/installer.nsh`.

---

## 📝 Convenciones de Commit

Usar el formato:

```
tipo(corto): descripción del cambio

- Detalle 1
- Detalle 2
```

### Tipos de commit

| Tipo | Uso |
|------|-----|
| `feat` | Nueva funcionalidad |
| `fix` | Corrección de bug |
| `docs` | Documentación |
| `style` | Formato de código (sin cambio de lógica) |
| `refactor` | Refactorización de código |
| `test` | Tests |
| `chore` | Tareas de mantenimiento |

### Ejemplos

```bash
git commit -m "fix(inventario): corregido error 't is not defined'"
git commit -m "feat(login): agregado sistema de auto-actualizaciones"
git commit -m "docs: agregada guía del desarrollador"
```

---

## 🔗 Enlaces Útiles

- **Repositorio:** https://github.com/betobeto00/tog-admin
- **Releases:** https://github.com/betobeto00/tog-admin/releases
- **Electron Docs:** https://www.electronjs.org/docs
- **electron-builder:** https://www.electron.build/
- **electron-updater:** https://www.electron.build/auto-update
- **Vite:** https://vitejs.dev/
- **Tailwind CSS:** https://tailwindcss.com/
- **Zustand:** https://zustand-demo.pmnd.rs/

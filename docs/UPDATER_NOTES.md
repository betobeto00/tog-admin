# Notas sobre Auto-Actualización (electron-updater)

## Cómo funciona

`electron-updater` revisa GitHub Releases para detectar nuevas versiones. Cuando hay una nueva:

1. Tu app consulta `https://github.com/{owner}/{repo}/releases/latest`
2. GitHub redirige a `releases/tag/{version}`
3. electron-updater descarga `latest.yml` desde `releases/download/{version}/latest.yml`
4. Compara la versión del .yml con la versión actual de la app
5. Si hay actualización, descarga el `.exe` y el `.blockmap`
6. Aplica la actualización en el próximo reinicio

**Sin `latest.yml`, electron-updater no puede saber que existe una nueva versión** y reporta "up to date" aunque la release exista en GitHub.

## Archivos necesarios en cada release

| Archivo | Generado por | Obligatorio |
|---------|---------------|-------------|
| `TOG Admin Setup x.y.z.exe` | electron-builder | ✅ Sí |
| `latest.yml` | electron-builder | ✅ Sí |
| `TOG Admin Setup x.y.z.exe.blockmap` | electron-builder | Recomendado |
| `latest.yml.gz` | electron-builder | Opcional |

Todos se generan en `release/` cuando corres `npm run build:installer`.

## Repo público (configuración actual)

Este repo es **público**. `electron-updater` consume `releases.atom` y descarga los assets directamente sin autenticación. No se requiere Personal Access Token ni variables de entorno especiales.

```json
// package.json > build.publish (sin private, sin token)
"publish": {
  "provider": "github",
  "owner": "betobeto00",
  "repo": "tog-admin"
}
```

`src/main/services/updater.ts` **NO** lee ni usa `GH_TOKEN` ni `GITHUB_TOKEN`. El token que pueda existir localmente en `.env` (ignorado por `.gitignore`) es residual y se ignora por completo.

> Nota histórica: secciones anteriores de este documento describían el flujo para repos privados (con `GH_TOKEN`). Ese flujo ya no aplica porque el repo es público y el código del updater no consume tokens. Si en el futuro el repo vuelve a ser privado, restaurar el flujo documentado arriba y añadir `GH_TOKEN` al updater.

---

## Procedimiento correcto para publicar release

### 1. Preparar el código
```bash
# Editar version en package.json
# Editar Manual del Usuario (si aplica)
git add -A
git commit -m "Release v1.0.x: <cambios>"
git push origin master
```

### 2. Crear y pushear el tag
```bash
git tag -a v1.0.x -m "Release v1.0.x - <resumen>"
git push origin v1.0.x
```

### 3. Compilar el instalador (sin publicar)
```bash
npm run build:installer
```

Esto tarda ~5-10 minutos y genera en `release/`:
- `TOG Admin Setup 1.0.x.exe` (~100 MB, con espacios)
- `latest.yml` (declara el nombre con **guiones**: `TOG-Admin-Setup-1.0.x-x64.exe`)
- `TOG Admin Setup 1.0.x.exe.blockmap`

> Renombra los dos binarios al nombre que declara `latest.yml` **antes** de subirlos (ver “Gotcha: nombres de archivo”).

### 4. Crear la release en GitHub

**Opción A — Manual con `gh` (recomendado para control fino):**
```bash
# 1. Copiar los 3 archivos con el nombre EXACTO que declara latest.yml
mkdir -p release/_upload
cp "release/TOG Admin Setup 1.0.x.exe" "release/_upload/TOG-Admin-Setup-1.0.x-x64.exe"
cp "release/TOG Admin Setup 1.0.x.exe.blockmap" "release/_upload/TOG-Admin-Setup-1.0.x-x64.exe.blockmap"
cp release/latest.yml release/_upload/latest.yml

# 2. Crear la release subiendo los 3 assets (no solo el .exe)
gh release create v1.0.x \
  --repo betobeto00/tog-admin \
  --title "TOG Admin v1.0.x" \
  --notes-file release/RELEASE_NOTES.md \
  "release/_upload/TOG-Admin-Setup-1.0.x-x64.exe" \
  "release/_upload/TOG-Admin-Setup-1.0.x-x64.exe.blockmap" \
  "release/_upload/latest.yml"
```

**Opción B — electron-builder hace todo (un solo paso):**
```bash
npm run build:installer -- --publish always
```
Esto compila, crea la release en GitHub y sube todos los assets automáticamente. Como el repo es público, no requiere tokens.

### ⚠️ Gotcha: nombres de archivo

electron-builder genera el instalador **con espacios** (`TOG Admin Setup 1.0.x x64.exe`) pero escribe `latest.yml` con **guiones**:

```yaml
path: TOG-Admin-Setup-1.0.x-x64.exe
files:
  - url: TOG-Admin-Setup-1.0.x-x64.exe
```

electron-updater resuelve la descarga con `p.replace(/ /g, "-")` (`electron-updater/out/providers/GitHubProvider.js`), o sea que **pide guiones**. GitHub, en cambio, convierte los **espacios en puntos** al guardar el asset.

**Regla:** el asset subido debe llamarse **igual que el `path` de `latest.yml` (guiones)**. Si se sube con el nombre local (espacios → puntos) la URL del updater responde **404** y la app no puede descargar la actualización, aunque `latest.yml` se descargue bien y la release exista.

## Verificación rápida

Después de subir, en tu terminal:
```bash
gh release view v1.0.x --repo betobeto00/tog-admin --json assets \
  --jq '.assets[].name'
```

Debe listar exactamente los nombres que declara `latest.yml`:
```
TOG-Admin-Setup-1.0.x-x64.exe
TOG-Admin-Setup-1.0.x-x64.exe.blockmap
latest.yml
```

Y la URL que usa el updater debe responder 200:
```bash
curl -s -o /dev/null -L -I -w '%{http_code}\n' \
  "https://github.com/betobeto00/tog-admin/releases/download/v1.0.x/TOG-Admin-Setup-1.0.x-x64.exe"
```

Si solo aparece el .exe, falta el metadata y los usuarios no recibirán la actualización. Si el nombre no coincide, la descarga da 404.

## Lecciones aprendidas

**v1.0.7 — faltaba el metadata.** En el primer build de v1.0.7 solo se subió el `.exe` con `gh release upload "release/TOG Admin Setup 1.0.7.exe"`. Resultado: los usuarios con v1.0.6 instalada recibieron "up to date" al hacer Check Updates. Se tuvo que re-subir manualmente `latest.yml` y `.blockmap` para arreglarlo.

**v1.3.0 — el nombre del asset no coincidía (404 en la descarga).** Las releases anteriores (1.0.x–1.2.1) subieron los binarios con el nombre local, así que GitHub los guardó como `TOG.Admin.Setup.1.2.1.x64.exe` mientras `latest.yml` pedía `TOG-Admin-Setup-1.2.1-x64.exe`. Verificado el 19-Sep-2026:

| URL | Código |
|-----|--------|
| `.../v1.2.1/TOG-Admin-Setup-1.2.1-x64.exe` (lo que pide el updater) | **404** |
| `.../v1.2.1/TOG.Admin.Setup.1.2.1.x64.exe` (el asset real) | 200 |

Desde v1.3.0 los assets se suben con el nombre con guiones y la URL del updater responde 200 (`TOG-Admin-Setup-1.3.0-x64.exe` + su `.blockmap`). Las releases viejas quedaron como están; los usuarios en ≤1.2.1 se actualizan correctamente a v1.3.0 porque el `latest.yml` de v1.3.0 ya apunta a un asset que existe.

**Desde entonces**: usar el comando de 3-asset upload documentado arriba.
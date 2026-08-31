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

## ⚠️ Repo privado requiere autenticación

**Si tu repo en GitHub es privado**, electron-updater NO puede consultar `releases.atom` ni descargar los assets sin un Personal Access Token (PAT). El síntoma típico es:

```
HttpError: 404
"method: GET url: https://github.com/{owner}/{repo}/releases.atom
 Please double check that your authentication token is correct."
```

### Solución implementada: token embebido en build

El proyecto actual usa **repo privado** con token embebido. El flujo es:

1. **Generar Personal Access Token** (PAT) en GitHub:
   - https://github.com/settings/tokens
   - Tipo: **classic**
   - **Scope mínimo: `public_repo` + `repo:status` + `Contents: Read`**
     - O solo `Contents: Read` si tu repo es 100% privado
   - **NO dar scope `repo` completo** — ese permite borrar el repo, crear archivos, etc.
   - Expiration: 90 días (renovar antes de expirar)

2. **Cargar el token desde `.env`** o variable de entorno:
   ```bash
   # Opción A: en .env (recomendado, queda fuera del repo)
   echo "GH_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx" >> .env

   # Opción B: variable de entorno antes del build
   $env:GH_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxx"
   ```

3. **Build del instalador**:
   ```bash
   npm run build:installer
   ```
   Durante el build, electron-builder lee `GH_TOKEN` y la inyecta en el binario como `process.env.GH_TOKEN` (solo en el main process, no en renderer). El token queda "embebido" pero no visible en strings del .exe (porque electron-builder usa `Buffer` para env vars).

4. **Subir el instalador a GitHub** (necesitas el MISMO token para publicar):
   ```bash
   # electron-builder puede publicar directamente con el mismo token:
   npm run build:installer -- --publish always

   # O subir manualmente con gh (usando el mismo GH_TOKEN):
   gh release create v1.0.x --repo betobeto00/tog-admin --title "..." --notes-file release/RELEASE_NOTES.md
   gh release upload v1.0.x "release/TOG Admin Setup 1.0.x.exe" "release/latest.yml" "release/TOG Admin Setup 1.0.x.exe.blockmap" --repo betobeto00/tog-admin --clobber
   ```

### Cómo funciona en runtime

Cuando el usuario final abre la app y hace Check Updates:

1. `src/main/services/updater.ts` lee `process.env.GH_TOKEN` (inyectada en build)
2. Llama `autoUpdater.addAuthHeader('token <token>')`
3. electron-updater hace `GET https://github.com/{owner}/{repo}/releases.atom` con header `Authorization: token ghp_...`
4. GitHub valida el token (debe tener scope `Contents: Read` o `repo:status`)
5. Si es válido → retorna el feed con todas las releases
6. electron-updater descarga `latest.yml` y compara versiones

### ⚠️ Seguridad del token embebido

El token **no es secreto perfecto** dentro del .exe — un atacante motivado con `asar extract` puede encontrarlo. Pero el scope **`Contents: Read`** significa que aunque alguien robe el token:

- ✅ Puede descargar releases y assets (eso es lo que queremos)
- ❌ NO puede modificar, borrar, o subir archivos al repo
- ❌ NO puede crear branches, tags, o commits
- ❌ NO puede cambiar permisos

**Si el token se filtra**, las consecuencias son limitadas. Solo necesitas **regenerarlo** cada 90 días (GitHub te avisa).

### Rotación del token

Cuando el token expire o se filtre:
1. Ve a https://github.com/settings/tokens
2. Click **Delete** en el token viejo
3. **Generate new token** con el mismo scope mínimo
4. Actualiza tu `.env`
5. Rebuild (`npm run build:installer`)
6. Distribuye el nuevo instalador

### Alternativa: hacer el repo público (más simple)

Si decides que el riesgo de repo público es aceptable:
- **Ventaja**: cero setup, electron-updater funciona out-of-the-box sin token
- **Desventaja**: cualquier persona puede ver el código fuente y los scripts de licencias
- **Mitigación**: la clave privada RSA NO está en el repo (`keys/private.key` está en .gitignore)

**Si haces el repo público**, elimina `"private": true` de `package.json > build.publish` para que el updater no requiera token.

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
- `TOG Admin Setup 1.0.x.exe` (~94 MB)
- `latest.yml`
- `TOG Admin Setup 1.0.x.exe.blockmap`

### 4. Crear la release en GitHub

**Opción A — Manual con `gh` (recomendado para control fino):**
```bash
gh release create v1.0.x \
  --repo betobeto00/tog-admin \
  --title "TOG Admin v1.0.x" \
  --notes-file release/RELEASE_NOTES.md

# Subir los 3 assets (no solo el .exe)
gh release upload v1.0.x \
  "release/TOG Admin Setup 1.0.x.exe" \
  "release/latest.yml" \
  "release/TOG Admin Setup 1.0.x.exe.blockmap" \
  --repo betobeto00/tog-admin \
  --clobber
```

**Opción B — electron-builder hace todo (un solo paso):**
```bash
npm run build:installer -- --publish always
```
Esto compila, crea la release en GitHub, y sube todos los assets automáticamente. Requiere que `GH_TOKEN` esté configurado en el entorno.

### ⚠️ Gotcha: nombres de archivo

electron-builder genera los assets con el nombre original (ej: `TOG-Admin-Setup-1.0.7.exe`), pero GitHub reemplaza los espacios por puntos en los URLs de assets (`TOG.Admin.Setup.1.0.7.exe`).

El `latest.yml` generado contiene el nombre con guiones. electron-updater puede resolver esto automáticamente porque reemplaza espacios por guiones internamente, **pero es buena práctica editar el .yml para que coincida exactamente** con el nombre del asset subido.

## Verificación rápida

Después de subir, en tu terminal:
```bash
gh release view v1.0.x --repo betobeto00/tog-admin --json assets \
  --jq '.assets[].name'
```

Debe listar:
```
TOG.Admin.Setup.1.0.x.exe
latest.yml
TOG.Admin.Setup.1.0.x.exe.blockmap
```

Si solo aparece el .exe, falta el metadata y los usuarios no recibirán la actualización.

## Lección aprendida (v1.0.7)

En el primer build de v1.0.7 solo se subió el `.exe` con `gh release upload "release/TOG Admin Setup 1.0.7.exe"`. Resultado: los usuarios con v1.0.6 instalada recibieron "up to date" al hacer Check Updates. Se tuvo que re-subir manualmente `latest.yml` y `.blockmap` para arreglarlo.

**Desde entonces**: usar el comando de 3-asset upload documentado arriba.
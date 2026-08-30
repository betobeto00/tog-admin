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
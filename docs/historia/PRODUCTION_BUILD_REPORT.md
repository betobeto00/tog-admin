# Reporte: Problema de Build de Producción

> 🕓 **Reporte histórico de un incidente ya resuelto (28-Ago-2026).** Describe el bug de pantalla blanca en producción y su fix; el pipeline de build puede haber cambiado desde entonces (ver `README.md` → Build).

**Fecha:** 28-Ago-2026
**Estado:** ✅ RESUELTO
**Síntoma:** La app funcionaba en `npm run dev` pero mostraba pantalla blanca en `TOG Admin.exe`

---

## 1. Lo que SÍ funciona

| Entorno | Resultado |
|---------|-----------|
| `npm run dev` (Vite dev server) | ✅ Todo funciona: login, CSS, navegación |
| Consola del renderer (DevTools) | ✅ `React mounted` se confirma |
| Main process | ✅ DB inicializada, IPC handlers registrados |
| Empaquetado (electron-builder) | ✅ Exe generado, procesos arrancan |

## 2. Lo que NO funciona

| Prueba | Resultado |
|--------|-----------|
| CSS via `<link rel="stylesheet">` | ❌ No carga desde asar |
| CSS inline en `<style>` | ❌ Tampoco se aplica |
| `<script type="module">` | ❌ No ejecuta desde file:// |
| `<script type="text/javascript">` | ❌ Tampoco |
| Formato IIFE de Vite | ❌ No resuelve el problema |

## 3. Diagnóstico actual

### 3.1 El problema NO es CSS
Se confirmó que el CSS inline SÍ está en el HTML (28KB de Tailwind). El body tiene estilos. Pero el contenido de React no aparece.

### 3.2 El problema NO es que React no monte
En pruebas anteriores con logging, se confirmó:
```
[TOG Admin] Renderer starting...
[TOG Admin] Root element: [object HTMLDivElement]
[TOG Admin] React mounted
```

### 3.3 El problema ES de RENDERING
React monta pero el output no es visible. Posibles causas:

1. **El JS se ejecuta pero las lazy imports fallan silenciosamente**
   - `React.lazy()` falla y Suspense no tiene fallback visible
   - El error se pierde porque no hay error boundary

2. **El CSS se carga pero las clases de Tailwind no aplican**
   - Tailwind CSS purga clases no usadas en build
   - Si el purge es agresivo, puede eliminar clases necesarias

3. **El Base URL relativo `./` no resolve correctamente**
   - `base: './'` en vite.config.ts genera paths relativos
   - Desde asar, la "base" puede ser diferente

4. **El protocolo asar:// maneja diferente los scripts**
   - Los scripts se cargan pero el scope/execution context es diferente

## 4. Diferencias entre Dev y Production

| Aspecto | Dev (`npm run dev`) | Production (`TOG Admin.exe`) |
|---------|---------------------|------------------------------|
| Servidor | HTTP (localhost:5173) | file:// o asar:// |
| CORS | ✅ Headers completos | ❌ Sin headers |
| MIME types | ✅ Correctos | ❌ Depende del protocolo |
| ES Modules | ✅ Funcionan | ❌ Requieren CORS |
| CSS loading | ✅ HTTP link tags | ❌ asar no sirve links |
| HMR | ✅ Hot reload | N/A |
| Source maps | ✅ Disponibles | ❌ No |

## 5. Steps de diagnóstico pendientes

### 5.1 Agregar error boundary global
```tsx
// En main.tsx, envolver App en un ErrorBoundary
// que muestre errores visibles en pantalla
```

### 5.2 Verificar que el JS SÍ ejecuta
```html
<!-- Agregar en index.html antes del script -->
<script>
  document.title = 'JS works: ' + Date.now();
</script>
```

### 5.3 Probar sin lazy loading
Cambiar `React.lazy()` por imports estáticos para ver si el problema es el code splitting.

### 5.4 Usar `webContents.executeJavaScript`
Inyectar un script desde el main process para verificar el estado del DOM.

### 5.5 Probar con `loadURL` y protocolo personalizado
Registrar un protocolo personalizado que sirva archivos con headers CORS correctos.

### 5.6 Verificar el asar content
Extraer el asar y verificar que todos los archivos están presentes y no corruptos.

## 6. Archivos involucrados

| Archivo | Rol |
|---------|-----|
| `vite.config.ts` | Build config: base, format, plugins |
| `scripts/inline-css.js` | Post-build: inline CSS, fix script tags |
| `src/main/index.ts` | Electron: loadFile/loadURL, window config |
| `src/renderer/main.tsx` | React entry point |
| `src/renderer/App.tsx` | Router + lazy loading + Suspense |
| `package.json` | Build scripts, electron-builder config |

## 7. Workaround temporal

Mientras se resuelve el problema de producción, la app funciona perfectamente en modo desarrollo:

```bash
npm run dev
```

Esto inicia Vite dev server + Electron con hot-reload.

## 8. Próximos pasos recomendados

1. **P1:** Agregar ErrorBoundary que muestre errores en pantalla
2. **P2:** Quitar lazy loading temporalmente para aislar el problema
3. **P3:** Probar `loadURL` con protocolo personalizado (custom protocol)
4. **P4:** Verificar si el problema es Chromium/Electron version específica
5. **P5:** Probar build sin Vite (usar webpack o rollup directamente)

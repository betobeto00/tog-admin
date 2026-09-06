# Fase 5 — Modelo de Producto (tipo, marca, imagen)

> 🕓 **Documento de planificación** — define el cierre de Fase 5 (tipo
> producto/servicio, marca, imagen) sin sobrediseñar. La DB ya tiene la
> base (subcategorías, marca, columna `imagen` y columna `tipo`); falta cerrar
> el comportamiento del POS y la UI.

---

## Estado actual (verificado contra código)

| Pieza | Estado | Archivo |
|-------|--------|---------|
| Columna `tipo TEXT DEFAULT 'producto'` en `productos` | ✅ existe | `src/main/db/database.ts:462` (migración 017) |
| Tabla `subcategorias` + `productos.subcategoria_id` | ✅ existe | `src/main/db/database.ts:467-479` (migración 018) |
| Columna `marca TEXT` en `productos` | ✅ existe | `src/main/db/database.ts:485` (migración 019) |
| Columna `imagen TEXT` en `productos` | ✅ existe pero **no se usa** (default `NULL`, sin UI) | `src/main/db/database.ts:148` (migración 003) |
| Migración 020: "venta_detalles_libre" | ✅ existe, no relacionado | — |
| UI de Inventario: selector de subcategoría | 🟡 parcial | `src/renderer/pages/InventarioPage.tsx` |
| UI de Inventario: campo de marca en form | 🟡 parcial | idem |
| UI de Inventario: subir imagen | ❌ no implementado | — |
| POS distingue "producto" de "servicio" en stock | 🟡 parcial — el tipo existe pero el stock siempre se descuenta (servicio NO debería) | ver bloque "Comportamiento esperado" |
| "Venta rápida" del POS como servicio ad-hoc | ✅ existe (campo `esVentaRapida` en el cart) | `src/renderer/pages/POSPage.tsx` |

## Comportamiento esperado

### Tipo producto vs servicio

| Caso | Hoy | Esperado |
|------|-----|----------|
| Producto con stock > 0 | Se vende, descuenta stock, suma al `venta_detalle` con `producto_id` real | Igual (sin cambios) |
| Servicio predefinido (ej: "Reparación básica") | Se vende pero también descuenta stock (incorrecto) | **No descuenta stock**, queda registrado igual en `venta_detalle` con `producto_id` real |
| Venta rápida (servicio ad-hoc sin producto) | Cart tiene flag `esVentaRapida: true` | Igual (sin cambios) — es el camino actual para servicios sin producto |
| Reportes: productos vs servicios | No distingue | **Sí distinguir** — gráfica de "ventas de productos" vs "ventas de servicios" en ReportesPage |
| Stock: ver si el servicio "mermó" stock | No, pero el bug es que sí | No (servicio = `UPDATE productos SET stock = stock - X WHERE id = Y AND tipo != 'servicio'` ya está bien en `createVenta`) |

**Conclusión**: la lógica ya está bien escrita en `createVenta` (línea 100 de `ventas.ts`: `AND tipo != 'servicio'`). Solo falta:
- Marcar los servicios predefinidos con `tipo = 'servicio'` al crearlos.
- UI que distinga claramente entre producto y servicio en Inventario.
- Reportes que desglosen por tipo.

### Subcategorías

Ya existe. La UI de Inventario lo soporta parcialmente. Lo que falta:
- Filtro por subcategoría en InventarioPage (hoy solo se filtra por categoría).
- Breadcrumb categoría → subcategoría en la lista de productos.
- Migrar al tipo de producto `servicio` (¿hay subcategorías de servicios? Por ahora no: si `tipo='servicio'`, la subcategoría es opcional).

### Marca

Campo `marca` ya existe. Falta:
- UI: input en el form de producto + filtro en InventarioPage.
- Listado: columna "Marca" opcional en la tabla de productos.
- Reportes: filtro "top productos por marca" (nice-to-have, no crítico para v1).

### Imagen del producto

**Decisión arquitectural clave** (tomar antes de implementar):

| Opción | Pros | Contras |
|--------|------|---------|
| **A) Base64 en DB** (`imagen` ya es `TEXT`, listo) | Simple, una sola fuente de verdad, fácil de backup | DB crece, lento en reportes con miles de productos |
| **B) Filesystem** (carpeta `app.getPath('userData')/imagenes/`) + ruta en DB | DB liviana, escalable | Backup debe incluir la carpeta; riesgo de archivos huérfanos |
| **C) Filesystem + URL firmada servida por Electron** | Mejor performance | Requiere protocolo custom, más complejo |

**Recomendación**: **Opción B** (filesystem). Es lo que se hace en la mayoría de POS modernos, y la DB no se infla. Migrar de la columna `imagen TEXT` a una columna `imagen_path TEXT` (la columna actual `imagen` se ignora o se usa como cache de path).

### Detalle de imagen (opción B)

```
%APPDATA%/tog-admin/imagenes/
  ├── 42.jpg          (producto_id=42)
  ├── 42_thumb.jpg    (versión miniatura, opcional)
  ├── 78.jpg
  └── 78.jpg
```

- Formatos aceptados: JPG, PNG, WebP.
- Tamaño máx: 2 MB original, 200 KB miniatura.
- Validación: magic bytes (no solo MIME), rechazar EXIF (privacidad), rechazar SVGs (XSS).
- UI: drag-and-drop en el form, preview inmediato, botón "Quitar imagen".
- Backup: el script `backup:create` debe incluir la carpeta `imagenes/`.

## Diseño propuesto

### Cambios en DB (migración 030)

```sql
-- Fase 5 cierre
ALTER TABLE productos ADD COLUMN imagen_path TEXT;  -- ruta en filesystem
UPDATE productos SET tipo = 'servicio' WHERE unidad = 'servicio';
-- (imagen_path inicialmente NULL, se usa desde la UI)
```

> La columna `imagen` previa queda en DB pero no se usa. No la borramos para no romper DBs viejas. La nueva `imagen_path` es la que toma el rol.

### Servicios transversales

**`src/main/services/imagenes.ts`** (nuevo):

```ts
import { app } from 'electron'
import path from 'path'
import fs from 'fs/promises'

const DIR = () => path.join(app.getPath('userData'), 'imagenes')

export async function saveImagen(productoId: number, buffer: Buffer, ext: 'jpg' | 'png' | 'webp'): Promise<string> {
  await fs.mkdir(DIR(), { recursive: true })
  const file = path.join(DIR(), `${productoId}.${ext}`)
  await fs.writeFile(file, buffer)
  return file
}

export async function deleteImagen(productoId: number): Promise<void> {
  for (const ext of ['jpg', 'png', 'webp']) {
    const file = path.join(DIR(), `${productoId}.${ext}`)
    await fs.unlink(file).catch(() => {})
  }
}

export function getImagenPath(productoId: number): string | null {
  for (const ext of ['jpg', 'png', 'webp']) {
    const file = path.join(DIR(), `${productoId}.${ext}`)
    if (fs.existsSync(file)) return file
  }
  return null
}
```

**IPC handler**:

```ts
handleIpc('productos:set-imagen', async (_e, data: { id: number; data: { buffer: number[]; ext: 'jpg'|'png'|'webp' }; usuario_id: number }) => {
  // permiso inventario_edit
  // Validar tamaño máx 2MB
  // Validar magic bytes
  // Validar ext
  // saveImagen(id, Buffer.from(data.buffer), data.ext)
  return { success: true, imagen_path: `imagenes/${id}.${data.ext}` }
})
```

### Cambios en UI

**`src/renderer/pages/InventarioPage.tsx`** (form de producto):
- Selector "Tipo": radio entre `producto` y `servicio`. Default `producto`.
- Input "Marca" (texto libre, opcional).
- Dropzone de imagen: drag-and-drop o file input. Muestra preview con botón "Quitar".

**`src/renderer/components/ProductImage.tsx`** (nuevo, mini componente):
- Recibe `productoId`, renderiza `<img src="..." />` con fallback a placeholder.
- Usa `window.api.invoke('productos:get-imagen', { id })` que devuelve `file://...` o null.

**`src/renderer/pages/POSPage.tsx`**:
- En el resultado de búsqueda y en el carrito, mostrar miniatura del producto (60×60).
- Si `tipo = 'servicio'`, no mostrar "stock" sino un tag "Servicio".

**`src/renderer/pages/ReportesPage.tsx`**:
- Toggle "Desglosar por tipo" en el reporte de ventas.
- Nueva métrica: "Servicios vendidos: $X" vs "Productos vendidos: $Y".

### Backup

`src/main/modules/configuracion/backup.ts` debe incluir la carpeta `imagenes/`. Hoy solo respalda la DB.

```ts
// Dentro de createBackup(), después de copiar la DB
const imagenesDir = path.join(app.getPath('userData'), 'imagenes')
if (fs.existsSync(imagenesDir)) {
  await tar.appendDir(imagenesDir, 'imagenes')
}
```

## Decisiones pendientes

| Decisión | Opciones | Recomendación |
|----------|----------|---------------|
| Imagen: DB vs filesystem | A (DB base64) · B (filesystem) · C (URL firmada) | **B** (filesystem) |
| ¿Borrar imagen al eliminar producto? | Sí (al eliminar, borrar el archivo) · No (queda huérfano) | **Sí** — el handler `productos:delete` llama `deleteImagen(id)` |
| ¿Miniatura automática? | Sí, con sharp/canvas · No, solo original | **No por ahora** (sharp agrega dep nativa). v2: usar la misma imagen, redimensionada por CSS. |
| ¿Tipo en POS para servicios predefinidos? | Mostrar como etiqueta visible · No distinguir visualmente | **Etiqueta visible** (consistencia con "Venta rápida") |
| ¿Categoría separada para servicios? | Sí (`categoria_servicio`) · No, misma `categorias` con filtro por tipo | **No** — misma tabla, filtro por `tipo` |
| Marca libre vs catálogo de marcas | Libre · Catálogo con autocompletar | **Libre en v1**, autocompletar después |
| Reportes: desglose tipo | Sí, en reporte existente · Reporte nuevo | **Toggle** en el reporte existente |

## Archivos a tocar

| Archivo | Cambio |
|---------|--------|
| `src/main/db/database.ts` | Migración 030: agregar `imagen_path` y marcar servicios por unidad |
| `src/main/services/imagenes.ts` | **NUEVO** — `saveImagen`, `deleteImagen`, `getImagenPath` |
| `src/main/modules/inventario/productos.ts` | Handler `productos:set-imagen` + usar `imagen_path` en CRUD |
| `src/main/ipc-channels.ts` + `src/shared/types.ts` | Canal y tipo `productos:set-imagen` |
| `src/main/modules/configuracion/backup.ts` | Incluir carpeta `imagenes/` en el backup |
| `src/main/preload.ts` | API `productos.setImagen`, `productos.getImagen` |
| `src/renderer/pages/InventarioPage.tsx` | Form: tipo, marca, dropzone de imagen |
| `src/renderer/components/ProductImage.tsx` | **NUEVO** — componente con placeholder |
| `src/renderer/pages/POSPage.tsx` | Miniatura en resultados y carrito + tag "Servicio" |
| `src/renderer/pages/ReportesPage.tsx` | Toggle "Desglosar por tipo" + métricas |
| `src/renderer/i18n/locales/{es,en}/translation.json` | Keys: `producto.tipo`, `producto.marca`, `producto.imagen`, `producto.dropzone`, `producto.esServicio` |

## Anti-patrones (NO hacer)

- ❌ **NO** guardar la imagen como base64 en DB (la columna `imagen TEXT` parece tentadora, pero la DB se infla con miles de productos).
- ❌ **NO** usar `img.src = \`file://...\`` sin sanitizar el path (si la ruta viene del renderer, riesgo de traversal). El handler del main debe normalizar y validar.
- ❌ **NO** aceptar cualquier extensión: validar por magic bytes. Un atacante podría subir `evil.jpg` que en realidad es un .exe.
- ❌ **NO** bloquear el POS mientras se sube la imagen. La subida es async, fire-and-forget; el producto se crea igual sin imagen, después se actualiza.
- ❌ **NO** confiar en el `tipo` que viene del frontend para tomar decisiones de stock. Validar en el backend (`createVenta` ya lo hace bien con `AND tipo != 'servicio'`).
- ❌ **NO** meter la marca en un catálogo nuevo. Es texto libre, autocompletar después.

## Test mínimo viable

```ts
// src/main/services/imagenes.test.ts
describe('imagenes service', () => {
  it('save + get + delete roundtrip', async () => {
    const buf = Buffer.from('fake-jpg-bytes')
    await saveImagen(999, buf, 'jpg')
    expect(getImagenPath(999)).toContain('999.jpg')
    await deleteImagen(999)
    expect(getImagenPath(999)).toBeNull()
  })

  it('rechaza extensiones inválidas', () => {
    expect(() => saveImagen(1, Buffer.from(''), 'svg' as any)).toThrow()
  })
})
```

```ts
// src/renderer/components/ProductImage.test.tsx
describe('ProductImage', () => {
  it('muestra placeholder cuando no hay imagen', () => {
    render(<ProductImage productoId={42} />)
    expect(screen.getByText(/sin imagen/i)).toBeInTheDocument()
  })
})
```

## Tareas concretas (orden de ejecución)

1. Migración 030 (`imagen_path` + marcar servicios por unidad).
2. Servicio `imagenes.ts` + tests.
3. Handler `productos:set-imagen` (con validación de magic bytes).
4. Incluir `imagenes/` en el backup.
5. Form de Inventario: tipo + marca + dropzone.
6. Componente `ProductImage` + integración en POS.
7. Reporte: toggle "desglosar por tipo".
8. Correr `npm test` + `npm run typecheck:all` + smoke test.
9. Commit + push.

## Documentos relacionados

- `FEATURES.md` — items I13 (subcategorías) e I14 (marca) e I15 (imagen) ya marcados como ✅. **Están en DB**, falta la UX.
- `ROADMAP.md` — Fase 5 items 5.1-5.8, lista detallada. Las migraciones 015-019 que menciona son **históricas y obsoletas** (ver advertencia al inicio del ROADMAP.md).
- `ARCHITECTURE.md` — para entender dónde encaja el servicio de imágenes (main process, no renderer).

## Estado

🕓 **Pendiente**. Base de datos lista (migraciones 017-019). Falta cerrar el comportamiento en UI + servicio de imágenes. Estimación: 1 sesión larga (es 7 archivos a tocar + el form de producto se vuelve más complejo, probablemente merece su propio refactor).
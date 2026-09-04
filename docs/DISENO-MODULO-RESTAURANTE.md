# 🍽️ Diseño — Módulo Restaurant (primer módulo *gated* nuevo)

> **Estado: DISEÑO — planificación, no implementado.**
> Documento de diseño para desarrollarlo cuando corresponda. Sigue la política
> del ecosistema: **sin sobreingeniería, mínimo viable primero**.
> Fuente de verdad de módulos: `tog-platform/docs/MODULOS.md` · Catálogo en
> código: `src/shared/modules.ts` · Patrón de módulo activado por licencia: **Distribuidor**.

---

## 1. Por qué Restaurant primero

Es el candidato ideal para probar el patrón de **módulo nuevo activado por
licencia** (lo mismo que Distribuidor pero vendible aparte):

- Es **autocontenido**: mesas, comanda, cocina — no toca los flujos existentes
  del Comercializador (POS, inventario, ventas).
- Reutiliza el **Core** ya probado: productos con componentes (combos),
  venta a crédito/fiado, métodos de pago configurable, impresión.
- La vertical de restaurantes/afines tiene alta demanda comercial y valida que
  el modelo "descargar la app + activar módulos" funciona con un segundo módulo.

Si el gating por licencia aguanta Restaurant, sumar Contable/RRHH/Postventa
después es mecánico.

---

## 2. Alcance mínimo (v1)

| Área | Qué incluye | Qué NO incluye (v2+) |
|---|---|---|
| **Mesas / salón** | Mesas con estado (libre/ocupada/fusionada), mover pedido de mesa | Mapa visual drag & drop del salón |
| **Comanda** | Abrir mesa, agregar productos al pedido de la mesa, enviar comanda a cocina, servir | Impresión automática por impresora de cocina (tickets por área) |
| **Cocina** | Pantalla de pedidos pendientes por área, marcar "en preparación"/"listo" | Pantalla de cocina multi-pantalla (KP) con temporizadores |
| **Cobro** | Pasar mesa a cobro → genera la **venta** estándar del Core (mismos métodos de pago, fiado, descuentos) | Propinas sobre total, división de cuenta entre N personas |
| **Productos** | Reusa el catálogo del Core (productos + **combos/compuestos** para platos) | Recetas con merma por área de cocina |

**Regla clave**: el módulo **no duplica** el Core. La venta de una mesa se
registra con el flujo `ventas:create` existente; el módulo solo gestiona el
"antes" (comanda) y el "cuándo" (paso a cobro).

---

## 3. Modelo de datos (borrador, migraciones nuevas)

```
mesas
  id, nombre, capacidad, estado ('libre','ocupada','fusionada'), activo
  (opcional: area_id)

comandas
  id, mesa_id, usuario_id, estado ('abierta','en_cocina','servida','cobrada','anulada'),
  notas, creado_en, cerrado_en

comanda_detalles
  id, comanda_id, producto_id, descripcion, cantidad, precio_unitario,
  estado ('pendiente','en_preparacion','listo','servido','cancelado'), notas

-- Relación con la venta cuando la mesa se cobra
comandas_venta  (o columna venta_id en comandas)
  comanda_id, venta_id
```

- **Anulación de ítem cancelado en cocina**: se marca `cancelado` en la comanda;
  al pasar a cobro solo se facturan los ítems `servido`/`listo` que el cliente
  consumió.
- **Reuso de combos**: un plato con componentes (ej. "Hamburguesa con papas")
  se define con `producto_componentes` (feature de productos compuestos); al
  cobrarse, la venta descuenta el stock de los componentes como ya hace el Core.

---

## 4. Patrón de implementación (espejo de Distribuidor)

| Capa | Cómo | Referencia |
|---|---|---|
| **Licencia** | Agregar `'restaurant'` a `ModuleId` + catálogo en `src/shared/modules.ts` (requiere `comercializador`, `base: false`) | Distribuidor |
| **Permisos** | `restaurant_mesas_view/edit`, `restaurant_comandas_view/edit` en `PERMISSIONS` + defaults admin | `src/shared/permissions.ts` |
| **Canales IPC** | `mesas:list/create/update`, `comandas:open/add-item/send-kitchen/state`, `comandas:checkout` | `src/shared/ipc-channels.ts` |
| **Backend** | Módulo `src/main/modules/restaurant/` con un handler por archivo, registrado en `registerRestaurantHandlers()` | `src/main/modules/distribuidor/*` |
| **Gating UI** | Items del Sidebar con `modulo: 'restaurant'` + `useActiveModules()` + rutas en `App.tsx` | Distribuidor (Clientes/Pedidos) |
| **Checkout** | `comandas:checkout` arma `ventaCreateSchema` y llama la lógica compartida de ventas (nada nuevo en caja/medios de pago) | `ventas:create` |

---

## 5. Pantallas

1. **Mesas / Salón** (`/restaurant-mesas`): grilla de mesas con estado y total
   acumulado; clic → abre comanda.
2. **Comanda** (modal o página): agregar productos por categoría o búsqueda,
   cantidades, notas al cocinero, "enviar a cocina", "marcar servido".
3. **Cocina** (`/restaurant-cocina`): pedidos `pendiente`/`en_preparacion`
   agrupados por comanda; botones "en preparación" y "listo".
4. **Cobro**: botón "Cobrar mesa" → modal estándar de cobro del POS
   (métodos de pago configurados, fiado, descuentos) → genera venta + ticket.

---

## 6. Decisiones abiertas (antes de implementar)

- [ ] ¿Cuentas divididas (split) en v1 o v2? → Recomendado **v2**.
- [ ] ¿Impresión de comanda por impresora térmica dedicada? → **v2** (el Core ya
      imprime tickets; falta enrutar comandas a otra impresora).
- [ ] ¿Fusionar mesas? → Se puede incluir en v1 (solo un campo `mesa_id` destino
      + lógica de traslado de comanda), es barato.
- [ ] ¿Propinas? → **v2**, requiere decisión fiscal por país.

---

## 7. Lo que NO se construye (anti-sobreingeniería)

- No hay backend nuevo de ventas: el cobro reusa `ventas:create`.
- No hay sincronización en la nube: esto es local/una PC (interconexión de red
  local es un feature aparte, ver `tog-platform/docs/INTERCONEXION-RED.md`).
- No hay mapa del salón con drag & drop en v1: una grilla simple alcanza.
- No hay temporizadores de cocina ni estadísticas de mesa en v1.

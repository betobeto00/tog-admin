# TOG Platform — Catálogo de Módulos y Activación por Licencia

> Documento de **visión de producto**. Define los módulos que componen TOG Platform, cómo se activan por licencia y cómo se relacionan entre sí. La implementación técnica vive en `ARCHITECTURE.md` (este repo) y el flujo de pago en `FACTURACION-STRIPE.md`.
>
> 📌 **Este archivo es un espejo** del mismo documento en el repo hermano `tog-platform/docs/MODULOS.md`, donde el catálogo se mantiene al día junto al backend. Al editar, actualiza ambos.

---

## 1. La idea

Hoy **TOG Admin** cubre la cara de **Comercialización al mayor y detal** dentro de la cadena:

```
Productor → Procesador → Comercializador → Distribuidor → Cliente final
                                          └─ Postventa
```

La visión de **TOG Platform** es que cada eslabón sea un **módulo activable por licencia** sobre una sola base instalable. El cliente compra los módulos que necesita; el día que necesite otro (por ejemplo pasar de "Productor" a "Productor + Distribuidor"), tú activas el módulo sin reinstalar nada.

---

## 2. El catálogo de módulos

| # | Módulo | Estado | Cubre | Depende de |
|---|--------|--------|-------|-----------|
| 0 | **Core (base)** | ✅ Existe (`tog-admin`) | UI shell, auth, licencia, IPC, persistencia local, auto-update | — |
| 1 | **Productor** | 🟡 Diseño | Siembra, costos de campo, estimación de cosecha, logística de acopio | Core |
| 2 | **Procesador** | 🟡 Diseño | Recepción de materia prima, recetas/BOM, transformación, mermas, lote de salida | Core + Productor (opcional) |
| 3 | **Comercializador** | ✅ Parcial (`tog-admin`) | Inventario (catálogo con producto/servicio, subcategorías, marca e imagen), compras, ventas (incl. **crédito/fiado** con cuentas por cobrar y abonos), cotizaciones, caja, POS | Core |
| 4 | **Distribuidor** | ✅ MVP v1 — clientes + pedidos CRUD (migraciones 015/016, gating por licencia y permisos, tests) | Clientes (con documento de registro internacional: RIF, RFC, EIN…), pedidos con estados y numeración. El **crédito a clientes vive en Comercializador** (migración 021): el POS vende fiado y valida `limite_credito` cuando se vincula a un cliente de este módulo. Pendientes: remitos, listas de precio, rutas, flotas y despachos | Core + Comercializador |
| 5 | **Postventa** | 🟡 Diseño | Tickets de soporte, devoluciones, garantías, notas de crédito | Core + Comercializador |
| 6 | **Administración** | 🟡 Diseño | **Submódulo Contable** (libros: compras, ventas, inventario, mayor, diario; retenciones de ley según el país del cliente), reportes de gestión | Core + Comercializador |
| 7 | **Recursos Humanos** | 🟡 Diseño | Empleados, roles, nómina básica, asistencia (alcance a definir al implementar) | Core |
| 8 | **Restaurant** | ✅ MVP v1 (migración 024, gating por licencia y permisos, tests) | Mesas (CRUD + estado libre/ocupada), comanda por mesa (productos del catálogo con precio autocompletado + ítems manuales), pantalla de cocina (en preparación/listo/servido), **cobro de mesa** que factura solo ítems servidos/listos reutilizando `createVenta` (stock, combos, fiado, caja) | Core + Comercializador |

**Leyenda**: ✅ existe · 🟡 en diseño · ⚪ no iniciado

> Cada módulo, una vez activo, **agrega pantallas, IPC handlers, permisos y (eventualmente) tablas** al Core. No reemplaza nada.

---

## 3. Modelo de licenciamiento

### 3.1 Estructura de una licencia

Una licencia es un JSON firmado RSA (la clave pública ya está embebida en `license.ts`) con esta forma:

```json
{
  "empresa": "AgroMaíz C.A.",
  "pais": "VE",
  "documento": "J-12345678-9",
  "issued_at": "2025-01-15",
  "expires_at": "2026-01-15",
  "modules": ["core", "comercializador", "distribuidor"],
  "max_usuarios": 5,
  "max_sucursales": 1,
  "edition": "professional",
  "signature": "base64-rsa-signature"
}
```

> ⚠️ **Estado real (2-Sep-2026):** este JSON es la **visión** (identidad de empresa = `pais` ISO 3166-1 alpha-2 + `documento` de registro libre — RIF, EIN, RFC, CNPJ…). En código hoy:
> - La licencia **v2** que la app guarda/valida tiene el formato de `LICENCIAMIENTO.md` (`cliente`, `expira`, `modules`, `firma`…); `src/shared/modules.ts` es el catálogo y Config → Sistema → Módulos de TOG Platform lo muestra.
> - El **backend TOG Platform** (`tog-platform` repo) da de alta empresas por `pais + documento` y emite licencias firmadas con la misma clave pública que la app valida. El gating **sí existe**: rutas e IPC del Distribuidor se ocultan si el módulo no viene en la licencia (`useActiveModules`) o sin permiso (`usePermissions`).
> - El botón **“Sincronizar”** (canal pre-auth `license:sync`, Config y pantalla de bloqueo) descarga la licencia activa del backend y la re-valida por firma antes de guardar. El flujo de pago online (Stripe) está **EN ESPERA** (ver `FACTURACION-STRIPE.md`).

El **Core** siempre está implícito. Si el cliente desactiva "Comercializador", el módulo sigue instalado pero el Sidebar y los handlers se ocultan.

### 3.2 Tipos de edición

| Edición | Módulos incluidos | Target |
|---------|-------------------|--------|
| **Starter** | Core + Comercializador | Mostrador pequeño (retail, servicios, abasto) |
| **Professional** | Core + Comercializador + Distribuidor | Distribuidor mediano |
| **Enterprise** | Core + todos los módulos disponibles | Cadena completa (Productor → Postventa) |
| **Custom** | Módulos a elección del cliente | Casos atípicos (negociación directa) |

Las ediciones son **bundles comerciales**. Internamente, la licencia sigue siendo un array `modules`. Esto te permite:
- Vender un bundle con descuento.
- Permitir que un cliente compre módulos sueltos sin cambiar de edición.
- Hacer upsell: "estás en Professional, te faltan Productor y Procesador para tener la cadena completa".

### 3.3 Cómo se entrega una licencia nueva / activación de módulo

**Hoy (v1 manual)**: dos caminos equivalentes, ambos con validación RSA local:
1. **Offline** — tú generas la clave firmada (`scripts/generate-license.js`, formato de `LICENCIAMIENTO.md`) y la envías por correo/WhatsApp; el cliente la importa desde la pantalla de bloqueo o desde Configuración.
2. **Online (Sincronizar)** — das de alta la empresa y emites su licencia en el backend TOG Platform; el cliente presiona **Config → Licencia → Sincronizar** (URL + ID de empresa + API Key) y la app la descarga y valida. Verificado end-to-end por `scripts/qa-sync.ts`.

**En espera (online automático con pago)**: Roberto paga con tarjeta vía Stripe Checkout; el webhook reactiva/renueva la licencia automáticamente. El código existe y está testeado en `tog-platform`, pero **pausado** hasta que un cliente quiera pagar online (decisión anti-overengineering). Detalle en `FACTURACION-STRIPE.md`.

### 3.4 Offline-first, online-cuando-puede

La licencia **siempre** es un archivo firmado local. El Core puede funcionar 100% sin internet. La conexión a tu backend solo aporta:
- Renovaciones automáticas (sin que Roberto tenga que pegar clave nueva cada año).
- Sincronización entre PCs del mismo Roberto.
- Analítica de uso para ti (qué módulos se usan, cuánto).

Si Roberto está offline 100%, el modelo degradado es: **tú le mandas la clave por WhatsApp**, él la pega, sigue funcionando. Nunca bloqueas al cliente por falta de internet.

### 3.5 Módulo al iniciar sesión (planificado)

Al hacer login, el usuario **escoge el módulo al que va a entrar** (POS, Distribución, Producción, Administración, Recursos Humanos, Postventa, Restaurant…). No son sesiones separadas: el módulo activado por la licencia lo filtra el Sidebar/Router, y el login solo aterriza al usuario en su área. El admin asigna módulos y accesos a cada usuario.

### 3.6 Multi-PC por red local

La licencia define el número de PCs conectadas: **1 PC/1 caja** (solo la Base, `max_pcs=1` por default) o **multi-PC de 2 a 20** (Base + hijas, `max_pcs` en la licencia firmada). **Un usuario solo puede estar con sesión activa en una PC a la vez**: `services/red-session.ts` registra `sesiones_activas(usuario_id UNIQUE, par_id, sesion_token)` y rechaza el login si el mismo usuario está activo en otro `par_id`.

Implementación (estado actual — spike funcional mergeado a master en tog-admin + tog-platform):

- **tog-admin** (migración 031): tablas `pcs_enlazadas`, `sesiones_activas`, `codigos_enlace`. Servicios `red-{config,server,client,session}.ts`. Módulo `red/handlers.ts`. `SetupPage` para PC Hija.
- **tog-platform**: `POST /api/empresas/:id/licencias` acepta `max_pcs` (1–20) y lo incluye firmado; `signLicense` valida el rango.
- **Flujo**: PC Base genera código (5 min, un solo uso) desde Config → Sistema → Red Local. PC Hija lo transcribe junto con su IP y nombre → handshake HTTP → ambas comparten DB. Cualquier `auth:login` reenviado por RPC lleva `__par_id` para registrar la sesión en la Base.
- **Pendiente para producción**: TLS local con cert autofirmado generado al primer arranque de la Base y heartbeat 60 s para expulsar sesiones huérfanas. Detalle completo en `tog-platform/docs/INTERCONEXION-RED.md`.

### 3.7 Productos / Servicios, Imagen y Moneda (Fase 5)

Tres features ya implementadas como **extensión del Core Comercializador** (no son módulos activables por licencia; viven en el Core):

- **Producto vs Servicio** (migración 016): columna `productos.tipo` (`producto`/`servicio`). Los servicios no consumen stock.
- **Subcategorías + Marca** (migraciones 017/018): tabla `subcategorias(categoria_id)`, columna `productos.marca`.
- **Imagen de producto en filesystem** (migración 030): `services/imagenes.ts` valida magic bytes (JPG/PNG/WebP, ≤2MB) y persiste en `%APPDATA%/tog-admin/imagenes/<id>.<ext>`. UI `<ProductImage>` consume el canal IPC `productos:get-imagen` para no exponer el filesystem al renderer.
- **Moneda, símbolo y tasa de cambio** (migración 029): `configuracion: currency_symbol`, `currency_name`, `tasa_cambio`. `renderer/services/currency.ts` aplica símbolo + tasa a todos los importes de la app.

---

## 4. Cómo se activan los módulos en runtime

Sin reinstalar. Sin descargar otro `.exe`. Sin técnico en sitio.

```
1. Roberto paga (Stripe Checkout o transferencia manual)
         ↓
2. Tu backend actualiza su registro de empresa y firma nueva licencia
         ↓
3a. Online:  Roberto abre TOG Admin → Config → Licencia → "Sincronizar"
            El Core descarga su nueva licencia, valida firma, aplica.
3b. Offline: Tú generas clave → la mandas → Roberto la pega → Core valida.
         ↓
5. Core expone window.api.modules = { comercializador: true, distribuidor: false, ... }
         ↓
6. Sidebar, Router, IPC handlers filtran lo no permitido
         ↓
7. Reinicio (solo del proceso, no de Windows). 5 segundos.
```

El nuevo `.exe` solo se descarga cuando **tú publicas una nueva versión del Core** (cambio mayor de UI, fix crítico, etc.). Eso es independiente de los módulos.

---

## 5. Modelo de entrega: Instalador vs. Nube

### 5.1 Instalador (hoy, único)

- Un solo instalador NSIS `TOG Admin Setup-x.y.z.exe` (~100–150 MB).
- Trae todos los módulos compilados (el bundle completo).
- Al instalar, solo activa los que la licencia permita.
- Datos en SQLite local (`%APPDATA%\tog-admin\`).
- Actualización OTA vía electron-updater.
- Sin internet = funciona, excepto sincronización de licencia.

**Ventaja para Roberto**: cero curva de aprendizaje de infra. Instala, listo.
**Ventaja para ti**: cero costo de servidor para el cliente básico. Tú solo pagas hosting para el panel admin web (Vercel free tier aguanta).

### 5.2 Nube (futuro, nice-to-have)

Misma UI, misma licencia, mismos módulos. La diferencia: el proceso Node corre en un contenedor tuyo (Fly.io, Railway, tu propio VPS) y Roberto accede por navegador o por la app Electron apuntando a `https://app.tog-platform.com`.

- Datos en Postgres central (no SQLite local).
- Múltiples usuarios concurrentes.
- Roberto puede entrar desde cualquier PC sin instalar nada.

**Ventaja para Roberto**: cero instalación, acceso desde tablet del almacén, del celular.
**Ventaja para ti**: revenue recurrente más alto (pagas hosting, cobras más), datos centralizados que te dan analítica y upsell.

### 5.3 Cómo construir ambos con un solo código

El Core expone una interfaz `IDataSource` (SQLite hoy, Postgres mañana). El Core expone una interfaz `IAuthProvider` (local hoy, OAuth mañana). El resto del código no sabe dónde corre.

Migración gradual:
1. Core sigue 100% local (hoy).
2. Añades `IDataSource` con implementación `PostgresDataSource` opcional (mañana).
3. El mismo instalador, según licencia, arranca en modo local o modo cloud-client.
4. Los módulos son **idénticos** en ambos modos.

---

## 6. Estrategia de pricing sugerida (referencia, no compromiso)

| Concepto | Precio sugerido |
|----------|-----------------|
| Core + Comercializador (Starter) | $30/mes por empresa + $5/usuario extra |
| Distribuidor (addon) | $25/mes |
| Restaurant (addon) | $25/mes |
| Productor (addon) | $25/mes |
| Procesador (addon) | $30/mes (más complejo, recetas) |
| Postventa (addon) | $15/mes |
| Bundle Professional (Core+Comerc+Distrib) | $70/mes (vs. $80) |
| Bundle Enterprise (todos) | $140/mes (vs. $145) |
| Cloud (sustituye instalador local) | +$50/mes |
| Implementación inicial | $200 one-time (incluye capacitación) |

Estos números son una **referencia para el roadmap**, no la tabla de precios final. El precio real se ajusta con base en feedback de los primeros clientes.

---

## 7. Roadmap por módulo

### Inmediato (mes 0–2): habilitar el catálogo — ✅ hecho (2-Sep-2026)
- [x] Catálogo de módulos desde la licencia activa (`src/shared/modules.ts` + hook `useActiveModules`).
- [x] Sidebar/Router/IPC filtran según módulos de la licencia y permisos.
- [x] Config → Licencia muestra catálogo y estado de módulos.
- [x] Backend TOG Platform (SQLite, repo `tog-platform`) con CRUD de empresas (pais + documento) y emisión de licencias firmadas.

### Corto plazo (mes 2–6): Distribuidor + Stripe
- [x] Módulo Distribuidor: tablas `clientes`, `pedidos`, `pedido_detalles`, `remitos`, `listas_precio` (migraciones 015/016).
- [x] CRUD de clientes y pedidos (numeración secuencial, estados: pendiente/despachado/entregado/anulado) con tests.
- [x] Venta a crédito/fiado en Comercializador: método de pago `fiado` en el POS + página **Créditos** con saldos y abonos (migraciones 020–022; validación de `limite_credito` del cliente cuando la licencia incluye Distribuidor).
- [ ] Remitos y listas de precio con UI; rutas/flotas/despachos.
- [x] Integración Stripe Checkout + webhooks (implementada y testeada en `tog-platform`) — ⏸️ **EN ESPERA** de cliente que pague online.
- [ ] Renovación automática online (idem, EN ESPERA).

### Medio plazo (mes 6–12): Productor + Procesador
- [ ] Módulo Productor: siembras, cosechas, costos de campo.
- [ ] Módulo Procesador: recetas/BOM, mermas, transformación.
- [ ] Trazabilidad lote-origen (Lote de maíz → lote de hojuela → remito → cliente final).

### Largo plazo (mes 12+): Nube + Postventa + multi-País + módulos transversales
- [ ] Modo nube con Postgres + autenticación central.
- [ ] Módulo Postventa.
- [ ] Módulo Administración: submódulo **contable** completo (libros: compras, ventas, inventario, mayor, diario; **retenciones de ley según el país del cliente**), reportes de gestión.
- [ ] Módulo Recursos Humanos (empleados, nómina básica, asistencia).
- [x] Módulo Restaurant (mesas, comanda, cocina) — **MVP v1 (4-Sep-2026)**: ver `docs/DISENO-MODULO-RESTAURANTE.md` y `docs/FEATURES.md` (RST1–RST5). Pendientes v2: cuentas divididas, enrutado de comandas a una impresora térmica dedicada (la impresión de comanda ya existe vía el flujo estándar), propinas, áreas del salón.
- [x] Interconexión por red local/Intranet entre PC Base y PC hijas (5-Sep-2026) — **spike funcional mergeado a master**: ver `docs/ARCHITECTURE.md` sección "Módulo Red Local" + `tog-platform/docs/INTERCONEXION-RED.md`. Pendiente para producción: TLS local + heartbeat 60 s.
- [x] Multi-moneda, símbolo de moneda y tasa de cambio (5-Sep-2026) — `configuracion.currency_symbol/currency_name/tasa_cambio`; `renderer/services/currency.ts` aplica a toda la app.
- [x] Imagen de producto en filesystem (5-Sep-2026) — `services/imagenes.ts` con validación por magic bytes.

---

## 8. Lo que NO está en alcance (al menos en v1)

- No es un SaaS multi-tenant hoy. Un Core = una empresa. La nube lo resolverá.
- No hay marketplace de módulos de terceros. Solo módulos propios.
- No hay app móvil nativa. La nube + webview cubre ese caso más adelante.
- No hay facturación electrónica integrada (SENIAT, SUNAT, etc.). Es un proyecto separado; el Comercializador tiene hooks para conectarse a un proveedor externo cuando exista.

---

## 9. Documentos relacionados

- `ARQUITECTURA-MODULAR.md` — cómo se monta el `ModuleLoader`, el contrato Core↔módulos, el sistema de permisos por módulo.
- `FACTURACION-STRIPE.md` — sincronización licencia↔pago, webhooks, modelo offline-first (estado: EN ESPERA).
- `QA-SYNC.md` — QA end-to-end del flujo “Sincronizar licencia” (automatizado + checklist manual).
- `LICENCIAMIENTO.md` — formato real de la licencia v2 y guía offline.
- `auto-license-stripe.md` — borrador original del flujo Stripe (referencia).
- `INFORME-ERP.md` — auditoría arquitectónica del estado actual de TOG Admin.
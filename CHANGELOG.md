# Changelog — tog-admin (TOG Admin POS)

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.3.0] - 2026-09-19

### Added
- **Numeración de comprobantes continua y configurable**: "Próxima factura" y
  "Próximo N° de control" (SENIAT) en `Configuración → Negocio → Numeración de
  comprobantes` y en `Impresión → Datos fiscales y numeración`. La numeración ya no
  se reinicia por día y avanza sola; fijarla o cambiarla exige **rol admin** más
  confirmación explícita, y el backend valida entero ≥ 1 y mayor que la última
  factura emitida (nunca repite un número). El número sale en el ticket ESC/POS,
  en el A4 y en la reimpresión de Ventas. Migración `055_numero_factura_continua`.
- **Nómina por capas (FASE 5)**: catálogo global de conceptos
  (`rrhh:conceptos-list|concepto-save|concepto-delete`), grupos de empleados con
  miembros y conceptos  (`rrhh:grupos-list|grupo-save|grupo-delete|grupo-miembros-set|grupo-conceptos-set`),
  vista previa de la nómina antes de confirmar (`rrhh:nomina-preview`, dry-run que
  calcula los mismos montos que se van a guardar sin escribir nada),
  generación de nómina por grupo (`salario base + asignaciones − deducciones = neto`),
  histórico de asistencias con filtros, histórico de nómina por trabajador, recibos
  individuales y en lote, e impresión A4 del histórico de asistencias.
  Migración `054_rrhh_capas`.
- **Hípico**: sub-módulo de apuestas con registro, liquidación de premios, permisos
  dedicados e impresión de comprobante.
- **Productor**: cadenas de producción encadenadas (BOM, productos intermedios y
  lotes), UI de 5 pestañas con búsqueda/filtro/orden, edición y borrado de pasos, y
  permisos granulares por acción.
- **Inventario**: filtro, badge y campo `tipo_produccion` en productos.
- **Impresión**: generador unificado de documentos (`renderer/lib/print.ts` →
  `abrirDocumento`), canal `print:documento-venta` y vista A4 del comprobante
  (`A4PrintModal`) desde POS y Ventas; comandas a impresora de cocina por ESC/POS
  (`comandas:print-kitchen` + `impresora_cocina_puerto`/`impresora_cocina_baudrate`).
- **Licencias**: prompt de Machine ID, elección Local/Cloud en el CLI, confirmación
  antes de sobrescribir una licencia existente y vinculación opcional con el vendedor
  (`OMV-XXXXX`, `POST /api/empresas/:id/vendedor`).
- **Tests nuevos**: `numeracion`, `shared/csv`, `renderer/lib/print`, `A4PrintModal`,
  `RrhhPage` (incluye la vista previa), `ImpresionPage`, `ConfigPage`, `POSPage` (flujo de
  venta completo), `VentasPage`, `session-auth` y `password-inicial`; integración
  venta → asiento contable → libro (incluida la reversión al anular). Suite: **621 tests**.

### Changed
- **Fechas de negocio en hora local**: nuevo `main/utils/time.ts`
  (`localDateStr`/`localDateTimeStr`); `ventas`, `compras`, `caja`, `movimientos`,
  `creditos`, `abonos`, `ajustes`, `productor` y `rrhh` guardan y comparan fechas
  locales, y los defaults de columna pasan a `datetime('now','localtime')`. La
  auditoría (`creado_en`) sigue en UTC. Migración `053_fechas_negocio_local`.
- Sincronización de licencias: `device-fingerprint` → `machine-id`.
- Documentación: proveedor de pagos Stripe → Crixto; módulos, guía de desarrollador,
  arquitectura y roadmap actualizados.
- Compras: el selector de métodos de pago se alimenta del catálogo de Configuración
  (antes estaba hardcodeado a 3 opciones y ocultaba los métodos propios del cliente).
- Imports con alias `@shared` reemplazados por rutas relativas en el proceso main.

### Fixed
- **Libro de ventas vacío / flujo de efectivo en cero / análisis financiero en cero**:
  la causa raíz era guardar las fechas de negocio en UTC. Una venta de las 22:00
  (UTC−4) quedaba con la fecha del día UTC siguiente y desaparecía de los reportes
  del día; además la hora mostrada iba +4 h. Los 3 tests que fallaban **solo de noche**
  eran el mismo bug.
- Restore de backup: se eliminan los archivos `-wal`/`-shm` antes de copiar, evitando
  mezclar datos de la base anterior (usuarios faltantes tras restaurar).
- POS: el modal de cliente nuevo usaba el namespace i18n inexistente `clients.*` y
  metía el objeto parcial `{ id }` en la lista; ahora usa las claves correctas y
  recarga `clientes:list`.
- POS: `config:get` sin `.catch()` producía una promesa rechazada sin manejar.
- POS: el botón "Imprimir" salía en blanco (el CSS de impresión solo muestra
  `.print-area`); ahora abre la vista A4 real.
- Remitos: la impresión detallada incluye unidad, precio unitario, subtotal y total,
  dos bloques de firma/sello (empresa y chofer) y datos fiscales desde `print:config`.
- RRHH: la fecha por defecto usaba `toISOString()` (UTC) y el recibo leía la empresa
  de un `localStorage` que nunca se setea; ahora usan fecha local y `print:config`.
- Cotizaciones, Mesas, Caja, Contabilidad y Reportes: escapes y fechas corregidos
  (`mesActual()` ya no usa `toISOString()`).
- Hípico: liquidación de apuestas corregida y permisos de apuesta exigidos.
- Postventa: mensaje claro cuando la venta no existe (el error de FK se confundía
  con un fallo de impresión).

### Security
- **Auditoría de seguridad — 27 hallazgos cerrados**: autenticación de IPC por sesión
  (el actor se resuelve desde `sesiones_activas` con token CSPRNG; el `usuario_id` del
  renderer nunca se confía), canales sensibles bloqueados por LAN, contraseña inicial
  del admin con `crypto.randomInt` y borrada al primer login, HMAC de licencia con
  clave aleatoria de 32 bytes, feedback vía `/api/feedback` (el token de Telegram no
  llega al cliente), CSP `connect-src 'self'` con `webSecurity` siempre activo, claves
  de configuración internas bloqueadas para el renderer, API keys enmascaradas,
  puerto serie validado antes de abrirlo, importación CSV con validación de
  extensión/tamaño y crash reports acotados por campo.
- **DOM-XSS en documentos imprimibles**: `escapeHtml()` aplicado a los 9 generadores
  de impresión (Remitos, RRHH, Caja, Ventas, Mesas, Cotizaciones, Reportes, Reportes
  visuales y Contabilidad).
- **ESC/POS**: se neutralizan los bytes de control después de codificar a latin1 (un
  `U+011B` terminaba en `0x1B` = ESC, permitiendo cortar papel o abrir el cajón).
- **CSV injection**: guarda para celdas que empiezan con `=`, `+`, `-`, `@` y
  entrecomillado correcto en contable, export de productos y reportes.

### Removed
- `docs/historia/FACTURACION-STRIPE.md` (diseño completo de la integración Stripe) y
  `docs/historia/auto-license-stripe.md` (borrador de brainstorming).
- Referencias activas a Stripe en la documentación; los documentos históricos que la
  mencionan quedan marcados como históricos.

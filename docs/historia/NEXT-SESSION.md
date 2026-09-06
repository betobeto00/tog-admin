# Próxima sesión de desarrollo — Omnimargen

> Estado al cierre de la sesión anterior (5-Sep-2026): **interconexión por red local + Fase 5 (Productos/Servicios/Imagen/Moneda) mergeadas a master**. 41 commits acumulados desde la rama `fix/license-modularization` (ya borrada). Este documento define el siguiente paso.

---

## Contexto

- **tog-admin**: v1.0.8 + módulo red (migración 031: `pcs_enlazadas`, `sesiones_activas`, `codigos_enlace`), módulo `red/` con servidor HTTP local `:3002` y cliente RPC, imagen de producto en filesystem (migración 030), moneda + símbolo + tasa (migración 029), logger centralizado, validación de origen IPC endurecida.
- **tog-platform**: acepta `max_pcs` (1–20) en emisión manual de licencias firmadas (`signLicense` valida el rango). Licencia de prueba vigente incluye `comercializador + distribuidor + restaurant`.
- **landing-page**: sin cambios en esta tanda.

## Lo que NO se prioriza (EN ESPERA — decisión anti-overengineering)

- ❌ Stripe Checkout + webhooks + grace period: implementado y testeado en `tog-platform`; queda pausado hasta que un cliente pague online.
- ❌ Nube / multi-tenant: se mantiene SQLite local; `IDataSource` se materializa cuando haga falta.
- ❌ Multi-sucursal real (Fase 7): depende de la decisión Postgres.

## Próxima tarea concreta (PRIORIDAD 1)

**Endurecer el módulo Red Local — TLS + heartbeat**.

El spike funcional actual usa HTTP plano en LAN con credenciales de par (`par_id` + `cert_hash`) y un token de enlace de un solo uso. Es seguro para una LAN confiable pero no para una LAN con peers desconocidos. Antes de activar el módulo en producción con clientes reales, falta:

1. **TLS local con cert autofirmado** generado al primer arranque de la PC Base (`scripts/generate-tls-cert.js` o similar). La Base expone HTTPS en `:3002`; las hijas reciben el cert vía el handshake inicial y lo usan para validar.
2. **Heartbeat 60s**: la hija envía `POST /api/red/heartbeat` cada minuto; la Base actualiza `pcs_enlazadas.last_seen` y expulsa sesiones huérfanas (par sin heartbeat por > 5 min → `liberarSesionesDePar`).
3. **Renovación de tokens**: hoy `cert_hash` es estático para la vida del par; rotar cada N días o al desloguear.

Archivos a tocar (estimación inicial):

| Archivo | Cambio |
|---------|--------|
| `tog-admin/src/main/services/red-server.ts` | Levantar HTTPS con `https.createServer({key, cert}, handle)`. Cargar cert de `%APPDATA%/tog-admin/certs/` |
| `tog-admin/src/main/services/red-cert.ts` (nuevo) | Generar self-signed al primer arranque; cargar/regenerar |
| `tog-admin/src/main/services/red-client.ts` | Aceptar cert autofirmado (sin `rejectUnauthorized: false` global, sino anclando al cert recibido en el handshake inicial) |
| `tog-admin/src/main/modules/red/handlers.ts` | Nuevo canal pre-auth `red:heartbeat` (en la hija) y endpoint `POST /api/red/heartbeat` (en la Base) |
| `tog-admin/src/renderer/hooks/useHeartbeat.ts` (nuevo) | `setInterval` 60s en la hija que llama `red:heartbeat` solo si `red:status.modo === 'hija'` |
| Migración nueva `032_heartbeat` | columna `pcs_enlazadas.last_heartbeat` + `sesiones_activas.last_heartbeat` |

## Tareas que siguen después

- (Fase 6) Exportar cotización a PDF nativo, combos con profitability real.
- (Fase 8) Facturación fiscal Venezuela (SENIAT) — depende del cliente.
- Refactor: extraer `red-status` polling a un hook `useRedStatus` (hoy cada componente lo lee con `callApi` directo).
- UX Config → Red Local: vista de "PCs activas ahora" (no solo `pcs_enlazadas`), botón "Desvincular" por par.

## Convenciones a respetar (de AGENTS.md)

- Responder en español.
- TypeScript estricto, sin `any` salvo justificación.
- Vitest para nuevos tests.
- i18n ES+EN cuando se agrega UI.
- NO commitear sin permiso explícito.
- NUNCA commitear secretos (`.env`, `keys/`, tokens, **certs privadas**). Todo eso va en `.gitignore` (ya está); los certs autofirmados también.
- Mensajes de commit en inglés, una línea, imperativo.
- No sobrediseñar: si la decisión está en la doc de "decisiones pendientes", elegir la recomendada y seguir, no abrir un debate nuevo.

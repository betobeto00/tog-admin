# Próxima sesión de desarrollo — Omnimargen

> Estado al cierre de la sesión anterior (5-Sep-2026): 35 commits mergeados
> en `master` (sin rama `fix/license-modularization` ya borrada). Este
> documento define el siguiente paso concreto.

---

## Contexto

- **tog-admin**: v1.0.8 + 35 commits de features nuevos (POS con cliente y borradores, impresión de remito/ticket, nota de entrega, almacenes, listas de precio con productos/clientes, search global del header, auto-refresh de mesas).
- **tog-platform**: corriendo local en `localhost:3001` con el bug del `.env` con `TEST_TOKEN_NO_USAR` ya arreglado. Licencia de prueba emitida con módulos `comercializador` + `distribuidor` + `restaurant`, vence **2026-09-11**.
- **Repos relacionados**: landing-page (sin cambios esta tanda).

## Decisión que tomó el usuario

El usuario decidió: **empezar por Interconexión por red local** (PC Base + hijas). Es la pieza de mayor impacto comercial porque habilita el modelo de licencias "1 PC + 1 caja" vs "multi-PC de 2 a 20 PCs". Ya está documentada en `tog-platform/docs/INTERCONEXION-RED.md` con el flujo operativo, anti-bypass, decisiones pendientes, y tabla de DB.

Razón: ya hay clientes preguntando por licencias multi-PC y el modelo offline-first actual de tog-admin choca con eso. Hacerlo antes que Moneda o FASE 5 porque es la pieza que justifica el modelo de licencia del ecosistema.

## Tarea concreta (PRIORIDAD 1)

**Interconexión por red local — primera fase: spike funcional end-to-end**.

Scope mínimo para validar la hipótesis antes de invertir en todas las decisiones pendientes:

1. **PC Base (`tog-platform` ya extendido como agente local)**: extender el backend de tog-platform para que corra también un **servidor HTTP local en un puerto dedicado** (ej. `:3002`) dentro del main process de tog-admin, no como proceso separado. Razón: el `.exe` ya instalado en la PC Base debe poder actuar como autoridad de la red sin instalar nada extra.

2. **Handshake de unión**: implementar el código de enlace (token de un solo uso) + endpoint `POST /api/red/vincular` que valida el token, registra la hija en SQLite, y le entrega un `par_id` + `cert_hash` para identificar la sesión.

3. **PC Hija (mismo `.exe`)**: pantalla de "primer inicio" (cuando la app arranca y NO tiene licencia propia) con input para "IP de la PC Base" + "código de enlace". Al confirmar, queda enlazada y todas las llamadas IPC se redirigen al servidor de la Base.

4. **Anti-bypass mínimo**: TLS local con cert autofirmado generado al primer arranque de la Base, validación de `par_id`+`cert_hash` en cada request, token con expiración de 5 minutos y de un solo uso.

5. **Sesión única**: tabla `sesiones_activas(usuario_id, par_id, opened_at, last_heartbeat)`. En cada `auth:login`, validar que `usuario_id` no esté ya con sesión abierta en otro `par_id`. Si lo está, rechazar.

## Lo que NO entra en esta tarea

- ❌ No armar la UI completa de gestión de PCs en Config (solo el handshake básico).
- ❌ No implementar heartbeat automático (la sesión muere al cerrar la app; el heart-beat se agrega en la fase 2).
- ❌ No implementar la topología completa de la Fase 7 (multi-sucursal, sync entre bases).
- ❌ No meter tasas de cambio, multi-moneda, ni Fase 5 (productos/servicios/imagen). Eso queda documentado y se hace después.

## Archivos a tocar (estimación inicial)

| Archivo | Cambio |
|---------|--------|
| `tog-platform/src/server.js` | Agregar endpoints `/api/red/*` con el handshake y validación de tokens |
| `tog-platform/src/db.js` | Migración nueva: tablas `pcs_enlazadas`, `sesiones_activas`, `codigos_enlace` (siguiendo el doc `INTERCONEXION-RED.md`) |
| `tog-platform/src/sign.js` | Helper para generar tokens aleatorios seguros |
| `tog-admin/src/main/index.ts` | Si la app está en modo "hija", arrancar un cliente HTTP al servidor de la Base en vez del SQLite local |
| `tog-admin/src/main/core/network-client.ts` (nuevo) | Cliente HTTP que reemplaza el handler IPC cuando está en modo hija |
| `tog-admin/src/renderer/pages/SetupPage.tsx` (nuevo) | Pantalla de "primer inicio" con input IP + código |
| `tog-admin/src/main/preload.ts` | Detectar modo (Base/Hija) y exponer API condicional |

## Comandos de validación

- `npm run typecheck:all && npm test` en ambos repos.
- Smoke test manual: instalar dos copias del `.exe` en dos PCs (o en una misma PC con dos `userData` distintos), activar licencia en la primera, generar código de enlace desde Config, vincular la segunda.
- Verificar que ambas PCs ven los mismos datos, que el login de un usuario en una PC bloquea el login en la otra, y que la Base no acepta más PCs que `max_pcs`.

## Riesgos a tener en cuenta

- OneDrive/Windows firewall pueden bloquear el puerto local: documentar el puerto (`:3002`) en la guía de instalación y dar instrucciones para abrirlo.
- CORS/CSP del renderer en la PC Hija: el cliente HTTP debe ser en el main process, no en el renderer (mismo patrón que el `license:sync` actual).
- Si la PC Base se apaga, las PCs hijas no funcionan. Eso es esperado (es red local), pero documentarlo en el error del login.

## Cuando termines esta tarea

1. Correr la suite completa de ambos repos.
2. Hacer commit con `git commit -m "feat(network): interconeccion PC Base + hijas con handshake basico"`.
3. Push a la rama que se cree para esto (NO a `master` directo — sigue siendo feature en desarrollo).
4. Actualizar `tog-platform/docs/INTERCONEXION-RED.md` con el estado real (la sección "Estado: pendiente" pasa a "Estado: spike funcional implementado, falta...").
5. Avisar al usuario con un resumen: cuántas PCs probaste, qué funcionó, qué no.

## Tareas que siguen después (no son para esta sesión)

- Tasa de cambio + símbolo de moneda (`tog-admin/docs/MONEDA.md`).
- Productos vs Servicios + imagen (`tog-admin/docs/FASE-5-PRODUCTOS.md`).
- Combos con profitability real (Fase 6).
- Exportar cotización a PDF (Fase 6).
- Convertir cotización a venta (Fase 6).
- Multi-sucursal real (Fase 7) — depende de la decisión sobre Postgres vs seguir con SQLite.

## Convenciones a respetar (de AGENTS.md)

- Responder en español.
- TypeScript estricto, sin `any` salvo justificación.
- Vitest para nuevos tests.
- i18n ES+EN cuando se agrega UI.
- NO commitear sin permiso explícito.
- NUNCA commitear secretos (`.env`, `keys/`, tokens). Todo eso va en `.gitignore` (ya está).
- Mensajes de commit en inglés, una línea, imperativo.
- No sobrediseñar: si la decisión está en la doc de "decisiones pendientes", elegir la recomendada y seguir, no abrir un debate nuevo.

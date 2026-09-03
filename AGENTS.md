# AGENTS.md — Instrucciones para asistentes AI en TOG Admin

> Este archivo es leído automáticamente por opencode (y otros asistentes AI compatibles) al inicio de cada sesión. Define cómo el agente debe trabajar en este repositorio. RESPONDER AL USUARIO SIEMPRE EN ESPAÑOL.S

---

## graphify

Este repositorio usa **graphify** para mantener un grafo de conocimiento navegable del código y los docs. Está integrado en opencode vía el plugin `.opencode/plugins/graphify.js`.

**Reglas para el agente:**

1. **Antes de responder preguntas sobre el código, lee `graphify-out/graph.json` y `graphify-out/GRAPH_REPORT.md`.** Si existen, úsalos como fuente primaria; son la representación navegable del repo.
2. **Usa `/graphify query "<pregunta>"`** cuando el usuario pregunte cómo funciona algo, qué llama a qué, o trace un flujo. El grafo ya está construido; no lo reextraigas.
3. **Si el usuario pide cambios estructurales** (nuevos archivos, mover carpetas, renombrar), reconstruye el grafo al final con `graphify` o avisa que el hook post-commit lo hará automáticamente.
4. **NUNCA** ejecutes un build completo de graphify (`graphify .`) si ya existe `graphify-out/graph.json` y la pregunta es sobre el código — usa query.
5. **Sí** ejecuta `graphify .` cuando:
   - Se agreguen muchos archivos nuevos.
   - El usuario lo pida explícitamente.
   - El hook post-commit reporte errores.

**Comandos útiles:**

| Comando | Cuándo |
|---------|--------|
| `graphify query "<pregunta>"` | Responder pregunta sobre el código (preferido) |
| `graphify path "NodoA" "NodoB"` | Trace de dependencias / flujo entre dos entidades |
| `graphify explain "NodoX"` | Explicación en lenguaje natural de un nodo |
| `graphify .` | Build completo (solo cuando sea necesario) |
| `graphify --update` | Build incremental |
| `graphify hook status` | Verificar hooks post-commit |
| `graphify export html` | Regenerar visualización HTML |

**Estado actual:** ver `graphify-out/GRAPH_REPORT.md` para secciones "God Nodes", "Surprising Connections" y "Suggested Questions" después del primer build.

---

## Convenciones del repo

- **Lenguaje:** TypeScript estricto (`tsc --noEmit` debe pasar).
- **Tests:** Vitest. Correr `npm test` antes de commit.
- **Estilo:** NO agregar comentarios al código salvo que el usuario lo pida explícitamente.
- **Commits:** mensajes en inglés, una línea, imperativo. NO commitear sin que el usuario lo pida.
- **Seguridad:** NUNCA commitear secretos. `.env` ya está en `.gitignore`.

## Arquitectura

- TOG Admin es un POS desktop (Electron 31 + React 18 + TypeScript + SQLite).
- **Main process modularizado:** los handlers IPC se registran por módulo en `src/main/modules/<modulo>/` (inventario, ventas, configuracion, caja-extra, license, terminal, crash-report, shared) y auth/usuarios en `src/main/core/auth/`. `src/main/ipc-handlers.ts` es solo el punto de registro que llama a cada `register*Handlers()`.
- `src/main/services/` queda para lógica transversal: `license.ts` (validación RSA), `crash-reporter.ts`, `updater.ts`, `valorTerminal.ts`, `configCache.ts`. (Ya NO existe `services/permissions.ts`.)
- **Catálogo de permisos:** `src/shared/permissions.ts` (única fuente; `ROLE_DEFAULTS.admin` = todas las claves).
- **Canales IPC tipados:** `src/shared/ipc-channels.ts` (tipo `IpcChannel` y lista `PREAUTH_CHANNELS`). El renderer llama por `callApi` en `src/renderer/lib/api-client.ts`, que inyecta `usuario_id` y lanza error si el handler responde `{ success: false }`.
- La visión de plataforma modular (módulos activables por licencia) vive en https://github.com/betobeto00/tog-platform.

Ver `docs/ARCHITECTURE.md` (estado actual), `docs/MODULOS.md` (referencia conceptual), `docs/INFORME-ERP.md` (auditoría), `docs/ARQUITECTURA-MODULAR.md` (plan).

## Permisos IPC

Los handlers IPC DEBEN validar permisos con `checkPermissionOrFail(data, channel, permission)` antes de ejecutar lógica de negocio. `checkPermissionOrFail` está en `src/main/core/auth/permissions.ts`; el admin pasa siempre (tiene todas las claves de `PERMISSIONS`).

Canales pre-auth (sin sesión, no requieren `usuario_id`): la lista canónica es `PREAUTH_CHANNELS` en `src/shared/ipc-channels.ts` — actualmente `app:version`, `auth:login`, `crash-report:save`, `i18n:get-lang`, `i18n:set-lang`, `license:status`, `license:sync`, `license:validate`, `license:import`. El renderer mantiene un espejo en `api-client.ts`; al tocar la lista, actualizar AMBOS lugares. `license:import` y `license:sync` DEBEN seguir pre-auth: son los caminos para activar la app desde la pantalla de bloqueo (antes del login). `license:sync` descarga la licencia activa desde el backend TOG Platform (`src/main/services/license-sync.ts`, URL + id de empresa + api key) y la valida con la firma RSA local antes de guardarla.
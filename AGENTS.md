# AGENTS.md — Instrucciones para asistentes AI en TOG Admin

> Este archivo es leído automáticamente por opencode (y otros asistentes AI compatibles) al inicio de cada sesión. Define cómo el agente debe trabajar en este repositorio. RESPONDER AL USUARIO SIEMPRE EN ESPAÑOL.S

---

## graphify

Este repositorio tiene un grafo de conocimiento en la **raíz del workspace**
(`graphify-out/`). Cubre todos los repos del ecosistema. Plugin en
`.opencode/plugins/graphify.js`.

**Reglas para el agente:**

1. **Antes de responder preguntas sobre el código, lee `../graphify-out/graph.json` y `../graphify-out/GRAPH_REPORT.md`.** Si existen, úsalos como fuente primaria.
2. **Usa `graphify query "<pregunta>"`** cuando el usuario pregunte cómo funciona algo, qué llama a qué, o trace un flujo. El grafo ya está construido; no lo reextraigas.
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
- **Commits:** mensajes en inglés, imperativo.
- **Seguridad:** NUNCA commitear secretos. `.env` ya está en `.gitignore`.

## Arquitectura

- TOG Admin es un POS desktop (Electron 31 + React 18 + TypeScript + SQLite).
- **Main process modularizado:** los handlers IPC se registran por módulo en `src/main/modules/<modulo>/` (inventario, ventas, configuracion, caja-extra, license, terminal, distribuidor, restaurant, administracion, rrhh, productor, postventa, hipico, print, crash-report, shared) y auth/usuarios en `src/main/core/auth/`. `src/main/ipc-handlers.ts` es solo el punto de registro que llama a cada `register*Handlers()`.
- `src/main/services/` queda para lógica transversal: `license.ts` (validación RSA), `crash-reporter.ts`, `updater.ts`, `valorTerminal.ts`, `configCache.ts`. (Ya NO existe `services/permissions.ts`.)
- **Catálogo de permisos:** `src/shared/permissions.ts` (única fuente; 69 permisos en 15 categorías; `ROLE_DEFAULTS.admin` = todas las claves).
- **Canales IPC tipados:** `src/shared/ipc-channels.ts` (tipo `IpcChannel`, lista `PREAUTH_CHANNELS` y lista `REMOTE_BLOCKED_CHANNELS`). El renderer llama **siempre** por `callApi` en `src/renderer/lib/api-client.ts`, que adjunta `session_token` + `usuario_id` y lanza error si el handler responde `{ success: false }`. No llamar `window.api.invoke` directo: saltear `callApi` es saltear la credencial de sesión y el main rechaza el canal.
- **La identidad la decide el main, no el cliente:** el actor de cada llamada sale del `session_token` (ver “Permisos IPC”). Cualquier handler nuevo que necesite saber “quién lo llamó” debe usar `checkPermissionOrFail` / `resolveAuthenticatedUserId`, nunca leer `data.usuario_id` y creerle.
- **Offline-first:** la app funciona sin internet. Solo la activación de licencia (email+clave de `omnimargen.site`, o `.key` a mano) y el feedback usan red; el **login es local** (SQLite + bcrypt) y el **módulo Red Local es LAN** (nunca sale a internet). No introducir dependencias de red en el camino de login, venta o caja. Detalle en `docs/ARCHITECTURE.md` → “Modelo de operación”.
- **Frontera de canales:** `handleIpc` (`src/main/core/auth/ipc-guard.ts`) lanza si el canal no está declarado en `IPC_CHANNELS`. Para exponer un canal nuevo hay que declararlo ahí primero. Nada de canales "internos" sin declarar: `ipcRenderer.invoke` los alcanzaría.
- **Nada de secretos en el cliente:** el instalador empaqueta el `.env` en `resources/` y lo copia a `%APPDATA%`, así que cualquier valor de ahí lo lee el usuario final. Los secretos (token de Telegram, API keys de terceros) van en un backend; el cliente solo llama a su endpoint. Ver `docs/historia/REMEDIACION_INFORME_SEGURIDAD.md`.
- La visión de plataforma modular (módulos activables por licencia) vive en https://github.com/betobeto00/tog-platform.

Ver `docs/README.md` (índice de documentación y reglas de canon), `docs/ARCHITECTURE.md` (estado actual), `docs/FEATURES.md` (estado por feature), `docs/MODULOS.md` (catálogo espejo de tog-platform). El resto está en `docs/historia/`.

## Documentación (canon)

- **Canon operativo** (raíz de `docs/`): `README.md` (índice + reglas), `ARCHITECTURE.md`, `FEATURES.md`, `MODULOS.md`, `LICENCIAMIENTO.md`, `QA-SYNC.md`, `UPDATER_NOTES.md`, `GUIA_DESARROLLADOR.md`, `MANUAL_USUARIO.html`.
- **Historia** (`docs/historia/`): roadmaps, auditorías, planes, bitácoras, benchmarks. No son fuente de verdad; no los actualices, solo archiva.
- Regla: **un tema, un archivo canónico**. Números clave (permisos, tests, migraciones, páginas) se actualizan en la fuente canónica, no en varios docs. Antes de crear un doc nuevo, revisa si puede vivir dentro de uno existente.

## Secretos y datos que no van al renderer

- **Claves de API** (`odds_api_key`, `racing_api_key`): viven solo en el main, que es quien llama a las APIs. Los canales que las gestionan devuelven `configurado` + `api_key_masked` (`services/claves-api.ts`), nunca la clave. **`config:get` filtra las claves reservadas** (`RESERVED_CONFIG_KEYS` en `modules/configuracion/config.ts`): si agregás una clave sensible, sumala ahí o se filtra por `config:get` a cualquier usuario con `config_access`.
- **Puerto de impresora**: no se abre un puerto crudo de la configuración; `services/printer.ts` valida la forma del nombre y que esté entre los puertos enumerados.

## Permisos IPC

Los handlers IPC DEBEN validar permisos con `checkPermissionOrFail(data, channel, permission)` antes de ejecutar lógica de negocio. `checkPermissionOrFail` está en `src/main/core/auth/permissions.ts`; el admin pasa siempre (tiene todas las claves de `PERMISSIONS`).

`checkPermissionOrFail` **resuelve al usuario desde el `session_token`** (`getUsuarioDeToken` → tabla `sesiones_activas`, local, sin red) y **sobrescribe `data.usuario_id`** con ese usuario antes de devolver. Sin token válido `resolveAuthenticatedUserId()` devuelve `null` y el handler responde `{ success: false, error: '...requiere sesión activa...' }` — **falla cerrado, sin fallback al `usuario_id` del cliente**. El token lo emite `auth:login` (`registrarSesion`), vive solo en memoria del renderer (no se persiste) y se rota en cada re-login. `auth:logout` / `red:logout` reciben el token y borran la fila (`liberarSesionPorToken`). No existe `extractUserId(data)`: si lo ves en algún diff, es una regresión.

Canales servibles por red local: `POST /api/red/rpc` rechaza con 403 todo canal de `REMOTE_BLOCKED_CHANNELS` (`src/shared/ipc-channels.ts`), que agrupa los que se resuelven localmente en la hija **y** los sensibles (`license:initial-password`, que exponía la contraseña del admin a cualquier PC emparejada). Además, para canales no-preauth la Base exige que el `usuario_id` reclamado coincida con el usuario de la sesión registrada para ese `par_id`; el cliente no decide quién es.

Canales pre-auth (sin sesión, no requieren `usuario_id`): la lista canónica es `PREAUTH_CHANNELS` en `src/shared/ipc-channels.ts` — actualmente `app:version`, `auth:login`, `crash-report:save`, `feedback:send`, `i18n:get-lang`, `i18n:set-lang`, `license:initial-password`, `license:import`, `license:machine-id`, `license:rebind-device`, `license:status`, `license:sync`, `license:sync-account`, `license:validate`, `red:heartbeat`, `red:status`, `red:vincular`, `red:desvincular`. El renderer mantiene un espejo en `api-client.ts`; al tocar la lista, actualizar AMBOS lugares. `license:import`, `license:sync`, `red:status`, `red:vincular` y `red:desvincular` DEBEN seguir pre-auth: son los caminos para activar la app desde la pantalla de bloqueo (antes del login). `license:sync` descarga la licencia activa desde el backend TOG Platform (`src/main/services/license-sync.ts`, URL + id de empresa + api key) y la valida con la firma RSA local antes de guardarla.

## Módulo Red Local (PC Base + hijas)

Activado por la licencia cuando `max_pcs ≥ 2`. Servicios principales en `src/main/services/`:

- `red-config.ts` — `getRedModo()` resuelve `base` (licencia activa), `hija` (`red_modo='hija'` guardado) o `local` (instalación sin red). Persiste en `configuracion`: `red_modo`, `red_base_url`, `red_par_id`, `red_cert_hash`, `red_pc_nombre`.
- `red-server.ts` — `createRedServer(deps)` y singleton `startRedServerIfBase()`. Endpoints: `POST /api/red/vincular` (handshake con código de 6 chars hex, TTL 5 min, un solo uso), `POST /api/red/rpc` (despacho genérico de canales IPC a los mismos handlers locales), `POST /api/red/logout`.
- `red-client.ts` — en la hija: `vincularABase(baseUrl, codigo, nombre)`, `desvincularDeBase()`, `rpcABase(canal, args)`, `logoutEnBase()`. Timeout 15 s para RPC.
- `red-session.ts` — `registrarSesion(db, usuarioId, parId)` rechaza si el mismo `usuario_id` ya tiene sesión activa en otro `par_id` y devuelve el `sesionToken`; `getUsuarioDeToken(db, token)` resuelve el actor para `checkPermissionOrFail`; `getSesionUsuario(db, parId)` es la autoridad de la Base sobre la hija; `barrerSesionesInactivas(db)` libera las sesiones de las terminales sin latido por más de `RED_SESION_TTL_MS` (5 min, barrido cada 60 s desde `startRedServerIfBase`); `liberarSesionPorToken`, `liberarSesionesDePar`, `parTieneSesionActiva`. **Al comparar fechas de `pcs_enlazadas` usar `datetime(...)`**: la tabla mezcla el formato de SQLite (`datetime('now')`) con ISO 8601, y comparadas como texto el espacio ordena antes que la `T`, así que una PC activa parece inactiva.

Handlers IPC del módulo en `src/main/modules/red/handlers.ts`: `red:status`, `red:vincular`, `red:desvincular`, `red:generar-codigo`, `red:listar-pcs`, `red:logout`. Permiso dedicado `red_manage` (solo admin).

**Reenvío RPC desde la Hija**: `src/main/ipc-handlers.ts` detecta `isHija()` y registra solo los handlers locales (app:version, i18n, crash-report, update, feedback, red:*, db:reset). Para los demás canales, registra un forwarder genérico que llama `rpcABase(canal, args)` y devuelve la respuesta del handler en la Base. `handleIpc` (`src/main/core/auth/ipc-guard.ts`) registra tanto el handler real como la entrada en el map `ipcListeners` que el servidor HTTP usa para despachar.

**Setup de PC Hija**: `src/renderer/pages/SetupPage.tsx` se renderiza desde `LicenseGate` cuando la licencia local no es válida y el usuario hace clic en "Conectar a una PC Base". Pide IP, código de enlace y nombre de PC.

Tests Vitest en `src/main/services/red-{server,client,session}.test.ts` (DB en memoria via `DbLike` + `fetch` mockeado).
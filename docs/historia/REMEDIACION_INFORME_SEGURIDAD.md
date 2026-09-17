# Remediación del Informe de Seguridad — TOG Admin

> **Fecha**: 17-Sep-2026
> **Insumo**: `docs/INFORME_SEGURIDAD_TOG_ADMIN.md` (auditoría del binario desempaquetado, 27 hallazgos)
> **Estado**: registro histórico + plan. No es fuente de verdad de la arquitectura
> (para eso: `docs/ARCHITECTURE.md`).
> **Método**: cada hallazgo se verificó contra el **código fuente** (`src/`), no
> contra el binario compilado (`dist-electron/`), que puede estar desactualizado.

---

## 1. Por qué el informe no se puede aplicar tal cual

El informe se generó por ingeniería inversa sobre `app.asar`. Eso produce dos
clases de error que hay que separar antes de tocar nada:

1. **El binario no es el código.** Varias líneas citadas (`dist-electron/...`)
   corresponden a una build que puede diferir del `src/` actual.
2. **Varias remediaciones propuestas rompen el producto.** El informe no conoce
   el modelo de negocio (Red Local PC Base ↔ hijas, activación antes del login,
   certificados auto-firmados sin CA pública). Aplicarlas al pie de la letra
   deja la app inutilizable.

Criterio usado en esta pasada: **arreglar la causa con la variante segura que
preserve la función**, y dejar escrito por qué la versión literal del informe era
incorrecta.

---

## 2. Certificación de los 27 hallazgos

Leyenda: **REAL** (confirmado en código) · **REAL/ACOTADO** (existe, impacto
menor al reportado) · **BY DESIGN** (el comportamiento es el requerido por el
producto) · **INALCANZABLE** (el código existe pero no se puede llegar a él).

| ID | Veredicto | Evidencia en código | Acción |
|---|---|---|---|
| CRIT-01 | REAL, **no explotable por sí solo** | `src/main/preload.ts` expone `invoke`; el alcance real lo fija `ipcMain.handle` | Guarda en `handleIpc` (ver §3.1) |
| CRIT-02 | **REAL — el hallazgo más serio** | `core/auth/permissions.ts` → `extractUserId(data)`; el `usuario_id` viaja en los args | ✅ **Cerrado**: remoto en §3.2, local en §4 |
| CRIT-03 | REAL | `db/database.ts` escribe `admin-initial-password.txt` y nunca lo borra | §3.3 |
| CRIT-04 | REAL | `license:initial-password` en `PREAUTH_CHANNELS` | §3.4 |
| CRIT-05 | REAL/**ACOTADO** | `red-client.ts` → `rejectUnauthorized: caPem ? true : false` | No aplicada: rompería el emparejamiento (§5.1) |
| HIGH-01 | **BY DESIGN** | `red-server.ts` → `server.listen(port, '0.0.0.0')` | No aplicada: es la función Red Local (§5.2) |
| HIGH-02 | REAL | `/api/red/rpc` → `deps.getHandler(canal)` dinámico | §3.2 (blocklist + sesión + usuario) |
| HIGH-03 | REAL/**ACOTADO** | `index.ts` → `webSecurity: !isDev`; el instalador ya corría con `webSecurity: true` | §3.5 |
| HIGH-04 | REAL | `index.ts` `PROD_CSP` con `connect-src 'self' https:` | §3.5 |
| HIGH-05 | REAL | `services/license.ts` → `getHmacKey()` deriva de la MAC | §3.6 |
| HIGH-06 | REAL | `db/database.ts` → `Math.random()` para el password admin | §3.3 |
| HIGH-07 | REAL | `resources/.env` empaquetado con el token + copia a `userData` | §3.7 |
| HIGH-08 | **PARCIAL** | ver §5.3: el informe lista canales que **deben** seguir pre-auth | §3.2 + §5.3 |
| MED-01 | REAL | `configuracion/config.ts` → `config:set` sin validar la clave | §3.8 |
| MED-02 | REAL | `auth/handlers.ts` inserta `rol` sin validar el enum | §3.8 |
| MED-03 | REAL | `modules/shared/feedback.ts` → Telegram con `parse_mode: 'Markdown'` | §3.7 |
| MED-04 | REAL, **más grave de lo reportado** | `hipico/odds-api.ts` → `leerConfigOdds()` devuelve `api_key`; **y `config:get` devolvía la tabla entera** | ✅ Corregido (§3.11) |
| MED-05 | REAL/**ACEPTADO** | `configuracion/backup.ts` copia la ruta recibida tras validar la magic number SQLite | Diferida (§6.2) |
| MED-06 | REAL | `services/printer.ts` usa el `puerto` sin whitelist | ✅ Corregido (§3.11) |
| MED-07 | **INALCANZABLE** | `inventario/csv.ts` — el canal estaba roto por orden de argumentos | §3.9 (se arregla el canal **y** la validación) |
| MED-08 | REAL | `crash-reporter.ts` escribe campos del renderer sin tope | §3.10 |
| MED-09 | REAL, pero el fix del informe es incorrecto | `crash-report:save` pre-auth vs. `read`/`delete` con permiso | §5.4 + §3.10 |
| LOW-01 | REAL | `services/updater.ts` → 2 `console.log/error` | §3.10 |
| LOW-02 | REAL | `crash-reporter.ts` → `Math.random()` para el id | §3.10 |
| LOW-03 | REAL, pero el fix del informe es **peligroso** | `services/red-cert.ts` → validez 5 años, RSA 2048 | No aplicada (§5.5) |
| LOW-04 | REAL | `red-server.ts` rate limit por IP en memoria | Diferida (§6.2) |
| LOW-05 | REAL | CSP duplicado en `index.html` y en `index.ts` | §3.5 |

### Correcciones de datos del informe

- Dice "255+ canales IPC". El valor real es **250** (verificado: `IPC_CHANNELS`
  tiene 250 entradas y hay exactamente 250 handlers registrados).
- En "Buenas Prácticas" afirma "Validación con Zod ✅". Era **parcialmente
  falso**: de los 24 schemas de `src/shared/validations.ts`, **13 no se usaban en
  ninguna parte**, incluidos `usuarioCreateSchema`, `usuarioUpdateSchema`,
  `configSetSchema`, `changePasswordSchema`, `cajaAbrirSchema`,
  `cajaCerrarSchema` y `movimientoCajaSchema`.
  Consecuencia concreta: `changePasswordSchema` pedía mínimo 8 caracteres pero
  `usuarios:change-password` aceptaba 6.
- **Actualización**: los schemas ya se cablearon (§3.8 y §6.3). Hoy hay 26
  schemas exportados y **23 se referencian fuera de `validations.ts`**; los 3
  restantes (`ventaDetalleCreateSchema`, `compraDetalleCreateSchema`,
  `quoteDetalleSchema`) son sub-schemas de líneas que se componen dentro del
  propio archivo.

---

## 3. Cambios implementados

### 3.1 CRIT-01 — `invoke` genérico (guarda de frontera)

**Verificado antes de tocar**: los 250 canales con handler registrado son
**exactamente** los declarados en `IPC_CHANNELS`. No hay ningún canal "interno"
que hoy se pueda alcanzar de más. Por lo tanto la remediación del informe
("reemplazar `invoke` por N funciones explícitas") **no agrega protección
hoy**: `ipcRenderer.invoke` ya solo alcanza canales registrados, y los 250 son
legítimos para el renderer.

Lo que sí tiene valor es blindar el registro para que un canal futuro no quede
expuesto sin querer:

- `core/auth/ipc-guard.ts`: `handleIpc()` lanza si el canal no está en
  `IPC_CHANNELS`.

Se conserva el `invoke` genérico a propósito, porque es el mecanismo de
`callApi` (el renderer usa 250 canales; convertirlos en 250 métodos tipados es
refactor sin ganancia de seguridad). La frontera real es el registro.

### 3.2 CRIT-02 / HIGH-02 / HIGH-08 — el RPC remoto ya no decide quién sos

La superficie realmente explotable de CRIT-02 es la **red local**: una PC hija
emparejada mandaba `args` con el `usuario_id` que quisiera, y la Base lo creía.

Implementado en `services/red-server.ts` (`POST /api/red/rpc`):

1. **`REMOTE_BLOCKED_CHANNELS`** (nuevo, en `shared/ipc-channels.ts`): canales que
   nunca se despachan por red → **403**. Incluye todos los que ya se resolvían
   localmente en la hija (`app:version`, `db:reset`, `red:*`, `crash-report:*`,
   `feedback:send`, `update:*`, `i18n:*`) **más `license:initial-password`**
   (la fuga de CRIT-04). Es una lista independiente de `HIJA_LOCAL_CHANNELS`
   porque significan cosas distintas ("dónde se resuelve" ≠ "qué es servible
   por red"); el comentario del código explica que no deben unificarse.
2. **Autoridad de sesión** (`services/red-session.ts` → `getSesionUsuario`): para
   canales no-preauth, si el `usuario_id` reclamado no coincide con el usuario
   de la sesión registrada para ese `par_id` → **403**. La Base ya sabía en qué
   usuario estaba logueada cada terminal (`sesiones_activas`); ahora lo usa.
3. La regla previa (canal de negocio sin sesión → 401) se mantiene.

**Consecuencias verificadas**: el tráfico legítimo de una hija manda el
`usuario_id` de su propia sesión → sigue pasando. Tests agregados en
`red-server.test.ts` cubren 403 por canal bloqueado, 403 por suplantación y el
camino legítimo. `red-client.test.ts` y el resto de la suite siguen verdes.

**Importante**: esto cierra el vector **remoto**. El vector **local** (renderer de
una PC Base reclamando `usuario_id`) quedó cerrado en §4, en esta misma pasada.

### 3.3 CRIT-03 + HIGH-06 — contraseña inicial del admin

- `db/database.ts`: el password se genera con `crypto.randomInt` (CSPRNG) en vez
  de `Math.random()`.
- El archivo `admin-initial-password.txt` se escribe con `mode: 0o600`.
- `core/auth/auth-service.ts`: **se borra en el primer login exitoso del admin**
  (además de marcar `admin_initial_password.shown_at`).

**Por qué no se borra al revelarlo** (que es lo que dice el informe): la
pantalla de activación muestra la contraseña una vez; si la borráramos al
revelarla y el usuario cerraba la app antes de entrar, quedaba **afuera de su
propio sistema**. Al borrarla cuando el admin ya entró, la ventana de exposición
en claro queda acotada a la activación y no hay riesgo de bloqueo.

Tests: `db/database-security.test.ts` actualizado para exigir CSPRNG, `mode:
0o600` y el borrado; un assert nuevo falla si vuelve a aparecer `Math.random()`
en el archivo de seed.

### 3.4 CRIT-04 — `license:initial-password` por red

Bloqueado en remoto (§3.2). **No se sacó de `PREAUTH_CHANNELS`** a propósito:
`LicenseSyncForm` lo llama desde la pantalla de activación, donde todavía no hay
sesión. Sacarlo de preauth rompería el flujo de primera activación. El problema
real era su alcance por red, y eso es lo que se cerró.

### 3.5 HIGH-03 + HIGH-04 + LOW-05 — Electron y CSP

- `main/index.ts`: `webSecurity: true` y `allowRunningInsecureContent: false`
  **siempre** (antes dependían de `isDev`). Nota honesta: en un instalador
  empaquetado `isDev` ya era `false`, así que este cambio protege
  builds/desarrollo, no la release que ya estaba en la calle.
- `connect-src 'self'` en `PROD_CSP` y en el meta tag de `index.html`
  (antes `'self' https:`, que permitía exfiltrar a cualquier dominio).
  **Verificado antes de cambiarlo**: `src/renderer` no tiene ni un `fetch(` ni
  `XMLHttpRequest` — todo el tráfico de red vive en el proceso main, que no está
  sujeto al CSP. `'self'` también cubre el websocket de HMR en dev.
- LOW-05: **en realidad eran tres lugares, no dos**, y el informe no lo vio: el
  plugin `inject-csp` de `vite.config.ts` **reescribe el meta tag en build**, así
  que era el que ganaba en el instalador y el tercero en quedar desactualizado.
  Se sincronizaron los tres (`vite.config.ts` = build del renderer,
  `src/main/index.ts` = header de sesión de Electron, `index.html` = fallback en
  dev) y se dejó el comentario cruzado en cada uno.
- **Verificado antes de restringir el CSP**: `src/renderer` no hace ningún request
  externo, así que `connect-src 'self'` no rompe ninguna pantalla. En dev se
  mantienen `http://localhost:5173` y `ws://localhost:5173` para el HMR.

### 3.6 HIGH-05 — clave HMAC de la licencia

`services/license.ts` → `getHmacKey()` deja de derivarse de la MAC (visible en la
red y falsificable con `macchanger`) y pasa a ser una clave aleatoria de 32 bytes
persistida en `.license-state-key` con `mode: 0o600`, junto a `license.json`.

**Consecuencia de migración**: el `license.json` de instalaciones existentes no
verifica con la clave nueva → `readLicenseState()` devuelve ceros (contadores
reiniciados, sin falso positivo de manipulación de fecha). Es seguro: la validez
de la licencia la decide la firma RSA, no este HMAC. El archivo se regenera en el
primer arranque posterior.

### 3.7 HIGH-07 + MED-03 — el token de Telegram sale del cliente

Era el pedido explícito: **no se quitó el botón**, se cambió el destino.

- **Antes**: `modules/shared/feedback.ts` leía `TELEGRAM_BOT_TOKEN` del `.env`,
  que `electron-builder` empaquetaba en `resources/` y `core/env.ts` copiaba a
  `%APPDATA%/tog-admin/.env` en la PC del cliente.
- **Ahora**: la app hace `POST` al endpoint interno de la landing
  (`landing-page` → `/api/feedback`), que es el único que conoce el token y lo
  usa server-side. Configurable con `TOG_FEEDBACK_URL` (default
  `https://omnimargen.site/api/feedback`).
- **Lado web**: `src/app/api/feedback/route.ts` nuevo +
  `sendAppFeedbackNotification()` en `src/lib/telegram.ts`. Valida forma y
  tamaño (mensaje ≤ 4000), limita por IP (`FEEDBACK_RATE_LIMIT_MAX`, default
  5/15 min) y devuelve **error genérico** (el detalle de Telegram puede revelar
  datos del bot). No usa CSRF double-submit porque el cliente no es un navegador
  con cookies; la barrera es el rate limit. No lleva `parse_mode`: el texto lo
  escribe el usuario, así que Telegram no debe interpretarlo como Markdown
  (eso cierra MED-03 — antes se podía inyectar formato y enlaces falsos).
- **Se dejó de empaquetar `.env`**: se quitó el bloque `extraResources` de
  `package.json`, `.env.example` ya no tiene secretos y el `.env` local quedó sin
  token. `core/env.ts` se mantiene (sirve para overrides no secretos, como
  `TOG_FEEDBACK_URL`, puestos a mano en `userData`).

Tests nuevos: `landing-page/src/app/api/feedback/route.test.ts` (8 casos) y
reescritura de `modules/shared/feedback.test.ts` (5 casos, incluye un assert que
falla si `feedback.ts` vuelve a mencionar `TELEGRAM_BOT_TOKEN` o
`api.telegram.org`).

**Acción manual pendiente (usuario)**: rotar el token con @BotFather y
actualizarlo solo en el backend (Railway/Vercel). El token viejo estuvo en claro
en el informe de auditoría (ver §7).

### 3.8 MED-01 + MED-02 — validación de entradas

- `configuracion/config.ts`: `config:set` rechaza claves reservadas
  (`red_modo`, `red_base_url`, `red_par_id`, `red_cert_hash`, `red_pc_nombre`,
  `red_ca_pem`, `red_cert_fingerprint`, `odds_api_key`, `odds_api_base`,
  `racing_api_key`, y cualquier `*_api_key`). Esas claves las escriben servicios
  propios, no el renderer; sin la guarda se podía redirigir la terminal a otro
  servidor (`red_base_url` + `red_cert_hash`) o tocar las claves de APIs.
  **Verificado**: la UI de Configuración solo escribe claves de negocio
  (`printer_name`, `fondo_inicial_default`, `logo_path`, datos fiscales), ninguna
  reservada. Además se valida que `clave` sea un string no vacío.
- `auth/handlers.ts`: `usuarios:create` y `usuarios:update` validan con
  `usuarioCreateSchema` / `usuarioUpdateSchema`, cuyo `rol` es
  `z.enum(USER_ROLES)`. Antes un `rol` arbitrario llegaba al INSERT/UPDATE.
  **Corrección importante durante la implementación**: la primera versión de
  esta guarda validaba `rol ∈ {admin, cajero}`, pero la app tiene **tres** roles
  (`cajero`, `manager`, `admin`) → habría **roto la creación de usuarios
  manager**, que es una función existente. El enum quedó en una única fuente
  (`USER_ROLES` en `src/shared/permissions.ts`, usado por los schemas del main y
  por las pantallas del renderer) para que no vuelvan a divergir.
- `ventas/caja.ts`, `inventario/categorias.ts`, `inventario/unidades.ts`: mismos
  schemas que ya existían (`cajaAbrirSchema`, `cajaCerrarSchema`,
  `movimientoCajaSchema`, `categoriaCreate/UpdateSchema`,
  `unidadCreate/UpdateSchema`) cableados con `validateInput`. Eran código muerto:
  los handlers insertaban sin validar.

### 3.9 MED-07 (+ bug real encontrado en el camino)

**Certificado como INALCANZABLE**: `productos:import-csv` estaba **roto**. El
renderer llama `callApi('productos:import-csv', filePath)`; `callApi` inyecta
`{ usuario_id }` como primer argumento, pero el handler tenía la firma
`(filePath, data)` → `data` recibía la ruta (string) y `checkPermissionOrFail`
fallaba siempre. Conclusión: el "lector de archivos arbitrarios" nunca se podía
disparar.

Se arreglaron las dos cosas juntas, porque **arreglar el canal sin validar
habría activado la vulnerabilidad**:

- Normalización de argumentos por tipo (en vez de asumir posición).
- Solo rutas `.csv` (regex de extensión).
- Tope de 20 MB (`fs.statSync`) para no congelar el proceso main.
- Claves i18n `errors.csvInvalidExtension` / `errors.csvTooLarge` (es/en).

### 3.10 Higiene (MED-08, MED-09, LOW-01, LOW-02)

- `crash-reporter.ts`: topes por campo (20 000 caracteres en mensaje/stack, 2 000
  en URL, 1 000 en user-agent, 200 en usuario) e id generado con
  `crypto.randomBytes` (LOW-02). El nombre de archivo ya se generaba
  server-side y se valida contra path traversal.
- `crash-report:save` **sigue pre-auth a propósito** (ver §5.4): es el canal que
  reporta el crash de la pantalla de login. Se mitiga con topes de tamaño y
  quedando bloqueado para red.
- `updater.ts`: se eliminaron los dos `console.log/error` (ya existía
  `electron-log`).

### 3.11 MED-04 + MED-06 — claves de API y puerto de impresora

#### MED-04: era peor de lo que decía el informe

El informe señalaba que `hipico:api-odds-config` devolvía `api_key` al renderer.
Cierto, y con un agravante que el informe no vio: **`config:get` devolvía la tabla
de configuración completa**, así que las claves (`odds_api_key`, `racing_api_key`,
`racing_api_base`, y cualquier `*_api_key` futura) eran legibles igual desde
cualquier usuario con `config_access`. Arreglar sólo `leerConfigOdds()` habría
dejado una falsa sensación de seguridad con la fuga intacta por la puerta de al
lado.

Implementado:

- `services/claves-api.ts` (nuevo): `enmascararApiKey()` deja visibles sólo los
  últimos 4 caracteres, enmascara entera una clave de ≤ 4 (mostrar sus "últimos 4"
  sería mostrarla completa) y no revela la longitud real de una clave larga.
- `leerConfigOdds()` y `leerConfigApi()` devuelven `api_base` + `configurado` +
  `api_key_masked`. La clave sigue guardada en `configuracion`: la usa el main,
  que es el que llama a las APIs.
- `config:get` **filtra** las claves reservadas (`isReservedConfigKey`). Verificado
  antes de filtrar: el renderer no lee **ninguna** clave reservada (`red_*`,
  `*_api_key`), y la UI que necesita datos de Red Local usa `red:status`.
- Cambiar sólo la `api_base` no borra la clave guardada (`guardarConfigOdds` ya
  ignoraba el string vacío; ahora hay un test que lo fija).

#### MED-06: el puerto de la impresora

`enviarEscPos` abría el puerto tal cual venía de la configuración, y la
configuración puede llegar de un backup restaurado: un valor arbitrario hacía que
el proceso main escribiera bytes ESC/POS en el dispositivo indicado.

- `esNombreDePuertoValido()` acepta `COM1`…`COM256` y cualquier cosa bajo `/dev/`
  (`ttyUSB0`, `cu.usbserial-1420`, `usb/lp0`, `serial/by-id/…`) y rechaza `..`
  (path traversal), rutas absolutas fuera de `/dev`, UNC de Windows y cualquier
  cosa con `;`/espacios.
- `validarPuertoDisponible()` comprueba además que el puerto esté entre los
  enumerados por `SerialPort.list()` **cuando la enumeración funciona**. Si falla
  (driver ausente), no bloquea: el `open()` real ya devuelve un error concreto.
- La validación corre **antes** de importar el módulo nativo, así un valor
  arbitrario se rechaza sin tocar el hardware.

### 3.12 NUEVO-07 — el vencimiento de sesión por heartbeat no existía

Hallazgo de esta pasada, al ir a testearlo: `listarParesInactivos()`,
`actualizarHeartbeatSesiones()` y `expulsarParesInactivos()` existían en
`red-session.ts` pero **nadie las llamaba**. La arquitectura documentaba "la Base
libera sesiones huérfanas (> 5 min)" y eso no pasaba: era código muerto.

**Por qué importa** (no es cosmético): `sesiones_activas.usuario_id` es UNIQUE y
`registrarSesion()` rechaza un login si el usuario ya tiene sesión en otro
`par_id`. Con el barrido ausente, una terminal que se apagaba sin cerrar sesión
dejaba a ese usuario **fuera para siempre**, incluso reiniciando la Base, hasta
que alguien borrara la fila a mano.

Implementado:

- El endpoint `/api/red/heartbeat` marca vivo al par **y a sus sesiones**
  (`actualizarHeartbeatSesiones`), que es lo que permite distinguir "terminal
  trabajando" de "terminal apagada con la sesión trabada".
- `barrerSesionesInactivas(db)` + `RED_SESION_TTL_MS` (5 min): la Base barre cada
  60 s desde `startRedServerIfBase()` y se detiene en `stopRedServer()`.
- **Bug de fechas encontrado al cablearlo**: `pcs_enlazadas` mezcla el formato de
  SQLite (`datetime('now')` al vincular) con ISO 8601 (`actualizarHeartbeatPar`).
  Comparadas como texto, `'2026-09-17 17:20:00' < '2026-09-17T17:15:00.000Z'` es
  **verdadero** (el espacio ordena antes que la `T`), así que un par que acababa
  de latir se veía inactivo y el barrido le habría borrado las sesiones. Se
  normaliza con `datetime(...)` en la consulta y queda un test que lo fija.
- `par_id != 'base'` en el barrido: las sesiones locales de la PC Base no se
  expiran nunca por este camino (hoy no están en `pcs_enlazadas`, pero la
  consulta no debe depender de eso).

### 3.13 Archivos tocados

```
tog-admin/                                    (50 archivos: +1494 / -222)
  AGENTS.md                                     convenciones de sesión
  .env.example / .env                           sin secretos
  index.html                                    CSP meta sincronizado
  package.json                                  se deja de empaquetar .env
  vite.config.ts                                CSP del plugin (la que gana en build)
  docs/ARCHITECTURE.md                          modelo offline-first + sesión
  docs/README.md                                índice

  src/shared/ipc-channels.ts                    + REMOTE_BLOCKED_CHANNELS
  src/shared/permissions.ts                     ROLES como fuente única
  src/shared/validations.ts                     schemas cableados + caja/inventario
  src/shared/papeleria-api.d.ts                 tipo del session_token

  src/main/core/auth/ipc-guard.ts               guarda de canal declarado
  src/main/core/auth/auth-service.ts            + token de sesión, borra password inicial
  src/main/core/auth/permissions.ts             identidad desde el token (adiós extractUserId)
  src/main/core/auth/handlers.ts                enum de rol desde ROLES
  src/main/core/auth/session-auth.test.ts       NUEVO (8 casos) — cierre de CRIT-02
  src/main/db/database.ts                       CSPRNG + mode 0600
  src/main/db/database-security.test.ts         asserts actualizados
  src/main/index.ts                             webSecurity + CSP
  src/main/modules/configuracion/config.ts      claves reservadas: rechazo al escribir + filtro al leer
  src/main/modules/configuracion/config.test.ts NUEVO (3 casos) — nada reservado sale por config:get
  src/main/modules/hipico/{odds-api,racing-api}.ts   la clave no viaja al renderer
  src/main/modules/hipico/apuestas.test.ts      +5 casos de MED-04
  src/main/modules/inventario/csv.ts            args + .csv + tamaño
  src/main/modules/inventario/{categorias,unidades}.ts  validación con schema
  src/main/modules/ventas/caja.ts               validación con schema
  src/main/modules/red/handlers.ts              red:logout por token
  src/main/modules/shared/feedback.ts           endpoint interno
  src/main/modules/shared/feedback.test.ts      reescrito (5 casos)
  src/main/modules/shared/feedback.integration.test.ts  NUEVO (4 casos, servidor local)
  src/main/services/crash-reporter.ts           topes + id CSPRNG
  src/main/services/license.ts                  clave HMAC aleatoria
  src/main/services/red-session.ts              getUsuarioDeToken / liberarSesionPorToken + barrerSesionesInactivas
  src/main/services/red-server.ts               blocklist + autoridad de sesión + heartbeat marca sesiones + barrido 60 s
  src/main/services/claves-api.ts               NUEVO (+test de 6 casos) — enmascarar API keys
  src/main/services/printer.ts                  validación del puerto (+test NUEVO de 16 casos)
  src/main/services/{red-server,red-session}.test.ts    casos nuevos
  src/main/services/updater.ts                  sin console.*
  src/main/i18n/locales/{es,en}.json            2 claves nuevas

  src/renderer/lib/api-client.ts                adjunta session_token; se elimina getApi()
  src/renderer/lib/api-client.test.tsx          +3 casos de token (9 total)
  src/renderer/core/auth/store.ts               sessionToken en memoria
  src/renderer/components/ProductImage.tsx      pasa de getApi() a callApi
  src/renderer/components/ForcePasswordChange.tsx (+test)  mínimo 8, barra de fuerza
  src/renderer/pages/ConfigPage.tsx             placeholder de contraseña a 8
  src/renderer/i18n/locales/{es,en}/translation.json    textos forcePassword.* a 8
  src/renderer/pages/LoginPage.tsx              error de feedback

  docs/INFORME_SEGURIDAD_TOG_ADMIN.md           token redactado
  docs/historia/REMEDIACION_INFORME_SEGURIDAD.md  este archivo

landing-page/
  src/app/api/feedback/route.ts                 nuevo
  src/app/api/feedback/route.test.ts            nuevo (8 tests)
  src/lib/telegram.ts                           + sendAppFeedbackNotification
  src/lib/env.ts                                rate limit de feedback
  .env.example                                  documentado
```

`docs/ARCHITECTURE.md` y `AGENTS.md` se actualizaron **en esta misma pasada**: el
canon decía que `callApi` inyecta `usuario_id`, y eso ya no describe el modelo de
autorización.

---

## 4. Tokens de sesión (cierre de CRIT-02) — implementado

Lo de §3.2 cierra el vector **remoto**. El **local** quedó cerrado en esta misma
pasada: `api-client.ts` mandaba `usuario_id` en los argumentos y
`checkPermissionOrFail` lo creía, así que un XSS, una dependencia npm
comprometida o cualquier JS ejecutado en el renderer podía reclamar
`usuario_id: 1` y operar como admin.

**Restricción de diseño**: esto tiene que ser 100% local. TOG Admin es
**offline-first** (ver `docs/ARCHITECTURE.md` → “Modelo de operación”): el login
se valida contra el SQLite del equipo, y la única red es la LAN del módulo Red
Local. Un token que dependiera de un servidor dejaría al negocio sin poder entrar
si se cae internet.

### 4.1 Cómo quedó

1. **Emisión**: `auth:login` exitoso llama `registrarSesion(db, user.id, 'base')`,
   que genera `sesion_token = crypto.randomBytes(16).toString('hex')` y lo guarda
   en `sesiones_activas.sesion_token`. La columna **ya existía** (migración 032) y
   nunca se comparaba: **no hizo falta migrar el esquema**.
2. **Transporte**: el token vive en memoria del renderer (store de Zustand, no
   `localStorage`), así una recarga equivale a cerrar sesión. `api-client.ts`
   adjunta `session_token` a toda llamada no-preauth.
3. **Validación**: `checkPermissionOrFail` resuelve el usuario **desde la fila de
   `sesiones_activas`** buscada por token (`getUsuarioDeToken`, sobre el índice
   único ya declarado) y evalúa el permiso sobre ese usuario. `extractUserId()` se
   eliminó y en su lugar quedó `resolveAuthenticatedUserId()`, que **falla
   cerrado**: sin token, o con token que no existe, devuelve `null` — nunca cae al
   `usuario_id` del cliente.
4. **Normalización (decisión)**: `checkPermissionOrFail` **sobrescribe
   `data.usuario_id`** con el usuario de la sesión antes de devolver. Se decidió
   **seguir mandando `usuario_id`** desde el renderer en vez de quitarlo de los
   args: decenas de handlers lo persisten (ventas, caja, ajustes de stock,
   auditoría) y los schemas Zod lo piden. Como el main lo pisa, el valor del
   cliente deja de tener efecto y no hay que tocar ~250 canales ni sus schemas.
   Esto **reemplaza** el punto 5 del diseño original, que proponía borrarlo de los
   args: habría sido un refactor masivo para el mismo resultado.
5. **PREAUTH**: intacto (`PREAUTH_CHANNELS` no lleva token y no lo necesita).
6. **Red local**: se **mantuvo** la comparación de §3.2 como segunda barrera.
   Además ahora la hija se autentica con el token que la Base le devolvió en el
   `auth:login` reenviado por RPC; la comparación por `par_id` sigue cubriendo el
   caso de un token reenviado desde otra terminal.
7. **Logout**: `red:logout` recibe el token y borra esa fila
   (`liberarSesionPorToken`), para que la sesión única por usuario no quede
   trabada al salir. El store captura el token **antes** de limpiar el estado.
8. **`getApi()` eliminado**: devolvía `window.api` crudo y era la vía para saltear
   `callApi` — y con eso, la credencial. Quedó sin uso al migrar `ProductImage.tsx`
   a `callApi`, así que se borró para que nadie lo reintroduzca.

### 4.2 Por qué no hizo falta la migración por etapas

El diseño original preveía 4 etapas (aceptar token **o** `usuario_id`, medir, y
recién después rechazar `usuario_id`) para no romper instalaciones viejas. En
Electron esa preocupación **no aplica**:

- El renderer y el main viajan en el **mismo ejecutable**: no existe un renderer
  viejo hablando con un main nuevo (ni al revés). El upgrade reemplaza ambos.
- La app **pide login en cada arranque** (`localStorage.removeItem('tog_user')`),
  así que no quedan sesiones persistidas sin token tras actualizar.

Por eso se aplicó el estado final de una vez (etapas 3 y 4 del plan), sin período
de convivencia ni telemetría de migración.

### 4.3 Consecuencias verificadas

- **Ningún llamador fuera de `callApi`**: se verificó por grep que en
  `src/renderer` los únicos usos de `window.api` estaban en `api-client.ts`.
  `ProductImage.tsx` usaba `getApi()` y se migró a `callApi` — sin eso, esa
  pantalla habría quedado sin token y rota.
- **Nada de red nueva**: el token se resuelve contra el SQLite local. No se agregó
  ninguna dependencia de internet ni de la landing.
- **La guarda de origen sigue vigente**: `handleIpc` valida sender y origen antes
  de la capa de permisos, así que el token no es la única barrera.

### 4.4 Cobertura de tests

| Caso | Archivo |
|---|---|
| Sin token → denegado (aunque el cliente mande `usuario_id`) | `core/auth/session-auth.test.ts` |
| Token inexistente (sesión cerrada o inventada) → denegado | `core/auth/session-auth.test.ts` |
| Un cajero no puede actuar como admin aunque falsifique `usuario_id` | `core/auth/session-auth.test.ts` |
| Permiso que pasa: `data.usuario_id` se normaliza al de la sesión | `core/auth/session-auth.test.ts` |
| El admin sigue pasando todo con su token | `core/auth/session-auth.test.ts` |
| El token deja de servir tras cerrar la sesión | `core/auth/session-auth.test.ts` |
| `resolveAuthenticatedUserId` con token válido / inválido / ausente / no-objeto | `core/auth/session-auth.test.ts` |
| `extractSessionToken` solo acepta strings no vacíos | `core/auth/session-auth.test.ts` |
| `callApi` adjunta `session_token` + `usuario_id` | `renderer/lib/api-client.test.tsx` |
| `callApi` no pisa un `session_token` explícito | `renderer/lib/api-client.test.tsx` |
| Sin sesión no adjunta nada (el main debe rechazar) | `renderer/lib/api-client.test.tsx` |
| Preauth no lleva sesión | `renderer/lib/api-client.test.tsx` |
| Re-login rota el token: el anterior deja de servir | `services/red-session.test.ts` |
| Liberar por token no toca las sesiones de otros | `services/red-session.test.ts` |
| La Base rechaza (403) a una hija que reclama otro `usuario_id` | `services/red-server.test.ts` |
| El token emitido en el login autoriza canales con la capa de permisos real (end-to-end por HTTP) | `services/red-server.test.ts` |

**Actualización**: el vencimiento de sesión por heartbeat resultó **no estar
cableado** (era código muerto) y con un bug de comparación de fechas. Quedó
implementado y cubierto de punta a punta en §3.12.

---

## 5. Remediaciones del informe que NO se aplicaron (y por qué)

### 5.1 CRIT-05 — `rejectUnauthorized` siempre `true`

El informe propone lanzar error si no hay CA. **Eso rompe el emparejamiento**:
en el primer `vincularABase()` la hija todavía no tiene el certificado de la Base
(se lo devuelve esa misma respuesta). El código actual hace TOFU: acepta el cert
auto-firmado en ese primer contacto y después lo **pinnea** (`config.ca` →
`rejectUnauthorized: true` en todas las llamadas siguientes). El impacto real de
CRIT-05 está acotado a ese primer handshake.

**Mejora recomendada (producto, no se hizo)**: mostrar el fingerprint del
certificado en la PC Base (`red:status` ya devuelve `certFingerprint` en la
hija) para que el operario compare en pantalla. Verificar `cert_pem` contra
`cert_fingerprint` **no sirve**: un atacante que intercepta el pairing controla
ambos valores del mismo cuerpo.

### 5.2 HIGH-01 — bindear a `127.0.0.1`

Rompe el módulo Red Local (la PC Base existe para servir a las hijas). Bindear a
una IP fija también se rompe: la IP cambia con DHCP y con cada red. El
comportamiento actual (`0.0.0.0`) es **by design**; las defensas son TLS +
código de enlace de un solo uso con TTL y rate limit + sesión por par + (ahora)
lista de canales bloqueados.

### 5.3 HIGH-08 — "reducir `PREAUTH_CHANNELS` al mínimo"

Parcialmente incorrecto. `AGENTS.md` ya documenta que `license:import`,
`license:sync`, `license:sync-account`, `red:status`, `red:vincular` y
`red:desvincular` **deben** ser pre-auth: son el camino para activar la app y
enlazar la terminal **antes** del login. Sacarlos rompe la activación. Lo que sí
era un problema real es que además fueran alcanzables **por red**, y eso se cerró
en §3.2. `crash-report:save` y `feedback:send` también deben seguir pre-auth
(funcionan desde la pantalla de login) y quedan mitigados por tamaño y rate limit.

### 5.4 MED-09 — ponerle auth a `crash-report:save`

Rompería el reporte de crashes de la pantalla de login (que es justo donde más
crash reports se generan). Se mitiga con topes de tamaño y bloqueo remoto.

### 5.5 LOW-03 — reducir la validez del certificado a 1 año

**Es un retroceso sin auto-renovación**: si el certificado de la Base expira y la
hija lo tiene pinneado, la conexión falla y la terminal deja de funcionar. Hoy
`getOrCreateCert()` reutiliza el certificado existente y no hay rotación.
Condición para hacerlo bien: implementar renovación (regenerar y re-notificar a
las hijas) **antes** de acortar la validez. Mientras tanto, 5 años es la opción
operativamente segura.

---

## 6. Diferidos (con su estado actual)

### 6.1 MED-04 — ✅ resuelto en §3.11

Se resolvió la decisión de UX que estaba pendiente (**el admin ve que hay una
clave cargada y puede reemplazarla, pero el main nunca se la devuelve**) y, de
paso, la fuga mayor por `config:get` que el informe no había visto. Ver §3.11.

### 6.2 MED-05 y LOW-04 (siguen diferidos)

> **MED-06** (puerto serial) se resolvió en §3.11: ya no se abre un puerto crudo
de la configuración.

- **MED-05** (restore de backup): riesgo residual aceptado por ahora. La ruta la
  elige el usuario en un diálogo nativo, requiere permiso `config_backup` y se
  valida la magic number de SQLite. El "ataque" es que un admin restaure una base
  arbitraria, que es la función de la feature. Útil a futuro: exigir que el
  archivo tenga el esquema esperado antes de reemplazar la base viva.
- **LOW-04** (rate limit por IP en memoria): mejorarlo pide persistencia
  (tabla + ventana por código de enlace). El valor actual es acotado: 26^6
  combinaciones a 5 intentos/minuto.

### 6.3 Schemas Zod muertos (NUEVO-02) — ✅ resuelto

Se cablearon los schemas de los caminos de mayor impacto y menor ambigüedad:
`usuarioCreateSchema` / `usuarioUpdateSchema` (incluye el **enum de `rol`**, que
además es la fuente única vía `USER_ROLES`), `changePasswordSchema`,
`configSetSchema` y los de caja e inventario (`cajaAbrirSchema`,
`cajaCerrarSchema`, `movimientoCajaSchema`, `categoriaCreate/UpdateSchema`,
`unidadCreate/UpdateSchema`).

**La validación no reemplaza el payload.** `validateInput()`
(`shared/validations.ts`) valida pero **no** devuelve los datos parseados: Zod
elimina las claves desconocidas, así que asignar `result.data` al payload
borraría campos que los handlers necesitan (por ejemplo `almacen_id` en
`caja:abrir`). El objeto original sigue siendo el que se usa.

**Consecuencia que hubo que resolver**: cablar `changePasswordSchema` subió el
mínimo de contraseña de 6 a 8, y la UI seguía pidiendo 6 → un usuario con 6 o 7
caracteres veía "✓ longitud OK" y el main lo rechazaba. Se alineó la UI
(`ForcePasswordChange.tsx` + placeholders y textos de `ConfigPage`) y las
traducciones de `forcePassword.*` (§ NUEVO-05).

---

## 7. Hallazgos nuevos (no estaban en el informe)

| ID | Hallazgo | Estado |
|---|---|---|
| NUEVO-01 | `productos:import-csv` **roto** por orden de argumentos (ver §3.9) | ✅ Corregido |
| NUEVO-02 | 13 de 24 schemas Zod eran código muerto; el informe los contaba como implementados | ✅ Cableados (§6.3) |
| NUEVO-03 | **El propio informe imprimía el token real de Telegram en claro** (HIGH-07 y Anexo C) | ✅ Redactado |
| NUEVO-04 | `database-security.test.ts` **exigía** el patrón vulnerable (`toContain('Math.random()')`) | ✅ Actualizado |
| NUEVO-05 | La UI pedía contraseña de **6** caracteres y los schemas del main exigen **8**: el usuario veía "✓ longitud OK" y el handler rechazaba | ✅ Alineado a 8 (UI + i18n) |
| NUEVO-06 | `getApi()` (`api-client.ts`) devolvía `window.api` crudo: era la vía para saltear `callApi` y, con el token, quedarse sin credencial | ✅ Eliminado (usado por `ProductImage.tsx`, migrado a `callApi`) |
| NUEVO-07 | El vencimiento de sesión por heartbeat **no estaba cableado** (código muerto) y su consulta comparaba fechas de dos formatos distintos: un par activo se veía inactivo | ✅ Implementado + bug de fechas corregido (§3.12) |
| NUEVO-08 | `config:get` devolvía la tabla de configuración completa, incluidas las API keys: el filtro de escritura de §3.8 era cosmético | ✅ Corregido (§3.11) |

NUEVO-03 es el más importante: el informe se generó a partir de un `.env` real y
volcó `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` en dos lugares del documento. El
archivo no está trackeado en git (verificado: no hay secretos en el historial),
pero estuvo en disco con el token válido. **Hay que rotar el token** (es la Fase
1 del `ROADMAP_SEGURIDAD.md` de la raíz del workspace, que sigue pendiente porque
solo la puede ejecutar el usuario en @BotFather).

---

## 8. Verificación

| Comando | Resultado |
|---|---|
| `tog-admin` → `npm run typecheck:all` (main + renderer) | ✅ sin errores |
| `tog-admin` → `npm test` | ✅ **527/527** (43 archivos) |
| `landing-page` → `npx tsc --noEmit` | ✅ sin errores |
| `landing-page` → `npm test` | ✅ **182/182** |
| `landing-page` → `npm run lint` | ✅ 0 errores |

Antes de implementar se verificaron además, por script, dos invariantes que
condicionan los cambios:

- `IPC_CHANNELS` tiene **250** entradas, sin duplicados, y los **250** canales
  con `handleIpc` están declarados → la guarda de §3.1 no puede romper el arranque.
- `src/renderer` **no** hace ningún request externo → `connect-src 'self'` no
  rompe ninguna pantalla.

En la segunda pasada se certificaron además, **ejecutando la consulta vieja y la
nueva** contra SQLite, dos hallazgos que se habían dado por buenos sin probarlos:

- **NUEVO-07 (fechas)**: la consulta original devolvía `['par-activo']` para un par
  que había latido 30 s antes del corte (lo habría expulsado); la versión con
  `datetime(...)` devuelve `[]`. El test de `red-session.test.ts` fija el caso.
- **NUEVO-08 (fuga por `config:get`)**: se verificó antes de filtrar que el
  renderer **no** lee ninguna clave reservada (`red_*`, `*_api_key`) y que
  `ConfigPage` sólo consume claves de negocio, así que el filtro no rompe ninguna
  pantalla.

---

## 9. Pendientes (ordenados por impacto)

1. **Rotar el token de Telegram** en @BotFather y actualizarlo solo en el backend
   (Railway/Vercel). Acción manual del usuario. (El token ya no viaja al cliente
   en ningún caso; esto es por la exposición que tuvo en el informe.)
2. **Desplegar la landing** con `/api/feedback`: hasta que esté publicado, el
   feedback de las instalaciones nuevas dirá "no pudimos enviar". El resto de la
   app no depende de eso (offline-first).
3. **Revisar los 3 schemas que quedan sin referencia externa** (§6.3): son
   sub-schemas de líneas que se componen dentro de `validations.ts`.
4. ~~MED-04 (claves de API en el renderer) y MED-06 (whitelist de puertos serie).~~
   ✅ Resueltos en §3.11.
5. Consolidar el `ROADMAP_SEGURIDAD.md` de la raíz del workspace: su Fase 1
   (rotación) sigue abierta y su Fase 6 afirmaba una validación que no existía
   (ya corregido en ese archivo el 17-Sep).

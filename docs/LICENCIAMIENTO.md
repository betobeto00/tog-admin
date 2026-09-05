# 🔐 Sistema de Licencias TOG Admin — Guía Completa

**Versión:** 1.0.0  
**Fecha:** 28 de agosto de 2026  
**Última actualización:** 2 de septiembre de 2026

---

## 📋 Tabla de Contenidos

1. [Resumen del Sistema](#1-resumen-del-sistema)
2. [Cómo Funciona (Flujo Visual)](#2-cómo-funciona-flujo-visual)
3. [Instalación en la PC del Cliente](#3-instalación-en-la-pc-del-cliente)
4. [Generación de Licencias (Paso a Paso)](#4-generación-de-licencias-paso-a-paso)
5. [Entrega e Instalación de la Licencia](#5-entrega-e-instalación-de-la-licencia)
6. [Renovación de Licencias](#6-renovación-de-licencias)
7. [Seguridad del Sistema](#7-seguridad-del-sistema)
8. [Preguntas Frecuentes](#8-preguntas-frecuentes)
9. [Troubleshooting](#9-troubleshooting)
10. [Referencia de Comandos](#10-referencia-de-comandos)

---

## 1. Resumen del Sistema

TOG Admin utiliza un sistema de **licencias RSA-2048** que funciona **100% offline** (sin internet). Cada licencia está vinculada a:

- **Nombre del cliente** (ej: "Papelería El Sol")
- **Fecha de expiración** (ej: 1 año desde emisión)
- **ID de máquina** (hardware único de la PC del cliente)
- **Firma digital RSA** (imposible de falsificar)

### ¿Qué necesitas como desarrollador?

| Archivo | Propósito | ¿Compartir con cliente? |
|---------|-----------|------------------------|
| `keys/private.key` | Genera licencias | ❌ **NUNCA** |
| `keys/public.key` | Validar licencias | ✅ Va embebida en el .exe |
| `scripts/generate-license.js` | Script para crear licencias | ❌ Solo tú lo usas |
| `scripts/generate-keys.js` | Generar claves (una vez) | ❌ Solo tú lo usas |

---

## 2. Cómo Funciona (Flujo Visual)

```
╔══════════════════════════════════════════════════════════════════════╗
║                    FLUJO COMPLETO DE LICENCIAMIENTO                 ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  ┌─────────────────────┐         ┌─────────────────────────────┐    ║
║  │   TÚ (Desarrollador) │         │   CLIENTE (Papelería)       │    ║
║  └──────────┬──────────┘         └──────────────┬──────────────┘    ║
║             │                                    │                   ║
║  PASO 1: Generar claves (UNA SOLA VEZ)          │                   ║
║  $ node scripts/generate-keys.js                │                   ║
║  → keys/private.key (🔴 secreta)                │                   ║
║  → keys/public.key  (🟢 va en el .exe)          │                   ║
║             │                                    │                   ║
║  PASO 2: Instalar TOG Admin ──────────────────► │                   ║
║  (copiar carpeta release/win-unpacked/)          │                   ║
║             │                                    │                   ║
║             │                         PASO 3: Cliente abre la app   ║
║             │                                    │                   ║
║             │                          ┌─────────▼──────────┐       ║
║             │                          │  PANTALLA DE BLOQUEO│       ║
║             │                          │                    │       ║
║             │                          │  ❌ Licencia no    │       ║
║             │                          │     encontrada     │       ║
║             │                          │                    │       ║
║             │                          │  🔑 Machine ID:    │       ║
║             │                          │  a1b2c3d4e5f6      │       ║
║             │                          │                    │       ║
║             │                          │  [Importar Licencia]│      ║
║             │                          └────────────────────┘       ║
║             │                                    │                   ║
║             │  PASO 4: Cliente te envía su      │                   ║
║             │  Machine ID por WhatsApp/email     │                   ║
║             ◄────────────────────────────────────┘                   ║
║             │                                                        ║
║  PASO 5: Generas la licencia                   │                   ║
║  $ node scripts/generate-license.js            │                   ║
║    "Papelería El Sol" "2027-08-28"             │                   ║
║    "a1b2c3d4e5f6"                              │                   ║
║  → license-2027-08-28-a1b2c3d4.key            │                   ║
║             │                                  │                   ║
║  PASO 6: Envías el .key al cliente ──────────►│                   ║
║  (WhatsApp, email, USB, etc.)                  │                   ║
║             │                                  │                   ║
║             │                       PASO 7: Cliente coloca el .key ║
║             │                       en %APPDATA%\tog-admin\         ║
║             │                       o lo importa desde la app        ║
║             │                                  │                   ║
║             │                          ┌─────────▼──────────┐       ║
║             │                          │  ✅ LICENCIA VÁLIDA │       ║
║             │                          │                    │       ║
║             │                          │  App funciona      │       ║
║             │                          │  normalmente       │       ║
║             │                          └────────────────────┘       ║
║                                                                      ║
║  PASO 8: Al vencer (1 año) → El cliente ve pantalla de bloqueo     ║
║          → Te genera nuevo Machine ID                                ║
║          → Tú generas nueva licencia                                 ║
║          → Se la envías y la importa desde Config                   ║
╚══════════════════════════════════════════════════════════════════════╝
```

---

## 3. Instalación en la PC del Cliente

### 3.1 Preparar el Instalador

El instalador de TOG Admin ya incluye la `public.key` embebida en el código fuente. No necesitas agregarla manualmente — Vite la incluye automáticamente durante el build.

> ⚠️ **Ubicación del archivo de licencia:** la app **instalada** NO lee `license.key` de la carpeta del .exe. La lee/crea en la carpeta de datos de la aplicación:
> `C:\Users\<usuario>\AppData\Roaming\tog-admin\license.key` (atajo: `%APPDATA%\tog-admin\license.key`)
> Solo en desarrollo (`npm run dev`) se lee de la raíz del proyecto.

```
release/win-unpacked/
├── TOG Admin.exe          ← Ejecutable principal
├── resources/
│   └── app.asar           ← Código fuente (incluye public.key)
├── dist/
│   ├── index.html         ← Frontend React
│   └── assets/
│       ├── index-XXX.js   ← JavaScript de la app
│       └── index-XXX.css  ← CSS de Tailwind
└── ... (otros archivos de Electron)

# En la PC del cliente — carpeta de datos de la app instalada:
C:\Users\<usuario>\AppData\Roaming\tog-admin\
├── license.key            ← ✅ Se crea al importar, o se copia aquí manualmente
├── license.json           ← Estado anti-tampering (automático)
└── tog-admin.db           ← Base de datos
```

### 3.2 Pasos de Instalación

1. **Copiar la carpeta** `release/win-unpacked/` a la PC del cliente
   - Puede ser por USB, red local, o descarga directa
   - Ejemplo: `C:\TOG Admin\`

2. **Crear acceso directo** del `TOG Admin.exe` en el escritorio (opcional)

3. **Abrir la app** por primera vez
   - Se creará la base de datos en `C:\Users\...\AppData\Roaming\tog-admin\tog-admin.db`
   - El usuario admin por defecto es: `admin` / `admin123`

4. **La app mostrará la pantalla de bloqueo** de licencia

---

## 4. Generación de Licencias (Paso a Paso)

### 4.1 Requisitos Previos

- Node.js instalado en tu PC de desarrollador
- Los archivos `keys/private.key` y `keys/public.key` generados previamente
- El `scripts/generate-license.js`

### 4.2 Generar Claves (Solo una vez)

Si aún no tienes las claves RSA:

```bash
# Navega al directorio del proyecto
cd D-E

# Genera el par de claves
node scripts/generate-keys.js
```

Salida esperada:
```
🔐 Generando par de claves RSA (2048 bits)...
✅ Claves generadas:
   🔑 keys/private.key  (1704 bytes) — NUNCA compartir
   🔓 keys/public.key   (451 bytes)  — Va dentro del .exe

⚠️  IMPORTANTE:
   - La private.key NUNCA debe salir de tu PC
   - La public.key se integra en el código fuente
   - Ambas se ignoran en .gitignore
```

### 4.3 Generar Licencia para un Cliente

```bash
# Formato:
node scripts/generate-license.js "NOMBRE DEL CLIENTE" "FECHA EXPIRACIÓN" [MACHINE_ID]

# Ejemplo SIN vincular a máquina (cualquier PC puede usarla):
node scripts/generate-license.js "Papelería El Sol" "2027-08-28"

# Ejemplo CON vincular a máquina específica (solo esa PC):
node scripts/generate-license.js "Papelería El Sol" "2027-08-28" "a1b2c3d4e5f6"
```

Salida esperada:
```
✅ Licencia generada:
   📄 licenses\license-2027-08-28-a1b2c3d4.key

   Cliente: Papelería El Sol
   Expira: 2027-08-28
   Versión: 1.0.0
   Machine: a1b2c3d4e5f6
   ID: f7e8d9c0b1a2

📋 Para activarla, el cliente importa el .key desde la pantalla de bloqueo
   o lo copia como license.key en %APPDATA%\tog-admin\
```

### 4.4 Parámetros del Script

| Parámetro | Requerido | Descripción | Ejemplo |
|-----------|-----------|-------------|---------|
| `nombre` | ✅ Sí | Nombre del cliente/negocio | `"Papelería El Sol"` |
| `fecha_expira` | ✅ Sí | Fecha de expiración (YYYY-MM-DD) | `"2027-08-28"` |
| `machine_id` | ❌ No | ID de máquina del cliente | `"a1b2c3d4e5f6"` |
| `--modules=a,b,c` | ❌ No | Módulos TOG Platform activados (v2) | `--modules=distribuidor,productor` |

> `max_pcs` (módulo Red Local) **no** se setea desde `generate-license.js` todavía. Se emite **vía tog-platform** (`POST /api/empresas/:id/licencias` con `{ max_pcs: N }`). Cuando el script CLI lo soporte, la flag será `--max-pcs=N` (N entre 1 y 20).

**Si no proporcionas `machine_id`**, la licencia funcionará en **cualquier PC**.  
**Si proporcionas `machine_id`**, la licencia solo funcionará en **esa PC específica**.  
**Si no proporcionas `--modules`**, la licencia cubre solo el módulo base (Comercializador). Los módulos válidos se definen en `src/shared/modules.ts`.  
**Para multi-PC (Red Local)**, emite la licencia desde `tog-platform` (`POST /api/empresas/:id/licencias`) incluyendo `max_pcs`. Ver sección "¿Puedo vincular la licencia a múltiples PCs?" abajo.

---

## 5. Entrega e Instalación de la Licencia

### 5.1 Opción A: Colocar el archivo en la carpeta de datos

1. En la PC del cliente, abre la carpeta de datos de la app:
   - `Win + R` → escribe `%APPDATA%\tog-admin` → Enter
   - O navega a `C:\Users\<usuario>\AppData\Roaming\tog-admin\`
2. Copia el archivo `.key` generado (ej: `license-2027-08-28-a1b2c3d4.key`)
3. Renómbralo a **`license.key`** (nombre exacto)

```
C:\Users\<usuario>\AppData\Roaming\tog-admin\
├── license.key          ← ✅ Archivo de licencia (nombre exacto)
├── license.json         ← Estado anti-tampering (automático)
└── tog-admin.db         ← Base de datos
```

4. Cierra la app si está abierta y ábrela de nuevo — detectará la licencia automáticamente

> ⚠️ **No** se coloca junto a `TOG Admin.exe` — la app instalada lee `license.key` de `%APPDATA%\tog-admin\`. (En desarrollo con `npm run dev`, sí se lee de la raíz del proyecto.)

### 5.2 Opción B: Importar desde la app

1. El cliente abre `TOG Admin.exe`
2. En la pantalla de bloqueo, hace clic en **"Importar Licencia"**
3. Selecciona el archivo `.key` que le enviaste
4. La app valida la firma y activa la licencia

### 5.3 Opción C: Importar desde Configuración

Si la app ya tiene una licencia válida pero el cliente necesita renovar:

1. Login → **Configuración** → pestaña **Sistema**
2. Sección **"Licencia del Software"**
3. Clic en **"Importar Nueva Licencia"**
4. Selecciona el nuevo archivo `.key`

### 5.4 Opción D: Sincronizar desde el servidor (TOG Platform)

Si el cliente fue dado de alta en el backend **TOG Platform** (empresa con `pais` + `documento` + `api_key`) y ya tiene licencia emitida, puede activarla o renovarla **sin recibir ningún archivo**:

1. TOG Admin → **Config → Licencia → Sincronizar** (el formulario también aparece en la pantalla de bloqueo, antes del login).
2. Carga la URL del backend, el ID de empresa y la API Key.
3. La app descarga la licencia activa (`GET /api/empresas/:id/licencia`), **re-valida la firma RSA localmente** y la guarda.

Notas:
- Es el camino de activación **online** y funciona sin sesión (canal pre-auth `license:sync`).
- La URL debe ser alcanzable desde la PC del cliente: `http://localhost:3001` solo sirve en tu máquina. Para clientes remotos haría falta desplegar el backend (ver README de `tog-platform`); mientras tanto, offline = Opciones A/B/C.
- Verificación end-to-end: `scripts/qa-sync.ts` + checklist manual en `docs/QA-SYNC.md`.

---

## 6. Renovación de Licencias

### 6.1 Cuando la licencia está por vencer (≤30 días)

La app muestra un **banner amarillo** en la parte superior:

```
⚠️ Tu licencia expira en 15 días (2027-08-28)  [Renovar licencia]
```

### 6.2 Cuando la licencia expira

La app muestra la **pantalla de bloqueo** con:
- Mensaje de error: "Licencia expirada hace X día(s)"
- Machine ID del cliente (para que te lo envíe)
- Botón "Importar Licencia"

### 6.3 Proceso de renovación

```
1. El cliente te envía su Machine ID (aparece en la pantalla de bloqueo)
2. Tú generas nueva licencia:
   $ node scripts/generate-license.js "Papelería El Sol" "2028-08-28" "a1b2c3d4e5f6"
3. Envías el nuevo .key al cliente
4. El cliente lo importa desde la pantalla de bloqueo o desde Configuración
```

**Alternativa online:** si el cliente usa **Sincronizar** (Opción D), la renovación es tú emitiendo la licencia nueva en TOG Platform → el cliente presiona Sincronizar y queda renovado, sin archivos de por medio.

---

## 7. Seguridad del Sistema

### 7.1 ¿Por qué RSA-2048?

| Característica | Detalle |
|----------------|---------|
| **Algoritmo** | RSA con 2048 bits de clave |
| **Firma** | SHA-256 con padding PKCS#1 v1.5 |
| **Tamaño de firma** | 256 bytes (base64) |
| **Seguridad** | Estándar de la industria, usado por bancos y gobiernos |
| **Tiempo de brute-force** | Miles de años con computadoras actuales |

### 7.2 ¿Por qué no se puede falsificar?

```
Para falsificar una licencia necesitarías:

1. Acceso a private.key → ❌ Solo existe en tu PC, nunca se comparte
2. Descifrar la firma RSA → ❌ Matemáticamente imposible (2048 bits)
3. Modificar la public.key en el .exe → ❌ El .exe está empaquetado en asar
4. Hackear tu PC de desarrollador → ❌ Difícil y arriesgado

En resumen: ❌ NO se puede falsificar sin tu private.key
```

### 7.3 ¿Qué pasa si alguien copia el .exe a otra PC?

| Escenario | Resultado |
|-----------|-----------|
| Copia la carpeta instalada a otra PC (la licencia queda en `%APPDATA%` de la PC original) | ❌ Pantalla de bloqueo |
| Copia la carpeta instalada **y** el `license.key` de `%APPDATA%\tog-admin\` (sin machine_id) | ✅ Funciona en cualquier PC |
| Copia la carpeta instalada **y** el `license.key` (con machine_id) | ❌ "Licencia vinculada a otra máquina" |
| Copia solo el `license.key` a otra PC | Depende de si tiene machine_id |

### 7.4 Machine ID

El Machine ID es un hash SHA-256 de la dirección MAC de la PC:

```
PC del cliente → MAC Address → SHA-256 → Primeros 16 caracteres
ej: a1b2c3d4e5f67890
```

| Característica | Detalle |
|----------------|---------|
| **Generación** | Automática, basada en hardware |
| **Estabilidad** | Mismo ID mientras no cambies la placa de red |
| **Precisión** | Identifica la PC de forma única |
| **Privacidad** | No expone datos personales |

---

## 8. Preguntas Frecuentes

### ¿Necesito internet para validar la licencia?
**No.** Todo el sistema funciona 100% offline. La validación se hace localmente en la PC del cliente usando la `public.key` embebida en el .exe.

### ¿Qué pasa si formateo la PC del cliente?
La licencia se almacena en `%APPDATA%\tog-admin\license.key` (y el estado anti-tampering en `license.json`, junto a la DB). Si formateas:
- La licencia se pierde si no la guardaste
- El Machine ID puede cambiar si cambia la placa de red
- Necesitas generar una nueva licencia

### ¿Puedo dar licencias permanentes (sin expiración)?
Sí. Usa una fecha de expiración lejana:
```bash
node scripts/generate-license.js "Cliente" "2099-12-31"
```
### ¿Puedo vincular la licencia a múltiples PCs?

**Sí**, vía el módulo Red Local (ver `docs/ARCHITECTURE.md` → "Módulo Red Local"). Pasos:

1. Genera la licencia con `--max-pcs=N` (N entre 2 y 20) cuando la emitas desde `scripts/generate-license.js` o vía `tog-platform` (`POST /api/empresas/:id/licencias` con `{ max_pcs: N }`).
2. Importa o sincroniza la licencia en la **PC Base**. Verá Config → Sistema → Red Local con el servidor activo en `:3002` y el botón **"Generar código de enlace"**.
3. En cada PC Hija: instalar el `.exe`, abrir la app, en la pantalla de bloqueo hacer clic en **"Conectar a una PC Base"**, completar IP de la Base + código + nombre. La hija queda enlazada y reenvía todas las llamadas a la Base.
4. La Base rechaza más PCs de las que diga `max_pcs` (tope en el handshake de `vincular`).

**Alternativa sin red local** (modo offline puro): genera N licencias independientes (una por PC), cada una con su `machine_id` o sin `machine_id` para que funcionen en cualquier PC.

### ¿Qué pasa si el cliente cambia de PC?
Si la licencia tiene `machine_id`, necesitas generar una nueva licencia para la nueva PC. Si no tiene `machine_id`, simplemente copia el mismo `license.key`.

### ¿Puedo revocar una licencia?
Con la validación **local offline**, no directamente: el `license.key` ya firmado sigue funcionando en esa PC (para "revocar" offline: que el cliente elimine el `license.key`, o rotar la `public.key` en una nueva versión del .exe para invalidar firmas viejas).

Con el **backend TOG Platform** sí hay revocación efectiva para clientes que sincronizan: si la empresa queda sin licencia activa (p. ej. impago tras el grace period), la próxima vez que presione **Sincronizar** el servidor responde `402` y la app muestra el motivo. La excepción sigue siendo un cliente 100% offline que nunca sincroniza.

### ¿Cuánto cuesta el sistema de licencias?
**$0.** Usa crypto nativo de Node.js. No necesitas servidores, APIs externas, ni servicios de terceros.

---

## 9. Troubleshooting

### La app no detecta el license.key

| Causa probable | Solución |
|----------------|----------|
| Archivo en ubicación incorrecta | La app instalada lee `%APPDATA%\tog-admin\license.key` — **no** junto al .exe. En dev, se lee de la raíz del proyecto |
| Nombre incorrecto | El archivo debe llamarse exactamente `license.key` |
| Archivo corrupto | Verifica que el contenido sea JSON válido |

### Error "Firma de licencia inválida"

| Causa probable | Solución |
|----------------|----------|
| Archivo modificado | No edits el contenido del `.key` manualmente |
| Licencia de otro proyecto | Cada proyecto tiene sus propias claves RSA |
| Corrupción al copiar | Vuelve a copiar el archivo original |

### Error "Licencia vinculada a otra máquina"

| Causa probable | Solución |
|----------------|----------|
| PC incorrecta | La licencia está vinculada a otra Machine ID |
| Cambio de hardware | Si cambiaste la placa de red, el Machine ID cambió |
| Solución | Genera una nueva licencia sin machine_id, o con el nuevo ID |

### Error "Licencia expirada"

| Causa probable | Solución |
|----------------|----------|
| Fecha pasó | Genera una nueva licencia con fecha futura |
| Reloj desincronizado | Verifica que la fecha/hora del sistema sea correcta |

### La app muestra pantalla blanca después de importar licencia

| Causa probable | Solución |
|----------------|----------|
| Licencia corrupta | Elimina `license.key` y vuelve a importar |
| Error de build | Rebuild: `npm run build:renderer && npm run build:main` |

---

## 10. Referencia de Comandos

### Generar claves RSA (una vez)
```bash
node scripts/generate-keys.js
```

### Generar licencia
```bash
# Básica (sin vincular a máquina)
node scripts/generate-license.js "Nombre" "AAAA-MM-DD"

# Con machine_id específica
node scripts/generate-license.js "Nombre" "AAAA-MM-DD" "machine_id"

# Con módulos TOG Platform activados (v2)
node scripts/generate-license.js "Nombre" "AAAA-MM-DD" "machine_id" --modules=distribuidor,productor

# Con múltiples PCs (Red Local, ver "Módulo Red Local" en ARCHITECTURE.md)
node scripts/generate-license.js "Nombre" "AAAA-MM-DD" "machine_id" --modules=distribuidor --max-pcs=4
```

### Verificar licencia actual
```bash
# La app valida automáticamente al iniciar
# También se puede verificar desde Config → Sistema → Licencia
```

### Estructura del archivo license.key
```json
{
  "cliente": "Papelería El Sol",
  "expira": "2027-08-28",
  "version": "1.0.0",
  "machineId": "a1b2c3d4e5f6",
  "modules": ["distribuidor"],
  "max_pcs": 4,
  "emitida": "2026-08-28T22:00:00.000Z",
  "id": "f7e8d9c0b1a2",
  "firma": "base64-encoded-rsa-signature..."
}
```

> `modules` es **opcional** (licencias v2, TOG Platform): lista los módulos activados además del base Comercializador. Las licencias v1 sin `modules` siguen siendo válidas y cubren el módulo base. La app muestra el estado de cada módulo en **Configuración → Sistema → Módulos de TOG Platform** (catálogo en `src/shared/modules.ts`).
> `max_pcs` es **opcional** (licencias con red local). Si está presente y es ≥ 2, la PC con licencia pasa a ser **PC Base** y permite vincular hasta `max_pcs-1` PCs hijas (ver `docs/ARCHITECTURE.md` → "Módulo Red Local"). Si está ausente o es 1, la app opera en modo local sin red.

---

## 📁 Estructura de Archivos

```
D-E/
├── keys/
│   ├── private.key          ← 🔴 SECRETA — Solo tu PC
│   └── public.key           ← 🟢 Embebida en el .exe
├── licenses/
│   └── license-YYYY-MM-DD-XXX.key  ← Licencias generadas
├── scripts/
│   ├── generate-keys.js     ← Generar claves RSA
│   └── generate-license.js  ← Generar licencias
├── src/
│   ├── main/
│   │   └── services/
│   │       └── license.ts   ← Validación en main process
│   └── renderer/
│       └── components/
│           └── LicenseGate.tsx  ← Pantalla de bloqueo
└── release/
    └── win-unpacked/
        ├── TOG Admin.exe
        └── resources/
            └── app.asar     ← Incluye public.key

# En la PC del cliente — carpeta de datos de la app instalada:
%APPDATA%\tog-admin\
├── license.key      ← Licencia del cliente (se crea al importar o se copia aquí)
└── tog-admin.db     ← Base de datos
```

---

## ⚠️ Recordatorios Importantes

1. **NUNCA compartas `keys/private.key`** — Es la clave maestra del sistema
2. **Genera las claves UNA SOLA VEZ** — Todas las licencias usan las mismas claves
3. **Guarda un backup de `keys/`** en un lugar seguro (USB, nube privada)
4. **El Machine ID es opcional** — Sin él, la licencia funciona en cualquier PC
5. **La fecha de expiración es flexible** — Puedes dar licencias de 1 año, 5 años, o permanentes
6. **Todo funciona offline** — No necesitas internet ni servidores

---

**Documento generado automáticamente**  
**Proyecto:** TOG Admin v1.0.0  
**Sistema de licencias:** RSA-2048 con validación offline

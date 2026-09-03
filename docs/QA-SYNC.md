# QA — Sincronización de licencia (TOG Platform ↔ TOG Admin)

El flujo que garantiza esto:

```
Roberto paga → admin emite licencia en el backend → Roberto abre TOG Admin
→ Config → Licencia → “Sincronizar” → la app descarga, valida la firma RSA
y activa los módulos de la licencia (ej: Distribuidor).
```

## 1. QA automatizado (headless)

```bash
# Desde la raíz de tog-admin:
npx tsx scripts/qa-sync.ts
```

Qué cubre:

1. Levanta el backend real (`../tog-platform`) con **`keys/private.key`** y una DB temporal.
2. Verifica que la **clave pública embebida** en la app (`src/main/services/license-crypto.ts`) es la pareja exacta de `keys/private.key` (si no, ninguna licencia del backend validaría).
3. Crea una empresa internacional (`pais` + `documento`, ej: MX/RFC) vía API admin.
4. Emite una licencia con el módulo `distribuidor`.
5. Simula el canal `license:sync`: descarga la licencia activa con la `api_key` de la empresa y la valida con la **misma función** que usa la app (`verifyLicenseSignature`).

Salida esperada: `✅ QA sync OK …`. Exit code `0`.

## 2. QA manual en Electron (con clic)

Requisitos: backend corriendo con la clave real y una empresa + licencia emitida.

```bash
# Terminal 1 — backend (usa la clave real de tog-admin)
cd ../tog-platform
LICENSE_PRIVATE_KEY_PATH=../tog-admin/keys/private.key npm start

# Terminal 2 — app en desarrollo
cd tog-admin && npm run dev
```

Pasos en la app:

1. **Sin licencia (pantalla de bloqueo):** si no hay `license.key`, la app muestra *LicenseGate*.
   - Debajo de “Importar Licencia” debe aparecer el formulario **“Sincronizar”**.
   - Cargar la URL del backend (`http://localhost:3001`), el **ID de empresa** y la **API Key** (los devuelve el `POST /api/empresas` al crear la empresa).
   - Clic en **Sincronizar licencia** → toast verde y la app entra (licencia válida).
2. **Config → Licencia (con sesión):**
   - El panel “Licencia del Software” muestra estado/cliente/expiración.
   - En el mismo panel está el formulario de sincronización (misma URL + ID + API Key).
3. **Activación del módulo Distribuidor:**
   - Emitir en el backend una licencia con `modules: ["distribuidor"]`.
   - En la app: Config → Licencia → **Sincronizar** (o reiniciar si ya estaba abierta).
   - El Sidebar debe mostrar **Clientes** y **Pedidos** al instante (evento `tog:license-updated`).
4. **Menú Clientes → Nuevo Cliente:** el campo del documento acepta formatos internacionales
   (RIF `J-123…`, RFC `XYZ…`, EIN `12-3456789`, CNPJ `12.345.678/0001-99`).
5. **Importar archivo** (flujo offline) sigue funcionando: archivo `.key` válido activa la licencia.

### Casos negativos esperados

| Escenario | Resultado esperado |
|---|---|
| URL inalcanzable | Toast error “No se pudo conectar con el servidor…” |
| Server sin respuesta en 10 s | Toast “Tiempo de espera agotado…” |
| API Key desconocida | Toast con error 401 del backend |
| Licencia emitida con otra clave (no pareja de la app) | Guardado rechazado: “Firma RSA inválida” |
| `machineId` distinto al de la PC (si la licencia lo trae) | “Licencia para otra máquina” |

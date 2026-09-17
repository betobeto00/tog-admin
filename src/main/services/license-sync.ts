import { normalizeModules } from '../../shared/modules'

// Sincronización de licencia desde el backend TOG Platform.
// Lógica pura (sin electron) para poder probarse en vitest: el fetch y el
// guardado se inyectan (defaults: globalThis.fetch y saveLicense real).

export interface LicenseSyncArgs {
  url: string
  empresaId: string | number
  apiKey: string
  deviceFingerprint?: string
  /** ID del vendedor que trajo al cliente (OMV-XXXXX). Opcional. */
  vendedorId?: string
  /** Si es true, sobreescribe la licencia local sin pedir confirmación. */
  force?: boolean
}

interface FetchResponseLike {
  ok: boolean
  status: number
  json(): Promise<any>
}

export interface LocalLicenseInfo {
  cliente: string
  expira: string
  modules: string[]
}

export interface LicenseSyncDeps {
  timeoutMs?: number
  fetchImpl?: (url: string, init: any) => Promise<FetchResponseLike>
  saveImpl?: (rawLicenseJson: string) => { success: boolean; error?: string }
  checkLocalLicense?: () => LocalLicenseInfo | null
}

export type VendedorVinculacion = {
  vinculado: boolean
  id_vendedor?: string
  nombre?: string
  error?: string
}

export type LicenseSyncResult =
  | { success: true; cliente: string; expira: string; modulos: string[]; vendedor?: VendedorVinculacion }
  | { success: false; error: string; deviceMismatch?: boolean; empresaId?: string | number; apiKey?: string }
  | { success: true; pendingOverwrite: true; cloud: { cliente: string; expira: string; modules: string[] }; local: LocalLicenseInfo }

/** Mismo formato que genera la landing page en /soy-vendedor. */
export const ID_VENDEDOR_REGEX = /^OMV-[A-Z0-9]{5}$/

export interface LicenseAccountSyncArgs {
  url: string
  email: string
  password: string
  deviceFingerprint?: string
  /** ID del vendedor que trajo al cliente (OMV-XXXXX). Opcional. */
  vendedorId?: string
  /** Si es true, sobreescribe la licencia local sin pedir confirmación. */
  force?: boolean
}

const DEFAULT_TIMEOUT_MS = 10_000

export async function syncLicenseFromServer(
  args: LicenseSyncArgs,
  deps: LicenseSyncDeps = {},
): Promise<LicenseSyncResult> {
  const url = (args?.url || '').trim().replace(/\/+$/, '')
  const empresaId = String(args?.empresaId ?? '').trim()
  const apiKey = (args?.apiKey || '').trim()
  const deviceFingerprint = args?.deviceFingerprint || ''

  if (!/^https?:\/\/.+/i.test(url)) {
    return { success: false, error: 'La URL del servidor debe comenzar con http:// o https://' }
  }
  if (!/^\d+$/.test(empresaId)) {
    return { success: false, error: 'El ID de empresa es inválido (debe ser numérico)' }
  }
  if (!apiKey) {
    return { success: false, error: 'Falta la API Key de la empresa' }
  }

  const fetchImpl = deps.fetchImpl || (globalThis.fetch as LicenseSyncDeps['fetchImpl'])
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  let response: FetchResponseLike
  try {
    const headers: Record<string, string> = { 'x-api-key': apiKey, Accept: 'application/json' }
    if (deviceFingerprint) headers['x-machine-id'] = deviceFingerprint
    response = await fetchImpl!(`${url}/api/empresas/${empresaId}/licencia`, {
      headers,
      signal: controller.signal,
    })
  } catch (err: any) {
    return {
      success: false,
      error:
        err?.name === 'AbortError'
          ? 'Tiempo de espera agotado al contactar el servidor. Intenta de nuevo.'
          : `No se pudo conectar con el servidor: ${err?.message || err}`,
    }
  } finally {
    clearTimeout(timer)
  }

  let body: any = {}
  try {
    body = await response.json()
  } catch {
    body = {}
  }

  if (!response.ok) {
    const serverError = body?.error
    const isDeviceMismatch = response.status === 403 && body?.code === 'DEVICE_MISMATCH'
    return {
      success: false,
      error:
        typeof serverError === 'string' && serverError
          ? serverError
          : `El servidor respondió con estado ${response.status}`,
      deviceMismatch: isDeviceMismatch || undefined,
      empresaId: isDeviceMismatch ? empresaId : undefined,
      apiKey: isDeviceMismatch ? apiKey : undefined,
    }
  }

  const licencia = body?.licencia
  if (!licencia || typeof licencia !== 'object' || typeof licencia.firma !== 'string') {
    return { success: false, error: 'El servidor no devolvió una licencia firmada' }
  }

  const cloudModules = normalizeModules(licencia.modules)
  const cloudInfo = { cliente: licencia.cliente ?? '', expira: licencia.expira ?? '', modules: cloudModules }

  // Si ya existe una licencia local y no se pidió force, devolvemos los datos
  // para que el UI muestre la comparación y el usuario decida.
  if (!args.force && deps.checkLocalLicense) {
    const local = deps.checkLocalLicense()
    if (local) {
      return { success: true, pendingOverwrite: true, cloud: cloudInfo, local }
    }
  }

  const raw = JSON.stringify(licencia)
  if (deps.saveImpl) {
    const saved = deps.saveImpl(raw)
    if (!saved?.success) {
      return { success: false, error: saved?.error || 'No se pudo guardar la licencia descargada' }
    }
  }

  // FASE 5: si el cliente trajo el ID del vendedor, se vincula la empresa con
  // ese vendedor (comisión para él). Nunca invalida la licencia ya descargada:
  // si falla, el usuario ve un aviso pero queda activado.
  const vendedor = await vincularVendedor(
    fetchImpl,
    url,
    { empresaId: Number(empresaId), apiKey, vendedorId: args?.vendedorId },
    deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  )

  return {
    success: true,
    cliente: cloudInfo.cliente,
    expira: cloudInfo.expira,
    modulos: cloudModules,
    vendedor,
  }
}

/**
 * Vincula la empresa recién sincronizada con el vendedor que la trajo.
 * Devuelve undefined si no se pidió vinculación (sin `vendedorId`).
 */
async function vincularVendedor(
  fetchImpl: LicenseSyncDeps['fetchImpl'],
  url: string,
  { empresaId, apiKey, vendedorId }: { empresaId: number; apiKey: string; vendedorId?: string },
  timeoutMs: number,
): Promise<VendedorVinculacion | undefined> {
  const id = (vendedorId || '').trim().toUpperCase()
  if (!id) return undefined
  if (!ID_VENDEDOR_REGEX.test(id)) {
    return { vinculado: false, id_vendedor: id, error: 'El ID de vendedor debe tener el formato OMV-XXXXX' }
  }
  if (!Number.isInteger(empresaId) || empresaId <= 0) {
    return { vinculado: false, id_vendedor: id, error: 'No se pudo vincular el vendedor: empresa inválida' }
  }

  try {
    const response = await requestJsonSafe(
      fetchImpl,
      `${url}/api/empresas/${empresaId}/vendedor`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ id_vendedor: id }),
      },
      timeoutMs,
    )
    const body: any = await response.json().catch(() => ({}))
    if (!response.ok || body?.success === false) {
      return {
        vinculado: false,
        id_vendedor: id,
        error: typeof body?.error === 'string' ? body.error : `No se pudo vincular el vendedor (estado ${response.status})`,
      }
    }
    return { vinculado: true, id_vendedor: body?.vendedor?.id_vendedor || id, nombre: body?.vendedor?.nombre }
  } catch (err: any) {
    return {
      vinculado: false,
      id_vendedor: id,
      error: err?.name === 'AbortError' ? 'Se agotó el tiempo al vincular el vendedor' : `No se pudo vincular el vendedor: ${err?.message || err}`,
    }
  }
}

/**
 * Sincroniza la licencia usando la cuenta OmniMargen (email + contraseña):
 * login → perfil (empresa + api_key) → descarga la licencia activa.
 * Mismo contrato de resultado que syncLicenseFromServer para reutilizar la UI.
 */
export async function syncLicenseWithAccount(
  args: LicenseAccountSyncArgs,
  deps: LicenseSyncDeps = {},
): Promise<LicenseSyncResult> {
  const url = (args?.url || '').trim().replace(/\/+$/, '')
  const email = (args?.email || '').trim()
  const password = args?.password || ''

  if (!/^https?:\/\/.+/i.test(url)) {
    return { success: false, error: 'La URL del servidor debe comenzar con http:// o https://' }
  }
  if (!email || !password) {
    return { success: false, error: 'Email y contraseña son requeridos' }
  }

  const fetchImpl = deps.fetchImpl || (globalThis.fetch as LicenseSyncDeps['fetchImpl'])
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const fail = (response: FetchResponseLike, body: any): LicenseSyncResult => {
    const serverError = body?.error
    return {
      success: false,
      error:
        typeof serverError === 'string' && serverError
          ? serverError
          : `El servidor respondió con estado ${response.status}`,
    }
  }

  let loginResponse: FetchResponseLike
  try {
    loginResponse = await requestJsonSafe(fetchImpl, `${url}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }, timeoutMs)
  } catch (err: any) {
    return {
      success: false,
      error: err?.name === 'AbortError' ? 'Tiempo de espera agotado. Intenta de nuevo.' : `No se pudo conectar con el servidor: ${err?.message || err}`,
    }
  }

  let loginBody: any = {}
  try {
    loginBody = await loginResponse.json()
  } catch {
    loginBody = {}
  }
  if (!loginResponse.ok || !loginBody?.token) {
    return fail(loginResponse, loginBody)
  }

  let profileResponse: FetchResponseLike
  try {
    profileResponse = await requestJsonSafe(fetchImpl, `${url}/api/user/profile`, {
      headers: { Authorization: `Bearer ${loginBody.token}` },
    }, timeoutMs)
  } catch (err: any) {
    return {
      success: false,
      error: err?.name === 'AbortError' ? 'Tiempo de espera agotado. Intenta de nuevo.' : `No se pudo conectar con el servidor: ${err?.message || err}`,
    }
  }

  let profileBody: any = {}
  try {
    profileBody = await profileResponse.json()
  } catch {
    profileBody = {}
  }
  if (!profileResponse.ok || !profileBody?.success) {
    return fail(profileResponse, profileBody)
  }

  const empresa = profileBody?.empresa
  if (!empresa?.id || !empresa?.api_key) {
    return { success: false, error: 'Tu cuenta no tiene empresa vinculada. Complétala en omnimargen.site/cuenta.' }
  }

  const licenciaResult = await syncLicenseFromServer(
    {
      url,
      empresaId: empresa.id,
      apiKey: empresa.api_key,
      deviceFingerprint: args?.deviceFingerprint,
      vendedorId: args?.vendedorId,
      force: args?.force,
    },
    deps,
  )
  return licenciaResult
}

async function requestJsonSafe(
  fetchImpl: LicenseSyncDeps['fetchImpl'],
  url: string,
  init: any,
  timeoutMs: number,
): Promise<FetchResponseLike> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetchImpl!(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

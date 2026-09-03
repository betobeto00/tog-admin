import { normalizeModules } from '../../shared/modules'

// Sincronización de licencia desde el backend TOG Platform.
// Lógica pura (sin electron) para poder probarse en vitest: el fetch y el
// guardado se inyectan (defaults: globalThis.fetch y saveLicense real).

export interface LicenseSyncArgs {
  url: string
  empresaId: string | number
  apiKey: string
}

interface FetchResponseLike {
  ok: boolean
  status: number
  json(): Promise<any>
}

export interface LicenseSyncDeps {
  timeoutMs?: number
  fetchImpl?: (url: string, init: any) => Promise<FetchResponseLike>
  saveImpl?: (rawLicenseJson: string) => { success: boolean; error?: string }
}

export type LicenseSyncResult =
  | { success: true; cliente: string; expira: string; modulos: string[] }
  | { success: false; error: string }

const DEFAULT_TIMEOUT_MS = 10_000

export async function syncLicenseFromServer(
  args: LicenseSyncArgs,
  deps: LicenseSyncDeps = {},
): Promise<LicenseSyncResult> {
  const url = (args?.url || '').trim().replace(/\/+$/, '')
  const empresaId = String(args?.empresaId ?? '').trim()
  const apiKey = (args?.apiKey || '').trim()

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
    response = await fetchImpl!(`${url}/api/empresas/${empresaId}/licencia`, {
      headers: { 'x-api-key': apiKey, Accept: 'application/json' },
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
    return {
      success: false,
      error:
        typeof serverError === 'string' && serverError
          ? serverError
          : `El servidor respondió con estado ${response.status}`,
    }
  }

  const licencia = body?.licencia
  if (!licencia || typeof licencia !== 'object' || typeof licencia.firma !== 'string') {
    return { success: false, error: 'El servidor no devolvió una licencia firmada' }
  }

  const raw = JSON.stringify(licencia)
  if (deps.saveImpl) {
    const saved = deps.saveImpl(raw)
    if (!saved?.success) {
      return { success: false, error: saved?.error || 'No se pudo guardar la licencia descargada' }
    }
  }

  return {
    success: true,
    cliente: licencia.cliente ?? '',
    expira: licencia.expira ?? '',
    modulos: normalizeModules(licencia.modules),
  }
}

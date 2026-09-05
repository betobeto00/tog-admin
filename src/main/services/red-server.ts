import http from 'http'
import https from 'https'
import { PREAUTH_CHANNELS } from '../../shared/ipc-channels'
import { generarToken, parTieneSesionActiva, liberarSesionesDePar, actualizarHeartbeatPar, type DbLike } from './red-session'
import { logger } from './logger'
import { getDatabase } from '../db/database'
import { getIpcListener } from '../core/auth/ipc-guard'
import { getLicenseMaxPcs } from './license'
import { isBase } from './red-config'
import type { TlsMaterial } from './red-cert'

export const RED_SERVER_PORT = 3002
const CODIGO_TTL_MS = 5 * 60 * 1000

export interface RedServerDeps {
  getDb: () => DbLike
  getHandler: (canal: string) => ((...args: any[]) => any) | undefined
  getMaxPcs: () => number
  port?: number
  tls?: TlsMaterial | null
}

export interface RedServer {
  start: () => Promise<number>
  stop: () => Promise<void>
}

export function generarCodigoEnlace(
  db: DbLike,
  now: Date = new Date(),
  ttlMs: number = CODIGO_TTL_MS,
): { codigo: string; expira_en: string } {
  const codigo = generarToken(3).toUpperCase()
  const expiraEn = new Date(now.getTime() + ttlMs).toISOString()
  db.prepare('INSERT INTO codigos_enlace (codigo, expira_en, usado) VALUES (?, ?, 0)').run(codigo, expiraEn)
  db.prepare('DELETE FROM codigos_enlace WHERE usado = 0 AND expira_en < ?').run(now.toISOString())
  return { codigo, expira_en: expiraEn }
}

let runningServer: RedServer | null = null

export async function startRedServerIfBase(): Promise<boolean> {
  try {
    if (!isBase()) return false
    if (runningServer) return true
    let tls: TlsMaterial | null = null
    try {
      const { getOrCreateCert } = await import('./red-cert')
      tls = await getOrCreateCert()
    } catch (certErr: any) {
      logger.warn('red', `No se pudo cargar/generar cert TLS (${certErr?.message}). Cayendo a HTTP para no bloquear dev.`)
    }
    runningServer = createRedServer({
      getDb: getDatabase,
      getHandler: getIpcListener,
      getMaxPcs: getLicenseMaxPcs,
      tls,
    })
    await runningServer.start()
    return true
  } catch (err: any) {
    logger.error('red', 'No se pudo iniciar el servidor red:', err)
    return false
  }
}

export async function stopRedServer(): Promise<void> {
  if (runningServer) {
    await runningServer.stop()
    runningServer = null
  }
}

export function isRedServerRunning(): boolean {
  return runningServer !== null
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        resolve(null)
      }
    })
  })
}

function json(res: http.ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function validarPar(db: DbLike, parId: unknown, certHash: unknown): boolean {
  if (typeof parId !== 'string' || typeof certHash !== 'string') return false
  const pc = db
    .prepare('SELECT 1 FROM pcs_enlazadas WHERE par_id = ? AND cert_hash = ?')
    .get(parId, certHash)
  if (!pc) return false
  actualizarHeartbeatPar(db, parId)
  return true
}

export function createRedServer(deps: RedServerDeps): RedServer {
  let server: http.Server | https.Server | null = null
  const port = deps.port ?? RED_SERVER_PORT
  const tls = deps.tls ?? null

  const handle = async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const path = url.pathname
    const method = req.method || 'GET'

    try {
      if (method !== 'POST') {
        return json(res, 405, { success: false, error: 'Método no permitido (usar POST)' })
      }

      if (path === '/api/red/vincular') {
        const body = await readBody(req)
        const codigo = typeof body?.codigo === 'string' ? body.codigo.trim().toUpperCase() : ''
        const nombre = typeof body?.nombre === 'string' ? body.nombre.trim().slice(0, 80) : ''
        if (!codigo || !nombre) {
          return json(res, 400, { success: false, error: 'codigo y nombre son requeridos' })
        }
        const db = deps.getDb()
        const row = db
          .prepare('SELECT id, expira_en, usado FROM codigos_enlace WHERE codigo = ?')
          .get(codigo) as { id: number; expira_en: string; usado: number } | undefined
        if (!row) return json(res, 404, { success: false, error: 'Código de enlace inválido' })
        if (row.usado) return json(res, 409, { success: false, error: 'Código de enlace ya utilizado' })
        if (new Date(row.expira_en).getTime() < Date.now()) {
          return json(res, 410, { success: false, error: 'Código de enlace expirado' })
        }
        const maxPcs = deps.getMaxPcs()
        const enlazadas = (db.prepare('SELECT COUNT(*) AS c FROM pcs_enlazadas').get() as { c: number }).c
        if (enlazadas >= maxPcs) {
          return json(
            res,
            403,
            { success: false, error: `Límite de PCs alcanzado (${maxPcs}). La licencia no permite más equipos.` },
          )
        }

        const parId = generarToken(8)
        const certHash = generarToken(16)
        const clienteIp = (req.socket.remoteAddress || '').replace(/^::ffff:/, '')
        db.prepare(
          'INSERT INTO pcs_enlazadas (par_id, nombre, ip, cert_hash, last_seen, last_heartbeat) VALUES (?, ?, ?, ?, datetime(\'now\'), datetime(\'now\'))',
        ).run(parId, nombre, clienteIp, certHash)
        db.prepare('UPDATE codigos_enlace SET usado = 1, usado_en = datetime(\'now\') WHERE id = ?').run(row.id)
        logger.info('red', `PC hija enlazada: ${nombre} (${clienteIp}) par_id=${parId.slice(0, 8)}…`)
        return json(res, 201, {
          success: true,
          par_id: parId,
          cert_hash: certHash,
          nombre,
          cert_pem: tls?.certPem ?? null,
          cert_fingerprint: tls?.fingerprintSha256 ?? null,
        })
      }

      if (path === '/api/red/heartbeat') {
        const body = await readBody(req)
        const db = deps.getDb()
        if (!validarPar(db, body?.par_id, body?.cert_hash)) {
          return json(res, 401, { success: false, error: 'Credenciales de par inválidas' })
        }
        return json(res, 200, { success: true, server_time: new Date().toISOString() })
      }

      if (path === '/api/red/logout') {
        const body = await readBody(req)
        const db = deps.getDb()
        if (!validarPar(db, body?.par_id, body?.cert_hash)) {
          return json(res, 401, { success: false, error: 'Credenciales de par inválidas' })
        }
        liberarSesionesDePar(db, body.par_id)
        return json(res, 200, { success: true })
      }

      if (path === '/api/red/rpc') {
        const body = await readBody(req)
        const db = deps.getDb()
        if (!validarPar(db, body?.par_id, body?.cert_hash)) {
          return json(res, 401, { success: false, error: 'Credenciales de par inválidas' })
        }
        const canal = typeof body?.canal === 'string' ? body.canal : ''
        const args: unknown[] = Array.isArray(body?.args) ? body.args : []
        if (!canal) return json(res, 400, { success: false, error: 'canal es requerido' })

        const esPreauth = (PREAUTH_CHANNELS as readonly string[]).includes(canal)
        if (!esPreauth && !parTieneSesionActiva(db, body.par_id)) {
          return json(res, 401, { success: false, error: 'Sin sesión activa en esta PC. Iniciá sesión primero.' })
        }

        const handler = deps.getHandler(canal)
        if (!handler) {
          return json(res, 404, { success: false, error: `Canal desconocido: ${canal}` })
        }

        const argsConPar =
          canal === 'auth:login' && args.length > 0
            ? [{ ...(args[0] as object), __par_id: body.par_id }, ...args.slice(1)]
            : args

        return json(res, 200, { success: true, response: await handler(null, ...argsConPar) })
      }

      return json(res, 404, { success: false, error: 'Ruta no encontrada' })
    } catch (err: any) {
      logger.error('red', 'Error en servidor red:', err)
      return json(res, 500, { success: false, error: err?.message || 'Error interno' })
    }
  }

  return {
    start: () =>
      new Promise<number>((resolve, reject) => {
        if (server) return resolve(port)
        if (tls) {
          server = https.createServer({ key: tls.keyPem, cert: tls.certPem }, handle as any)
          logger.info('red', `Servidor HTTPS habilitado (fp=${tls.fingerprintSha256.slice(0, 12)}…)`)
        } else {
          server = http.createServer(handle)
          logger.warn('red', 'Servidor HTTP sin TLS (solo desarrollo). Generar cert para producción.')
        }
        server.on('error', (err) => {
          logger.error('red', 'Error del servidor red:', err)
        })
        server.once('error', reject)
        server.listen(port, '0.0.0.0', () => {
          const addr = server?.address()
          const actualPort = addr && typeof addr === 'object' ? addr.port : port
          logger.info('red', `Servidor red local escuchando en :${actualPort} (${tls ? 'HTTPS' : 'HTTP'})`)
          resolve(actualPort)
        })
      }),
    stop: () =>
      new Promise<void>((resolve) => {
        if (!server) return resolve()
        server.close(() => {
          server = null
          resolve()
        })
      }),
  }
}

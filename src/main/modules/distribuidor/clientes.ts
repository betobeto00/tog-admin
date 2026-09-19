import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { getActiveModules } from '../../services/license'
import { clienteCreateSchema, clienteUpdateSchema } from '../../../shared/validations'

function checkModuleOrFail(): { success: false; error: string } | null {
  if (!getActiveModules().includes('comercializador')) {
    return { success: false, error: 'El módulo Comercializador no está activo en la licencia' }
  }
  return null
}

/** Columnas editables. Allowlist fija: el renderer nunca aporta SQL. */
const CAMPOS_CLIENTE = ['nombre', 'documento', 'telefono', 'email', 'direccion', 'limite_credito', 'notas'] as const

const normalizarDoc = (valor: unknown): string => (typeof valor === 'string' ? valor.trim().toUpperCase() : '')

/** '' o null → NULL, para poder borrar un dato opcional desde el formulario. */
function opcional(valor: unknown): string | null {
  if (valor === undefined || valor === null) return null
  const texto = String(valor).trim()
  return texto === '' ? null : texto
}

/**
 * Un mismo documento (CI/RIF) no puede repetirse entre clientes activos: el POS
 * busca por documento y un duplicado seleccionaría al cliente equivocado y
 * dividiría su historial de crédito.
 *
 * En edición solo se valida cuando el documento **cambia**, para no bloquear la
 * edición de datos que ya venían duplicados de una versión anterior.
 */
function documentoDuplicado(db: any, documento: unknown, exceptoId = 0): { success: false; error: string } | null {
  const doc = normalizarDoc(documento)
  if (!doc) return null
  const row = db
    .prepare('SELECT id FROM clientes WHERE activo = 1 AND id <> ? AND upper(trim(documento)) = ? LIMIT 1')
    .get(exceptoId, doc)
  if (!row) return null
  return { success: false, error: `Ya existe un cliente activo con el documento ${doc}` }
}

export function registerClientesHandlers(): void {
  handleIpc('clientes:list', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'clientes:list', 'distribuidor_clientes_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    // `deuda` = saldo pendiente del fiado; la lista de clientes la muestra.
    return db.prepare(`
      SELECT c.*, COALESCE((
        SELECT SUM(cr.saldo) FROM creditos cr WHERE cr.cliente_id = c.id AND cr.estado = 'pendiente'
      ), 0) AS deuda
      FROM clientes c
      WHERE c.activo = 1
      ORDER BY c.nombre
    `).all()
  })

  handleIpc('clientes:create', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'clientes:create', 'distribuidor_clientes_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const parsed = clienteCreateSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }
    const db = getDatabase()
    const input = parsed.data
    const dup = documentoDuplicado(db, input.documento)
    if (dup) return dup
    const result = db.prepare(
      'INSERT INTO clientes (nombre, documento, telefono, email, direccion, limite_credito, notas) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      input.nombre.trim(),
      opcional(input.documento),
      opcional(input.telefono),
      opcional(input.email),
      opcional(input.direccion),
      input.limite_credito ?? 0,
      opcional(input.notas),
    )
    return { success: true, id: result.lastInsertRowid }
  })

  handleIpc('clientes:update', async (_event, data: { id: number; data: any; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'clientes:update', 'distribuidor_clientes_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const parsed = clienteUpdateSchema.safeParse(data?.data ?? {})
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }
    const db = getDatabase()
    const actual: any = db.prepare('SELECT * FROM clientes WHERE id = ? AND activo = 1').get(data.id)
    if (!actual) return { success: false, error: 'El cliente no existe' }

    const d: Record<string, unknown> = parsed.data as Record<string, unknown>
    const campos: Record<string, unknown> = {}
    for (const key of CAMPOS_CLIENTE) {
      if (d[key] === undefined) continue // undefined = no tocar (edición parcial)
      if (key === 'limite_credito') {
        campos[key] = d[key] ?? 0
        continue
      }
      if (key === 'nombre') {
        campos[key] = String(d[key]).trim()
        continue
      }
      campos[key] = opcional(d[key])
    }
    if (Object.keys(campos).length === 0) return { success: true }

    if (campos.documento !== undefined && normalizarDoc(campos.documento) !== normalizarDoc(actual.documento)) {
      const dup = documentoDuplicado(db, campos.documento, data.id)
      if (dup) return dup
    }

    const set = Object.keys(campos).map((k) => `${k} = ?`).join(', ')
    db.prepare(`UPDATE clientes SET ${set}, actualizado_en = datetime('now') WHERE id = ?`)
      .run(...Object.values(campos), data.id)
    return { success: true }
  })

  handleIpc('clientes:delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'clientes:delete', 'distribuidor_clientes_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    // La baja es lógica: los créditos ya emitidos siguen siendo cobrables y
    // conservan el nombre del deudor. Se informa la deuda pendiente para avisar.
    const pendiente: any = db
      .prepare("SELECT COUNT(*) AS creditos, COALESCE(SUM(saldo), 0) AS saldo FROM creditos WHERE cliente_id = ? AND estado = 'pendiente'")
      .get(data.id)
    db.prepare('UPDATE clientes SET activo = 0 WHERE id = ?').run(data.id)
    return { success: true, creditosPendientes: pendiente?.creditos || 0, saldoPendiente: pendiente?.saldo || 0 }
  })
}
import { ipcMain, dialog } from 'electron'
import bcrypt from 'bcryptjs'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { getDatabase, closeDatabase, initializeDatabase } from './db/database'
import {
  productoCreateSchema, productoUpdateSchema,
  ventaCreateSchema, compraCreateSchema,
  categoriaCreateSchema, proveedorCreateSchema,
  usuarioCreateSchema,
  cajaAbrirSchema, cajaCerrarSchema, movimientoCajaSchema,
  quoteCreateSchema,
} from '../shared/validations'
import { ROLE_DEFAULTS, type PermissionKey } from '../shared/permissions'
import { getTerminalService } from './services/valorTerminal'
import {
  saveCrashReport,
  listCrashReports,
  readCrashReport,
  deleteCrashReport,
  openCrashReportsFolder,
  getCrashReportsPath,
} from './services/crash-reporter'
import { validateLicense, getLicenseStatus, saveLicense, resetLicenseState } from './services/license'
import { getLang, setLang, initI18n, t, type SupportedLang } from './i18n'
import { checkPermission } from './services/permissions'
import { getConfigMap, invalidateConfigCache } from './services/configCache'

/**
 * Registra todos los handlers IPC del sistema.
 */
export function registerIpcHandlers(): void {
  registerAuthHandlers()
  registerUsuariosHandlers()
  registerCategoriasHandlers()
  registerUnidadesHandlers()
  registerProductosHandlers()
  registerProveedoresHandlers()
  registerVentasHandlers()
  registerComprasHandlers()
  registerCajaHandlers()
  registerQuotesHandlers()
  registerReportesHandlers()
  registerConfigHandlers()
  registerBackupHandlers()
  registerTerminalHandlers()
  registerLicenseHandlers()
  registerProductosCsvHandlers()
  registerCajaExtraHandlers()
  registerAjustesHandlers()
  registerMetodosPagoHandlers()
  registerI18nHandlers()
  registerCrashReportHandlers()
  registerAppHandlers()
}

function registerAppHandlers(): void {
  ipcMain.handle('app:version', () => {
    return app.getVersion()
  })
}

function registerI18nHandlers(): void {  
  ipcMain.handle('i18n:get-lang', () => getLang())

  ipcMain.handle('i18n:set-lang', (_evt, payload: { lang: string }) => {
    if (payload?.lang !== 'es' && payload?.lang !== 'en') {
      return { success: false, lang: getLang() }
    }
    setLang(payload.lang as SupportedLang)
    return { success: true, lang: getLang() }
  })
}

// ============================================
// CRASH REPORTS
// ============================================

function registerCrashReportHandlers(): void {
  ipcMain.handle('crash-report:save', async (_event, data: {
    type: string
    message: string
    stack?: string
    componentStack?: string
    currentUrl?: string
    userAgent?: string
    loggedUser?: string
  }) => {
    try {
      const filePath = saveCrashReport({
        type: data.type as any,
        message: data.message,
        stack: data.stack,
        componentStack: data.componentStack,
        currentUrl: data.currentUrl,
        userAgent: data.userAgent,
        loggedUser: data.loggedUser,
      })
      return { success: true, path: filePath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('crash-report:list', async () => {
    try {
      return { success: true, reports: listCrashReports() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('crash-report:read', async (_event, data: { filename: string }) => {
    try {
      const content = readCrashReport(data.filename)
      if (content === null) return { success: false, error: 'Reporte no encontrado' }
      return { success: true, content }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('crash-report:delete', async (_event, data: { filename: string }) => {
    try {
      const deleted = deleteCrashReport(data.filename)
      return { success: deleted }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('crash-report:open-folder', async () => {
    try {
      await openCrashReportsFolder()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('crash-report:path', async () => {
    return getCrashReportsPath()
  })
}

// ============================================
// AUTH
// ============================================

// Rate limiting para login
const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000 // 15 minutos
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>()

function registerAuthHandlers(): void {
  ipcMain.handle('auth:login', async (_event, data: { usuario: string; contrasena: string }) => {
    try {
      // Rate limiting
      const attempts = loginAttempts.get(data.usuario)
      if (attempts && attempts.count >= MAX_LOGIN_ATTEMPTS && Date.now() - attempts.lastAttempt < LOGIN_LOCKOUT_MS) {
        const remaining = Math.ceil((LOGIN_LOCKOUT_MS - (Date.now() - attempts.lastAttempt)) / 60000)
        return { success: false, error: `Demasiados intentos fallidos. Intenta de nuevo en ${remaining} minutos.` }
      }

      const db = getDatabase()
      const user = db.prepare('SELECT * FROM usuarios WHERE usuario = ? AND activo = 1').get(data.usuario) as any

      if (!user) {
        // Registrar intento fallido
        const prev = loginAttempts.get(data.usuario) || { count: 0, lastAttempt: 0 }
        loginAttempts.set(data.usuario, { count: prev.count + 1, lastAttempt: Date.now() })
        return { success: false, error: t('errors.notFound') }
      }

      const validPassword = bcrypt.compareSync(data.contrasena, user.contrasena)
      if (!validPassword) {
        // Registrar intento fallido
        const prev = loginAttempts.get(data.usuario) || { count: 0, lastAttempt: 0 }
        loginAttempts.set(data.usuario, { count: prev.count + 1, lastAttempt: Date.now() })
        return { success: false, error: t('errors.wrongPassword') }
      }

      // Login exitoso: limpiar intentos
      loginAttempts.delete(data.usuario)

      // No enviar la contraseña al renderer
      const { contrasena: _, ...usuario } = user
      return { success: true, usuario }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}

// ============================================
// USUARIOS
// ============================================

function registerUsuariosHandlers(): void {
  // Cambio de contraseña (propio usuario)
  ipcMain.handle('usuarios:change-password', async (_event, data: { usuario_id: number; contrasena_actual: string; contrasena_nueva: string }) => {
    const db = getDatabase()
    const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(data.usuario_id) as any
    if (!user) {       return { success: false, error: t('errors.notFound') }
    }
    const validPassword = bcrypt.compareSync(data.contrasena_actual, user.contrasena)
    if (!validPassword) {       return { success: false, error: t('errors.wrongCurrentPassword') }
    }
    if (!data.contrasena_nueva || data.contrasena_nueva.length < 6) {       return { success: false, error: t('errors.passwordMinLength') }
    }
    const newHash = bcrypt.hashSync(data.contrasena_nueva, 10)
    db.prepare(`UPDATE usuarios SET contrasena = ?, debe_cambiar_contrasena = 0, actualizado_en = datetime('now') WHERE id = ?`).run(newHash, data.usuario_id)
    return { success: true }
  })

  ipcMain.handle('usuarios:list', async () => {
    const db = getDatabase()
    return db.prepare('SELECT id, usuario, nombre, rol, activo, creado_en FROM usuarios ORDER BY nombre').all()
  })

  ipcMain.handle('usuarios:create', async (_event, data: any) => {
    const db = getDatabase()
    const hash = bcrypt.hashSync(data.contrasena, 10)
    const result = db.prepare(
      'INSERT INTO usuarios (usuario, contrasena, nombre, rol) VALUES (?, ?, ?, ?)'
    ).run(data.usuario, hash, data.nombre, data.rol || 'cajero')
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('usuarios:update', async (_event, data: { id: number; data: any }) => {
    const db = getDatabase()
    const fields: string[] = []
    const values: any[] = []

    if (data.data.nombre !== undefined) { fields.push('nombre = ?'); values.push(data.data.nombre) }
    if (data.data.rol !== undefined) { fields.push('rol = ?'); values.push(data.data.rol) }
    if (data.data.activo !== undefined) { fields.push('activo = ?'); values.push(data.data.activo) }
    if (data.data.contrasena && data.data.contrasena.trim()) {
      const hash = bcrypt.hashSync(data.data.contrasena, 10)
      fields.push('contrasena = ?'); values.push(hash)
    }

    fields.push("actualizado_en = datetime('now')")
    values.push(data.id)

    db.prepare(`UPDATE usuarios SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return { success: true }
  })

  ipcMain.handle('usuarios:delete', async (_event, data: { id: number }) => {
    const db = getDatabase()
    db.prepare(`UPDATE usuarios SET activo = 0, actualizado_en = datetime('now') WHERE id = ?`).run(data.id)
    return { success: true }
  })

  // Obtener permisos de un usuario
  ipcMain.handle('usuarios:getPermissions', async (_event, data: { id: number }) => {
    const db = getDatabase()
    const user = db.prepare('SELECT id, usuario, nombre, rol, permisos FROM usuarios WHERE id = ?').get(data.id) as any
    if (!user) return { success: false, error: 'Usuario no encontrado' }

    let permisos: string[] = []
    if (user.rol === 'admin') {
      permisos = Object.keys(ROLE_DEFAULTS.admin)
    } else if (user.permisos) {
      try { permisos = JSON.parse(user.permisos) } catch { permisos = ROLE_DEFAULTS[user.rol] || [] }
    } else {
      permisos = ROLE_DEFAULTS[user.rol] || []
    }

    return { success: true, permisos, rol: user.rol }
  })

  // Establecer permisos de un usuario
  ipcMain.handle('usuarios:setPermissions', async (_event, data: { id: number; permisos: PermissionKey[] }) => {
    const db = getDatabase()
    const user = db.prepare('SELECT id, rol FROM usuarios WHERE id = ?').get(data.id) as any
    if (!user) return { success: false, error: 'Usuario no encontrado' }

    // Admin siempre tiene todos los permisos
    if (user.rol === 'admin') {
      return { success: true, message: 'Admin tiene todos los permisos automáticamente' }
    }

    const permisosJson = JSON.stringify(data.permisos)
    db.prepare(`UPDATE usuarios SET permisos = ?, actualizado_en = datetime('now') WHERE id = ?`).run(permisosJson, data.id)
    return { success: true }
  })
}

// ============================================
// CATEGORÍAS
// ============================================

function registerCategoriasHandlers(): void {
  ipcMain.handle('categorias:list', async () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM categorias WHERE activo = 1 ORDER BY nombre').all()
  })

  ipcMain.handle('categorias:create', async (_event, data: any) => {
    const db = getDatabase()
    const result = db.prepare('INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)').run(
      data.nombre,
      data.descripcion || null
    )
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('categorias:update', async (_event, data: { id: number; data: any }) => {
    const db = getDatabase()
    db.prepare('UPDATE categorias SET nombre = COALESCE(?, nombre), descripcion = COALESCE(?, descripcion) WHERE id = ?').run(
      data.data.nombre || null,
      data.data.descripcion || null,
      data.id
    )
    return { success: true }
  })

  ipcMain.handle('categorias:delete', async (_event, data: { id: number }) => {
    const db = getDatabase()
    db.prepare('UPDATE categorias SET activo = 0 WHERE id = ?').run(data.id)
    return { success: true }
  })
}

// ============================================
// UNIDADES DE MEDIDA
// ============================================

function registerUnidadesHandlers(): void {
  ipcMain.handle('unidades:list', async () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM unidades_medida WHERE activo = 1 ORDER BY nombre').all()
  })

  ipcMain.handle('unidades:create', async (_event, data: any) => {
    const db = getDatabase()
    const result = db.prepare('INSERT INTO unidades_medida (nombre, abreviatura) VALUES (?, ?)').run(
      data.nombre, data.abreviatura || null
    )
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('unidades:update', async (_event, data: { id: number; data: any }) => {
    const db = getDatabase()
    db.prepare('UPDATE unidades_medida SET nombre = COALESCE(?, nombre), abreviatura = COALESCE(?, abreviatura) WHERE id = ?').run(
      data.data.nombre || null, data.data.abreviatura || null, data.id
    )
    return { success: true }
  })

  ipcMain.handle('unidades:delete', async (_event, data: { id: number }) => {
    const db = getDatabase()
    db.prepare('UPDATE unidades_medida SET activo = 0 WHERE id = ?').run(data.id)
    return { success: true }
  })
}

// ============================================
// PRODUCTOS
// ============================================

function registerProductosHandlers(): void {
  ipcMain.handle('productos:list', async (_event, filters?: any) => {
    const db = getDatabase()
    let sql = `
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.activo = 1
    `
    const params: any[] = []

    if (filters?.search) {
      sql += ` AND (p.nombre LIKE ? OR p.codigo_barras LIKE ? OR p.sku LIKE ?)`
      const term = `%${filters.search}%`
      params.push(term, term, term)
    }

    if (filters?.categoria_id) {
      sql += ` AND p.categoria_id = ?`
      params.push(filters.categoria_id)
    }

    sql += ` ORDER BY p.nombre`
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('productos:getById', async (_event, data: { id: number }) => {
    const db = getDatabase()
    return db.prepare(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.id = ?
    `).get(data.id)
  })

  ipcMain.handle('productos:create', async (_event, data: any) => {
    const parsed = productoCreateSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }
    const db = getDatabase()
    const result = db.prepare(`
      INSERT INTO productos (codigo_barras, sku, nombre, descripcion, categoria_id,
        precio_compra, precio_venta, stock, stock_minimo, unidad)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.codigo_barras || null,
      data.sku || null,
      data.nombre,
      data.descripcion || null,
      data.categoria_id || null,
      data.precio_compra || 0,
      data.precio_venta || 0,
      data.stock || 0,
      data.stock_minimo || 5,
      data.unidad || 'unidad'
    )
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('productos:update', async (_event, data: { id: number; data: any }) => {
    const db = getDatabase()
    const d = data.data
    db.prepare(`
      UPDATE productos SET
        codigo_barras = COALESCE(?, codigo_barras),
        sku = COALESCE(?, sku),
        nombre = COALESCE(?, nombre),
        descripcion = COALESCE(?, descripcion),
        categoria_id = COALESCE(?, categoria_id),
        precio_compra = COALESCE(?, precio_compra),
        precio_venta = COALESCE(?, precio_venta),
        stock = COALESCE(?, stock),
        stock_minimo = COALESCE(?, stock_minimo),
        unidad = COALESCE(?, unidad),
        activo = COALESCE(?, activo),
        actualizado_en = datetime('now')
      WHERE id = ?
    `).run(
      d.codigo_barras, d.sku, d.nombre, d.descripcion, d.categoria_id,
      d.precio_compra, d.precio_venta, d.stock, d.stock_minimo,
      d.unidad, d.activo, data.id
    )
    return { success: true }
  })

  ipcMain.handle('productos:delete', async (_event, data: { id: number }) => {
    const db = getDatabase()
    db.prepare(`UPDATE productos SET activo = 0, actualizado_en = datetime('now') WHERE id = ?`).run(data.id)
    return { success: true }
  })

  ipcMain.handle('productos:low-stock', async () => {
    const db = getDatabase()
    return db.prepare(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.activo = 1 AND p.stock <= p.stock_minimo
      ORDER BY p.stock ASC
    `).all()
  })

  ipcMain.handle('productos:ajustar', async (_event, data: { producto_id: number; stock_nuevo: number; justificacion: string; usuario_id: number }) => {
    const db = getDatabase()
    const ajustar = db.transaction(() => {
      const producto = db!.prepare('SELECT id, nombre, stock FROM productos WHERE id = ?').get(data.producto_id) as any
      if (!producto) return { success: false, error: t('errors.notFound') }
      if (!data.justificacion.trim()) return { success: false, error: t('errors.justificationRequired') }

      const stockAnterior = producto.stock
      const diferencia = data.stock_nuevo - stockAnterior

      // Actualizar stock
      db!.prepare(`UPDATE productos SET stock = ?, actualizado_en = datetime('now') WHERE id = ?`).run(data.stock_nuevo, data.producto_id)

      // Registrar ajuste
      db!.prepare(`
        INSERT INTO ajustes_inventario (producto_id, usuario_id, stock_anterior, stock_nuevo, diferencia, justificacion)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(data.producto_id, data.usuario_id, stockAnterior, data.stock_nuevo, diferencia, data.justificacion)

      return { success: true, stock_anterior: stockAnterior, stock_nuevo: data.stock_nuevo, diferencia }
    })
    return ajustar()
  })

  ipcMain.handle('productos:ajustes-historial', async (_event, data?: { producto_id?: number; limite?: number }) => {
    const db = getDatabase()
    let sql = `
      SELECT a.*, p.nombre as producto_nombre, u.nombre as usuario_nombre
      FROM ajustes_inventario a
      LEFT JOIN productos p ON a.producto_id = p.id
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE 1=1
    `
    const params: any[] = []
    if (data?.producto_id) { sql += ' AND a.producto_id = ?'; params.push(data.producto_id) }
    sql += ' ORDER BY a.fecha DESC'
    if (data?.limite) { sql += ` LIMIT ?`; params.push(data.limite) }
    return db.prepare(sql).all(...params)
  })

  // Buscar producto por codigo de barras o SKU (para lector USB HID)
  ipcMain.handle('productos:buscar-por-codigo', async (_event, data: { codigo: string }) => {
    const db = getDatabase()
    const codigo = data.codigo.trim()
    if (!codigo) return null

    // 1. Buscar por codigo_barras exacto
    let producto = db.prepare(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.activo = 1 AND p.codigo_barras = ?
    `).get(codigo) as any

    // 2. Fallback: buscar por SKU
    if (!producto) {
      producto = db.prepare(`
        SELECT p.*, c.nombre as categoria_nombre
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE p.activo = 1 AND p.sku = ?
      `).get(codigo) as any
    }

    return producto || null
  })
}

// ============================================
// PROVEEDORES
// ============================================

function registerProveedoresHandlers(): void {
  ipcMain.handle('proveedores:list', async () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM proveedores WHERE activo = 1 ORDER BY nombre').all()
  })

  ipcMain.handle('proveedores:create', async (_event, data: any) => {
    const db = getDatabase()
    const result = db.prepare(
      'INSERT INTO proveedores (nombre, ein, telefono, email, direccion, notas) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(data.nombre, data.ein || null, data.telefono || null, data.email || null, data.direccion || null, data.notas || null)
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('proveedores:update', async (_event, data: { id: number; data: any }) => {
    const db = getDatabase()
    const d = data.data
    db.prepare(`
      UPDATE proveedores SET
        nombre = COALESCE(?, nombre), ein = COALESCE(?, ein),
        telefono = COALESCE(?, telefono), email = COALESCE(?, email),
        direccion = COALESCE(?, direccion), notas = COALESCE(?, notas)
      WHERE id = ?
    `).run(d.nombre, d.ein, d.telefono, d.email, d.direccion, d.notas, data.id)
    return { success: true }
  })

  ipcMain.handle('proveedores:delete', async (_event, data: { id: number }) => {
    const db = getDatabase()
    db.prepare('UPDATE proveedores SET activo = 0 WHERE id = ?').run(data.id)
    return { success: true }
  })
}

// ============================================
// VENTAS
// ============================================

function registerVentasHandlers(): void {
  ipcMain.handle('ventas:list', async (_event, filters?: any) => {
    const db = getDatabase()
    let sql = `
      SELECT v.*, u.nombre as usuario_nombre
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE 1=1
    `
    const params: any[] = []

    if (filters?.fecha_inicio) {
      sql += ` AND v.fecha >= ?`
      params.push(filters.fecha_inicio)
    }
    if (filters?.fecha_fin) {
      sql += ` AND v.fecha <= ?`
      params.push(filters.fecha_fin + ' 23:59:59')
    }

    sql += ` ORDER BY v.fecha DESC`
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('ventas:getById', async (_event, data: { id: number }) => {
    const db = getDatabase()
    const venta = db.prepare(`
      SELECT v.*, u.nombre as usuario_nombre
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.id = ?
    `).get(data.id) as any

    if (venta) {
      venta.detalles = db.prepare(`
        SELECT vd.*, p.nombre as producto_nombre
        FROM venta_detalles vd
        LEFT JOIN productos p ON vd.producto_id = p.id
        WHERE vd.venta_id = ?
      `).all(data.id)
    }

    return venta
  })

  ipcMain.handle('ventas:create', async (_event, data: any) => {
    const parsed = ventaCreateSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }

    const db = getDatabase()

    // Validación de stock antes de procesar la venta
    for (const det of data.detalles) {
      const producto = db.prepare('SELECT id, nombre, stock, unidad FROM productos WHERE id = ?').get(det.producto_id) as any
      if (!producto) {
        return { success: false, error: `Producto con ID ${det.producto_id} no encontrado` }
      }
      if (producto.unidad !== 'servicio' && producto.stock < det.cantidad) {
        return { success: false, error: `Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock}, Solicitado: ${det.cantidad}` }
      }
    }

    const createVenta = db.transaction(() => {
      // Obtener siguiente número de venta del día
      const hoy = new Date().toISOString().split('T')[0]
      const lastVenta = db!.prepare(
        "SELECT MAX(numero_venta) as max_num FROM ventas WHERE DATE(fecha) = ?"
      ).get(hoy) as any
      const numeroVenta = (lastVenta?.max_num || 0) + 1

      // Insertar venta
      const result = db!.prepare(`
        INSERT INTO ventas (numero_venta, usuario_id, subtotal, impuesto, descuento, total,
          metodo_pago, monto_pagado, cambio, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        numeroVenta,
        data.usuario_id,
        data.subtotal,
        data.impuesto,
        data.descuento,
        data.total,
        data.metodo_pago,
        data.monto_pagado,
        data.cambio,
        data.notas || null
      )

      const ventaId = result.lastInsertRowid

      // Insertar detalles y descontar stock
      const insertDetalle = db!.prepare(`
        INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, descuento, subtotal, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      const updateStock = db!.prepare(
        'UPDATE productos SET stock = stock - ? WHERE id = ?'
      )

      for (const det of data.detalles) {
        insertDetalle.run(
          ventaId, det.producto_id, det.cantidad,
          det.precio_unitario, det.descuento, det.subtotal,
          det.notas || null
        )
        updateStock.run(det.cantidad, det.producto_id)
      }

      // Registrar movimiento en caja si hay caja abierta
      const cajaAbierta = db!.prepare("SELECT id FROM caja WHERE estado = 'abierta' LIMIT 1").get() as any
      if (cajaAbierta) {
        db!.prepare(`
          INSERT INTO movimientos_caja (caja_id, tipo, monto, descripcion, referencia_id)
          VALUES (?, 'venta', ?, ?, ?)
        `).run(cajaAbierta.id, data.total, `Venta #${numeroVenta}`, ventaId)

        // Actualizar total de ventas en caja
        db!.prepare('UPDATE caja SET total_ventas = total_ventas + ? WHERE id = ?').run(
          data.total, cajaAbierta.id
        )
      }

      // Actualizar secuencial de ticket
      db!.prepare(
        "UPDATE configuracion SET valor = ? WHERE clave = 'ticket_numero_venta'"
      ).run(String(numeroVenta))
      invalidateConfigCache()

      return { id: ventaId, numero_venta: numeroVenta }
    })

    const result = createVenta()
    return { success: true, ...result }
  })

  ipcMain.handle('ventas:anular', async (_event, data: { id: number; motivo: string }) => {
    const db = getDatabase()

    const anularVenta = db.transaction(() => {
      // Obtener detalles para devolver stock
      const detalles = db!.prepare(
        'SELECT producto_id, cantidad FROM venta_detalles WHERE venta_id = ?'
      ).all(data.id) as any[]

      // Devolver stock
      const updateStock = db!.prepare(
        'UPDATE productos SET stock = stock + ? WHERE id = ?'
      )
      for (const det of detalles) {
        updateStock.run(det.cantidad, det.producto_id)
      }

      // Marcar venta como anulada
      db!.prepare("UPDATE ventas SET estado = 'anulada', notas = ? WHERE id = ?").run(
        data.motivo,
        data.id
      )

      return { success: true }
    })

    return anularVenta()
  })

  ipcMain.handle('ventas:resumen-dia', async (_event, data?: { fecha?: string }) => {
    const db = getDatabase()
    const fecha = data?.fecha || new Date().toISOString().split('T')[0]

    const resumen = db.prepare(`
      SELECT
        COUNT(*) as total_ventas,
        COALESCE(SUM(total), 0) as monto_total,
        COALESCE(SUM(CASE WHEN metodo_pago = 'efectivo' THEN total ELSE 0 END), 0) as efectivo,
        COALESCE(SUM(CASE WHEN metodo_pago = 'transferencia' THEN total ELSE 0 END), 0) as transferencia,
        COALESCE(SUM(CASE WHEN metodo_pago = 'pago_movil' THEN total ELSE 0 END), 0) as pago_movil
      FROM ventas
      WHERE DATE(fecha) = ? AND estado = 'completada'
    `).get(fecha)

    return resumen
  })
}

// ============================================
// COMPRAS
// ============================================

function registerComprasHandlers(): void {
  ipcMain.handle('compras:list', async (_event, filters?: any) => {
    const db = getDatabase()
    let sql = `
      SELECT c.*, p.nombre as proveedor_nombre, u.nombre as usuario_nombre
      FROM compras c
      LEFT JOIN proveedores p ON c.proveedor_id = p.id
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE 1=1
    `
    const params: any[] = []

    if (filters?.fecha_inicio) {
      sql += ` AND DATE(c.fecha) >= ?`
      params.push(filters.fecha_inicio)
    }
    if (filters?.fecha_fin) {
      sql += ` AND DATE(c.fecha) <= ?`
      params.push(filters.fecha_fin)
    }

    sql += ` ORDER BY c.fecha DESC`
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('compras:create', async (_event, data: any) => {
    const parsed = compraCreateSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }

    const db = getDatabase()

    const createCompra = db.transaction(() => {
      const hoy = new Date().toISOString().split('T')[0]
      const lastCompra = db!.prepare(
        "SELECT MAX(numero_compra) as max_num FROM compras WHERE DATE(fecha) = ?"
      ).get(hoy) as any
      const numeroCompra = (lastCompra?.max_num || 0) + 1

      const result = db!.prepare(`
        INSERT INTO compras (numero_compra, proveedor_id, usuario_id, subtotal, impuesto, total, metodo_pago, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        numeroCompra,
        data.proveedor_id || null,
        data.usuario_id,
        data.subtotal,
        data.impuesto,
        data.total,
        data.metodo_pago || 'efectivo',
        data.notas || null
      )

      const compraId = result.lastInsertRowid

      // Insertar detalles y actualizar stock
      const insertDetalle = db!.prepare(`
        INSERT INTO compra_detalles (compra_id, producto_id, cantidad, costo_unitario, subtotal)
        VALUES (?, ?, ?, ?, ?)
      `)
      const updateStock = db!.prepare(
        'UPDATE productos SET stock = stock + ? WHERE id = ?'
      )

      for (const det of data.detalles) {
        insertDetalle.run(compraId, det.producto_id, det.cantidad, det.costo_unitario, det.subtotal)
        updateStock.run(det.cantidad, det.producto_id)
      }

      return { id: compraId, numero_compra: numeroCompra }
    })

    return createCompra()
  })
}

// ============================================
// CAJA
// ============================================

function registerCajaHandlers(): void {
  ipcMain.handle('caja:status', async () => {
    const db = getDatabase()
    return db.prepare(`
      SELECT c.*, u.nombre as usuario_nombre
      FROM caja c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.estado = 'abierta'
      ORDER BY c.fecha_apertura DESC
      LIMIT 1
    `).get()
  })

  ipcMain.handle('caja:abrir', async (_event, data: any) => {
    const db = getDatabase()

    // Verificar que no haya caja abierta
    const abierta = db.prepare("SELECT id FROM caja WHERE estado = 'abierta' LIMIT 1").get()
    if (abierta) {
      return { success: false, error: t('errors.cashAlreadyOpen') }
    }

    const result = db.prepare(
      'INSERT INTO caja (usuario_id, fondo_inicial) VALUES (?, ?)'
    ).run(data.usuario_id, data.fondo_inicial)

    return { success: true, id: result.lastInsertRowid }
  })

  ipcMain.handle('caja:cerrar', async (_event, data: any) => {
    const db = getDatabase()

    const cerrarCaja = db.transaction(() => {
      const caja = db!.prepare('SELECT * FROM caja WHERE id = ?').get(data.caja_id) as any
      if (!caja) return { success: false, error: t('errors.notFound') }

      const totalEsperado = caja.fondo_inicial + caja.total_entradas - caja.total_salidas + caja.total_ventas
      const diferencia = data.total_real - totalEsperado

      db!.prepare(`
        UPDATE caja SET
          total_esperado = ?,
          total_real = ?,
          diferencia = ?,
          notas = COALESCE(?, notas),
          estado = 'cerrada',
          fecha_cierre = datetime('now'),
          cerrado_en = datetime('now')
        WHERE id = ?
      `).run(totalEsperado, data.total_real, diferencia, data.notas || null, data.caja_id)

      return { success: true, diferencia }
    })

    return cerrarCaja()
  })

  ipcMain.handle('caja:movimiento', async (_event, data: any) => {
    const db = getDatabase()

    const cajaAbierta = db.prepare("SELECT id FROM caja WHERE estado = 'abierta' LIMIT 1").get() as any
    if (!cajaAbierta) {
      return { success: false, error: t('errors.cashNotOpen') }
    }

    db.prepare(`
      INSERT INTO movimientos_caja (caja_id, tipo, monto, descripcion)
      VALUES (?, ?, ?, ?)
    `).run(cajaAbierta.id, data.tipo, data.monto, data.descripcion)

    // Actualizar totales en caja
    if (data.tipo === 'entrada') {
      db.prepare('UPDATE caja SET total_entradas = total_entradas + ? WHERE id = ?').run(data.monto, cajaAbierta.id)
    } else if (data.tipo === 'salida' || data.tipo === 'retiro') {
      db.prepare('UPDATE caja SET total_salidas = total_salidas + ? WHERE id = ?').run(data.monto, cajaAbierta.id)
    }

    return { success: true }
  })

  ipcMain.handle('caja:historial', async (_event, filters?: any) => {
    const db = getDatabase()
    let sql = `
      SELECT c.*, u.nombre as usuario_nombre
      FROM caja c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE 1=1
    `
    const params: any[] = []

    if (filters?.fecha_inicio) {
      sql += ` AND DATE(c.fecha_apertura) >= ?`
      params.push(filters.fecha_inicio)
    }
    if (filters?.fecha_fin) {
      sql += ` AND DATE(c.fecha_apertura) <= ?`
      params.push(filters.fecha_fin)
    }

    sql += ` ORDER BY c.fecha_apertura DESC`
    return db.prepare(sql).all(...params)
  })
}

// ============================================
// QUOTES / COTIZACIONES
// ============================================

function registerQuotesHandlers(): void {
  ipcMain.handle('quotes:list', async (_event, filters?: any) => {
    const db = getDatabase()
    let sql = `SELECT q.*, u.nombre as usuario_nombre FROM quotes q LEFT JOIN usuarios u ON q.usuario_id = u.id WHERE 1=1`
    const params: any[] = []
    if (filters?.estado) { sql += ` AND q.estado = ?`; params.push(filters.estado) }
    if (filters?.search) {
      sql += ` AND (q.cliente_nombre LIKE ? OR q.numero_cotizacion LIKE ?)`
      const term = `%${filters.search}%`; params.push(term, term)
    }
    sql += ` ORDER BY q.fecha DESC`
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('quotes:getById', async (_event, data: { id: number }) => {
    const db = getDatabase()
    const quote = db.prepare(`SELECT q.*, u.nombre as usuario_nombre FROM quotes q LEFT JOIN usuarios u ON q.usuario_id = u.id WHERE q.id = ?`).get(data.id) as any
    if (quote) {
      quote.detalles = db.prepare(`SELECT qd.*, p.nombre as producto_nombre FROM quote_detalles qd LEFT JOIN productos p ON qd.producto_id = p.id WHERE qd.quote_id = ?`).all(data.id)
    }
    return quote
  })

  ipcMain.handle('quotes:create', async (_event, data: any) => {
    const db = getDatabase()
    const createQuote = db.transaction(() => {
      const lastNum = db!.prepare('SELECT MAX(numero_cotizacion) as max_num FROM quotes').get() as any
      const numero = (lastNum?.max_num || 0) + 1
      const result = db!.prepare(`
        INSERT INTO quotes (numero_cotizacion, fecha_vencimiento, cliente_nombre, cliente_email, cliente_telefono, cliente_direccion, subtotal, impuesto, descuento, total, notas, usuario_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(numero, data.fecha_vencimiento || null, data.cliente_nombre, data.cliente_email || null, data.cliente_telefono || null, data.cliente_direccion || null, data.subtotal, data.impuesto, data.descuento, data.total, data.notas || null, data.usuario_id)
      const quoteId = result.lastInsertRowid
      const insertDet = db!.prepare('INSERT INTO quote_detalles (quote_id, producto_id, descripcion, cantidad, precio_unitario, descuento, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)')
      for (const d of data.detalles) {
        insertDet.run(quoteId, d.producto_id || null, d.descripcion, d.cantidad, d.precio_unitario, d.descuento || 0, d.subtotal)
      }
      return { id: quoteId, numero_cotizacion: numero }
    })
    return createQuote()
  })

  ipcMain.handle('quotes:update', async (_event, data: { id: number; data: any }) => {
    const db = getDatabase()
    const d = data.data
    db.prepare(`
      UPDATE quotes SET cliente_nombre = COALESCE(?, cliente_nombre), cliente_email = COALESCE(?, cliente_email),
      cliente_telefono = COALESCE(?, cliente_telefono), cliente_direccion = COALESCE(?, cliente_direccion),
      subtotal = COALESCE(?, subtotal), impuesto = COALESCE(?, impuesto), descuento = COALESCE(?, descuento),
      total = COALESCE(?, total), notas = COALESCE(?, notas), estado = COALESCE(?, estado),
      fecha_vencimiento = COALESCE(?, fecha_vencimiento), actualizado_en = datetime('now') WHERE id = ?
    `).run(d.cliente_nombre, d.cliente_email, d.cliente_telefono, d.cliente_direccion, d.subtotal, d.impuesto, d.descuento, d.total, d.notas, d.estado, d.fecha_vencimiento, data.id)
    // Reemplazar detalles si se proveen
    if (d.detalles) {
      db.prepare('DELETE FROM quote_detalles WHERE quote_id = ?').run(data.id)
      const insertDet = db!.prepare('INSERT INTO quote_detalles (quote_id, producto_id, descripcion, cantidad, precio_unitario, descuento, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)')
      for (const det of d.detalles) {
        insertDet.run(data.id, det.producto_id || null, det.descripcion, det.cantidad, det.precio_unitario, det.descuento || 0, det.subtotal)
      }
    }
    return { success: true }
  })

  ipcMain.handle('quotes:delete', async (_event, data: { id: number }) => {
    const db = getDatabase()
    db.prepare('DELETE FROM quote_detalles WHERE quote_id = ?').run(data.id)
    db.prepare('DELETE FROM quotes WHERE id = ?').run(data.id)
    return { success: true }
  })
}

// ============================================
// REPORTES
// ============================================

function registerReportesHandlers(): void {
  ipcMain.handle('reportes:ventas-periodo', async (_event, data: any) => {
    const db = getDatabase()
    return db.prepare(`
      SELECT
        DATE(fecha) as fecha,
        COUNT(*) as total_ventas,
        SUM(total) as monto_total
      FROM ventas
      WHERE DATE(fecha) BETWEEN ? AND ? AND estado = 'completada'
      GROUP BY DATE(fecha)
      ORDER BY fecha ASC
    `).all(data.fecha_inicio, data.fecha_fin)
  })

  ipcMain.handle('reportes:productos-mas-vendidos', async (_event, data: any) => {
    const db = getDatabase()
    const limite = data.limite || 10
    return db.prepare(`
      SELECT
        p.nombre,
        p.codigo_barras,
        SUM(vd.cantidad) as total_vendido,
        SUM(vd.subtotal) as total_ingreso
      FROM venta_detalles vd
      JOIN productos p ON vd.producto_id = p.id
      JOIN ventas v ON vd.venta_id = v.id
      WHERE DATE(v.fecha) BETWEEN ? AND ? AND v.estado = 'completada'
      GROUP BY p.id
      ORDER BY total_vendido DESC
      LIMIT ?
    `).all(data.fecha_inicio, data.fecha_fin, limite)
  })

  ipcMain.handle('reportes:ultimas-ventas', async (_event, data?: { limite?: number }) => {
    const db = getDatabase()
    const limite = data?.limite || 10
    return db.prepare(`
      SELECT v.*, u.nombre as usuario_nombre
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.estado = 'completada'
      ORDER BY v.fecha DESC
      LIMIT ?
    `).all(limite)
  })

  ipcMain.handle('reportes:ventas-por-categoria', async (_event, data: any) => {
    const db = getDatabase()
    return db.prepare(`
      SELECT
        COALESCE(c.nombre, 'Sin categoría') as categoria,
        COUNT(DISTINCT v.id) as total_ventas,
        SUM(vd.cantidad) as total_unidades,
        SUM(vd.subtotal) as total_ingreso
      FROM venta_detalles vd
      JOIN productos p ON vd.producto_id = p.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      JOIN ventas v ON vd.venta_id = v.id
      WHERE DATE(v.fecha) BETWEEN ? AND ? AND v.estado = 'completada'
      GROUP BY c.id
      ORDER BY total_ingreso DESC
    `).all(data.fecha_inicio, data.fecha_fin)
  })
}

// ============================================
// CONFIGURACIÓN
// ============================================

function getDbPath(): string {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'tog-admin.db')
  }
  return path.join(process.cwd(), 'data', 'tog-admin.db')
}

function registerConfigHandlers(): void {
  ipcMain.handle('config:get', async () => {
    const map = getConfigMap()
    return Array.from(map, ([clave, valor]) => ({ clave, valor })).sort((a, b) =>
      a.clave.localeCompare(b.clave)
    )
  })

  ipcMain.handle('config:set', async (_event, data: { clave: string; valor: string }) => {
    const db = getDatabase()
    db.prepare(
      "INSERT OR REPLACE INTO configuracion (clave, valor, actualizado_en) VALUES (?, ?, datetime('now'))"
    ).run(data.clave, data.valor)
    invalidateConfigCache()
    return { success: true }
  })
}

// ============================================
// METODOS DE PAGO (configurables desde admin)
// ============================================

function registerMetodosPagoHandlers(): void {
  ipcMain.handle('metodos-pago:list', async (_event, data: { activoOnly?: boolean } | undefined) => {
    const db = getDatabase()
    const rows = data?.activoOnly
      ? db.prepare('SELECT * FROM metodos_pago WHERE activo = 1 ORDER BY orden, id').all()
      : db.prepare('SELECT * FROM metodos_pago ORDER BY orden, id').all()
    return rows
  })

  ipcMain.handle('metodos-pago:create', async (_event, data: any) => {
    const db = getDatabase()
    if (!data.clave || !data.nombre) return { success: false, error: 'clave y nombre son requeridos' }
    const clave = String(data.clave).toLowerCase().replace(/\s+/g, '_')
    try {
      const result = db.prepare(
        'INSERT INTO metodos_pago (clave, nombre, icono, requiere_terminal, activo, orden) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(clave, data.nombre, data.icono || 'DollarSign', data.requiere_terminal ? 1 : 0, data.activo !== false ? 1 : 0, data.orden || 99)
      return { success: true, id: result.lastInsertRowid }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('metodos-pago:update', async (_event, data: { id: number; data: any }) => {
    const db = getDatabase()
    const fields: string[] = []
    const values: any[] = []
    const upd = data.data
    for (const k of ['nombre', 'icono', 'requiere_terminal', 'activo', 'orden']) {
      if (upd[k] !== undefined) {
        fields.push(`${k} = ?`)
        values.push(k === 'requiere_terminal' || k === 'activo' ? (upd[k] ? 1 : 0) : upd[k])
      }
    }
    if (!fields.length) return { success: false, error: 'Nada que actualizar' }
    fields.push("actualizado_en = datetime('now')")
    values.push(data.id)
    db.prepare(`UPDATE metodos_pago SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return { success: true }
  })

  ipcMain.handle('metodos-pago:delete', async (_event, data: { id: number }) => {
    const db = getDatabase()
    db.prepare('UPDATE metodos_pago SET activo = 0 WHERE id = ?').run(data.id)
    return { success: true }
  })

  ipcMain.handle('metodos-pago:procesar-tarjeta', async (_event, data: { monto: number }) => {
    const { getTerminalService } = await import('./services/valorTerminal')
    const terminal = getTerminalService()
    if (!terminal.isConnected()) {
      return { success: false, error: 'Terminal VP800 no está conectado. Ve a Configuración → Terminal.' }
    }
    try {
      const resp = await terminal.enviarCobro(data.monto)
      return {
        success: resp.RESPONSE_CODE === '00',
        authCode: resp.AUTH_CODE,
        refNum: resp.REF_NUM,
        cardType: resp.CARD_TYPE,
        maskedPan: resp.MASKED_PAN,
        responseText: resp.RESPONSE_TEXT,
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}

// ============================================
// BACKUP / RESTORE
// ============================================

function registerBackupHandlers(): void {
  ipcMain.handle('backup:create', async (_event, data?: { ruta?: string }) => {
    try {
      const dbPath = getDbPath()
      if (!fs.existsSync(dbPath)) {         return { success: false, error: t('errors.dbNotFound') }
      }

      let targetPath = data?.ruta
      if (!targetPath) {
        const result = await dialog.showSaveDialog({
          title: 'Crear Backup',
          defaultPath: `tog-admin-backup-${new Date().toISOString().split('T')[0]}.db`,
          filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        })
        if (result.canceled || !result.filePath) {
          return { success: false, error: t('errors.operationCancelled') }
        }
        targetPath = result.filePath
      }

      // Asegurar que existe el directorio
      const dir = path.dirname(targetPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      fs.copyFileSync(dbPath, targetPath)
      return { success: true, path: targetPath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('backup:restore', async (_event, data?: { ruta?: string }) => {
    try {
      let sourcePath = data?.ruta
      if (!sourcePath) {
        const result = await dialog.showOpenDialog({
          title: 'Restaurar Backup',
          filters: [{ name: 'SQLite Database', extensions: ['db'] }],
          properties: ['openFile'],
        })
        if (result.canceled || !result.filePaths.length) {
          return { success: false, error: t('errors.operationCancelled') }
        }
        sourcePath = result.filePaths[0]
      }

      if (!fs.existsSync(sourcePath)) {
        return { success: false, error: t('errors.fileNotFound') }
      }

      // Verificar que es un SQLite válido (mágico bytes)
      const fd = fs.openSync(sourcePath, 'r')
      const buf = Buffer.alloc(16)
      fs.readSync(fd, buf, 0, 16, 0)
      fs.closeSync(fd)
      const magic = buf.toString('utf8', 0, 16)
      if (!magic.startsWith('SQLite format')) {
        return { success: false, error: t('errors.invalidDbFile') }
      }

      const dbPath = getDbPath()

      // Cerrar la base de datos actual
      closeDatabase()

      // Crear backup de la DB actual por seguridad
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, dbPath + '.bak')
      }

      // Restaurar
      fs.copyFileSync(sourcePath, dbPath)

      // Reinicializar
      initializeDatabase()

      return { success: true }
    } catch (err: any) {
      // Intentar recuperar
      try {
        const dbPath = getDbPath()
        if (fs.existsSync(dbPath + '.bak')) {
          fs.copyFileSync(dbPath + '.bak', dbPath)
        }
        initializeDatabase()
      } catch {}
      return { success: false, error: err.message }
    }
  })

  // Reset DB (dangerous - only admin)
  ipcMain.handle('db:reset', async () => {
    try {
      const dbPath = getDbPath()
      if (!fs.existsSync(dbPath)) {
        return { success: false, error: t('errors.dbNotFound') }
      }

      // Cerrar DB actual
      closeDatabase()

      // Crear backup de seguridad antes de borrar
      fs.copyFileSync(dbPath, dbPath + '.pre-reset')

      // Borrar la DB Y todos los archivos WAL/SHM
      fs.unlinkSync(dbPath)
      try { fs.unlinkSync(dbPath + '-wal') } catch {}
      try { fs.unlinkSync(dbPath + '-shm') } catch {}
      try { fs.unlinkSync(dbPath + '-journal') } catch {}

      // Reinicializar limpia
      initializeDatabase()

      console.log('[TOG Admin] Base de datos reseteada por admin')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}

// ============================================
// TERMINAL VP800
// ============================================

function registerTerminalHandlers(): void {
  const terminal = getTerminalService()

  ipcMain.handle('terminal:conectar', async (_event, data: { puerto: string; baudRate?: number }) => {
    try {
      await terminal.connect(data.puerto, data.baudRate || 9600)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('terminal:desconectar', async () => {
    terminal.disconnect()
    return { success: true }
  })

  ipcMain.handle('terminal:estado', async () => {
    return terminal.consultarEstado()
  })

  ipcMain.handle('terminal:procesar-pago', async (_event, data: { monto: number; timeoutMs?: number }) => {
    try {
      const resultado = await terminal.enviarCobro(data.monto, data.timeoutMs)

      if (resultado.RESPONSE_CODE === '00') {
        return {
          success: true,
          referencia: resultado.REF_NUM,
          autorizacion: resultado.AUTH_CODE,
          tipo_tarjeta: resultado.CARD_TYPE,
          ultimos_4: resultado.MASKED_PAN,
          mensaje: 'Pago aprobado',
        }
      } else {
        return {
          success: false,
          error: resultado.RESPONSE_TEXT || t('errors.terminalDeclinedByTerminal'),
          codigo_respuesta: resultado.RESPONSE_CODE,
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}

// ============================================
// LICENCIA
// ============================================

function registerLicenseHandlers(): void {
  ipcMain.handle('license:status', async () => {
    return getLicenseStatus()
  })

  ipcMain.handle('license:validate', async () => {
    return validateLicense()
  })

  ipcMain.handle('license:import', async (_event, fileContent: string) => {
    return saveLicense(fileContent)
  })

  ipcMain.handle('license:reset-state', async () => {
    resetLicenseState()
    return { success: true }
  })
}

// ============================================
// PRODUCTOS CSV (Import/Export)
// ============================================

function registerProductosCsvHandlers(): void {
  ipcMain.handle('productos:export-csv', async () => {
    try {
      const result = await dialog.showSaveDialog({
        title: 'Exportar Productos',
        defaultPath: `productos-${new Date().toISOString().split('T')[0]}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      })
      if (result.canceled || !result.filePath) return { success: false, error: t('errors.operationCancelled') }

      const db = getDatabase()
      const productos = db.prepare(`
        SELECT p.codigo_barras, p.sku, p.nombre, p.descripcion,
               c.nombre as categoria, p.precio_compra, p.precio_venta,
               p.stock, p.stock_minimo, p.unidad
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE p.activo = 1
        ORDER BY p.nombre
      `).all() as any[]

      const header = 'codigo_barras,sku,nombre,descripcion,categoria,precio_compra,precio_venta,stock,stock_minimo,unidad'
      const rows = productos.map((p) => [
        p.codigo_barras || '', p.sku || '', p.nombre, p.descripcion || '',
        p.categoria || '', p.precio_compra, p.precio_venta,
        p.stock, p.stock_minimo, p.unidad,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))

      fs.writeFileSync(result.filePath, [header, ...rows].join('\n'), 'utf8')
      return { success: true, path: result.filePath, count: productos.length }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('productos:import-csv', async (_event, filePath: string) => {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const lines = content.split('\n').filter((l) => l.trim())
      if (lines.length < 2) return { success: false, error: t('errors.csvEmpty') }

      const db = getDatabase()
      const header = lines[0].toLowerCase()
      const hasHeaders = header.includes('nombre') || header.includes('name')
      const dataLines = hasHeaders ? lines.slice(1) : lines

      let imported = 0
      let skipped = 0

      const importar = db.transaction(() => {
        for (const line of dataLines) {
          try {
            const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').replace('""', '"').trim())
            const nombre = cols[2] || cols[0] // nombre or first column
            if (!nombre) { skipped++; continue }

            // Check if product exists
            const existing = db!.prepare('SELECT id FROM productos WHERE nombre = ?').get(nombre) as any
            if (existing) { skipped++; continue }

            db!.prepare(`
              INSERT INTO productos (codigo_barras, sku, nombre, descripcion, categoria_id,
                precio_compra, precio_venta, stock, stock_minimo, unidad)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              cols[0] || null, cols[1] || null, nombre, cols[3] || null,
              null, // categoria_id would need lookup
              parseFloat(cols[5]) || 0, parseFloat(cols[6]) || 0,
              parseInt(cols[7]) || 0, parseInt(cols[8]) || 5, cols[9] || 'Unit'
            )
            imported++
          } catch { skipped++ }
        }
      })

      importar()
      return { success: true, imported, skipped, total: dataLines.length }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}

// ============================================
// CAJA: BACKUP AUTOMÁTICO + REPORTE X
// ============================================

function registerCajaExtraHandlers(): void {
  ipcMain.handle('caja:reporte-x', async () => {
    try {
      const db = getDatabase()
      const caja = db.prepare("SELECT * FROM caja WHERE estado = 'abierta' LIMIT 1").get() as any
      if (!caja) return { success: false, error: t('errors.cashNotOpen') }

      const totalEsperado = caja.fondo_inicial + caja.total_entradas - caja.total_salidas + caja.total_ventas

      // Ventas del día por método de pago
      const ventasPorMetodo = db.prepare(`
        SELECT metodo_pago, COUNT(*) as cantidad, SUM(total) as total
        FROM ventas WHERE DATE(fecha) = DATE(?) AND estado = 'completada'
        GROUP BY metodo_pago
      `).all(caja.fecha_apertura) as any[]

      // Últimas ventas
      const ultimasVentas = db.prepare(`
        SELECT v.numero_venta, v.total, v.metodo_pago, v.fecha, u.nombre as usuario_nombre
        FROM ventas v LEFT JOIN usuarios u ON v.usuario_id = u.id
        WHERE DATE(v.fecha) = DATE(?) AND v.estado = 'completada'
        ORDER BY v.fecha DESC LIMIT 20
      `).all(caja.fecha_apertura) as any[]

      // Movimientos
      const movimientos = db.prepare(`
        SELECT tipo, monto, descripcion, fecha
        FROM movimientos_caja WHERE caja_id = ?
        ORDER BY fecha DESC
      `).all(caja.id) as any[]

      return {
        success: true,
        caja,
        totalEsperado,
        ventasPorMetodo,
        ultimasVentas,
        movimientos,
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('caja:backup-auto', async () => {
    try {
      const dbPath = app.isPackaged
        ? path.join(app.getPath('userData'), 'tog-admin.db')
        : path.join(process.cwd(), 'data', 'tog-admin.db')
      if (!fs.existsSync(dbPath)) return { success: false, error: 'DB no encontrada' }

      const backupDir = app.isPackaged
        ? path.join(app.getPath('userData'), 'backups')
        : path.join(process.cwd(), 'data', 'backups')
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })

      const filename = `tog-admin-backup-${new Date().toISOString().split('T')[0]}-${Date.now()}.db`
      const backupPath = path.join(backupDir, filename)
      fs.copyFileSync(dbPath, backupPath)
      return { success: true, path: backupPath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}

// ============================================
// HISTORIAL DE AJUSTES
// ============================================

function registerAjustesHandlers(): void {
  ipcMain.handle('ajustes:historial', async (_event, data?: { producto_id?: number; limite?: number }) => {
    const db = getDatabase()
    let sql = `
      SELECT a.*, p.nombre as producto_nombre, u.nombre as usuario_nombre
      FROM ajustes_inventario a
      LEFT JOIN productos p ON a.producto_id = p.id
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE 1=1
    `
    const params: any[] = []
    if (data?.producto_id) { sql += ' AND a.producto_id = ?'; params.push(data.producto_id) }
    sql += ' ORDER BY a.fecha DESC'
    if (data?.limite) { sql += ` LIMIT ?`; params.push(data.limite) }
    return db.prepare(sql).all(...params)
  })
}

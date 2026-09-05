import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import bcrypt from 'bcryptjs'

let db: Database.Database | null = null

/**
 * Obtiene la ruta del archivo de base de datos.
 * En desarrollo: ./data/tog-admin.db
 * En producción: %APPDATA%/tog-admin/tog-admin.db
 */
export function getDbPath(): string {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'tog-admin.db')
  }
  return path.join(process.cwd(), 'data', 'tog-admin.db')
}

/**
 * Retorna la instancia de la base de datos (singleton).
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Base de datos no inicializada. Llama initializeDatabase() primero.')
  }
  return db
}

/**
 * Inicializa la base de datos: crea archivo, activa WAL, ejecuta migraciones y seeds.
 */
export function initializeDatabase(): Database.Database {
  const dbPath = getDbPath()

  // Asegurar que existe el directorio
  const fs = require('fs')
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  db = new Database(dbPath)

  // Configuraciones de rendimiento
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 1000')

  // Ejecutar migraciones
  runMigrations(db)

  // Insertar datos iniciales si la DB está vacía
  seedDatabase(db)

  console.log(`[TOG Admin] Base de datos inicializada: ${dbPath}`)
  return db
}

/**
 * Cierra la conexión a la base de datos.
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

// ============================================
// MIGRACIONES
// ============================================

function runMigrations(db: Database.Database): void {
  // Crear tabla de control de migraciones
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      ejecutado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const executedMigrations = db
    .prepare('SELECT nombre FROM _migrations')
    .all()
    .map((r: any) => r.nombre)

  const migrations = getMigrations()

  const runInTransaction = db.transaction(() => {
    for (const migration of migrations) {
      if (!executedMigrations.includes(migration.nombre)) {
        console.log(`[Migración] Ejecutando: ${migration.nombre}`)
        db.exec(migration.sql)
        db.prepare('INSERT INTO _migrations (nombre) VALUES (?)').run(migration.nombre)
      }
    }
  })

  runInTransaction()
}

function getMigrations(): Array<{ nombre: string; sql: string }> {
  return [
    {
      nombre: '001_usuarios',
      sql: `
        CREATE TABLE IF NOT EXISTS usuarios (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario TEXT NOT NULL UNIQUE,
          contrasena TEXT NOT NULL,
          nombre TEXT NOT NULL,
          rol TEXT NOT NULL DEFAULT 'cajero',
          activo INTEGER NOT NULL DEFAULT 1,
          creado_en TEXT NOT NULL DEFAULT (datetime('now')),
          actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `,
    },
    {
      nombre: '002_categorias',
      sql: `
        CREATE TABLE IF NOT EXISTS categorias (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL UNIQUE,
          descripcion TEXT,
          activo INTEGER NOT NULL DEFAULT 1,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `,
    },
    {
      nombre: '003_productos',
      sql: `
        CREATE TABLE IF NOT EXISTS productos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          codigo_barras TEXT UNIQUE,
          sku TEXT UNIQUE,
          nombre TEXT NOT NULL,
          descripcion TEXT,
          categoria_id INTEGER REFERENCES categorias(id),
          precio_compra REAL NOT NULL DEFAULT 0,
          precio_venta REAL NOT NULL DEFAULT 0,
          stock INTEGER NOT NULL DEFAULT 0,
          stock_minimo INTEGER NOT NULL DEFAULT 5,
          unidad TEXT NOT NULL DEFAULT 'unidad',
          imagen TEXT,
          activo INTEGER NOT NULL DEFAULT 1,
          creado_en TEXT NOT NULL DEFAULT (datetime('now')),
          actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);
        CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo_barras);
        CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre);
      `,
    },
    {
      nombre: '004_proveedores',
      sql: `
        CREATE TABLE IF NOT EXISTS proveedores (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          ein TEXT,
          telefono TEXT,
          email TEXT,
          direccion TEXT,
          notas TEXT,
          activo INTEGER NOT NULL DEFAULT 1,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `,
    },
    {
      nombre: '005_ventas',
      sql: `
        CREATE TABLE IF NOT EXISTS ventas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          numero_venta INTEGER NOT NULL,
          fecha TEXT NOT NULL DEFAULT (datetime('now')),
          usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
          subtotal REAL NOT NULL DEFAULT 0,
          impuesto REAL NOT NULL DEFAULT 0,
          descuento REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL DEFAULT 0,
          metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
          monto_pagado REAL NOT NULL DEFAULT 0,
          cambio REAL NOT NULL DEFAULT 0,
          estado TEXT NOT NULL DEFAULT 'completada',
          notas TEXT,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS venta_detalles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          venta_id INTEGER NOT NULL REFERENCES ventas(id),
          producto_id INTEGER NOT NULL REFERENCES productos(id),
          cantidad REAL NOT NULL DEFAULT 1,
          precio_unitario REAL NOT NULL,
          descuento REAL NOT NULL DEFAULT 0,
          subtotal REAL NOT NULL,
          notas TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
        CREATE INDEX IF NOT EXISTS idx_ventas_usuario ON ventas(usuario_id);
        CREATE INDEX IF NOT EXISTS idx_venta_detalles_venta ON venta_detalles(venta_id);
        CREATE INDEX IF NOT EXISTS idx_venta_detalles_producto ON venta_detalles(producto_id);
      `,
    },
    {
      nombre: '006_compras',
      sql: `
        CREATE TABLE IF NOT EXISTS compras (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          numero_compra INTEGER NOT NULL,
          fecha TEXT NOT NULL DEFAULT (datetime('now')),
          proveedor_id INTEGER REFERENCES proveedores(id),
          usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
          subtotal REAL NOT NULL DEFAULT 0,
          impuesto REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL DEFAULT 0,
          metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
          notas TEXT,
          estado TEXT NOT NULL DEFAULT 'completada',
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS compra_detalles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          compra_id INTEGER NOT NULL REFERENCES compras(id),
          producto_id INTEGER NOT NULL REFERENCES productos(id),
          cantidad REAL NOT NULL,
          costo_unitario REAL NOT NULL,
          subtotal REAL NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras(fecha);
        CREATE INDEX IF NOT EXISTS idx_compras_proveedor ON compras(proveedor_id);
      `,
    },
    {
      nombre: '007_caja',
      sql: `
        CREATE TABLE IF NOT EXISTS caja (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fecha_apertura TEXT NOT NULL DEFAULT (datetime('now')),
          fecha_cierre TEXT,
          fondo_inicial REAL NOT NULL DEFAULT 0,
          total_ventas REAL NOT NULL DEFAULT 0,
          total_entradas REAL NOT NULL DEFAULT 0,
          total_salidas REAL NOT NULL DEFAULT 0,
          total_esperado REAL NOT NULL DEFAULT 0,
          total_real REAL NOT NULL DEFAULT 0,
          diferencia REAL NOT NULL DEFAULT 0,
          usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
          estado TEXT NOT NULL DEFAULT 'abierta',
          notas TEXT,
          cerrado_en TEXT
        );

        CREATE TABLE IF NOT EXISTS movimientos_caja (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          caja_id INTEGER NOT NULL REFERENCES caja(id),
          tipo TEXT NOT NULL,
          monto REAL NOT NULL,
          descripcion TEXT,
          referencia_id INTEGER,
          fecha TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_caja_estado ON caja(estado);
        CREATE INDEX IF NOT EXISTS idx_movimientos_caja_caja ON movimientos_caja(caja_id);
      `,
    },
    {
      nombre: '008_configuracion',
      sql: `
        CREATE TABLE IF NOT EXISTS configuracion (
          clave TEXT PRIMARY KEY,
          valor TEXT NOT NULL,
          descripcion TEXT,
          actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `,
    },
    {
      nombre: '009_unidades_medida',
      sql: `
        CREATE TABLE IF NOT EXISTS unidades_medida (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL UNIQUE,
          abreviatura TEXT,
          activo INTEGER NOT NULL DEFAULT 1,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `,
    },
    {
      nombre: '010_quotes',
      sql: `
        CREATE TABLE IF NOT EXISTS quotes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          numero_cotizacion INTEGER NOT NULL,
          fecha TEXT NOT NULL DEFAULT (datetime('now')),
          fecha_vencimiento TEXT,
          cliente_nombre TEXT NOT NULL,
          cliente_email TEXT,
          cliente_telefono TEXT,
          cliente_direccion TEXT,
          subtotal REAL NOT NULL DEFAULT 0,
          impuesto REAL NOT NULL DEFAULT 0,
          descuento REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL DEFAULT 0,
          notas TEXT,
          estado TEXT NOT NULL DEFAULT 'pendiente',
          usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
          creado_en TEXT NOT NULL DEFAULT (datetime('now')),
          actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS quote_detalles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quote_id INTEGER NOT NULL REFERENCES quotes(id),
          producto_id INTEGER REFERENCES productos(id),
          descripcion TEXT NOT NULL,
          cantidad REAL NOT NULL DEFAULT 1,
          precio_unitario REAL NOT NULL,
          descuento REAL NOT NULL DEFAULT 0,
          subtotal REAL NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_quotes_fecha ON quotes(fecha);
        CREATE INDEX IF NOT EXISTS idx_quotes_cliente ON quotes(cliente_nombre);
        CREATE INDEX IF NOT EXISTS idx_quote_detalles_quote ON quote_detalles(quote_id);
      `,
    },
    {
      nombre: '011usuarios_debe_cambiar_contrasena',
      sql: `
        ALTER TABLE usuarios ADD COLUMN debe_cambiar_contrasena INTEGER NOT NULL DEFAULT 0;
      `,
    },
    {
      nombre: '012_ajustes_inventario',
      sql: `
        CREATE TABLE IF NOT EXISTS ajustes_inventario (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          producto_id INTEGER NOT NULL REFERENCES productos(id),
          usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
          stock_anterior INTEGER NOT NULL,
          stock_nuevo INTEGER NOT NULL,
          diferencia INTEGER NOT NULL,
          justificacion TEXT NOT NULL,
          fecha TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_ajustes_producto ON ajustes_inventario(producto_id);
        CREATE INDEX IF NOT EXISTS idx_ajustes_fecha ON ajustes_inventario(fecha);
      `,
    },
    {
      nombre: '013_usuario_permisos',
      sql: `
        ALTER TABLE usuarios ADD COLUMN permisos TEXT;
      `,
    },
    {
      nombre: '014_metodos_pago',
      sql: `
        CREATE TABLE IF NOT EXISTS metodos_pago (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          clave TEXT NOT NULL UNIQUE,
          nombre TEXT NOT NULL,
          icono TEXT NOT NULL DEFAULT 'DollarSign',
          requiere_terminal INTEGER NOT NULL DEFAULT 0,
          activo INTEGER NOT NULL DEFAULT 1,
          orden INTEGER NOT NULL DEFAULT 0,
          creado_en TEXT NOT NULL DEFAULT (datetime('now')),
          actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT OR IGNORE INTO metodos_pago (clave, nombre, icono, requiere_terminal, orden) VALUES
          ('efectivo', 'Efectivo', 'DollarSign', 0, 1),
          ('tarjeta', 'Tarjeta (VP800)', 'CreditCard', 1, 2);
      `,
    },
    {
      nombre: '015_distribuidor',
      sql: `
        CREATE TABLE IF NOT EXISTS clientes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          rif TEXT,
          telefono TEXT,
          email TEXT,
          direccion TEXT,
          limite_credito REAL NOT NULL DEFAULT 0,
          notas TEXT,
          activo INTEGER NOT NULL DEFAULT 1,
          creado_en TEXT NOT NULL DEFAULT (datetime('now')),
          actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS pedidos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          numero TEXT NOT NULL UNIQUE,
          cliente_id INTEGER NOT NULL REFERENCES clientes(id),
          fecha TEXT NOT NULL DEFAULT (datetime('now')),
          estado TEXT NOT NULL DEFAULT 'pendiente',
          subtotal REAL NOT NULL DEFAULT 0,
          impuesto REAL NOT NULL DEFAULT 0,
          total REAL NOT NULL DEFAULT 0,
          notas TEXT,
          usuario_id INTEGER REFERENCES usuarios(id),
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS pedido_detalles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
          producto_id INTEGER NOT NULL REFERENCES productos(id),
          cantidad REAL NOT NULL,
          precio REAL NOT NULL,
          subtotal REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS remitos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          numero TEXT NOT NULL UNIQUE,
          pedido_id INTEGER REFERENCES pedidos(id),
          cliente_id INTEGER NOT NULL REFERENCES clientes(id),
          fecha TEXT NOT NULL DEFAULT (datetime('now')),
          estado TEXT NOT NULL DEFAULT 'pendiente',
          observaciones TEXT,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS listas_precio (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          factor REAL NOT NULL DEFAULT 1,
          activo INTEGER NOT NULL DEFAULT 1,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
        CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha);
        CREATE INDEX IF NOT EXISTS idx_remitos_cliente ON remitos(cliente_id);
      `,
    },
    {
      nombre: '016_clientes_documento',
      sql: `
        ALTER TABLE clientes RENAME COLUMN rif TO documento;
      `,
    },
    {
      nombre: '017_producto_tipo',
      sql: `
        ALTER TABLE productos ADD COLUMN tipo TEXT NOT NULL DEFAULT 'producto';
        UPDATE productos SET tipo = 'servicio' WHERE LOWER(unidad) = 'servicio';
      `,
    },
    {
      nombre: '018_subcategorias',
      sql: `
        CREATE TABLE IF NOT EXISTS subcategorias (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          categoria_id INTEGER NOT NULL REFERENCES categorias(id),
          activo INTEGER NOT NULL DEFAULT 1,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        ALTER TABLE productos ADD COLUMN subcategoria_id INTEGER REFERENCES subcategorias(id);
        CREATE INDEX IF NOT EXISTS idx_productos_subcategoria ON productos(subcategoria_id);
        CREATE INDEX IF NOT EXISTS idx_subcategorias_categoria ON subcategorias(categoria_id);
      `,
    },
    {
      nombre: '019_producto_marca',
      sql: `
        ALTER TABLE productos ADD COLUMN marca TEXT;
      `,
    },
    {
      nombre: '020_venta_detalles_libre',
      sql: `
        CREATE TABLE venta_detalles_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          venta_id INTEGER NOT NULL REFERENCES ventas(id),
          producto_id INTEGER REFERENCES productos(id),
          descripcion TEXT,
          cantidad REAL NOT NULL DEFAULT 1,
          precio_unitario REAL NOT NULL,
          descuento REAL NOT NULL DEFAULT 0,
          subtotal REAL NOT NULL,
          notas TEXT
        );

        INSERT INTO venta_detalles_new (id, venta_id, producto_id, cantidad, precio_unitario, descuento, subtotal, notas)
          SELECT id, venta_id, producto_id, cantidad, precio_unitario, descuento, subtotal, notas FROM venta_detalles;

        DROP TABLE venta_detalles;
        ALTER TABLE venta_detalles_new RENAME TO venta_detalles;
        CREATE INDEX IF NOT EXISTS idx_venta_detalles_venta ON venta_detalles(venta_id);
        CREATE INDEX IF NOT EXISTS idx_venta_detalles_producto ON venta_detalles(producto_id);
      `,
    },
    {
      nombre: '021_creditos',
      sql: `
        CREATE TABLE IF NOT EXISTS creditos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          venta_id INTEGER NOT NULL REFERENCES ventas(id),
          cliente_id INTEGER REFERENCES clientes(id),
          deudor_nombre TEXT NOT NULL,
          deudor_telefono TEXT,
          deudor_documento TEXT,
          monto_total REAL NOT NULL DEFAULT 0,
          saldo REAL NOT NULL DEFAULT 0,
          fecha TEXT NOT NULL DEFAULT (datetime('now')),
          estado TEXT NOT NULL DEFAULT 'pendiente',
          usuario_id INTEGER REFERENCES usuarios(id),
          notas TEXT,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS credito_abonos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          credito_id INTEGER NOT NULL REFERENCES creditos(id),
          monto REAL NOT NULL,
          fecha TEXT NOT NULL DEFAULT (datetime('now')),
          usuario_id INTEGER REFERENCES usuarios(id),
          notas TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_creditos_estado ON creditos(estado);
        CREATE INDEX IF NOT EXISTS idx_creditos_cliente ON creditos(cliente_id);
        CREATE INDEX IF NOT EXISTS idx_creditos_venta ON creditos(venta_id);
        CREATE INDEX IF NOT EXISTS idx_credito_abonos_credito ON credito_abonos(credito_id);
      `,
    },
    {
      nombre: '022_metodo_pago_fiado',
      sql: `
        INSERT OR IGNORE INTO metodos_pago (clave, nombre, icono, requiere_terminal, activo, orden) VALUES
          ('fiado', 'Fiado', 'HandCoins', 0, 1, 3);
      `,
    },
    {
      nombre: '023_productos_compuestos',
      sql: `
        CREATE TABLE IF NOT EXISTS producto_componentes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          producto_id INTEGER NOT NULL REFERENCES productos(id),
          componente_id INTEGER NOT NULL REFERENCES productos(id),
          cantidad REAL NOT NULL DEFAULT 1,
          creado_en TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE (producto_id, componente_id)
        );
        CREATE INDEX IF NOT EXISTS idx_producto_componentes_producto ON producto_componentes(producto_id);
        CREATE INDEX IF NOT EXISTS idx_producto_componentes_componente ON producto_componentes(componente_id);

        -- Snapshot de componentes consumidos por una venta (desglose de ticket + anulación)
        CREATE TABLE IF NOT EXISTS venta_detalle_componentes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          venta_detalle_id INTEGER NOT NULL REFERENCES venta_detalles(id),
          componente_id INTEGER NOT NULL REFERENCES productos(id),
          cantidad REAL NOT NULL,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_vdc_detalle ON venta_detalle_componentes(venta_detalle_id);
      `,
    },
    {
      nombre: '024_restaurant',
      sql: `
        CREATE TABLE IF NOT EXISTS mesas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          capacidad INTEGER NOT NULL DEFAULT 4,
          estado TEXT NOT NULL DEFAULT 'libre',
          activo INTEGER NOT NULL DEFAULT 1,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS comandas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          mesa_id INTEGER NOT NULL REFERENCES mesas(id),
          usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
          estado TEXT NOT NULL DEFAULT 'abierta',
          notas TEXT,
          venta_id INTEGER REFERENCES ventas(id),
          creado_en TEXT NOT NULL DEFAULT (datetime('now')),
          cerrado_en TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_comandas_mesa ON comandas(mesa_id);
        CREATE INDEX IF NOT EXISTS idx_comandas_estado ON comandas(estado);

        CREATE TABLE IF NOT EXISTS comanda_detalles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          comanda_id INTEGER NOT NULL REFERENCES comandas(id),
          producto_id INTEGER REFERENCES productos(id),
          descripcion TEXT NOT NULL,
          cantidad REAL NOT NULL DEFAULT 1,
          precio_unitario REAL NOT NULL DEFAULT 0,
          subtotal REAL NOT NULL DEFAULT 0,
          estado TEXT NOT NULL DEFAULT 'pendiente',
          notas TEXT,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_comanda_detalles_comanda ON comanda_detalles(comanda_id);

        INSERT OR IGNORE INTO mesas (nombre, capacidad, estado) VALUES
          ('Mesa 1', 4, 'libre'), ('Mesa 2', 4, 'libre'), ('Mesa 3', 4, 'libre'),
          ('Mesa 4', 2, 'libre'), ('Mesa 5', 6, 'libre'), ('Mesa 6', 2, 'libre');
      `,
    },
    {
      nombre: '025_reportes_guardados',
      sql: `
        CREATE TABLE IF NOT EXISTS reportes_guardados (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
          nombre TEXT NOT NULL,
          fuente TEXT NOT NULL,
          campos TEXT NOT NULL,
          fecha_inicio TEXT,
          fecha_fin TEXT,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_reportes_guardados_usuario ON reportes_guardados(usuario_id);
      `,
    },
    {
      nombre: '026_remove_telegram_config',
      sql: `
        DELETE FROM configuracion WHERE clave IN ('telegram_bot_token', 'telegram_chat_id');
      `,
    },
    {
      nombre: '027_ventas_cliente_y_borradores',
      sql: `
        ALTER TABLE ventas ADD COLUMN cliente_id INTEGER REFERENCES clientes(id);
        CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON ventas(cliente_id);

        CREATE TABLE IF NOT EXISTS ventas_borrador (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
          cliente_id INTEGER REFERENCES clientes(id),
          items_json TEXT NOT NULL,
          descuento_global REAL NOT NULL DEFAULT 0,
          notas TEXT,
          creado_en TEXT NOT NULL DEFAULT (datetime('now')),
          actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_ventas_borrador_usuario ON ventas_borrador(usuario_id);
      `,
    },
    {
      nombre: '028_ventas_tipo_comprobante',
      sql: `
        ALTER TABLE ventas ADD COLUMN tipo_comprobante TEXT NOT NULL DEFAULT 'factura';
        CREATE INDEX IF NOT EXISTS idx_ventas_tipo_comprobante ON ventas(tipo_comprobante);
      `,
    },
  ]
}

// ============================================
// SEEDS (datos iniciales)
// ============================================

function seedDatabase(db: Database.Database): void {
  const existeAdmin = db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get('admin')

  if (!existeAdmin) {
    const seedInTransaction = db.transaction(() => {
      // Usuario admin por defecto (contraseña: admin123)
      // Se fuerza cambio de contraseña en el primer login
      const hash = bcrypt.hashSync('admin123', 10)
      db!.prepare(`
        INSERT INTO usuarios (usuario, contrasena, nombre, rol, debe_cambiar_contrasena)
        VALUES (?, ?, ?, ?, 1)
      `).run('admin', hash, 'Administrador', 'admin')

      // Empleada de prueba: solo puede ver inventario y procesar compras
      // (contraseña: empleado123)
      const hashEmpleado = bcrypt.hashSync('empleado123', 10)
      const permisosEmpleado = JSON.stringify([
        'pos_access', 'pos_discount', 'pos_edit_price', 'pos_quick_sale',
        'caja_access', 'caja_open', 'caja_close', 'caja_movement',
        'inventario_access', 'inventario_create', 'inventario_edit',
        'compras_access', 'compras_create',
        'quotes_access', 'quotes_create',
      ])
      db!.prepare(`
        INSERT INTO usuarios (usuario, contrasena, nombre, rol, permisos)
        VALUES (?, ?, ?, ?, ?)
      `).run('maria', hashEmpleado, 'María (Prueba)', 'cajero', permisosEmpleado)

      // Nota: categorías NO se seedean — el cliente crea las suyas
      // Solo se insertan unidades de medida genéricas

      // Unidades de medida iniciales
      const unidades = [
        { nombre: 'Unidad', abbr: 'ud' },
        { nombre: 'Paquete', abbr: 'paq' },
        { nombre: 'Caja', abbr: 'cj' },
        { nombre: 'Resma', abbr: 'res' },
        { nombre: 'Rollo', abbr: 'rl' },
        { nombre: 'Litro', abbr: 'L' },
        { nombre: 'Galón', abbr: 'gal' },
        { nombre: 'Hoja', abbr: 'hj' },
        { nombre: 'Metro', abbr: 'm' },
        { nombre: 'Par', abbr: 'par' },
        { nombre: 'Servicio', abbr: 'svc' },
      ]

      const insertUnidad = db!.prepare(
        'INSERT OR IGNORE INTO unidades_medida (nombre, abreviatura) VALUES (?, ?)'
      )
      for (const u of unidades) {
        insertUnidad.run(u.nombre, u.abbr)
      }

      // Configuración inicial (solo defaults mínimos)
      const configs = [
        ['currency_symbol', '$', 'Currency symbol (USD)'],
        ['sales_tax_rate', '0', 'Sales tax rate (%)'],
        ['fondo_inicial_default', '100', 'Default opening amount for cash register'],
        ['ticket_numero_venta', '0', 'Número secuencial de la última venta'],
        ['ticket_numero_compra', '0', 'Número secuencial de la última compra'],
      ]

      const insertConfig = db!.prepare(
        'INSERT OR IGNORE INTO configuracion (clave, valor, descripcion) VALUES (?, ?, ?)'
      )
      for (const [clave, valor, desc] of configs) {
        insertConfig.run(clave, valor, desc)
      }
    })

    seedInTransaction()
    console.log('[TOG Admin] Seeds iniciales insertados (admin, categorías, configuración)')
  }
}

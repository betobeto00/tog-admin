import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import bcrypt from 'bcryptjs'

let db: Database.Database | null = null

/**
 * Obtiene la ruta del archivo de base de datos.
 * En desarrollo: ./data/tog-admin.db
 * En producción: %APPDATA%/TOG Admin/tog-admin.db
 */
function getDbPath(): string {
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
  db.pragma('busy_timeout = 5000')

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

import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import bcrypt from 'bcryptjs'
import { logger } from '../services/logger'

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

  logger.info('db', `Base de datos inicializada: ${dbPath}`)
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
        logger.info('db', `Ejecutando migración: ${migration.nombre}`)
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
          fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
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
          fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
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
          fecha_apertura TEXT NOT NULL DEFAULT (datetime('now','localtime')),
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
          fecha TEXT NOT NULL DEFAULT (datetime('now','localtime'))
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
          fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
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
          fecha TEXT NOT NULL DEFAULT (datetime('now','localtime'))
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
          fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
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
          fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
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
          fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          estado TEXT NOT NULL DEFAULT 'pendiente',
          usuario_id INTEGER REFERENCES usuarios(id),
          notas TEXT,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS credito_abonos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          credito_id INTEGER NOT NULL REFERENCES creditos(id),
          monto REAL NOT NULL,
          fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
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
    {
      nombre: '029_almacenes_y_listas_precio',
      sql: `
        CREATE TABLE IF NOT EXISTS almacenes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL UNIQUE,
          direccion TEXT,
          activo INTEGER NOT NULL DEFAULT 1,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS producto_almacen (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          producto_id INTEGER NOT NULL REFERENCES productos(id),
          almacen_id INTEGER NOT NULL REFERENCES almacenes(id),
          stock REAL NOT NULL DEFAULT 0,
          actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(producto_id, almacen_id)
        );
        CREATE INDEX IF NOT EXISTS idx_producto_almacen_producto ON producto_almacen(producto_id);
        CREATE INDEX IF NOT EXISTS idx_producto_almacen_almacen ON producto_almacen(almacen_id);

        CREATE TABLE IF NOT EXISTS lista_precio_productos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          lista_id INTEGER NOT NULL REFERENCES listas_precio(id),
          producto_id INTEGER NOT NULL REFERENCES productos(id),
          precio_override REAL,
          UNIQUE(lista_id, producto_id)
        );
        CREATE INDEX IF NOT EXISTS idx_lpp_lista ON lista_precio_productos(lista_id);
        CREATE INDEX IF NOT EXISTS idx_lpp_producto ON lista_precio_productos(producto_id);

        CREATE TABLE IF NOT EXISTS cliente_lista_precio (
          cliente_id INTEGER NOT NULL REFERENCES clientes(id),
          lista_id INTEGER NOT NULL REFERENCES listas_precio(id),
          PRIMARY KEY (cliente_id, lista_id)
        );
      `,
    },
    {
      nombre: '030_currency_name',
      sql: `
        INSERT OR IGNORE INTO configuracion (clave, valor, descripcion) VALUES
          ('currency_name', 'USD', 'Nombre de la moneda (USD, Bs, EUR, etc.)');
      `,
    },
    {
      nombre: '031_producto_imagen_path',
      sql: `
        ALTER TABLE productos ADD COLUMN imagen_path TEXT;
      `,
    },
    {
      nombre: '032_red_local',
      sql: `
        CREATE TABLE IF NOT EXISTS pcs_enlazadas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          par_id TEXT NOT NULL UNIQUE,
          nombre TEXT NOT NULL,
          ip TEXT,
          cert_hash TEXT NOT NULL,
          last_seen TEXT,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_pcs_enlazadas_par ON pcs_enlazadas(par_id);

        CREATE TABLE IF NOT EXISTS sesiones_activas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usuario_id INTEGER NOT NULL UNIQUE REFERENCES usuarios(id),
          par_id TEXT NOT NULL,
          sesion_token TEXT NOT NULL UNIQUE,
          opened_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_heartbeat TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_sesiones_activas_par ON sesiones_activas(par_id);

        CREATE TABLE IF NOT EXISTS codigos_enlace (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          codigo TEXT NOT NULL UNIQUE,
          creado_en TEXT NOT NULL DEFAULT (datetime('now')),
          expira_en TEXT NOT NULL,
          usado INTEGER NOT NULL DEFAULT 0,
          usado_en TEXT
        );
      `,
    },
    {
      nombre: '033_heartbeat_pcs',
      sql: `
        ALTER TABLE pcs_enlazadas ADD COLUMN last_heartbeat TEXT;
        CREATE INDEX IF NOT EXISTS idx_pcs_enlazadas_last_heartbeat ON pcs_enlazadas(last_heartbeat);
      `,
    },
    {
      nombre: '034_contable',
      sql: `
        CREATE TABLE IF NOT EXISTS asientos_contables (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
          tipo TEXT NOT NULL,
          descripcion TEXT NOT NULL,
          referencia_tipo TEXT,
          referencia_id INTEGER,
          cuenta TEXT NOT NULL,
          debe REAL NOT NULL DEFAULT 0,
          haber REAL NOT NULL DEFAULT 0,
          usuario_id INTEGER REFERENCES usuarios(id),
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_asientos_fecha ON asientos_contables(fecha);
        CREATE INDEX IF NOT EXISTS idx_asientos_ref ON asientos_contables(referencia_tipo, referencia_id);
      `,
    },
    {
      nombre: '035_rrhh',
      sql: `
        CREATE TABLE IF NOT EXISTS empleados (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          documento TEXT,
          cargo TEXT,
          salario_mensual REAL NOT NULL DEFAULT 0,
          telefono TEXT,
          direccion TEXT,
          fecha_ingreso TEXT NOT NULL DEFAULT (date('now','localtime')),
          activo INTEGER NOT NULL DEFAULT 1,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS asistencia (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          empleado_id INTEGER NOT NULL REFERENCES empleados(id),
          fecha TEXT NOT NULL DEFAULT (date('now','localtime')),
          estado TEXT NOT NULL DEFAULT 'presente',
          notas TEXT,
          creado_en TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(empleado_id, fecha)
        );
        CREATE INDEX IF NOT EXISTS idx_asistencia_fecha ON asistencia(fecha);

        CREATE TABLE IF NOT EXISTS nominas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          empleado_id INTEGER NOT NULL REFERENCES empleados(id),
          periodo_inicio TEXT NOT NULL,
          periodo_fin TEXT NOT NULL,
          salario_base REAL NOT NULL DEFAULT 0,
          dias_trabajados INTEGER NOT NULL DEFAULT 0,
          bonos REAL NOT NULL DEFAULT 0,
          deducciones REAL NOT NULL DEFAULT 0,
          total_pagar REAL NOT NULL DEFAULT 0,
          estado TEXT NOT NULL DEFAULT 'pendiente',
          pagado_en TEXT,
          usuario_id INTEGER REFERENCES usuarios(id),
          creado_en TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(empleado_id, periodo_inicio, periodo_fin)
        );
        CREATE INDEX IF NOT EXISTS idx_nominas_periodo ON nominas(periodo_inicio, periodo_fin);
      `,
    },
    {
      nombre: '035b_nomina_conceptos',
      sql: `
        CREATE TABLE IF NOT EXISTS nomina_conceptos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nomina_id INTEGER NOT NULL REFERENCES nominas(id) ON DELETE CASCADE,
          nombre TEXT NOT NULL,
          tipo TEXT NOT NULL CHECK(tipo IN ('asignacion', 'deduccion')),
          monto REAL NOT NULL DEFAULT 0,
          orden INTEGER NOT NULL DEFAULT 0,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_nomina_conceptos_nomina ON nomina_conceptos(nomina_id);
      `,
    },
    {
      nombre: '036_productor',
      sql: `
        CREATE TABLE IF NOT EXISTS cultivos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          variedad TEXT,
          unidad TEXT NOT NULL DEFAULT 'kg',
          notas TEXT,
          activo INTEGER NOT NULL DEFAULT 1,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS siembras (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cultivo_id INTEGER NOT NULL REFERENCES cultivos(id),
          descripcion TEXT,
          fecha_siembra TEXT NOT NULL DEFAULT (date('now','localtime')),
          area REAL NOT NULL DEFAULT 0,
          unidad_area TEXT NOT NULL DEFAULT 'ha',
          cantidad_sembrada REAL NOT NULL DEFAULT 0,
          estado TEXT NOT NULL DEFAULT 'activa',
          fecha_cosecha TEXT,
          cantidad_cosechada REAL NOT NULL DEFAULT 0,
          notas TEXT,
          usuario_id INTEGER REFERENCES usuarios(id),
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_siembras_estado ON siembras(estado);

        CREATE TABLE IF NOT EXISTS costos_campo (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          siembra_id INTEGER NOT NULL REFERENCES siembras(id),
          fecha TEXT NOT NULL DEFAULT (date('now','localtime')),
          concepto TEXT NOT NULL,
          monto REAL NOT NULL DEFAULT 0,
          notas TEXT,
          usuario_id INTEGER REFERENCES usuarios(id),
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_costos_campo_siembra ON costos_campo(siembra_id);
      `,
    },
    {
      nombre: '037_postventa',
      sql: `
        CREATE TABLE IF NOT EXISTS tickets_postventa (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          numero TEXT NOT NULL UNIQUE,
          venta_id INTEGER REFERENCES ventas(id),
          cliente_nombre TEXT NOT NULL,
          cliente_telefono TEXT,
          asunto TEXT NOT NULL,
          descripcion TEXT,
          estado TEXT NOT NULL DEFAULT 'abierto',
          prioridad TEXT NOT NULL DEFAULT 'media',
          usuario_id INTEGER REFERENCES usuarios(id),
          cerrado_en TEXT,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_tickets_estado ON tickets_postventa(estado);

        CREATE TABLE IF NOT EXISTS ticket_mensajes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ticket_id INTEGER NOT NULL REFERENCES tickets_postventa(id),
          autor TEXT NOT NULL,
          mensaje TEXT NOT NULL,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS devoluciones (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          venta_id INTEGER REFERENCES ventas(id),
          ticket_id INTEGER REFERENCES tickets_postventa(id),
          producto_id INTEGER REFERENCES productos(id),
          cantidad REAL NOT NULL DEFAULT 1,
          monto REAL NOT NULL DEFAULT 0,
          motivo TEXT NOT NULL,
          tipo TEXT NOT NULL DEFAULT 'devolucion',
          usuario_id INTEGER REFERENCES usuarios(id),
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS garantias (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          venta_id INTEGER REFERENCES ventas(id),
          ticket_id INTEGER REFERENCES tickets_postventa(id),
          producto_id INTEGER REFERENCES productos(id),
          vence_en TEXT,
          estado TEXT NOT NULL DEFAULT 'vigente',
          resolucion TEXT,
          resuelto_en TEXT,
          usuario_id INTEGER REFERENCES usuarios(id),
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );
      `,
},
      {
        nombre: '038_productos_costo_combo',
        sql: `
          ALTER TABLE productos ADD COLUMN costo_real REAL;
          ALTER TABLE productos ADD COLUMN es_combo INTEGER NOT NULL DEFAULT 0;
        `,
      },
      {
        nombre: '039_cargos',
        sql: `
          CREATE TABLE IF NOT EXISTS cargos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            salario_base_mensual REAL NOT NULL DEFAULT 0,
            activo INTEGER NOT NULL DEFAULT 1,
            creado_en TEXT NOT NULL DEFAULT (datetime('now'))
          );
        `,
      },
      {
        nombre: '040_empleado_cargo',
        sql: `
          CREATE TABLE IF NOT EXISTS empleado_cargo (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            empleado_id INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
            cargo_id INTEGER NOT NULL REFERENCES cargos(id),
            fecha_asignacion TEXT NOT NULL DEFAULT (datetime('now')),
            activo INTEGER NOT NULL DEFAULT 1
          );
          CREATE INDEX IF NOT EXISTS idx_empleado_cargo_empleado ON empleado_cargo(empleado_id);
          CREATE INDEX IF NOT EXISTS idx_empleado_cargo_cargo ON empleado_cargo(cargo_id);
        `,
      },
      {
        nombre: '041_empleado_extendido',
        sql: `
          ALTER TABLE empleados ADD COLUMN experiencia TEXT;
          ALTER TABLE empleados ADD COLUMN anos_servicio INTEGER NOT NULL DEFAULT 0;
          ALTER TABLE empleados ADD COLUMN nivel_academico TEXT;
        `,
      },
      {
        nombre: '042_nominas_flexible',
        sql: `
          ALTER TABLE nominas ADD COLUMN tipo_pago TEXT;
          ALTER TABLE nominas ADD COLUMN salario_base_activo INTEGER NOT NULL DEFAULT 0;
        `,
      },
      {
        nombre: '043_almacen_caja',
        sql: `
          ALTER TABLE caja ADD almacen_id INTEGER REFERENCES almacenes(id);
        `,
      },
      {
        nombre: '044_security_default_passwords',
        sql: `
          -- Flag to track if initial password has been shown to user
          ALTER TABLE usuarios ADD COLUMN initial_password_shown INTEGER NOT NULL DEFAULT 0;
          
          -- Create table to store initial admin password (cleared after first login)
          CREATE TABLE IF NOT EXISTS admin_initial_password (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            shown_at TEXT
          );
        `,
      },
      {
        nombre: '045_login_attempts',
        sql: `
          CREATE TABLE IF NOT EXISTS login_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario TEXT NOT NULL,
            ip TEXT,
            exitoso INTEGER NOT NULL DEFAULT 0,
            creado_en TEXT NOT NULL DEFAULT (datetime('now'))
          );
          CREATE INDEX IF NOT EXISTS idx_login_attempts_usuario ON login_attempts(usuario);
          CREATE INDEX IF NOT EXISTS idx_login_attempts_creado ON login_attempts(creado_en);
        `,
      },
      {
        nombre: '046_ventas_numero_control',
        sql: `
          -- N° de control fiscal (SENIAT) por factura: A-00000042.
          -- Ver docs/LEGAL-VENEZUELA-POS.md y src/main/services/fiscal.ts
          ALTER TABLE ventas ADD COLUMN numero_control TEXT;
          CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_numero_control ON ventas(numero_control) WHERE numero_control IS NOT NULL;
        `,
      },
      {
        nombre: '047_hipico',
        sql: `
          -- Módulo Hípico (FASE 7): propietarios, caballos, carreras, inscripciones y resultados.
          -- Las carreras pueden cargarse a mano o importarse de una API pública (columna fuente).
          CREATE TABLE IF NOT EXISTS hipico_propietarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            documento TEXT,
            telefono TEXT,
            email TEXT,
            pais TEXT,
            notas TEXT,
            activo INTEGER NOT NULL DEFAULT 1,
            creado_en TEXT NOT NULL DEFAULT (datetime('now'))
          );
          CREATE INDEX IF NOT EXISTS idx_hipico_propietarios_nombre ON hipico_propietarios(nombre);

          CREATE TABLE IF NOT EXISTS hipico_caballos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            raza TEXT,
            sexo TEXT,
            anio_nacimiento INTEGER,
            propietario_id INTEGER REFERENCES hipico_propietarios(id),
            microchip TEXT,
            entrenador TEXT,
            notas TEXT,
            activo INTEGER NOT NULL DEFAULT 1,
            creado_en TEXT NOT NULL DEFAULT (datetime('now'))
          );
          CREATE INDEX IF NOT EXISTS idx_hipico_caballos_nombre ON hipico_caballos(nombre);
          CREATE INDEX IF NOT EXISTS idx_hipico_caballos_propietario ON hipico_caballos(propietario_id);
          CREATE UNIQUE INDEX IF NOT EXISTS idx_hipico_caballos_microchip ON hipico_caballos(microchip) WHERE microchip IS NOT NULL;

          CREATE TABLE IF NOT EXISTS hipico_carreras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hipodromo TEXT NOT NULL,
            fecha TEXT NOT NULL,
            numero_carrera INTEGER NOT NULL,
            distancia_m INTEGER,
            categoria TEXT,
            premio REAL,
            estado TEXT NOT NULL DEFAULT 'programada',
            notas TEXT,
            fuente TEXT NOT NULL DEFAULT 'manual',
            creado_en TEXT NOT NULL DEFAULT (datetime('now'))
          );
          -- Clave natural: es lo que permite que la importación de la API sea idempotente (INSERT OR IGNORE)
          CREATE UNIQUE INDEX IF NOT EXISTS idx_hipico_carreras_unica ON hipico_carreras(hipodromo, fecha, numero_carrera);
          CREATE INDEX IF NOT EXISTS idx_hipico_carreras_fecha ON hipico_carreras(fecha);

          CREATE TABLE IF NOT EXISTS hipico_inscripciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            carrera_id INTEGER NOT NULL REFERENCES hipico_carreras(id),
            caballo_id INTEGER NOT NULL REFERENCES hipico_caballos(id),
            jinete TEXT,
            peso REAL,
            numero_partida INTEGER,
            retirado INTEGER NOT NULL DEFAULT 0,
            notas TEXT,
            creado_en TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE (carrera_id, caballo_id)
          );
          CREATE INDEX IF NOT EXISTS idx_hipico_inscripciones_carrera ON hipico_inscripciones(carrera_id);

          CREATE TABLE IF NOT EXISTS hipico_resultados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            carrera_id INTEGER NOT NULL REFERENCES hipico_carreras(id),
            inscripcion_id INTEGER NOT NULL REFERENCES hipico_inscripciones(id),
            caballo_id INTEGER NOT NULL REFERENCES hipico_caballos(id),
            posicion INTEGER NOT NULL,
            tiempo TEXT,
            dividendo REAL,
            fuente TEXT NOT NULL DEFAULT 'manual',
            creado_en TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE (carrera_id, posicion),
            UNIQUE (inscripcion_id)
          );
          CREATE INDEX IF NOT EXISTS idx_hipico_resultados_carrera ON hipico_resultados(carrera_id);
        `,
      },
      {
        nombre: '048_hipico_apuestas',
        sql: `
          -- FASE 7b: Sub-modulo de apuestas hípicas.
          -- Tickets de apuesta, selecciones, odds cacheadas y configuración de APIs.

          CREATE TABLE IF NOT EXISTS hipico_carreras_odds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            carrera_id INTEGER NOT NULL REFERENCES hipico_carreras(id),
            bookmaker_key TEXT NOT NULL,
            bookmaker_nombre TEXT NOT NULL,
            outcomes_json TEXT NOT NULL,
            actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE (carrera_id, bookmaker_key)
          );
          CREATE INDEX IF NOT EXISTS idx_hipico_odds_carrera ON hipico_carreras_odds(carrera_id);

          CREATE TABLE IF NOT EXISTS hipico_apuestas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero_ticket TEXT NOT NULL,
            carrera_id INTEGER NOT NULL REFERENCES hipico_carreras(id),
            tipo_apuesta TEXT NOT NULL DEFAULT 'win',
            monto REAL NOT NULL,
            odd_total REAL,
            payout_potencial REAL,
            estado TEXT NOT NULL DEFAULT 'pendiente',
            ganancia REAL,
            cerrada_en TEXT,
            cobrada_en TEXT,
            notas TEXT,
            creado_en TEXT NOT NULL DEFAULT (datetime('now'))
          );
          CREATE UNIQUE INDEX IF NOT EXISTS idx_hipico_apuestas_ticket ON hipico_apuestas(numero_ticket);
          CREATE INDEX IF NOT EXISTS idx_hipico_apuestas_carrera ON hipico_apuestas(carrera_id);
          CREATE INDEX IF NOT EXISTS idx_hipico_apuestas_estado ON hipico_apuestas(estado);

          CREATE TABLE IF NOT EXISTS hipico_apuesta_selections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            apuesta_id INTEGER NOT NULL REFERENCES hipico_apuestas(id),
            carrera_id INTEGER NOT NULL REFERENCES hipico_carreras(id),
            caballo_nombre TEXT NOT NULL,
            caballo_numero INTEGER,
            posicion_predicha INTEGER,
            odd_individual REAL,
            resultado_posicion INTEGER,
            ganador INTEGER NOT NULL DEFAULT 0,
            creado_en TEXT NOT NULL DEFAULT (datetime('now'))
          );
          CREATE INDEX IF NOT EXISTS idx_hipico_selections_apuesta ON hipico_apuesta_selections(apuesta_id);

          CREATE TABLE IF NOT EXISTS hipico_config_api (
            clave TEXT PRIMARY KEY,
            valor TEXT NOT NULL,
            actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
          );
        `,
      },
      // ============================================
      // FASE 8: MÓDULO PRODUCTOR REDISEÑADO — CADENAS DE PRODUCCIÓN
      // ============================================
      {
        nombre: '049_producto_tipo_produccion',
        sql: `
          -- Clasificación de productos por etapa de transformación.
          -- NULL = normal (comprado y vendido sin producción)
          -- 'base' = materia prima / componente comprado al proveedor
          -- 'intermedio' = se produce a partir de bases, se usa como insumo
          -- 'final' = se produce y se vende al cliente
          ALTER TABLE productos ADD COLUMN tipo_produccion TEXT DEFAULT NULL;
        `,
      },
      {
        nombre: '050_cadena_produccion',
        sql: `
          -- Receta / BOM (Bill of Materials) para producir un producto.
          CREATE TABLE IF NOT EXISTS cadena_produccion (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            producto_final_id INTEGER NOT NULL REFERENCES productos(id),
            nombre TEXT NOT NULL,
            descripcion TEXT,
            tiempo_estimado_minutos REAL NOT NULL DEFAULT 0,
            costo_mano_obra_hora REAL NOT NULL DEFAULT 0,
            overhead_porcentaje REAL NOT NULL DEFAULT 0,
            activo INTEGER NOT NULL DEFAULT 1,
            creado_en TEXT NOT NULL DEFAULT (datetime('now')),
            actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
          );
          CREATE INDEX IF NOT EXISTS idx_cadena_producto ON cadena_produccion(producto_final_id);

          -- Cada paso de la cadena: qué insumo se consume en cada etapa.
          CREATE TABLE IF NOT EXISTS cadena_paso (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cadena_id INTEGER NOT NULL REFERENCES cadena_produccion(id) ON DELETE CASCADE,
            orden INTEGER NOT NULL DEFAULT 1,
            producto_base_id INTEGER NOT NULL REFERENCES productos(id),
            cantidad REAL NOT NULL DEFAULT 1,
            unidad TEXT NOT NULL DEFAULT 'unidad',
            costo_unitario_override REAL,
            notas TEXT,
            creado_en TEXT NOT NULL DEFAULT (datetime('now'))
          );
          CREATE INDEX IF NOT EXISTS idx_cadena_paso_cadena ON cadena_paso(cadena_id);
        `,
      },
      {
        nombre: '051_produccion_lotes',
        sql: `
          -- Lote de producción: registro de que se fabricaron X unidades.
          CREATE TABLE IF NOT EXISTS produccion_lote (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cadena_id INTEGER NOT NULL REFERENCES cadena_produccion(id),
            producto_final_id INTEGER NOT NULL REFERENCES productos(id),
            cantidad_producida REAL NOT NULL DEFAULT 1,
            costo_materiales REAL NOT NULL DEFAULT 0,
            costo_mano_obra REAL NOT NULL DEFAULT 0,
            costo_overhead REAL NOT NULL DEFAULT 0,
            costo_total REAL NOT NULL DEFAULT 0,
            costo_unitario REAL NOT NULL DEFAULT 0,
            fecha_inicio TEXT NOT NULL DEFAULT (datetime('now')),
            fecha_fin TEXT,
            estado TEXT NOT NULL DEFAULT 'en_proceso',
            notas TEXT,
            usuario_id INTEGER REFERENCES usuarios(id),
            creado_en TEXT NOT NULL DEFAULT (datetime('now'))
          );
          CREATE INDEX IF NOT EXISTS idx_produccion_lote_producto ON produccion_lote(producto_final_id);
          CREATE INDEX IF NOT EXISTS idx_produccion_lote_estado ON produccion_lote(estado);

          -- Detalle de insumos consumidos en un lote.
          CREATE TABLE IF NOT EXISTS produccion_lote_detalle (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lote_id INTEGER NOT NULL REFERENCES produccion_lote(id) ON DELETE CASCADE,
            producto_base_id INTEGER NOT NULL REFERENCES productos(id),
            cantidad_consumida REAL NOT NULL DEFAULT 0,
            costo_unitario REAL NOT NULL DEFAULT 0,
            costo_total REAL NOT NULL DEFAULT 0
          );
          CREATE INDEX IF NOT EXISTS idx_produccion_detalle_lote ON produccion_lote_detalle(lote_id);
        `,
      },
      {
        nombre: '052_intentos_vincular',
        sql: `
          -- Intentos de emparejamiento de PCs hijas (código de enlace).
          -- Persistente a propósito: el límite por IP sobrevive reinicios de la
          -- app y queda auditable, a diferencia del Map en memoria anterior.
          CREATE TABLE IF NOT EXISTS intentos_vincular (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip TEXT NOT NULL,
            creado_en TEXT NOT NULL DEFAULT (datetime('now'))
          );
          CREATE INDEX IF NOT EXISTS idx_intentos_vincular_ip ON intentos_vincular(ip, creado_en);
        `,
      },
    {
      nombre: '053_fechas_negocio_local',
      sql: `
        -- Las fechas de negocio se guardaban con datetime('now') (UTC) mientras
        -- la UI y los reportes usan hora local. En UTC-4, una venta hecha a las
        -- 22:00 quedaba con fecha del día UTC siguiente y desaparecía del libro
        -- del día (y mostraba una hora corrida 4h). Esta migración corre una
        -- sola vez y pasa las filas existentes a hora local.
        --
        -- asientos_contables.fecha NO se toca: ya se guardaba como fecha local
        -- (YYYY-MM-DD) desde createVenta/createCompra.
        UPDATE ventas SET fecha = datetime(fecha, 'localtime') WHERE fecha IS NOT NULL;
        UPDATE compras SET fecha = datetime(fecha, 'localtime') WHERE fecha IS NOT NULL;
        UPDATE caja SET fecha_apertura = datetime(fecha_apertura, 'localtime') WHERE fecha_apertura IS NOT NULL;
        UPDATE caja SET fecha_cierre = datetime(fecha_cierre, 'localtime') WHERE fecha_cierre IS NOT NULL;
        UPDATE caja SET cerrado_en = datetime(cerrado_en, 'localtime') WHERE cerrado_en IS NOT NULL;
        UPDATE movimientos_caja SET fecha = datetime(fecha, 'localtime') WHERE fecha IS NOT NULL;
        UPDATE creditos SET fecha = datetime(fecha, 'localtime') WHERE fecha IS NOT NULL;
        UPDATE credito_abonos SET fecha = datetime(fecha, 'localtime') WHERE fecha IS NOT NULL;
        UPDATE ajustes_inventario SET fecha = datetime(fecha, 'localtime') WHERE fecha IS NOT NULL;
        UPDATE pedidos SET fecha = datetime(fecha, 'localtime') WHERE fecha IS NOT NULL;
        UPDATE remitos SET fecha = datetime(fecha, 'localtime') WHERE fecha IS NOT NULL;
        UPDATE quotes SET fecha = datetime(fecha, 'localtime') WHERE fecha IS NOT NULL;
      `,
    },
    {
      nombre: '054_rrhh_capas',
      sql: `
        -- Nómina por capas: catálogo global de conceptos + grupos de empleados.
        --
        -- 1) conceptos_catalogo: asignaciones/deducciones reutilizables
        --    (p. ej. "Prima de Alimentación") con monto por defecto.
        -- 2) empleado_grupos: grupos creados por el usuario (Fijos, Obreros…).
        -- 3) empleado_grupo_miembros: qué empleados pertenecen a cada grupo.
        -- 4) grupo_conceptos: qué conceptos del catálogo aplica cada grupo,
        --    con un monto que puede sobrescribir el default.
        CREATE TABLE IF NOT EXISTS conceptos_catalogo (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL,
          tipo TEXT NOT NULL CHECK(tipo IN ('asignacion', 'deduccion')),
          monto_default REAL NOT NULL DEFAULT 0,
          activo INTEGER NOT NULL DEFAULT 1,
          creado_en TEXT NOT NULL DEFAULT (datetime('now')),
          actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS empleado_grupos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          nombre TEXT NOT NULL UNIQUE,
          descripcion TEXT,
          activo INTEGER NOT NULL DEFAULT 1,
          creado_en TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS empleado_grupo_miembros (
          grupo_id INTEGER NOT NULL REFERENCES empleado_grupos(id) ON DELETE CASCADE,
          empleado_id INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
          PRIMARY KEY (grupo_id, empleado_id)
        );

        CREATE TABLE IF NOT EXISTS grupo_conceptos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          grupo_id INTEGER NOT NULL REFERENCES empleado_grupos(id) ON DELETE CASCADE,
          concepto_id INTEGER NOT NULL REFERENCES conceptos_catalogo(id) ON DELETE CASCADE,
          monto REAL NOT NULL DEFAULT 0,
          UNIQUE(grupo_id, concepto_id)
        );

        CREATE INDEX IF NOT EXISTS idx_grupo_miembros_empleado ON empleado_grupo_miembros(empleado_id);
        CREATE INDEX IF NOT EXISTS idx_grupo_conceptos_grupo ON grupo_conceptos(grupo_id);
      `,
    },
    {
      nombre: '055_numero_factura_continua',
      sql: `
        -- Numeración de facturas continua (antes reiniciaba cada día: la
        -- primera venta del día era la #1). Ahora avanza de a uno y el negocio
        -- puede fijar el punto de partida cuando viene de otro sistema
        -- (Configuración → Negocio). En instalaciones existentes arranca
        -- después de la última factura emitida.
        INSERT OR IGNORE INTO configuracion (clave, valor, descripcion)
        VALUES (
          'numero_factura_siguiente',
          CAST((SELECT COALESCE(MAX(numero_venta), 0) + 1 FROM ventas) AS TEXT),
          'Próximo número de factura a emitir'
        );
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
      // La generación (CSPRNG) y la escritura en disco viven en
      // `core/auth/password-inicial.ts`, que es testeable por comportamiento.
      const { generarPasswordInicial, escribirPasswordInicial } = require('../core/auth/password-inicial')
      const adminPassword: string = generarPasswordInicial()

      // Se escribe en texto plano SOLO para poder mostrarla una vez (la
      // pantalla de activación la lee con `license:initial-password`). El
      // archivo se borra en el primer login del admin — ver
      // `core/auth/auth-service.ts`. Mientras exista, solo el dueño puede leerlo.
      const initialPasswordPath: string = escribirPasswordInicial(
        require('electron').app.getPath('userData'),
        adminPassword,
      )
      
      // Hash the password for storage
      const hash = bcrypt.hashSync(adminPassword, 10)
      db!.prepare(`
        INSERT INTO usuarios (usuario, contrasena, nombre, rol, debe_cambiar_contrasena)
        VALUES (?, ?, ?, ?, 1)
      `).run('admin', hash, 'Administrador', 'admin')
      
      // Store initial password for first login display
      db!.prepare(`
        INSERT INTO admin_initial_password (id, password_hash) VALUES (1, ?)
      `).run(hash)
      
      logger.info('db', `Admin password generated. Check: ${initialPasswordPath}`)

      // Note: 'maria' test user removed for security (Phase 3)

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
        ['numero_factura_siguiente', '1', 'Próximo número de factura a emitir'],
      ]

      const insertConfig = db!.prepare(
        'INSERT OR IGNORE INTO configuracion (clave, valor, descripcion) VALUES (?, ?, ?)'
      )
      for (const [clave, valor, desc] of configs) {
        insertConfig.run(clave, valor, desc)
      }

      // Almacén por defecto
      const insertAlmacen = db!.prepare('INSERT OR IGNORE INTO almacenes (id, nombre, direccion) VALUES (1, ?, ?)')
      insertAlmacen.run('Principal', 'Almacén principal')
    })

    seedInTransaction()
    logger.info('db', 'Seeds iniciales insertados (admin, categorías, configuración)')
  }
}

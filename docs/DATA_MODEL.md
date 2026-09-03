# Modelo de Datos — TOG Admin

> ⚠️ **Esquema canónico:** la fuente de verdad es la cadena de **migraciones 001 → 016** en `src/main/db/database.ts` (tabla `schema_migrations`). Este documento describe el modelo **v1** (POS) y el apéndice al final cubre las tablas agregadas después. Si un detalle discrepa con `database.ts`, manda `database.ts`.

## Diagrama ER (Simplificado)

```
┌─────────────┐       ┌──────────────┐       ┌──────────────┐
│  usuarios   │       │   ventas     │       │ venta_detalles│
│─────────────│       │──────────────│       │──────────────│
│ id (PK)     │◄──┐   │ id (PK)      │◄──┐   │ id (PK)      │
│ usuario     │   │   │ fecha        │   │   │ venta_id(FK) │──►│
│ contraseña  │   │   │ usuario_id   │──►│   │ producto_id  │──►│
│ nombre      │   │   │ subtotal     │   │   │ cantidad     │
│ rol         │   │   │ impuesto     │   │   │ precio_unit  │
│ activo      │   │   │ total        │   │   │ subtotal     │
└─────────────┘   │   │ metodo_pago  │   │   └──────────────┘
                  │   │ estado       │   │
                  │   │ notas        │   │
                  │   └──────────────┘   │
                  │                      │
                  │   ┌──────────────┐   │   ┌──────────────┐
                  │   │  productos   │   │   │  categorias  │
                  │   │──────────────│   │   │──────────────│
                  ├───│ id (PK)      │   │   │ id (PK)      │
                  │   │ codigo_barras│   │   │ nombre       │
                  │   │ nombre       │   │   │ descripcion  │
                  │   │ descripcion  │   │   └──────────────┘
                  │   │ categoria_id │──►│
                  │   │ precio_compra│       ┌──────────────┐
                  │   │ precio_venta │       │  proveedores │
                  │   │ stock        │       │──────────────│
                  │   │ stock_min    │       │ id (PK)      │
                  │   │ unidad       │       │ nombre       │
                  │   │ imagen       │       │ telefono     │
                  │   │ activo       │       │ direccion    │
                  │   └──────────────┘       │ email        │
                  │                          │ notas        │
                  │   ┌──────────────┐       │ activo       │
                  │   │   compras    │       └──────────────┘
                  │   │──────────────│              ▲
                  │   │ id (PK)      │              │
                  │   │ proveedor_id │──────────────┘
                  │   │ fecha        │       ┌──────────────┐
                  │   │ total        │       │compra_detalle│
                  │   │ notas        │       │──────────────│
                  │   │ usuario_id   │──►│   │ id (PK)      │
                  │   └──────────────┘   │   │ compra_id    │──►│
                  │                      │   │ producto_id  │──►│
                  │   ┌──────────────┐   │   │ cantidad     │
                  │   │  caja        │   │   │ costo_unit   │
                  │   │──────────────│   │   │ subtotal     │
                  └───│ id (PK)      │   │   └──────────────┘
                      │ fecha_apertura│   │
                      │ fecha_cierre  │   │
                      │ fondo_inicial │   │   ┌──────────────┐
                      │ total_entradas│   │   │   movimientos │
                      │ total_salidas │   │   │──────────────│
                      │ total_ventas  │   │   │ id (PK)      │
                      │ total_esperado│   │   │ caja_id      │──►│
                      │ total_real    │   │   │ tipo         │
                      │ diferencia    │   │   │ monto        │
                      │ usuario_id    │──►│   │ descripcion  │
                      │ notas         │   │   │ fecha        │
                      └──────────────┘   │   └──────────────┘
```

---

## Esquema SQL

### usuarios
```sql
CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario TEXT NOT NULL UNIQUE,
    contrasena TEXT NOT NULL,          -- bcrypt hash
    nombre TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'cajero', -- 'admin' | 'cajero'
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en TEXT NOT NULL DEFAULT (datetime('now')),
    actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### categorias
```sql
CREATE TABLE categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Categorías iniciales sugeridas:**
- Papelería
- Copiado
- Impresión
- Encuadernación
- Artículos de oficina
- Sellos
- Impresión de fotos
- Servicios varios

### productos
```sql
CREATE TABLE productos (
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
    unidad TEXT NOT NULL DEFAULT 'unidad', -- 'unidad' | 'paquete' | 'hoja' | 'servicio'
    imagen TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en TEXT NOT NULL DEFAULT (datetime('now')),
    actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### proveedores
```sql
CREATE TABLE proveedores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    ein TEXT,              -- EIN/RIF tributario (campo libre, mercado internacional)
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    notas TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### ventas
```sql
CREATE TABLE ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_venta INTEGER NOT NULL,     -- Número secuencial del día
    fecha TEXT NOT NULL DEFAULT (datetime('now')),
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    subtotal REAL NOT NULL DEFAULT 0,
    impuesto REAL NOT NULL DEFAULT 0,
    descuento REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    metodo_pago TEXT NOT NULL DEFAULT 'efectivo', -- 'efectivo' | 'transferencia' | 'pago_movil' | 'mixto'
    monto_pagado REAL NOT NULL DEFAULT 0,
    cambio REAL NOT NULL DEFAULT 0,
    estado TEXT NOT NULL DEFAULT 'completada', -- 'completada' | 'anulada'
    notas TEXT,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### venta_detalles
```sql
CREATE TABLE venta_detalles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    venta_id INTEGER NOT NULL REFERENCES ventas(id),
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    cantidad REAL NOT NULL DEFAULT 1,
    precio_unitario REAL NOT NULL,
    descuento REAL NOT NULL DEFAULT 0,
    subtotal REAL NOT NULL,
    notas TEXT
);
```

### compras
```sql
CREATE TABLE compras (
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
```

### compra_detalles
```sql
CREATE TABLE compra_detalles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    compra_id INTEGER NOT NULL REFERENCES compras(id),
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    cantidad REAL NOT NULL,
    costo_unitario REAL NOT NULL,
    subtotal REAL NOT NULL
);
```

### caja (sesiones de caja)
```sql
CREATE TABLE caja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_apertura TEXT NOT NULL DEFAULT (datetime('now')),
    fecha_cierre TEXT,
    fondo_inicial REAL NOT NULL DEFAULT 0,
    total_ventas REAL NOT NULL DEFAULT 0,
    total_entradas REAL NOT NULL DEFAULT 0,  -- entradas manuales (vueltos, etc.)
    total_salidas REAL NOT NULL DEFAULT 0,   -- retiros, gastos
    total_esperado REAL NOT NULL DEFAULT 0,
    total_real REAL NOT NULL DEFAULT 0,       -- lo que el cajero cuenta
    diferencia REAL NOT NULL DEFAULT 0,       -- esperado - real
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
    estado TEXT NOT NULL DEFAULT 'abierta',   -- 'abierta' | 'cerrada'
    notas TEXT,
    cerrado_en TEXT
);
```

### movimientos_caja
```sql
CREATE TABLE movimientos_caja (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    caja_id INTEGER NOT NULL REFERENCES caja(id),
    tipo TEXT NOT NULL,           -- 'venta' | 'entrada' | 'salida' | 'retiro'
    monto REAL NOT NULL,
    descripcion TEXT,
    referencia_id INTEGER,        -- ID de venta o compra relacionada
    fecha TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### unidades_medida
```sql
CREATE TABLE unidades_medida (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    abreviatura TEXT,
    activo INTEGER NOT NULL DEFAULT 1,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Unidades iniciales:** Unit, Package, Box, Ream, Roll, Liter, Gallon, Sheet, Meter, Pair, Service

### configuracion
```sql
CREATE TABLE configuracion (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL,
    descripcion TEXT,
    actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**Configuraciones iniciales (adaptadas a EEUU):**
```sql
INSERT INTO configuracion (clave, valor, descripcion) VALUES
('nombre_negocio', 'My Business', 'Business name'),
('ein', '', 'EIN (Employer Identification Number)'),
('telefono', '', 'Phone number'),
('direccion', '', 'Business address'),
('sales_tax_rate', '0', 'Sales Tax rate (%) — varies by state/county'),
('currency_symbol', '$', 'Currency symbol (USD)'),
('ticket_ultima_venta', '0', 'Número de la última venta'),
('ticket_ultima_compra', '0', 'Número de la última compra'),
('backup_automatico', 'true', 'Crear backup al cerrar caja'),
('backup_ruta', '', 'Ruta donde guardar backups');
```

---

## Índices Recomendados

```sql
CREATE INDEX idx_ventas_fecha ON ventas(fecha);
CREATE INDEX idx_ventas_usuario ON ventas(usuario_id);
CREATE INDEX idx_venta_detalles_venta ON venta_detalles(venta_id);
CREATE INDEX idx_venta_detalles_producto ON venta_detalles(producto_id);
CREATE INDEX idx_productos_categoria ON productos(categoria_id);
CREATE INDEX idx_productos_codigo ON productos(codigo_barras);
CREATE INDEX idx_compras_fecha ON compras(fecha);
CREATE INDEX idx_compras_proveedor ON compras(proveedor_id);
CREATE INDEX idx_caja_estado ON caja(estado);
CREATE INDEX idx_movimientos_caja_caja ON movimientos_caja(caja_id);
```

---

## Reglas de Negocio en DB

1. **Stock negativo no permitido:** CHECK constraint o validación en app
2. **Número de venta secuencial:** Se incrementa por día, se resetea
3. **Borrado lógico:** Tablas usan `activo` en vez de DELETE
4. **Caja abierta única:** Solo puede haber una caja abierta a la vez
5. **Auditoría:** `creado_en` y `actualizado_en` en tablas principales

---

## Apéndice: tablas y columnas agregadas después de v1 (migraciones 010–016)

| Migración | Cambio |
|-----------|--------|
| 010 | `quotes`, `quote_detalles` (cotizaciones con items) |
| 011 | `usuarios.debe_cambiar_contrasena` |
| 012 | `ajustes_inventario` (historial de ajustes de stock) |
| 013 | `usuarios.permisos` (JSON de permisos por usuario; reemplaza el rol simple) |
| 014 | `metodos_pago` (efectivo, tarjeta VP800…) |
| 015 | `clientes`, `pedidos`, `pedido_detalles`, `remitos`, `listas_precio` (módulo Distribuidor) |
| 016 | `clientes.rif` → `clientes.documento` (identidad internacional) |

### clientes (Distribuidor, migraciones 015/016)
```sql
CREATE TABLE clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    documento TEXT,           -- RIF, RFC, EIN, CNPJ… (libre, mercado internacional)
    telefono TEXT,
    email TEXT,
    direccion TEXT,
    limite_credito REAL NOT NULL DEFAULT 0,
    notas TEXT,
    activo INTEGER NOT NULL DEFAULT 1,   -- borrado lógico
    creado_en TEXT NOT NULL DEFAULT (datetime('now')),
    actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### pedidos + pedido_detalles (Distribuidor, migración 015)
```sql
CREATE TABLE pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT NOT NULL UNIQUE,          -- secuencial (configuracion.pedido_numero)
    cliente_id INTEGER NOT NULL REFERENCES clientes(id),
    fecha TEXT NOT NULL DEFAULT (datetime('now')),
    estado TEXT NOT NULL DEFAULT 'pendiente',  -- pendiente | despachado | entregado | anulado
    subtotal REAL NOT NULL DEFAULT 0,
    impuesto REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    notas TEXT,
    usuario_id INTEGER REFERENCES usuarios(id),
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE pedido_detalles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
    producto_id INTEGER NOT NULL REFERENCES productos(id),
    cantidad REAL NOT NULL,
    precio REAL NOT NULL,
    subtotal REAL NOT NULL
);
```

También existen (creadas en 015, sin UI todavía): `remitos(numero, pedido_id, cliente_id, fecha, estado, observaciones)` y `listas_precio(nombre, factor, activo)`.

import { describe, it, expect, vi, beforeEach } from 'vitest'

// DB en memoria con la API de better-sqlite3 (ver distribuidor.test.ts)
const { db, handles } = vi.hoisted(() => {
  const { DatabaseSync } = require('node:sqlite')
  const raw = new DatabaseSync(':memory:')
  const stmts = new Map<string, any>()
  const db = {
    exec(sql: string) {
      return raw.exec(sql)
    },
    prepare(sql: string) {
      if (!stmts.has(sql)) stmts.set(sql, raw.prepare(sql))
      return stmts.get(sql)
    },
    transaction(fn: (...args: any[]) => any) {
      return (...args: any[]) => fn(...args)
    },
  }
  db.exec(`
    CREATE TABLE configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      descripcion TEXT,
      actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE usuarios (id INTEGER PRIMARY KEY, nombre TEXT);
    CREATE TABLE productos (id INTEGER PRIMARY KEY, nombre TEXT);
    CREATE TABLE clientes (id INTEGER PRIMARY KEY, nombre TEXT, documento TEXT, telefono TEXT, direccion TEXT);
    CREATE TABLE ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_venta INTEGER NOT NULL,
      fecha TEXT NOT NULL DEFAULT (datetime('now')),
      usuario_id INTEGER NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      impuesto REAL NOT NULL DEFAULT 0,
      descuento REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
      monto_pagado REAL NOT NULL DEFAULT 0,
      cambio REAL NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'completada',
      notas TEXT,
      cliente_id INTEGER,
      tipo_comprobante TEXT,
      numero_control TEXT
    );
    CREATE TABLE venta_detalles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL,
      producto_id INTEGER,
      descripcion TEXT,
      cantidad REAL NOT NULL DEFAULT 1,
      precio_unitario REAL NOT NULL,
      descuento REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL
    );
    INSERT INTO configuracion (clave, valor) VALUES
      ('nombre_negocio', 'Bodega OmniMargen'),
      ('ein', 'J-40123456-7'),
      ('direccion', 'Av. Principal 123'),
      ('numero_control_serie', 'A'),
      ('numero_control_correlativo', '7'),
      ('sales_tax_rate', '16'),
      ('impresora_puerto', 'COM3'),
      ('impresora_ancho', '80'),
      ('currency_name', 'USD');
    INSERT INTO usuarios (id, nombre) VALUES (1, 'admin');
    INSERT INTO clientes (id, nombre, documento) VALUES (1, 'Cliente SA', 'J-999');
    INSERT INTO ventas (id, numero_venta, usuario_id, subtotal, impuesto, descuento, total, metodo_pago, monto_pagado, cambio, cliente_id, tipo_comprobante, numero_control)
      VALUES (10, 42, 1, 10, 1.6, 0, 11.6, 'efectivo', 15, 3.4, 1, 'factura', 'A-00000008');
    INSERT INTO venta_detalles (venta_id, producto_id, descripcion, cantidad, precio_unitario, subtotal)
      VALUES (10, 1, 'Harina 1kg', 2, 5, 10);
  `)
  return { db, handles: {} as Record<string, any> }
})

const impresiones: { bytes: number[]; opciones: any }[] = []

vi.mock('electron', () => ({ ipcMain: { handle: (c: string, fn: any) => { handles[c] = fn } } }))
vi.mock('../../core/auth/ipc-guard', () => ({ handleIpc: (c: string, fn: any) => { handles[c] = fn } }))
vi.mock('../../db/database', () => ({ getDatabase: () => db }))
vi.mock('../../core/auth', () => ({
  checkPermissionOrFail: (data: any) => (data && data.usuario_id === 1 ? null : { success: false, error: 'Sin permisos', channel: 'test' }),
}))
vi.mock('../../services/printer', () => ({
  listarPuertosSerie: async () => [{ path: 'COM3', fabricante: 'Epson' }],
  enviarEscPos: async (bytes: number[], opciones: any) => {
    impresiones.push({ bytes, opciones })
    return { success: true, bytes: bytes.length }
  },
}))

import { construirEscPos, sanearTexto, textoABytes, CMD_FEED, ESC, GS } from './escpos'
import { documentoDeVenta, etiquetaMetodoPago } from './documentos'
import { getDatosFiscales, siguienteNumeroControl, guardarConfig } from '../../services/fiscal'
import { registerPrintHandlers } from './handlers'
import type { LineaTicket } from '../../../shared/print'

const lineas: LineaTicket[] = [
  { texto: 'TOG Admin', centrada: true, negrita: true },
  { texto: 'Harina 1kg 2 x 5.00', negrita: false },
  { texto: 'TOTAL', negrita: true, doble: true },
  { texto: '11.60 USD' },
]

beforeEach(() => {
  impresiones.length = 0
})

describe('driver ESC/POS', () => {
  it('inicializa, alinea, marca negrita/doble y corta el papel', () => {
    const bytes = construirEscPos(lineas, { cortar: true })
    expect(bytes.slice(0, 2)).toEqual([ESC, 0x40]) // ESC @
    expect(bytes).toContain(0x01) // alineación centrada
    expect(bytes).toContain(0x11) // GS ! 0x11 (doble)
    expect(bytes.slice(-3)).toEqual([GS, 0x56, 0x01]) // GS V 1 (corte parcial)
  })

  it('apaga los atributos al terminar (no deja el ticket en negrita)', () => {
    const bytes = construirEscPos(lineas)
    const idxDobleOff = bytes.findIndex((b, i) => b === GS && bytes[i + 1] === 0x21 && bytes[i + 2] === 0x00)
    const idxBoldOff = bytes.findIndex((b, i) => b === ESC && bytes[i + 1] === 0x45 && bytes[i + 2] === 0x00)
    expect(idxDobleOff).toBeGreaterThan(-1)
    expect(idxBoldOff).toBeGreaterThan(-1)
  })

  it('puede abrir el cajón de dinero y omitir el corte', () => {
    const bytes = construirEscPos(lineas, { abrirCajon: true, cortar: false })
    expect(bytes.slice(-5)).toEqual([ESC, 0x70, 0x00, 0x19, 0xfa])
    expect(bytes.slice(-3)).not.toEqual([GS, 0x56, 0x01])
  })

  it('termina cada línea con salto de línea y escribe acentos en latin1', () => {
    const bytes = construirEscPos([{ texto: 'Añejo' }], { cortar: false, avanceFinal: 0 })
    const texto = textoABytes('Añejo')
    // La secuencia del texto aparece en orden (incluida la ñ = 241 en latin1)
    const idx = bytes.findIndex((_, i) => texto.every((b, j) => bytes[i + j] === b))
    expect(idx).toBeGreaterThan(-1)
    expect(texto).toContain(241)
    expect(bytes[idx + texto.length]).toBe(CMD_FEED[0])
  })

  it('sanea caracteres de control que romperían la impresora', () => {
    expect(sanearTexto('linea1\nlinea2\ttab')).toBe('linea1 linea2 tab')
    expect(sanearTexto('“comillas”')).toBe('"comillas"')
  })
})

describe('documento de una venta', () => {
  it('arma el documento con datos fiscales, ítems y N° de control', () => {
    const doc = documentoDeVenta(10, db)!
    expect(doc.numero).toBe('42')
    expect(doc.numero_control).toBe('A-00000008')
    expect(doc.empresa.razon_social).toBe('Bodega OmniMargen')
    expect(doc.empresa.rif).toBe('J-40123456-7')
    expect(doc.cliente?.nombre).toBe('Cliente SA')
    expect(doc.cajero).toBe('admin')
    expect(doc.items).toEqual([
      { descripcion: 'Harina 1kg', cantidad: 2, precio_unitario: 5, descuento: 0, subtotal: 10 },
    ])
    expect(doc.metodo_pago).toBe('Efectivo')
    expect(doc.alicuota_iva).toBe(16)
  })

  it('devuelve null si la venta no existe', () => {
    expect(documentoDeVenta(999, db)).toBeNull()
  })

  it('traduce los métodos de pago conocidos', () => {
    expect(etiquetaMetodoPago('pago_movil')).toBe('Pago móvil')
    expect(etiquetaMetodoPago('tarjeta')).toBe('Tarjeta')
    expect(etiquetaMetodoPago('otro-metodo')).toBe('otro-metodo')
    expect(etiquetaMetodoPago(null)).toBe('')
  })
})

describe('datos fiscales y N° de control', () => {
  it('lee la configuración con defaults aplicados', () => {
    const fiscal = getDatosFiscales(db)
    expect(fiscal.razon_social).toBe('Bodega OmniMargen')
    expect(fiscal.rif).toBe('J-40123456-7')
    expect(fiscal.alicuota_iva).toBe(16)
    expect(fiscal.puerto_impresora).toBe('COM3')
    expect(fiscal.ancho_ticket).toBe(80)
    expect(fiscal.abrir_cajon).toBe(false)
  })

  it('reserva correlativos consecutivos sin repetir', () => {
    const primero = siguienteNumeroControl(db)
    const segundo = siguienteNumeroControl(db)
    expect(primero).not.toBe(segundo)
    const [serie1, n1] = primero.split('-')
    const [serie2, n2] = segundo.split('-')
    expect(serie1).toBe('A')
    expect(serie2).toBe('A')
    expect(Number(n2)).toBe(Number(n1) + 1)
  })

  it('persiste cambios de configuración', () => {
    guardarConfig(db, 'impresora_ancho', '58')
    expect(getDatosFiscales(db).ancho_ticket).toBe(58)
    guardarConfig(db, 'impresora_ancho', '80')
  })
})

describe('handlers de impresión', () => {
  registerPrintHandlers()
  const llamar = (canal: string, data: any) => handles[canal](null, data)
  const auth = { usuario_id: 1 }

  it('exige permisos en todos los canales', async () => {
    for (const canal of ['print:config', 'print:set-config', 'print:puertos', 'print:ticket', 'print:test']) {
      const res = await llamar(canal, {})
      expect(res.success, canal).toBe(false)
      expect(res.error).toBe('Sin permisos')
    }
  })

  it('print:config devuelve la configuración y el próximo N° de control', async () => {
    const res = await llamar('print:config', auth)
    expect(res.razon_social).toBe('Bodega OmniMargen')
    expect(res.proximo_numero_control).toMatch(/^A-\d{8}$/)
  })

  it('print:set-config guarda y devuelve la configuración nueva', async () => {
    const res = await llamar('print:set-config', { ...auth, pie_ticket: 'Vuelva pronto', copias: 2, abrir_cajon: true })
    expect(res.success).toBe(true)
    expect(res.config.pie_ticket).toBe('Vuelva pronto')
    expect(res.config.copias).toBe(2)
    expect(res.config.abrir_cajon).toBe(true)
    await llamar('print:set-config', { ...auth, copias: 1, abrir_cajon: false })
  })

  it('print:puertos lista los puertos disponibles', async () => {
    const res = await llamar('print:puertos', auth)
    expect(res.success).toBe(true)
    expect(res.puertos[0].path).toBe('COM3')
  })

  it('print:ticket imprime la venta por el puerto configurado', async () => {
    const res = await llamar('print:ticket', { ...auth, venta_id: 10 })
    expect(res.success).toBe(true)
    expect(impresiones).toHaveLength(1)
    expect(impresiones[0].opciones.puerto).toBe('COM3')
    // El ticket real lleva el N° de control de la factura
    const texto = Buffer.from(impresiones[0].bytes).toString('latin1')
    expect(texto).toContain('A-00000008')
    expect(texto).toContain('Bodega OmniMargen')
  })

  it('print:ticket avisa cuando no hay ventas', async () => {
    db.exec('DELETE FROM venta_detalles; DELETE FROM ventas;')
    const res = await llamar('print:ticket', auth)
    expect(res.success).toBe(false)
    expect(res.error).toContain('No hay ventas')
    db.exec(`
      INSERT INTO ventas (id, numero_venta, usuario_id, subtotal, impuesto, descuento, total, metodo_pago, monto_pagado, cambio, cliente_id, tipo_comprobante, numero_control)
        VALUES (10, 42, 1, 10, 1.6, 0, 11.6, 'efectivo', 15, 3.4, 1, 'factura', 'A-00000008');
      INSERT INTO venta_detalles (venta_id, producto_id, descripcion, cantidad, precio_unitario, subtotal)
        VALUES (10, 1, 'Harina 1kg', 2, 5, 10);
    `)
  })

  it('print:test imprime un ticket de prueba', async () => {
    const res = await llamar('print:test', auth)
    expect(res.success).toBe(true)
    expect(res.documento.titulo).toBe('TICKET DE PRUEBA')
    expect(impresiones).toHaveLength(1)
  })
})

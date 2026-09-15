/**
 * Documentos imprimibles de TOG Admin (FASE 6).
 *
 * Este archivo es la **única** definición del documento: lo usan el renderer
 * (vista previa en React), el driver ESC/POS (ticket térmico) y los handlers
 * IPC. El layout de texto es una función pura para poder testearlo sin
 * impresora ni base de datos.
 *
 * Anchuras: 58mm ≈ 32 columnas, 80mm ≈ 48 columnas (fuente A, 12 cpi).
 */

export type AnchoTicket = 58 | 80

export const COLUMNAS_POR_ANCHO: Record<AnchoTicket, number> = {
  58: 32,
  80: 48,
}

export interface ItemDocumento {
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento?: number
  subtotal: number
}

export interface DatosEmpresa {
  razon_social: string
  rif?: string
  direccion?: string
  telefono?: string
  email?: string
}

export interface DatosCliente {
  nombre: string
  documento?: string
  direccion?: string
  telefono?: string
}

/** Una línea del ticket con sus atributos de impresión. */
export interface LineaTicket {
  texto: string
  /** Centrada horizontalmente */
  centrada?: boolean
  negrita?: boolean
  /** Doble alto/ancho (títulos, TOTAL) */
  doble?: boolean
}

export interface DocumentoVenta {
  titulo: string
  empresa: DatosEmpresa
  cliente?: DatosCliente | null
  numero: string
  /** N° de control fiscal (SENIAT). Ver docs/LEGAL-VENEZUELA-POS.md */
  numero_control?: string | null
  fecha: string
  cajero?: string
  caja?: string
  items: ItemDocumento[]
  subtotal: number
  descuento: number
  impuesto: number
  /** Alícuota de IVA aplicada, en % (ej: 16) */
  alicuota_iva?: number
  total: number
  moneda?: string
  metodo_pago?: string
  monto_pagado?: number
  cambio?: number
  notas?: string
  pie?: string
}

// ---------- formateo (puro) ----------

export function formatearMonto(monto: unknown, moneda = ''): string {
  const n = Number(monto)
  const valor = Number.isFinite(n) ? n.toFixed(2) : '0.00'
  return moneda ? `${valor} ${moneda}` : valor
}

/** Acepta ISO, 'YYYY-MM-DD HH:mm:ss' o Date. Devuelve 'DD/MM/YYYY HH:mm'. */
export function formatearFecha(fecha: string | Date | null | undefined): string {
  if (!fecha) return ''
  const d = fecha instanceof Date ? fecha : new Date(String(fecha).replace(' ', 'T'))
  if (Number.isNaN(d.getTime())) return String(fecha)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Centra el texto en `ancho` columnas (el sobrante va a la derecha). */
export function centrar(texto: string, ancho: number): string {
  const t = texto.trim()
  if (t.length >= ancho) return t
  const izquierda = Math.floor((ancho - t.length) / 2)
  return ' '.repeat(izquierda) + t + ' '.repeat(ancho - t.length - izquierda)
}

/** Corta el texto en líneas de a lo sumo `ancho` columnas, respetando palabras. */
export function envolver(texto: string, ancho: number): string[] {
  const palabras = String(texto ?? '').trim().split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return []
  const lineas: string[] = []
  let actual = ''
  for (const palabra of palabras) {
    const candidata = actual ? `${actual} ${palabra}` : palabra
    if (candidata.length <= ancho) {
      actual = candidata
      continue
    }
    if (actual) lineas.push(actual)
    // Una palabra sola más larga que el ancho se parte
    let resto = palabra
    while (resto.length > ancho) {
      lineas.push(resto.slice(0, ancho))
      resto = resto.slice(ancho)
    }
    actual = resto
  }
  if (actual) lineas.push(actual)
  return lineas
}

export function divisoria(ancho: number, char = '-'): string {
  return char.repeat(ancho)
}

/**
 * Alinea `izquierda` a la izquierda y `derecha` a la derecha en `ancho` columnas.
 * Si no entra, se recorta la izquierda: el importe siempre se lee completo.
 */
export function columnas(izquierda: string, derecha: string, ancho: number): string {
  let izq = String(izquierda ?? '')
  const der = String(derecha ?? '')
  const espacio = ancho - izq.length - der.length
  if (espacio > 0) return izq + ' '.repeat(espacio) + der

  // No entra: se recorta la izquierda para que el importe se lea completo y
  // siempre quede el espacio separador (una etiqueta cortada se entiende;
  // un monto pegado a la etiqueta o cortado, no).
  izq = izq.slice(0, Math.max(ancho - der.length - 1, 0))
  const relleno = Math.max(ancho - izq.length - der.length, 0)
  return (izq + ' '.repeat(relleno) + der).slice(0, ancho)
}

/**
 * Convierte el documento en las líneas del ticket (58/80mm).
 * Función pura: la usan la vista previa y el driver ESC/POS.
 */
export function construirLineasTicket(doc: DocumentoVenta, ancho: AnchoTicket = 80): LineaTicket[] {
  const cols = COLUMNAS_POR_ANCHO[ancho] ?? COLUMNAS_POR_ANCHO[80]
  const moneda = doc.moneda || ''
  const lineas: LineaTicket[] = []

  // Se envuelve primero: una razón social larga no puede romper el ancho del papel.
  const centrada = (texto: string, extra: Partial<LineaTicket> = {}) => {
    if (!texto) return
    for (const linea of envolver(texto, cols)) {
      lineas.push({ texto: centrar(linea, cols), centrada: true, ...extra })
    }
  }
  const fila = (texto: string, extra: Partial<LineaTicket> = {}) => {
    if (!texto) return
    lineas.push({ texto, ...extra })
  }
  const monto = (m: unknown) => formatearMonto(m, moneda)
  const parrafo = (texto: string, extra: Partial<LineaTicket> = {}) => {
    for (const l of envolver(texto, cols)) lineas.push({ texto: l, ...extra })
  }

  centrada(doc.empresa?.razon_social || '', { negrita: true })
  centrada(doc.empresa?.rif ? `RIF: ${doc.empresa.rif}` : '')
  centrada(doc.empresa?.direccion || '')
  if (doc.empresa?.telefono) centrada(`Tel: ${doc.empresa.telefono}`)
  fila('')

  centrada(doc.titulo || '', { negrita: true, doble: true })
  fila(columnas(`N° ${doc.numero}`, formatearFecha(doc.fecha), cols))
  if (doc.numero_control) fila(`N° CONTROL: ${doc.numero_control}`)
  const operador = [doc.cajero ? `Cajero: ${doc.cajero}` : '', doc.caja ? `Caja: ${doc.caja}` : '']
    .filter(Boolean)
    .join('  ')
  parrafo(operador)
  fila(divisoria(cols))

  if (doc.cliente?.nombre) {
    parrafo(`Cliente: ${doc.cliente.nombre}${doc.cliente.documento ? ` (${doc.cliente.documento})` : ''}`)
    if (doc.cliente.direccion) parrafo(doc.cliente.direccion)
    if (doc.cliente.telefono) parrafo(`Tel: ${doc.cliente.telefono}`)
    fila(divisoria(cols))
  }

  fila(columnas('CANT  DESCRIPCION', 'IMPORTE', cols), { negrita: true })
  for (const item of doc.items || []) {
    const cantidad = `${Number(item.cantidad) || 0}`.padEnd(4).slice(0, 4)
    const importe = monto(item.subtotal)
    const disponibles = cols - cantidad.length - importe.length - 1
    const lineasDesc = envolver(String(item.descripcion ?? ''), Math.max(disponibles, 8))
    const primera = lineasDesc.shift() ?? ''
    fila(columnas(`${cantidad}${primera}`, importe, cols))
    for (const restante of lineasDesc) fila(`    ${restante}`)
    if (Number(item.descuento) > 0) {
      fila(columnas('    descuento', `-${monto(item.descuento)}`, cols))
    }
  }

  fila(divisoria(cols))
  fila(columnas('Subtotal', monto(doc.subtotal), cols))
  if (Number(doc.descuento) > 0) fila(columnas('Descuento', `-${monto(doc.descuento)}`, cols))
  const etiquetaIva = doc.alicuota_iva != null ? `IVA (${doc.alicuota_iva}%)` : 'IVA'
  fila(columnas(etiquetaIva, monto(doc.impuesto), cols))
  fila(columnas('TOTAL', monto(doc.total), cols), { negrita: true, doble: true })

  // Una línea por dato: en 58mm tres datos juntos no entran.
  const pagos: string[] = []
  if (doc.metodo_pago) pagos.push(`Pago: ${doc.metodo_pago}`)
  if (doc.monto_pagado != null) pagos.push(`Recibido: ${monto(doc.monto_pagado)}`)
  if (doc.cambio != null && Number(doc.cambio) !== 0) pagos.push(`Cambio: ${monto(doc.cambio)}`)
  if (pagos.length) {
    fila(divisoria(cols))
    for (const pago of pagos) parrafo(pago)
  }

  if (doc.notas) {
    fila(divisoria(cols))
    parrafo(doc.notas)
  }
  if (doc.pie) {
    fila('')
    parrafo(doc.pie)
  }

  return lineas
}

/* ---------- Ticket de apuesta hípica (FASE 7b) ---------- */

export interface SeleccionApuesta {
  caballo: string
  numero?: number | null
  odd?: number | null
  posicion_predicha?: number | null
  resultado_posicion?: number | null
  ganador?: boolean
}

export interface DocumentoApuesta {
  empresa: DatosEmpresa
  numero_ticket: string
  fecha: string
  cajero?: string
  hipodromo: string
  numero_carrera: number
  carrera_fecha?: string
  tipo_apuesta: string
  selecciones: SeleccionApuesta[]
  monto: number
  odd_total: number
  payout_potencial: number
  estado: string
  ganancia?: number | null
  moneda?: string
  cobrada?: boolean
  reimpresion?: boolean
  notas?: string
  pie?: string
}

export const ETIQUETAS_TIPO_APUESTA: Record<string, string> = {
  win: 'WIN (ganador)',
  place: 'PLACE (puesto)',
  each_way: 'EACH-WAY (gana o puesto)',
  exacta: 'EXACTA (1o y 2o)',
  trifecta: 'TRIFECTA (1o, 2o y 3o)',
}

export const ETIQUETAS_ESTADO_APUESTA: Record<string, string> = {
  pendiente: 'PENDIENTE',
  ganada: 'GANADA',
  perdida: 'PERDIDA',
  anulada: 'ANULADA',
}

/** Convierte una apuesta en las líneas del ticket térmico. Función pura. */
export function construirLineasTicketApuesta(doc: DocumentoApuesta, ancho: AnchoTicket = 80): LineaTicket[] {
  const cols = COLUMNAS_POR_ANCHO[ancho] ?? COLUMNAS_POR_ANCHO[80]
  const moneda = doc.moneda || ''
  const lineas: LineaTicket[] = []

  const centrada = (texto: string, extra: Partial<LineaTicket> = {}) => {
    if (!texto) return
    for (const linea of envolver(texto, cols)) lineas.push({ texto: centrar(linea, cols), centrada: true, ...extra })
  }
  const fila = (texto: string, extra: Partial<LineaTicket> = {}) => {
    if (!texto) return
    lineas.push({ texto, ...extra })
  }
  const parrafo = (texto: string, extra: Partial<LineaTicket> = {}) => {
    for (const l of envolver(texto, cols)) lineas.push({ texto: l, ...extra })
  }
  const monto = (m: unknown) => formatearMonto(m, moneda)

  centrada(doc.empresa?.razon_social || '', { negrita: true })
  centrada(doc.empresa?.rif ? `RIF: ${doc.empresa.rif}` : '')
  centrada(doc.empresa?.telefono ? `Tel: ${doc.empresa.telefono}` : '')
  fila('')

  centrada(doc.reimpresion ? 'REIMPRESION' : 'TICKET DE APUESTA', { negrita: true, doble: true })
  fila(columnas(`Ticket: ${doc.numero_ticket}`, formatearFecha(doc.fecha), cols))
  if (doc.cajero) parrafo(`Cajero: ${doc.cajero}`)
  fila(divisoria(cols))

  parrafo(`Carrera: ${doc.hipodromo} #${doc.numero_carrera}${doc.carrera_fecha ? ` - ${formatearFecha(doc.carrera_fecha)}` : ''}`)
  fila(`Tipo: ${ETIQUETAS_TIPO_APUESTA[doc.tipo_apuesta] || doc.tipo_apuesta}`)
  fila(divisoria(cols))

  fila('SELECCIONES', { negrita: true })
  for (const s of doc.selecciones || []) {
    const numero = s.numero != null ? `${s.numero} ` : ''
    const odd = s.odd != null ? ` x${Number(s.odd).toFixed(2)}` : ''
    fila(columnas(`${numero}${s.caballo}`, odd.trim(), cols))
    const detalles: string[] = []
    if (s.posicion_predicha != null) detalles.push(`Pos. predicha: ${s.posicion_predicha}o`)
    if (s.resultado_posicion != null) detalles.push(`Resultado: ${s.resultado_posicion}o${s.ganador ? ' OK' : ''}`)
    // Una línea por dato: en 58mm los dos juntos no entran.
    for (const detalle of detalles) fila(`    ${detalle}`)
  }

  fila(divisoria(cols))
  fila(columnas('Monto apostado', monto(doc.monto), cols))
  fila(columnas('Odd total', Number(doc.odd_total || 0).toFixed(2), cols))
  fila(columnas('Pago potencial', monto(doc.payout_potencial), cols))
  if (doc.estado === 'ganada' && doc.ganancia != null) {
    fila(columnas('GANANCIA', monto(doc.ganancia), cols), { negrita: true, doble: true })
    if (doc.cobrada) fila('PAGADA')
  }
  fila(columnas('Estado', ETIQUETAS_ESTADO_APUESTA[doc.estado] || doc.estado, cols), { negrita: true })

  if (doc.notas) {
    fila(divisoria(cols))
    parrafo(doc.notas)
  }
  centrada('Conserve este ticket para cobrar', { negrita: true })
  if (doc.pie) {
    fila('')
    parrafo(doc.pie)
  }

  return lineas
}

/** Documento de prueba para configurar la impresora. */
export function documentoDePrueba(empresa: DatosEmpresa, extras: Partial<DocumentoVenta> = {}): DocumentoVenta {
  return {
    titulo: 'TICKET DE PRUEBA',
    empresa,
    cliente: { nombre: 'Cliente de prueba', documento: 'V-12345678' },
    numero: 'TEST-0001',
    numero_control: 'A-00000001',
    fecha: new Date().toISOString(),
    cajero: 'admin',
    caja: 'Caja 1',
    items: [
      { descripcion: 'Producto de prueba', cantidad: 2, precio_unitario: 5, subtotal: 10 },
      { descripcion: 'Impuesto incluido', cantidad: 1, precio_unitario: 1.6, subtotal: 1.6 },
    ],
    subtotal: 10,
    descuento: 0,
    impuesto: 1.6,
    alicuota_iva: 16,
    total: 11.6,
    moneda: 'USD',
    metodo_pago: 'Efectivo',
    monto_pagado: 15,
    cambio: 3.4,
    pie: 'Si puede leer esto, la impresora está configurada.',
    ...extras,
  }
}

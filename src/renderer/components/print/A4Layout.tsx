import { desgloseFiscal } from '@shared/fiscal'
import { formatearFecha, formatearMonto, type DocumentoVenta } from '@shared/print'

interface A4LayoutProps {
  documento: DocumentoVenta
  /** Muestra el bloque de firmas (facturas y notas de entrega) */
  mostrarFirma?: boolean
  /** Texto del bloque legal al pie */
  leyendaFiscal?: string
  className?: string
}

/**
 * Documento A4 (210x297mm): factura, nota de entrega o cotización.
 * Se imprime con `window.print()`; la clase `print-area` la usa el CSS de
 * impresión para ocultar el resto de la app (ver index.css).
 */
export default function A4Layout({ documento, mostrarFirma = true, leyendaFiscal, className = '' }: A4LayoutProps) {
  const moneda = documento.moneda || ''
  const fiscal = desgloseFiscal(documento)
  const monto = (n: unknown) => formatearMonto(n, moneda)

  return (
    <div
      className={`print-area bg-white text-black p-8 mx-auto ${className}`}
      style={{ width: '210mm', minHeight: '180mm', fontSize: '12px' }}
      data-testid="a4-layout"
    >
      {/* Encabezado */}
      <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-4">
        <div>
          <h1 className="text-xl font-bold uppercase">{documento.empresa.razon_social || 'TOG Admin'}</h1>
          {documento.empresa.rif && <p className="font-semibold">RIF: {documento.empresa.rif}</p>}
          {documento.empresa.direccion && <p>{documento.empresa.direccion}</p>}
          {documento.empresa.telefono && <p>Tel: {documento.empresa.telefono}</p>}
          {documento.empresa.email && <p>{documento.empresa.email}</p>}
        </div>
        <div className="text-right">
          <h2 className="text-lg font-bold uppercase">{documento.titulo}</h2>
          <p>
            <span className="font-semibold">N°:</span> {documento.numero}
          </p>
          {documento.numero_control && (
            <p>
              <span className="font-semibold">N° CONTROL:</span> {documento.numero_control}
            </p>
          )}
          <p>{formatearFecha(documento.fecha)}</p>
          {documento.cajero && <p>Cajero: {documento.cajero}</p>}
        </div>
      </div>

      {/* Cliente */}
      <div className="border border-black p-2 mb-4">
        <p>
          <span className="font-semibold">Cliente:</span> {documento.cliente?.nombre || 'Consumidor final'}
        </p>
        {documento.cliente?.documento && (
          <p>
            <span className="font-semibold">Documento / RIF:</span> {documento.cliente.documento}
          </p>
        )}
        {documento.cliente?.direccion && (
          <p>
            <span className="font-semibold">Dirección:</span> {documento.cliente.direccion}
          </p>
        )}
        {documento.cliente?.telefono && (
          <p>
            <span className="font-semibold">Teléfono:</span> {documento.cliente.telefono}
          </p>
        )}
      </div>

      {/* Detalle */}
      <table className="w-full border-collapse mb-4" data-testid="a4-items">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1 w-16">Cant.</th>
            <th className="py-1">Descripción</th>
            <th className="py-1 w-24 text-right">P. Unit.</th>
            <th className="py-1 w-20 text-right">Desc.</th>
            <th className="py-1 w-28 text-right">Importe</th>
          </tr>
        </thead>
        <tbody>
          {documento.items.map((item, i) => (
            <tr key={i} className="border-b border-gray-300 align-top">
              <td className="py-1">{item.cantidad}</td>
              <td className="py-1">{item.descripcion}</td>
              <td className="py-1 text-right">{monto(item.precio_unitario)}</td>
              <td className="py-1 text-right">{item.descuento ? monto(item.descuento) : '—'}</td>
              <td className="py-1 text-right">{monto(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totales */}
      <div className="flex justify-end mb-6">
        <table className="text-right" style={{ minWidth: '240px' }}>
          <tbody>
            <tr>
              <td className="pr-6 py-0.5">Base imponible:</td>
              <td className="py-0.5">{monto(fiscal.base_imponible)}</td>
            </tr>
            <tr>
              <td className="pr-6 py-0.5">
                IVA{documento.alicuota_iva != null ? ` (${documento.alicuota_iva}%)` : ''}:
              </td>
              <td className="py-0.5">{monto(fiscal.iva)}</td>
            </tr>
            <tr className="border-t border-black font-bold text-base">
              <td className="pr-6 py-1">TOTAL:</td>
              <td className="py-1">{monto(fiscal.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Pago */}
      {(documento.metodo_pago || documento.monto_pagado != null) && (
        <div className="border border-black p-2 mb-4">
          {documento.metodo_pago && (
            <p>
              <span className="font-semibold">Forma de pago:</span> {documento.metodo_pago}
            </p>
          )}
          {documento.monto_pagado != null && (
            <p>
              <span className="font-semibold">Monto recibido:</span> {monto(documento.monto_pagado)}
              {documento.cambio != null && ` · Cambio: ${monto(documento.cambio)}`}
            </p>
          )}
        </div>
      )}

      {documento.notas && <p className="mb-4 whitespace-pre-line">{documento.notas}</p>}

      {mostrarFirma && (
        <div className="flex justify-between mt-12">
          <div className="text-center">
            <div className="border-t border-black w-56 mt-10" />
            <p className="mt-1">Firma del cliente</p>
          </div>
          <div className="text-center">
            <div className="border-t border-black w-56 mt-10" />
            <p className="mt-1">Firma y sello</p>
          </div>
        </div>
      )}

      {(leyendaFiscal || documento.pie) && (
        <p className="text-xs mt-8 border-t border-gray-400 pt-2">{leyendaFiscal || documento.pie}</p>
      )}
    </div>
  )
}

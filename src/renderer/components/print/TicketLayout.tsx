import { construirLineasTicket, COLUMNAS_POR_ANCHO, type AnchoTicket, type DocumentoVenta } from '@shared/print'

interface TicketLayoutProps {
  documento: DocumentoVenta
  ancho?: AnchoTicket
  /** Máximo alto visible en la vista previa (px). Sin límite si se omite. */
  maxAlto?: number
  className?: string
}

const ANCHO_MM: Record<AnchoTicket, string> = { 58: '58mm', 80: '80mm' }

/**
 * Ticket térmico. Usa el mismo `construirLineasTicket` que el driver ESC/POS,
 * así la vista previa es exactamente lo que sale por la impresora.
 * Las tipografías de ticketera son monoespaciadas: de ahí el `pre`.
 */
export default function TicketLayout({ documento, ancho = 80, maxAlto, className = '' }: TicketLayoutProps) {
  const cols = COLUMNAS_POR_ANCHO[ancho] ?? COLUMNAS_POR_ANCHO[80]
  const lineas = construirLineasTicket(documento, ancho)

  return (
    <div
      className={`bg-white border border-gray-300 rounded-lg p-3 overflow-auto ${className}`}
      style={{ width: ANCHO_MM[ancho], maxHeight: maxAlto }}
      data-testid="ticket-layout"
    >
      <pre
        className="font-mono text-black whitespace-pre leading-snug"
        style={{ fontSize: ancho === 58 ? '10px' : '12px', margin: 0 }}
        data-columnas={cols}
      >
        {lineas.map((linea, i) => (
          <span
            key={i}
            style={{ fontWeight: linea.negrita || linea.doble ? 700 : 400, fontSize: linea.doble ? '1.25em' : undefined }}
          >
            {linea.texto + '\n'}
          </span>
        ))}
      </pre>
    </div>
  )
}

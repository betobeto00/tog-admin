import { useTranslation } from 'react-i18next'
import { Printer, X } from 'lucide-react'
import type { DocumentoVenta } from '@shared/print'
import A4Layout from './A4Layout'

interface A4PrintModalProps {
  open: boolean
  documento: DocumentoVenta | null
  onClose: () => void
}

/**
 * Vista A4 de una factura/nota de entrega lista para imprimir.
 *
 * Renderiza el mismo `A4Layout` que usan los demás documentos A4 y llama a
 * `window.print()`: el CSS de impresión (`index.css`) oculta todo menos
 * `.print-area`, así que el comprobante sale solo, con su número y su N° de
 * control fiscal.
 */
export default function A4PrintModal({ open, documento, onClose }: A4PrintModalProps) {
  const { t } = useTranslation()

  if (!open || !documento) return null

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black/60 p-6" data-testid="a4-print-modal">
      <div className="flex items-center justify-end gap-2 mb-3 no-print">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Printer className="w-4 h-4" /> {t('print.printA4')}
        </button>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white rounded-lg hover:bg-gray-100"
        >
          <X className="w-4 h-4" /> {t('common.close')}
        </button>
      </div>

      <div className="mx-auto shadow-2xl" style={{ width: '210mm' }}>
        <A4Layout documento={documento} />
      </div>
    </div>
  )
}

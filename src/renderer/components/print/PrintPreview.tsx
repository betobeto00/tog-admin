import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Printer, X, FileText, Receipt, Loader2 } from 'lucide-react'
import type { AnchoTicket, DocumentoVenta } from '@shared/print'
import { useToast } from '../ui/Toast'
import { callApi } from '../../lib/api-client'
import TicketLayout from './TicketLayout'
import A4Layout from './A4Layout'

interface PrintPreviewProps {
  documento: DocumentoVenta
  /** id de la venta para reimprimir desde el backend (opcional si el doc ya está armado) */
  ventaId?: number
  anchoTicket?: AnchoTicket
  onClose: () => void
}

type Pestana = 'ticket' | 'a4'

/**
 * Vista previa antes de imprimir: ticket térmico (ESC/POS en la ticketera) o
 * documento A4 (`window.print()`, sirve para imprimir o guardar PDF).
 */
export default function PrintPreview({ documento, ventaId, anchoTicket = 80, onClose }: PrintPreviewProps) {
  const { t } = useTranslation()
  const toast = useToast()
  const [pestana, setPestana] = useState<Pestana>('ticket')
  const [imprimiendo, setImprimiendo] = useState(false)

  const imprimirTicket = async () => {
    setImprimiendo(true)
    try {
      const res = await callApi<{ success: boolean; error?: string }>('print:ticket', ventaId ? { venta_id: ventaId } : {})
      if (res?.success) {
        toast.success(t('print.sentToPrinter'))
      } else {
        toast.error(res?.error || t('print.printError'))
      }
    } catch (err: any) {
      toast.error(err?.message || t('print.printError'))
    } finally {
      setImprimiendo(false)
    }
  }

  const imprimirA4 = () => {
    // El CSS de impresión (index.css) deja visible solo `.print-area`.
    window.print()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Printer className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{t('print.previewTitle')}</h2>
              <p className="text-xs text-gray-500">
                {documento.titulo} N° {documento.numero}
                {documento.numero_control ? ` · ${documento.numero_control}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" title={t('common.close')}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex gap-2 px-5 pt-4">
          <button
            onClick={() => setPestana('ticket')}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border ${
              pestana === 'ticket' ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'
            }`}
          >
            <Receipt className="w-4 h-4" /> {t('print.tabTicket')}
          </button>
          <button
            onClick={() => setPestana('a4')}
            className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border ${
              pestana === 'a4' ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'
            }`}
          >
            <FileText className="w-4 h-4" /> {t('print.tabA4')}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5 bg-gray-50">
          {pestana === 'ticket' ? (
            <div className="flex justify-center">
              <TicketLayout documento={documento} ancho={anchoTicket} maxAlto={520} />
            </div>
          ) : (
            <div className="overflow-auto">
              <A4Layout documento={documento} mostrarFirma={documento.titulo !== 'TICKET'} />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
            {t('common.cancel')}
          </button>
          <button
            onClick={imprimirA4}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <FileText className="w-4 h-4" /> {t('print.printA4')}
          </button>
          <button
            onClick={imprimirTicket}
            disabled={imprimiendo}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
          >
            {imprimiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            {t('print.printTicket')}
          </button>
        </div>
      </div>
    </div>
  )
}

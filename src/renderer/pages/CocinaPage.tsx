import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChefHat, RefreshCw, Clock, CheckCircle, CookingPot } from 'lucide-react'
import { useToast } from '../components/ui/Toast'
import { formatDateTime } from '../lib/utils'
import { callApi } from '../lib/api-client'

interface ComandaItem {
  id: number
  comanda_id: number
  producto_id: number | null
  producto_nombre?: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  estado: string
  notas: string | null
}
interface Comanda {
  id: number
  mesa_id: number
  mesa_nombre: string
  estado: string
  creado_en: string
  notas: string | null
  detalles: ComandaItem[]
}

const ITEM_ESTADO_STYLES: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  en_preparacion: 'bg-orange-100 text-orange-700',
  listo: 'bg-blue-100 text-blue-700',
  servido: 'bg-green-100 text-green-700',
  cancelado: 'bg-gray-100 text-gray-500',
}

export default function CocinaPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const [comandas, setComandas] = useState<Comanda[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const list = await callApi<Comanda[]>('comandas:list', { activas: true })
      const pendientes = (Array.isArray(list) ? list : []).filter((c) =>
        c.detalles.some((d) => ['pendiente', 'en_preparacion', 'listo'].includes(d.estado))
      )
      setComandas(pendientes)
    } catch {
      setComandas([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const interval = setInterval(load, 20000)
    return () => clearInterval(interval)
  }, [])

  const markItem = async (item: ComandaItem, estado: string) => {
    try {
      await callApi('comandas:mark-item', { comanda_id: item.comanda_id, detalle_id: item.id, estado })
      await load()
    } catch (err: any) {
      toast.error(err?.message || t('restaurant.error'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('restaurant.kitchenTitle')}</h1>
          <p className="text-sm text-gray-500">{comandas.length} {t('restaurant.orders').toLowerCase()}</p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
          <RefreshCw className="w-4 h-4" /> {t('restaurant.refresh')}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
      ) : comandas.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ChefHat className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{t('restaurant.kitchenEmpty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {comandas.map((comanda) => (
            <div key={comanda.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold">{comanda.mesa_nombre}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatDateTime(comanda.creado_en)}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                  comanda.estado === 'servida' ? 'bg-green-500' : 'bg-orange-500'
                }`}>
                  {comanda.estado === 'servida' ? t('restaurant.itemServed') : t('restaurant.itemPreparing')}
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {comanda.detalles.map((item) => {
                  const activo = ['pendiente', 'en_preparacion', 'listo'].includes(item.estado)
                  if (!activo) return null
                  return (
                    <div key={item.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          <span className="font-bold mr-1">{item.cantidad}×</span>{item.descripcion}
                        </p>
                        {item.notas && <p className="text-xs text-gray-400 mt-0.5">📝 {item.notas}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex text-xs font-medium px-2 py-1 rounded-full ${ITEM_ESTADO_STYLES[item.estado] || ''}`}>
                          {item.estado === 'pendiente' ? t('restaurant.itemPending')
                            : item.estado === 'en_preparacion' ? t('restaurant.itemPreparing')
                            : t('restaurant.itemReady')}
                        </span>
                        {item.estado === 'pendiente' && (
                          <button onClick={() => markItem(item, 'en_preparacion')}
                            className="px-2.5 py-1.5 text-xs font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 flex items-center gap-1">
                            <CookingPot className="w-3 h-3" /> {t('restaurant.markPreparing')}
                          </button>
                        )}
                        {item.estado === 'en_preparacion' && (
                          <button onClick={() => markItem(item, 'listo')}
                            className="px-2.5 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> {t('restaurant.markReady')}
                          </button>
                        )}
                        {item.estado === 'listo' && (
                          <button onClick={() => markItem(item, 'servido')}
                            className="px-2.5 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> {t('restaurant.markServed')}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
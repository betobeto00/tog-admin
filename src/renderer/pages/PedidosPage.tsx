import { useTranslation } from 'react-i18next'
import { ClipboardList } from 'lucide-react'
import { useActiveModules } from '../hooks/useModules'

export default function PedidosPage() {
  const { t } = useTranslation()
  const { isActive } = useActiveModules()

  if (!isActive('distribuidor')) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
        <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium text-gray-500">{t('pedidos.notActiveTitle')}</p>
        <p className="text-sm mt-1">{t('pedidos.notActiveHint')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('pedidos.title')}</h1>
        <p className="text-sm text-gray-500">{t('pedidos.subtitle')}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
        <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium text-gray-500">{t('pedidos.comingSoonTitle')}</p>
        <p className="text-sm mt-1">{t('pedidos.comingSoonBody')}</p>
      </div>
    </div>
  )
}

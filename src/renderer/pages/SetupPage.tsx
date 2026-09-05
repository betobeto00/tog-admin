import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Network, Link2, Monitor, Loader2 } from 'lucide-react'
import { callApi } from '../lib/api-client'
import { useToast } from '../components/ui/Toast'

interface Props {
  onLinked: () => void
}

export default function SetupPage({ onLinked }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const [baseUrl, setBaseUrl] = useState('')
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [linking, setLinking] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!baseUrl.trim() || !codigo.trim() || !nombre.trim()) return
    setLinking(true)
    try {
      const result = await callApi<{ success: boolean; error?: string }>('red:vincular', {
        baseUrl: baseUrl.trim(),
        codigo: codigo.trim(),
        nombre: nombre.trim(),
      })
      if (result.success) {
        toast.success(t('setup.linked'))
        onLinked()
      } else {
        toast.error(result.error || t('setup.error'))
      }
    } catch (err: any) {
      toast.error(err?.message || t('setup.error'))
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <Network className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('setup.title')}</h1>
          <p className="text-gray-500 mt-1 text-sm">{t('setup.subtitle')}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('setup.pcName')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Monitor className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder={t('setup.pcNamePlaceholder')}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('setup.baseIp')}
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="192.168.1.10"
                className="block w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">{t('setup.baseIpHelp')}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('setup.linkCode')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Link2 className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  placeholder="ABC123"
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">{t('setup.linkCodeHelp')}</p>
            </div>

            <button
              type="submit"
              disabled={linking || !baseUrl.trim() || !codigo.trim() || !nombre.trim()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              {linking ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {t('setup.linking')}
                </>
              ) : (
                <>
                  <Link2 className="w-5 h-5" />
                  {t('setup.linkButton')}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
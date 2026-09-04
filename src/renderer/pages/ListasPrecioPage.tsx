import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Tag, Trash2, Pencil } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import { callApi } from '../lib/api-client'
import { useActiveModules } from '../hooks/useModules'

interface ListaPrecio {
  id: number; nombre: string; factor: number; activo: number
}

export default function ListasPrecioPage() {
  const { t } = useTranslation()
  const { isActive } = useActiveModules()
  const toast = useToast()

  const [listas, setListas] = useState<ListaPrecio[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ListaPrecio | null>(null)
  const [saving, setSaving] = useState(false)
  const [nombre, setNombre] = useState('')
  const [factor, setFactor] = useState('1')
  const [deleteTarget, setDeleteTarget] = useState<ListaPrecio | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const loadData = async () => {
    setListas(await callApi<ListaPrecio[]>('listas-precio:list'))
  }

  useEffect(() => {
    loadData().catch(() => {})
  }, [])

  const openCreate = () => {
    setEditing(null)
    setNombre('')
    setFactor('1')
    setModalOpen(true)
  }

  const openEdit = (l: ListaPrecio) => {
    setEditing(l)
    setNombre(l.nombre)
    setFactor(String(l.factor))
    setModalOpen(true)
  }

  const save = async () => {
    const factorNum = Number(factor)
    if (!nombre.trim()) {
      toast.error(t('listasPrecio.nameRequired'))
      return
    }
    if (!factorNum || factorNum <= 0) {
      toast.error(t('listasPrecio.factorRequired'))
      return
    }
    setSaving(true)
    try {
      const res = editing
        ? await callApi<{ success: boolean; error?: string }>('listas-precio:update', { id: editing.id, data: { nombre: nombre.trim(), factor: factorNum } })
        : await callApi<{ success: boolean; error?: string }>('listas-precio:create', { nombre: nombre.trim(), factor: factorNum })
      if (!res.success) throw new Error(res.error)
      toast.success(editing ? t('common.update') + ' ✓' : t('common.create') + ' ✓')
      setModalOpen(false)
      await loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Error guardando lista')
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (l: ListaPrecio) => {
    setBusyId(l.id)
    try {
      await callApi('listas-precio:update', { id: l.id, data: { activo: l.activo ? 0 : 1 } })
      await loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Error actualizando lista')
    } finally {
      setBusyId(null)
    }
  }

  const eliminar = async () => {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id)
    try {
      await callApi('listas-precio:delete', { id: deleteTarget.id })
      toast.success(t('common.delete') + ' ✓')
      await loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Error eliminando lista')
    } finally {
      setBusyId(null)
      setDeleteTarget(null)
    }
  }

  const fmtFactor = (f: number) =>
    f.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  if (!isActive('distribuidor')) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
        <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium text-gray-500">{t('listasPrecio.notActiveTitle')}</p>
        <p className="text-sm mt-1">{t('listasPrecio.notActiveHint')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('listasPrecio.title')}</h1>
          <p className="text-sm text-gray-500">{listas.length} {t('listasPrecio.registered')}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> {t('listasPrecio.new')}
        </button>
      </div>

      {listas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Tag className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{t('listasPrecio.empty')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-4 py-3">{t('listasPrecio.colNombre')}</th>
                <th className="px-4 py-3">{t('listasPrecio.colFactor')}</th>
                <th className="px-4 py-3">{t('listasPrecio.colEstado')}</th>
                <th className="px-4 py-3 text-right">{t('listasPrecio.colAcciones')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {listas.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{l.nombre}</td>
                  <td className="px-4 py-3 text-gray-700">{fmtFactor(l.factor)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                        l.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                      onClick={() => toggleActivo(l)}
                      title={l.activo ? t('listasPrecio.desactivar') : t('listasPrecio.activar')}
                    >
                      {l.activo ? t('listasPrecio.activo') : t('listasPrecio.inactivo')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => openEdit(l)}
                        disabled={busyId === l.id}
                        className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                      >
                        <Pencil className="w-3.5 h-3.5 inline mr-0.5" /> {t('listasPrecio.edit')}
                      </button>
                      <button
                        onClick={() => setDeleteTarget(l)}
                        disabled={busyId === l.id}
                        className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline mr-0.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `${t('listasPrecio.edit')} — ${editing.nombre}` : t('listasPrecio.new')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('listasPrecio.nameLabel')} *</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder={t('listasPrecio.nameLabel')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('listasPrecio.factorLabel')} *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={factor}
              onChange={(e) => setFactor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">{t('listasPrecio.factorHint')}</p>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              {t('common.cancel')}
            </button>
            <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
              {saving ? t('common.saving') : editing ? t('common.update') : t('common.create')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={eliminar}
        title={t('listasPrecio.deleteTitle')}
        message={`${t('listasPrecio.deleteMessage')} "${deleteTarget?.nombre}"`}
        confirmText={t('common.delete')}
        danger
      />
    </div>
  )
}

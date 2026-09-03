import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Edit2, Trash2, Contact, Phone, Mail, MapPin } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { callApi } from '../lib/api-client'
import { useActiveModules } from '../hooks/useModules'

interface Cliente {
  id: number; nombre: string; documento: string | null; telefono: string | null
  email: string | null; direccion: string | null; limite_credito: number | null
  notas: string | null; activo: number; creado_en: string
}

const emptyForm = { nombre: '', documento: '', telefono: '', email: '', direccion: '', limite_credito: '', notas: '' }

export default function ClientesPage() {
  const { t } = useTranslation()
  const { isActive } = useActiveModules()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setClientes(await callApi<Cliente[]>('clientes:list'))
  }

  const filtered = clientes.filter((c) =>
    !search || c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.documento?.toLowerCase().includes(search.toLowerCase()) ||
    c.telefono?.includes(search)
  )

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  const openEdit = (c: Cliente) => {
    setEditing(c)
    setForm({
      nombre: c.nombre, documento: c.documento || '', telefono: c.telefono || '',
      email: c.email || '', direccion: c.direccion || '',
      limite_credito: c.limite_credito ? String(c.limite_credito) : '',
      notas: c.notas || '',
    })
    setModalOpen(true)
  }

  const save = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      const data = {
        ...form,
        documento: form.documento || undefined, telefono: form.telefono || undefined,
        email: form.email || undefined, direccion: form.direccion || undefined,
        limite_credito: form.limite_credito ? Number(form.limite_credito) : undefined,
        notas: form.notas || undefined,
      }
      if (editing) { await callApi('clientes:update', { id: editing.id, data }) }
      else { await callApi('clientes:create', data) }
      setModalOpen(false)
      await loadData()
    } finally { setSaving(false) }
  }

  const remove = async (id: number) => { await callApi('clientes:delete', { id }); await loadData() }

  if (!isActive('distribuidor')) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
        <Contact className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium text-gray-500">{t('clientes.notActiveTitle')}</p>
        <p className="text-sm mt-1">{t('clientes.notActiveHint')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('clientes.title')}</h1>
          <p className="text-sm text-gray-500">{clientes.length} {t('clientes.registered')}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> {t('clientes.new')}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={t('clientes.searchPlaceholder')}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400">
            <Contact className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{t('clientes.empty')}</p>
          </div>
        ) : filtered.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{c.nombre}</h3>
                {c.documento && <p className="text-xs text-gray-400 mt-0.5">{t('clientes.documento')}: {c.documento}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(c)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit2 className="w-4 h-4 text-gray-500" /></button>
                <button onClick={() => setDeleteTarget(c.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
              </div>
            </div>
            <div className="space-y-1.5 text-sm text-gray-600">
              {c.telefono && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-gray-400" /> {c.telefono}</div>}
              {c.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-gray-400" /> {c.email}</div>}
              {c.direccion && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-gray-400" /> {c.direccion}</div>}
              {!!c.limite_credito && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{t('clientes.creditLimit')}:</span>
                  <span className="font-medium text-gray-700">{c.limite_credito}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('clientes.edit') : t('clientes.new')} wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.name')} *</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientes.documento')}</label>
              <input value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })}
                placeholder={t('clientes.documentoPlaceholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientes.phone')}</label>
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientes.email')}</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientes.address')}</label>
              <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientes.creditLimit')}</label>
              <input type="number" min="0" step="0.01" value={form.limite_credito} onChange={(e) => setForm({ ...form, limite_credito: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">{t('clientes.creditLimitHint')}</p>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.notes')}</label>
              <textarea rows={2} value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
            <button onClick={save} disabled={saving || !form.nombre.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
              {saving ? t('common.saving') : editing ? t('common.save') : t('common.create')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) remove(deleteTarget) }}
        title={t('clientes.deleteTitle')} message={t('clientes.deleteMessage')}
        confirmText={t('common.delete')} danger />
    </div>
  )
}
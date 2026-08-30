import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Search, Edit2, Trash2, Truck, Phone, Mail, MapPin } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'

interface Proveedor {
  id: number; nombre: string; ein: string | null; telefono: string | null
  email: string | null; direccion: string | null; notas: string | null
  activo: number; creado_en: string
}

const emptyForm = { nombre: '', ein: '', telefono: '', email: '', direccion: '', notas: '' }

export default function ProveedoresPage() {
  const { t, i18n } = useTranslation()
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Proveedor | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setProveedores(await window.api.proveedores.list())
  }

  const filtered = proveedores.filter((p) =>
    !search || p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.ein?.toLowerCase().includes(search.toLowerCase()) ||
    p.telefono?.includes(search)
  )

  const openCreate = () => { setEditing(null); setForm(emptyForm); setModalOpen(true) }
  const openEdit = (p: Proveedor) => {
    setEditing(p)
    setForm({ nombre: p.nombre, ein: p.ein || '', telefono: p.telefono || '', email: p.email || '', direccion: p.direccion || '', notas: p.notas || '' })
    setModalOpen(true)
  }

  const save = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      const data = { ...form, ein: form.ein || undefined, telefono: form.telefono || undefined, email: form.email || undefined, direccion: form.direccion || undefined, notas: form.notas || undefined }
      if (editing) { await window.api.proveedores.update(editing.id, data) }
      else { await window.api.proveedores.create(data) }
      setModalOpen(false)
      await loadData()
    } finally { setSaving(false) }
  }

  const remove = async (id: number) => { await window.api.proveedores.delete(id); await loadData() }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('proveedores.title')}</h1>
          <p className="text-sm text-gray-500">{proveedores.length} {i18n.language === 'en' ? 'registered suppliers' : 'proveedores registrados'}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> {i18n.language === 'en' ? 'New Supplier' : 'Nuevo Proveedor'}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={i18n.language === 'en' ? 'Search by name, EIN or phone...' : 'Buscar por nombre, EIN o teléfono...'}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-400">
            <Truck className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{i18n.language === 'en' ? 'No suppliers found' : 'No se encontraron proveedores'}</p>
          </div>
        ) : filtered.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{p.nombre}</h3>
                {p.ein && <p className="text-xs text-gray-400 mt-0.5">EIN: {p.ein}</p>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit2 className="w-4 h-4 text-gray-500" /></button>
                <button onClick={() => setDeleteTarget(p.id)} className="p-1.5 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
              </div>
            </div>
            <div className="space-y-1.5 text-sm text-gray-600">
              {p.telefono && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-gray-400" /> {p.telefono}</div>}
              {p.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-gray-400" /> {p.email}</div>}
              {p.direccion && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-gray-400" /> {p.direccion}</div>}
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('proveedores.edit') : t('proveedores.new')} wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.name')} *</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('proveedores.taxId')}</label>
              <input value={form.ein} onChange={(e) => setForm({ ...form, ein: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('proveedores.phone')}</label>
              <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('proveedores.email')}</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('proveedores.address')}</label>
              <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
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
        title={i18n.language === 'en' ? 'Delete supplier' : 'Eliminar proveedor'} message={i18n.language === 'en' ? 'Are you sure? This action cannot be undone.' : '¿Estás seguro? Esta acción no se puede deshacer.'}
        confirmText={t('common.delete')} danger />
    </div>
  )
}

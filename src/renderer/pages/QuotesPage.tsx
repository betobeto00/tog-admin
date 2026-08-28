import { useEffect, useState } from 'react'
import { useAuthStore } from '../stores/auth.store'
import {
  Plus, Search, Eye, Edit2, Trash2, FileText, Send, Clock, CheckCircle,
  XCircle, Printer, Mail, DollarSign
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { formatCurrency, formatDateTime } from '../lib/utils'

interface Quote { id: number; numero_cotizacion: number; fecha: string; fecha_vencimiento: string | null; cliente_nombre: string; cliente_email: string | null; cliente_telefono: string | null; cliente_direccion: string | null; subtotal: number; impuesto: number; descuento: number; total: number; notas: string | null; estado: string; usuario_nombre: string; creado_en: string }
interface QuoteDetalle { id?: number; producto_id: number | null; producto_nombre?: string; descripcion: string; cantidad: number; precio_unitario: number; descuento: number; subtotal: number }
interface Producto { id: number; nombre: string; precio_venta: number; stock: number }

const STATUS_COLORS: Record<string, string> = { pendiente: 'bg-yellow-100 text-yellow-700', aprobada: 'bg-green-100 text-green-700', rechazada: 'bg-red-100 text-red-700', convertida: 'bg-blue-100 text-blue-700', vencida: 'bg-gray-100 text-gray-500' }
const STATUS_ICONS: Record<string, any> = { pendiente: Clock, aprobada: CheckCircle, rechazada: XCircle, convertida: FileText, vencida: Clock }

export default function QuotesPage() {
  const usuario = useAuthStore((s) => s.usuario)
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // Modal nueva/ver quote
  const [modalOpen, setModalOpen] = useState(false)
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null)
  const [viewQuote, setViewQuote] = useState<(Quote & { detalles: QuoteDetalle[] }) | null>(null)
  const [viewOpen, setViewOpen] = useState(false)

  // Form
  const [cliente, setCliente] = useState({ nombre: '', email: '', telefono: '', direccion: '' })
  const [items, setItems] = useState<QuoteDetalle[]>([])
  const [searchProd, setSearchProd] = useState('')
  const [notas, setNotas] = useState('')
  const [fechaVenc, setFechaVenc] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

  useEffect(() => { loadData() }, [filterStatus])

  const loadData = async () => {
    setLoading(true)
    const [q, p] = await Promise.all([
      window.api.quotes.list({ estado: filterStatus || undefined, search: search || undefined }),
      window.api.productos.list(),
    ])
    setQuotes(q)
    setProductos(p)
    setLoading(false)
  }

  const searchProducts = searchProd.trim()
    ? productos.filter((p) => p.nombre.toLowerCase().includes(searchProd.toLowerCase())).slice(0, 8)
    : []

  const addItem = (prod: Producto) => {
    setItems([...items, { producto_id: prod.id, descripcion: prod.nombre, cantidad: 1, precio_unitario: prod.precio_venta, descuento: 0, subtotal: prod.precio_unitario }])
    setSearchProd('')
  }

  const addCustomItem = () => {
    setItems([...items, { producto_id: null, descripcion: '', cantidad: 1, precio_unitario: 0, descuento: 0, subtotal: 0 }])
  }

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(items.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      updated.subtotal = updated.cantidad * updated.precio_unitario * (1 - updated.descuento / 100)
      return updated
    }))
  }

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx))

  const subtotal = items.reduce((acc, i) => acc + i.subtotal, 0)
  const [taxRate, setTaxRate] = useState(0)
  useEffect(() => { window.api.config.get().then((cfg: any[]) => { const r = cfg.find((c: any) => c.clave === 'sales_tax_rate'); if (r) setTaxRate(parseFloat(r.valor) / 100) }) }, [])
  const impuesto = subtotal * taxRate
  const total = subtotal + impuesto

  const openCreate = () => {
    setEditingQuote(null); setCliente({ nombre: '', email: '', telefono: '', direccion: '' })
    setItems([]); setNotas(''); setFechaVenc(''); setModalOpen(true)
  }

  const openEdit = async (q: Quote) => {
    const completa = await window.api.quotes.getById(q.id)
    setEditingQuote(q)
    setCliente({ nombre: completa.cliente_nombre, email: completa.cliente_email || '', telefono: completa.cliente_telefono || '', direccion: completa.cliente_direccion || '' })
    setItems(completa.detalles || [])
    setNotas(completa.notas || ''); setFechaVenc(completa.fecha_vencimiento || '')
    setModalOpen(true)
  }

  const openView = async (q: Quote) => {
    const completa = await window.api.quotes.getById(q.id)
    setViewQuote(completa); setViewOpen(true)
  }

  const saveQuote = async () => {
    if (!cliente.nombre.trim() || items.length === 0 || saving) return
    setSaving(true)
    try {
      const data = {
        cliente_nombre: cliente.nombre, cliente_email: cliente.email || undefined, cliente_telefono: cliente.telefono || undefined, cliente_direccion: cliente.direccion || undefined,
        subtotal, impuesto, descuento: 0, total, notas: notas || undefined, fecha_vencimiento: fechaVenc || undefined,
        usuario_id: usuario!.id,
        detalles: items.map((i) => ({ producto_id: i.producto_id, descripcion: i.descripcion, cantidad: i.cantidad, precio_unitario: i.precio_unitario, descuento: i.descuento, subtotal: i.subtotal })),
      }
      if (editingQuote) { await window.api.quotes.update(editingQuote.id, { ...data, estado: editingQuote.estado }) }
      else { await window.api.quotes.create(data) }
      setModalOpen(false); await loadData()
    } finally { setSaving(false) }
  }

  const changeStatus = async (id: number, estado: string) => {
    await window.api.quotes.update(id, { estado })
    await loadData()
    if (viewQuote?.id === id) { const updated = await window.api.quotes.getById(id); setViewQuote(updated) }
  }

  const removeQuote = async (id: number) => {
    await window.api.quotes.delete(id); await loadData()
  }

  // Generar HTML para imprimir
  const printQuote = (q: any) => {
    const rows = q.detalles?.map((d: any) =>
      `<tr><td>${d.descripcion}</td><td style="text-align:center">${d.cantidad}</td><td style="text-align:right">${formatCurrency(d.precio_unitario)}</td><td style="text-align:right">${formatCurrency(d.subtotal)}</td></tr>`
    ).join('') || ''
    const win = window.open('', '_blank', 'width=400,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><style>
      body{font-family:monospace;font-size:11px;width:360px;margin:0 auto;padding:15px}
      h2{text-align:center;margin:5px 0;font-size:14px}
      table{width:100%;border-collapse:collapse;margin:8px 0}
      td,th{padding:3px 0;font-size:11px}
      .total{font-weight:bold;font-size:13px;border-top:1px dashed #000;padding-top:5px;margin-top:5px}
      .right{text-align:right}.center{text-align:center}
      hr{border:none;border-top:1px dashed #000;margin:8px 0}
      .label{color:#666;font-size:10px}
    </style></head><body>
      <h2>QUOTE / ESTIMATE</h2>
      <div class="center">#${String(q.numero_cotizacion).padStart(6, '0')}</div>
      <div class="center" style="font-size:10px;color:#666">${formatDateTime(q.fecha)}</div>
      ${q.fecha_vencimiento ? `<div class="center" style="font-size:10px;color:#999">Valid until: ${q.fecha_vencimiento}</div>` : ''}
      <hr>
      <div class="label">BILL TO:</div>
      <div><strong>${q.cliente_nombre}</strong></div>
      ${q.cliente_email ? `<div>${q.cliente_email}</div>` : ''}
      ${q.cliente_telefono ? `<div>${q.cliente_telefono}</div>` : ''}
      ${q.cliente_direccion ? `<div>${q.cliente_direccion}</div>` : ''}
      <hr>
      <table><thead><tr><th style="text-align:left">Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Subtotal</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <hr>
      <div class="right">Subtotal: ${formatCurrency(q.subtotal)}</div>
      ${q.impuesto > 0 ? `<div class="right">Tax: ${formatCurrency(q.impuesto)}</div>` : ''}
      <div class="right total">TOTAL: ${formatCurrency(q.total)}</div>
      ${q.notas ? `<hr><div class="label">NOTES:</div><div style="font-size:10px">${q.notas}</div>` : ''}
      <hr>
      <div class="center" style="margin-top:15px;font-size:10px;color:#666">Thank you for your business!</div>
    </body></html>`)
    win.document.close(); win.print()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
          <p className="text-sm text-gray-500">{quotes.length} quotes</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Quote
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => loadData()}
            placeholder="Search by client name or quote #..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">All Status</option>
          <option value="pendiente">Pending</option>
          <option value="aprobada">Approved</option>
          <option value="rechazada">Rejected</option>
          <option value="convertida">Converted</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Quote</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Client</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Date</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Valid Until</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Total</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" /></td></tr>
            ) : quotes.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400"><FileText className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>No quotes found</p></td></tr>
            ) : quotes.map((q) => {
              const Icon = STATUS_ICONS[q.estado] || Clock
              return (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono font-medium">#{String(q.numero_cotizacion).padStart(6, '0')}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{q.cliente_nombre}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(q.fecha)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{q.fecha_vencimiento || '—'}</td>
                  <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(q.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full capitalize ${STATUS_COLORS[q.estado] || ''}`}>
                      <Icon className="w-3 h-3" /> {q.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openView(q)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="View"><Eye className="w-4 h-4 text-gray-500" /></button>
                      <button onClick={() => printQuote(q)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Print"><Printer className="w-4 h-4 text-gray-500" /></button>
                      {q.estado === 'pendiente' && <button onClick={() => openEdit(q)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Edit"><Edit2 className="w-4 h-4 text-gray-500" /></button>}
                      {q.estado === 'pendiente' && <button onClick={() => setDeleteTarget(q.id)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4 text-red-400" /></button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Create/Edit Quote */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingQuote ? `Edit Quote #${String(editingQuote.numero_cotizacion).padStart(6, '0')}` : 'New Quote'} wide>
        <div className="space-y-4">
          {/* Client Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
              <input value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Client or Company name" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="client@email.com" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="(555) 123-4567" /></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <input value={cliente.direccion} onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="123 Main St, City, State" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
              <input type="date" value={fechaVenc} onChange={(e) => setFechaVenc(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          </div>

          {/* Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Items *</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchProd} onChange={(e) => setSearchProd(e.target.value)} placeholder="Search product to add..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm" />
              {searchProducts.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {searchProducts.map((p) => (
                    <button key={p.id} onClick={() => addItem(p)} className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 text-left text-sm">
                      <span>{p.nombre}</span><span className="text-gray-400">{formatCurrency(p.precio_venta)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={addCustomItem} className="text-xs text-blue-600 hover:text-blue-700 mb-2">+ Add custom line item</button>
            {items.length > 0 && (
              <div className="bg-gray-50 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Description</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 w-20">Qty</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 w-24">Unit Price</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 w-20">Disc %</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 w-24">Subtotal</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item, idx) => (
                      <tr key={idx} className="bg-white">
                        <td className="px-2 py-1"><input value={item.descripcion} onChange={(e) => updateItem(idx, 'descripcion', e.target.value)} className="w-full border-0 bg-transparent text-sm focus:ring-0 p-1" /></td>
                        <td className="px-2 py-1 text-center"><input type="number" min="1" value={item.cantidad} onChange={(e) => updateItem(idx, 'cantidad', Number(e.target.value))} className="w-14 text-center border border-gray-200 rounded px-1 py-1 text-sm" /></td>
                        <td className="px-2 py-1 text-center"><input type="number" step="0.01" min="0" value={item.precio_unitario} onChange={(e) => updateItem(idx, 'precio_unitario', Number(e.target.value))} className="w-20 text-center border border-gray-200 rounded px-1 py-1 text-sm" /></td>
                        <td className="px-2 py-1 text-center"><input type="number" step="1" min="0" max="100" value={item.descuento} onChange={(e) => updateItem(idx, 'descuento', Number(e.target.value))} className="w-14 text-center border border-gray-200 rounded px-1 py-1 text-sm" /></td>
                        <td className="px-3 py-1 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                        <td className="px-2 py-1 text-center"><button onClick={() => removeItem(idx)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3 text-red-400" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="flex justify-between items-start">
            <div className="w-1/2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Payment terms, special conditions..." />
            </div>
            <div className="w-64 bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
              {taxRate > 0 && <div className="flex justify-between"><span className="text-gray-500">Tax ({(taxRate * 100).toFixed(1)}%)</span><span>{formatCurrency(impuesto)}</span></div>}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200"><span>Total</span><span>{formatCurrency(total)}</span></div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
            <button onClick={saveQuote} disabled={saving || !cliente.nombre.trim() || items.length === 0}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
              {saving ? 'Saving...' : editingQuote ? 'Update Quote' : 'Create Quote'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal View Quote */}
      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title={viewQuote ? `Quote #${String(viewQuote.numero_cotizacion).padStart(6, '0')}` : ''} wide>
        {viewQuote && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-gray-500">Client</p><p className="font-medium">{viewQuote.cliente_nombre}</p></div>
              <div><p className="text-gray-500">Date</p><p className="font-medium">{formatDateTime(viewQuote.fecha)}</p></div>
              {viewQuote.cliente_email && <div><p className="text-gray-500">Email</p><p className="font-medium">{viewQuote.cliente_email}</p></div>}
              {viewQuote.cliente_telefono && <div><p className="text-gray-500">Phone</p><p className="font-medium">{viewQuote.cliente_telefono}</p></div>}
              {viewQuote.fecha_vencimiento && <div><p className="text-gray-500">Valid Until</p><p className="font-medium">{viewQuote.fecha_vencimiento}</p></div>}
              <div><p className="text-gray-500">Status</p>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full capitalize ${STATUS_COLORS[viewQuote.estado]}`}>{viewQuote.estado}</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100"><tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Description</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">Qty</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Price</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Subtotal</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-200">
                  {viewQuote.detalles?.map((d: any) => (
                    <tr key={d.id}><td className="px-3 py-2">{d.descripcion}</td><td className="px-3 py-2 text-center">{d.cantidad}</td><td className="px-3 py-2 text-right">{formatCurrency(d.precio_unitario)}</td><td className="px-3 py-2 text-right font-medium">{formatCurrency(d.subtotal)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(viewQuote.subtotal)}</span></div>
              {viewQuote.impuesto > 0 && <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>{formatCurrency(viewQuote.impuesto)}</span></div>}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200"><span>Total</span><span>{formatCurrency(viewQuote.total)}</span></div>
            </div>

            {viewQuote.notas && <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700"><strong>Notes:</strong> {viewQuote.notas}</div>}

            {/* Action buttons */}
            {viewQuote.estado === 'pendiente' && (
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button onClick={() => changeStatus(viewQuote.id, 'aprobada')} className="flex-1 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center justify-center gap-1"><CheckCircle className="w-4 h-4" /> Approve</button>
                <button onClick={() => changeStatus(viewQuote.id, 'rechazada')} className="flex-1 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 flex items-center justify-center gap-1"><XCircle className="w-4 h-4" /> Reject</button>
                <button onClick={() => changeStatus(viewQuote.id, 'convertida')} className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1"><FileText className="w-4 h-4" /> Convert to Sale</button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => printQuote(viewQuote)} className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-1"><Printer className="w-4 h-4" /> Print</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) removeQuote(deleteTarget) }}
        title="Delete Quote" message="This action cannot be undone." confirmText="Delete" danger />
    </div>
  )
}

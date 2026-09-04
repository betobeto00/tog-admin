import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@core/auth/store'
import {
  Plus, Search, Eye, Edit2, Trash2, FileText, Send, Clock, CheckCircle,
  XCircle, Printer, Mail, DollarSign, Download
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import { formatCurrency, formatDateTime } from '../lib/utils'
import { callApi } from '../lib/api-client'

interface Quote { id: number; numero_cotizacion: number; fecha: string; fecha_vencimiento: string | null; cliente_nombre: string; cliente_email: string | null; cliente_telefono: string | null; cliente_direccion: string | null; subtotal: number; impuesto: number; descuento: number; total: number; notas: string | null; estado: string; usuario_nombre: string; creado_en: string }
interface QuoteDetalle { id?: number; producto_id: number | null; producto_nombre?: string; descripcion: string; cantidad: number; precio_unitario: number; descuento: number; subtotal: number }
interface Producto { id: number; nombre: string; precio_venta: number; stock: number }

const STATUS_COLORS: Record<string, string> = { pendiente: 'bg-yellow-100 text-yellow-700', aprobada: 'bg-green-100 text-green-700', rechazada: 'bg-red-100 text-red-700', convertida: 'bg-blue-100 text-blue-700', vencida: 'bg-gray-100 text-gray-500' }
const STATUS_ICONS: Record<string, any> = { pendiente: Clock, aprobada: CheckCircle, rechazada: XCircle, convertida: FileText, vencida: Clock }

export default function QuotesPage() {
  const { t } = useTranslation()
  const toast = useToast()
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

  // Convertir cotización a venta
  const [convertOpen, setConvertOpen] = useState(false)
  const [convertTarget, setConvertTarget] = useState<(Quote & { detalles: QuoteDetalle[] }) | null>(null)
  const [convertForm, setConvertForm] = useState({ metodo_pago: 'efectivo', monto_pagado: 0 })
  const [converting, setConverting] = useState(false)

  useEffect(() => { loadData() }, [filterStatus])

  const loadData = async () => {
    setLoading(true)
    try {
      const [q, p] = await Promise.all([
        callApi('quotes:list', { estado: filterStatus || undefined, search: search || undefined }),
        callApi('productos:list'),
      ])
      setQuotes(Array.isArray(q) ? q : [])
      setProductos(Array.isArray(p) ? p : [])
    } catch (err) {
      console.error('Error loading quotes:', err)
      setQuotes([])
      setProductos([])
    } finally {
      setLoading(false)
    }
  }

  const searchProducts = searchProd.trim()
    ? productos.filter((p) => p.nombre.toLowerCase().includes(searchProd.toLowerCase())).slice(0, 8)
    : []

  const addItem = (prod: Producto) => {
    setItems([...items, { producto_id: prod.id, descripcion: prod.nombre, cantidad: 1, precio_unitario: prod.precio_venta, descuento: 0, subtotal: prod.precio_venta }])
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
  useEffect(() => {
    callApi<any[]>('config:get').then((cfg: any[]) => {
      const r = cfg.find((c: any) => c.clave === 'sales_tax_rate')
      if (r && r.valor) {
        const parsed = parseFloat(r.valor)
        if (!isNaN(parsed)) setTaxRate(parsed / 100)
      }
    })
  }, [])
  const impuesto = subtotal * taxRate
  const total = subtotal + impuesto

  const openCreate = () => {
    setEditingQuote(null); setCliente({ nombre: '', email: '', telefono: '', direccion: '' })
    setItems([]); setNotas(''); setFechaVenc(''); setModalOpen(true)
  }

  const openEdit = async (q: Quote) => {
    const completa = await callApi<Quote & { detalles: QuoteDetalle[] }>('quotes:getById', { id: q.id })
    setEditingQuote(q)
    setCliente({ nombre: completa.cliente_nombre, email: completa.cliente_email || '', telefono: completa.cliente_telefono || '', direccion: completa.cliente_direccion || '' })
    setItems(completa.detalles || [])
    setNotas(completa.notas || ''); setFechaVenc(completa.fecha_vencimiento || '')
    setModalOpen(true)
  }

  const openView = async (q: Quote) => {
    const completa = await callApi<Quote & { detalles: QuoteDetalle[] }>('quotes:getById', { id: q.id })
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
      if (editingQuote) { await callApi('quotes:update', { id: editingQuote.id, data: { ...data, estado: editingQuote.estado } }) }
      else { await callApi('quotes:create', data) }
      setModalOpen(false); await loadData()
    } finally { setSaving(false) }
  }

  const changeStatus = async (id: number, estado: string) => {
    await callApi('quotes:update', { id, data: { estado } })
    await loadData()
    if (viewQuote?.id === id) { const updated = await callApi<Quote & { detalles: QuoteDetalle[] }>('quotes:getById', { id }); setViewQuote(updated) }
  }

  const removeQuote = async (id: number) => {
    await callApi('quotes:delete', { id }); await loadData()
  }

  const openConvert = (q: Quote & { detalles: QuoteDetalle[] }) => {
    setConvertTarget(q)
    setConvertForm({ metodo_pago: 'efectivo', monto_pagado: q.total || 0 })
    setConvertOpen(true)
  }

  const doConvert = async () => {
    if (!convertTarget || converting) return
    setConverting(true)
    try {
      const q = convertTarget
      const total = q.total || 0
      const monto = Number(convertForm.monto_pagado) || 0
      await callApi('ventas:create', {
        usuario_id: usuario!.id,
        subtotal: q.subtotal || 0,
        impuesto: q.impuesto || 0,
        descuento: q.descuento || 0,
        total,
        metodo_pago: convertForm.metodo_pago,
        monto_pagado: monto,
        cambio: Math.max(0, monto - total),
        notas: q.notas || undefined,
        deudor_nombre: convertForm.metodo_pago === 'fiado' ? q.cliente_nombre : undefined,
        detalles: (q.detalles || []).map((d) => ({
          producto_id: d.producto_id,
          descripcion: d.descripcion,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          descuento: d.descuento || 0,
          subtotal: d.subtotal,
        })),
      })
      await callApi('quotes:update', { id: q.id, data: { estado: 'convertida' } })
      toast.success(t('quotes.saleCreated'))
      setConvertOpen(false)
      await loadData()
    } catch (err: any) {
      toast.error(err?.message || t('quotes.convertError'))
    } finally {
      setConverting(false)
    }
  }

  const loadAndExportPdf = async (id: number) => {
    try {
      const full = await callApi<Quote & { detalles: QuoteDetalle[] }>('quotes:getById', { id })
      await exportQuotePdf(full)
    } catch (e) {
      console.error('Failed to load quote for PDF export', e)
    }
  }

  const exportQuotePdf = async (q: Quote & { detalles: QuoteDetalle[] }) => {
    let logo = '', bizName = '', bizAddr = '', bizPhone = '', bizEin = ''
    try {
      const cfg = await callApi<any[]>('config:get')
      const get = (k: string) => cfg.find((c: any) => c.clave === k)?.valor || ''
      logo = get('logo_path')
      bizName = get('nombre_negocio')
      bizAddr = get('direccion')
      bizPhone = get('telefono')
      bizEin = get('ein')
    } catch {}
    const rows = (q.detalles || []).map((d: any) =>
      `<tr><td>${d.descripcion || '—'}</td><td style="text-align:center">${d.cantidad}</td><td style="text-align:right">${formatCurrency(d.precio_unitario)}</td><td style="text-align:right">${formatCurrency(d.subtotal)}</td></tr>`
    ).join('')
    const win = window.open('', '_blank', 'width=840,height=640')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${t('quotes.pdfHeader')} #${String(q.numero_cotizacion).padStart(6, '0')}</title><style>
      *{box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:0;padding:32px;background:#f3f4f6}
      .page{max-width:720px;margin:0 auto;background:#fff;padding:40px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,.08)}
      h1{font-size:22px;margin:0 0 4px;color:#111827}
      .muted{color:#6b7280;font-size:12px}
      .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #3b82f6;padding-bottom:16px;margin-bottom:24px}
      .brand{font-size:14px;font-weight:bold;color:#1e40af}
      .quote-no{font-size:26px;font-weight:bold;color:#111827}
      table{width:100%;border-collapse:collapse;margin:20px 0}
      th{background:#f3f4f6;text-align:left;padding:10px 12px;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;border-bottom:2px solid #e5e7eb}
      td{padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px}
      .totals{width:320px;margin-left:auto;font-size:13px}
      .totals>div{display:flex;justify-content:space-between;padding:6px 0}
      .grand{font-size:16px;font-weight:bold;border-top:2px solid #111827;margin-top:4px;padding-top:10px}
      .notes{background:#f9fafb;border-left:3px solid #3b82f6;padding:12px 16px;margin-top:24px;font-size:12px}
      .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;text-align:center;color:#9ca3af;font-size:11px}
      @media print{body{background:#fff;padding:0}.page{box-shadow:none;border:none}}
    </style></head><body><div class="page">
      <div class="head">
        <div>
          ${logo ? `<img src="${logo}" style="max-width:150px;max-height:70px;margin-bottom:8px">` : ''}
          <div class="brand">${bizName || 'TOG Admin'}</div>
          ${bizAddr ? `<div class="muted">${bizAddr}</div>` : ''}
          ${bizPhone ? `<div class="muted">${bizPhone}</div>` : ''}
          ${bizEin ? `<div class="muted">${bizEin}</div>` : ''}
        </div>
        <div style="text-align:right">
          <h1>${t('quotes.pdfHeader')}</h1>
          <div class="quote-no">#${String(q.numero_cotizacion).padStart(6, '0')}</div>
          <div class="muted">${formatDateTime(q.fecha)}</div>
          ${q.fecha_vencimiento ? `<div class="muted">${t('quotes.validUntil')}: ${q.fecha_vencimiento}</div>` : ''}
        </div>
      </div>
      <div>
        <div class="muted" style="text-transform:uppercase;letter-spacing:.05em">${t('quotes.billTo')}</div>
        <div style="font-size:15px;font-weight:600;margin-top:4px">${q.cliente_nombre}</div>
        ${q.cliente_email ? `<div class="muted">${q.cliente_email}</div>` : ''}
        ${q.cliente_telefono ? `<div class="muted">${q.cliente_telefono}</div>` : ''}
        ${q.cliente_direccion ? `<div class="muted">${q.cliente_direccion}</div>` : ''}
      </div>
      <table>
        <thead><tr><th>${t('quotes.description')}</th><th style="text-align:center">${t('quotes.qty')}</th><th style="text-align:right">${t('quotes.price')}</th><th style="text-align:right">${t('quotes.subtotal')}</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4" style="text-align:center;color:#9ca3af">${t('quotes.noQuotesFound')}</td></tr>`}</tbody>
      </table>
      <div class="totals">
        <div><span class="muted">${t('quotes.subtotal')}</span><span>${formatCurrency(q.subtotal || 0)}</span></div>
        ${(q.impuesto || 0) > 0 ? `<div><span class="muted">${t('quotes.tax')}</span><span>${formatCurrency(q.impuesto)}</span></div>` : ''}
        <div class="grand"><span>${t('quotes.total')}</span><span>${formatCurrency(q.total || 0)}</span></div>
      </div>
      ${q.notas ? `<div class="notes"><strong>${t('quotes.notes')}:</strong> ${q.notas}</div>` : ''}
      <div class="footer">${t('quotes.receiptThankYou')}</div>
    </div></body></html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  const loadAndPrint = async (id: number) => {
    try {
      const full = await callApi<Quote & { detalles: QuoteDetalle[] }>('quotes:getById', { id })
      printQuote(full)
    } catch (e) {
      console.error('Failed to load quote for printing', e)
    }
  }
  const printQuote = async (q: any) => {
    const rows = q.detalles?.map((d: any) =>
      `<tr><td>${d.descripcion}</td><td style="text-align:center">${d.cantidad}</td><td style="text-align:right">${formatCurrency(d.precio_unitario)}</td><td style="text-align:right">${formatCurrency(d.subtotal)}</td></tr>`
    ).join('') || ''
    const win = window.open('', '_blank', 'width=400,height=700')
    if (!win) return
    // Cargar datos del negocio para logo y contacto
    let logo = '', bizName = '', bizAddr = '', bizPhone = '', bizEin = ''
    try {
      const cfg = await callApi<any[]>('config:get')
      const get = (k: string) => cfg.find((c: any) => c.clave === k)?.valor || ''
      logo = get('logo_path')
      bizName = get('nombre_negocio')
      bizAddr = get('direccion')
      bizPhone = get('telefono')
      bizEin = get('ein')
    } catch {}
    const logoHTML = logo ? `<div class="center" style="margin-bottom:8px"><img src="${logo}" style="max-width:140px;max-height:80px"></div>` : ''
    const companyHTML = `
      <div class="center" style="font-size:11px"><strong>${bizName}</strong></div>
      ${bizAddr ? `<div class="center" style="font-size:9px;color:#555">${bizAddr}</div>` : ''}
      ${bizPhone ? `<div class="center" style="font-size:9px;color:#555">${bizPhone}</div>` : ''}
      ${bizEin ? `<div class="center" style="font-size:9px;color:#555">EIN: ${bizEin}</div>` : ''}
    `
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
      ${logoHTML}
      ${companyHTML}
      <h2>QUOTE / ESTIMATE</h2>
      <div class="center">#${String(q.numero_cotizacion).padStart(6, '0')}</div>
      <div class="center" style="font-size:10px;color:#666">${formatDateTime(q.fecha)}</div>
      ${q.fecha_vencimiento ? `<div class="center" style="font-size:10px;color:#999">${t('quotes.validUntil')}: ${q.fecha_vencimiento}</div>` : ''}
      <hr>
      <div class="label">${t('quotes.billTo')}</div>
      <div><strong>${q.cliente_nombre}</strong></div>
      ${q.cliente_email ? `<div>${q.cliente_email}</div>` : ''}
      ${q.cliente_telefono ? `<div>${q.cliente_telefono}</div>` : ''}
      ${q.cliente_direccion ? `<div>${q.cliente_direccion}</div>` : ''}
      <hr>
      <table><thead><tr><th style="text-align:left">${t('quotes.descriptionShort')}</th><th style="text-align:center">${t('quotes.qtyShort')}</th><th style="text-align:right">${t('quotes.price')}</th><th style="text-align:right">${t('quotes.subtotal')}</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <hr>
      <div class="right">${t('quotes.subtotal')}: ${formatCurrency(q.subtotal || 0)}</div>
      ${(q.impuesto || 0) > 0 ? `<div class="right">${t('quotes.tax')}: ${formatCurrency(q.impuesto)}</div>` : ''}
      <div class="right total">${t('quotes.total')}: ${formatCurrency(q.total || 0)}</div>
      ${q.notas ? `<hr><div class="label">${t('quotes.notes')}:</div><div style="font-size:10px">${q.notas}</div>` : ''}
      <hr>
      <div class="center" style="margin-top:15px;font-size:10px;color:#666">${t('quotes.receiptThankYou')}</div>
    </body></html>`)
    win.document.close(); win.print()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('quotes.title')}</h1>
          <p className="text-sm text-gray-500">{quotes.length} {t('quotes.title').toLowerCase()}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> {t('quotes.newQuote')}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} onBlur={() => loadData()}
            placeholder={t('quotes.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option value="">{t('quotes.allStatus')}</option>
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
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('quotes.quote')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('quotes.client')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('quotes.date')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('quotes.validUntil')}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('quotes.total')}</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('quotes.status')}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('quotes.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" /></td></tr>
            ) : quotes.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400"><FileText className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>{t('quotes.noQuotesFound')}</p></td></tr>
            ) : (quotes || []).map((q) => {
              const Icon = STATUS_ICONS[q.estado] || Clock
              return (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono font-medium">#{String(q.numero_cotizacion || 0).padStart(6, '0')}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{q.cliente_nombre || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{q.fecha ? formatDateTime(q.fecha) : '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{q.fecha_vencimiento || '—'}</td>
                  <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(q.total || 0)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full capitalize ${STATUS_COLORS[q.estado] || ''}`}>
                      <Icon className="w-3 h-3" /> {q.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openView(q)} className="p-1.5 hover:bg-gray-100 rounded-lg" title={t('quotes.view')}><Eye className="w-4 h-4 text-gray-500" /></button>
                      <button onClick={() => loadAndPrint(q.id)} className="p-1.5 hover:bg-gray-100 rounded-lg" title={t('quotes.print')}><Printer className="w-4 h-4 text-gray-500" /></button>
                      <button onClick={() => loadAndExportPdf(q.id)} className="p-1.5 hover:bg-gray-100 rounded-lg" title={t('quotes.exportPdf')}><Download className="w-4 h-4 text-gray-500" /></button>
                      {q.estado === 'pendiente' && <button onClick={() => openEdit(q)} className="p-1.5 hover:bg-gray-100 rounded-lg" title={t('quotes.edit')}><Edit2 className="w-4 h-4 text-gray-500" /></button>}
                      {q.estado === 'pendiente' && <button onClick={() => setDeleteTarget(q.id)} className="p-1.5 hover:bg-red-50 rounded-lg" title={t('quotes.delete')}><Trash2 className="w-4 h-4 text-red-400" /></button>}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Create/Edit Quote */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingQuote ? `${t('quotes.editQuote')} #${String(editingQuote.numero_cotizacion).padStart(6, '0')}` : t('quotes.newQuote')} wide>
        <div className="space-y-4">
          {/* Client Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">{t('quotes.clientName')} *</label>
              <input value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder={t('quotes.clientPlaceholder')} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" value={cliente.email} onChange={(e) => setCliente({ ...cliente, email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="client@email.com" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('quotes.phone')}</label>
              <input value={cliente.telefono} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder={t('quotes.phonePlaceholder')} /></div>
            <div className="col-span-2"><label className="block text-sm font-medium text-gray-700 mb-1">{t('quotes.address')}</label>
              <input value={cliente.direccion} onChange={(e) => setCliente({ ...cliente, direccion: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder={t('quotes.addressPlaceholder')} /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">{t('quotes.validUntil')}</label>
              <input type="date" value={fechaVenc} onChange={(e) => setFechaVenc(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
          </div>

          {/* Items */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('quotes.items')} *</label>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchProd} onChange={(e) => setSearchProd(e.target.value)} placeholder={t('quotes.searchProduct')}
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
            <button onClick={addCustomItem} className="text-xs text-blue-600 hover:text-blue-700 mb-2">{t('quotes.addCustomItem')}</button>
            {items.length > 0 && (
              <div className="bg-gray-50 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{t('quotes.description')}</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 w-20">{t('quotes.qty')}</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 w-24">{t('quotes.unitPrice')}</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 w-20">{t('quotes.disc')}</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 w-24">{t('quotes.subtotal')}</th>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('quotes.notes')}</label>
              <textarea rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder={t('quotes.notesPlaceholder')} />
            </div>
            <div className="w-64 bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">{t('quotes.subtotal')}</span><span>{formatCurrency(subtotal)}</span></div>
              {taxRate > 0 && <div className="flex justify-between"><span className="text-gray-500">{t('quotes.tax')} ({(taxRate * 100).toFixed(1)}%)</span><span>{formatCurrency(impuesto)}</span></div>}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200"><span>{t('quotes.total')}</span><span>{formatCurrency(total)}</span></div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('quotes.cancel')}</button>
            <button onClick={saveQuote} disabled={saving || !cliente.nombre.trim() || items.length === 0}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
              {saving ? t('quotes.saving') : editingQuote ? t('quotes.updateQuote') : t('quotes.createQuote')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal View Quote */}
      <Modal open={viewOpen} onClose={() => setViewOpen(false)} title={viewQuote ? `${t('quotes.quote')} #${String(viewQuote.numero_cotizacion).padStart(6, '0')}` : ''} wide>
        {viewQuote && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-gray-500">{t('quotes.client')}</p><p className="font-medium">{viewQuote.cliente_nombre || '—'}</p></div>
              <div><p className="text-gray-500">{t('quotes.date')}</p><p className="font-medium">{viewQuote.fecha ? formatDateTime(viewQuote.fecha) : '—'}</p></div>
              {viewQuote.cliente_email && <div><p className="text-gray-500">Email</p><p className="font-medium">{viewQuote.cliente_email}</p></div>}
              {viewQuote.cliente_telefono && <div><p className="text-gray-500">{t('quotes.phone')}</p><p className="font-medium">{viewQuote.cliente_telefono}</p></div>}
              {viewQuote.fecha_vencimiento && <div><p className="text-gray-500">{t('quotes.validUntil')}</p><p className="font-medium">{viewQuote.fecha_vencimiento}</p></div>}
              <div><p className="text-gray-500">{t('quotes.status')}</p>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full capitalize ${STATUS_COLORS[viewQuote.estado]}`}>{viewQuote.estado}</span>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100"><tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{t('quotes.description')}</th>
                  <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">{t('quotes.qty')}</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">{t('quotes.price')}</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">{t('quotes.subtotal')}</th>
                </tr></thead>
                <tbody className="divide-y divide-gray-200">
                  {(viewQuote.detalles || []).map((d: any) => (
                    <tr key={d.id}><td className="px-3 py-2">{d.descripcion || '—'}</td><td className="px-3 py-2 text-center">{d.cantidad || 0}</td><td className="px-3 py-2 text-right">{formatCurrency(d.precio_unitario || 0)}</td><td className="px-3 py-2 text-right font-medium">{formatCurrency(d.subtotal || 0)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">{t('quotes.subtotal')}</span><span>{formatCurrency(viewQuote.subtotal || 0)}</span></div>
              {(viewQuote.impuesto || 0) > 0 && <div className="flex justify-between"><span className="text-gray-500">{t('quotes.tax')}</span><span>{formatCurrency(viewQuote.impuesto)}</span></div>}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200"><span>{t('quotes.total')}</span><span>{formatCurrency(viewQuote.total || 0)}</span></div>
            </div>

            {viewQuote.notas && <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700"><strong>{t('quotes.notes')}:</strong> {viewQuote.notas}</div>}

            {/* Action buttons */}
            {viewQuote.estado === 'pendiente' && (
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button onClick={() => changeStatus(viewQuote.id, 'aprobada')} className="flex-1 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center justify-center gap-1"><CheckCircle className="w-4 h-4" /> {t('quotes.approve')}</button>
                <button onClick={() => changeStatus(viewQuote.id, 'rechazada')} className="flex-1 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 flex items-center justify-center gap-1"><XCircle className="w-4 h-4" /> {t('quotes.reject')}</button>
                <button onClick={() => openConvert(viewQuote)} className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1"><FileText className="w-4 h-4" /> {t('quotes.convertToSale')}</button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => printQuote(viewQuote)} className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-1"><Printer className="w-4 h-4" /> {t('quotes.print')}</button>
              <button onClick={() => exportQuotePdf(viewQuote)} className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-1"><Download className="w-4 h-4" /> {t('quotes.exportPdf')}</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Convertir a Venta */}
      <Modal open={convertOpen} onClose={() => setConvertOpen(false)} title={t('quotes.convertTitle')}>
        {convertTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">{t('quotes.convertMsg')}</p>
            <div className="bg-gray-50 rounded-xl p-4 text-sm flex justify-between font-semibold">
              <span>{t('quotes.total')}</span><span>{formatCurrency(convertTarget.total || 0)}</span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('pos.paymentMethod')} *</label>
              <select value={convertForm.metodo_pago} onChange={(e) => setConvertForm({ ...convertForm, metodo_pago: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value="efectivo">{t('pos.cash')}</option>
                <option value="transferencia">{t('pos.transfer')}</option>
                <option value="pago_movil">{t('pos.mobile')}</option>
                <option value="mixto">{t('pos.mixed')}</option>
                <option value="fiado">{t('caja.fiadoMethod')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('pos.amountReceived')}</label>
              <input type="number" step="0.01" min="0" value={convertForm.monto_pagado}
                onChange={(e) => setConvertForm({ ...convertForm, monto_pagado: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-400 mt-1">{t('pos.change')}: {formatCurrency(Math.max(0, (Number(convertForm.monto_pagado) || 0) - (convertTarget.total || 0)))}</p>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => setConvertOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('quotes.cancel')}</button>
              <button onClick={doConvert} disabled={converting}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2">
                <FileText className="w-4 h-4" /> {converting ? t('quotes.saving') : t('quotes.convertConfirm')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => { if (deleteTarget) removeQuote(deleteTarget) }}
        title={t('quotes.deleteConfirm')} message={t('quotes.deleteMsg')} confirmText={t('quotes.deleteButton')} danger />
    </div>
  )
}

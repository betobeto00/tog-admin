import { Plus, Minus, Trash2 } from 'lucide-react'
import { formatCurrency } from '../../lib/utils'

interface CartItemData {
  producto_id: number; nombre: string; precio_unitario: number
  cantidad: number; stock: number; unidad: string; descuento: number
}

interface Props {
  item: CartItemData
  onUpdateQuantity: (id: number, delta: number) => void
  onUpdateDiscount: (id: number, descuento: number) => void
  onRemove: (id: number) => void
}

export default function CartItem({ item, onUpdateQuantity, onUpdateDiscount, onRemove }: Props) {
  const lineTotal = item.precio_unitario * item.cantidad
  const lineDiscount = lineTotal * item.descuento / 100
  const lineNet = lineTotal - lineDiscount

  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{item.nombre}</p>
          <p className="text-xs text-gray-500">{formatCurrency(item.precio_unitario)} c/u</p>
        </div>
        <button onClick={() => onRemove(item.producto_id)}
          className="p-1 hover:bg-red-100 rounded-lg ml-2">
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
        </button>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => onUpdateQuantity(item.producto_id, -1)}
            className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:bg-gray-100">
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-8 text-center text-sm font-medium">{item.cantidad}</span>
          <button onClick={() => onUpdateQuantity(item.producto_id, 1)}
            className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:bg-gray-100">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="text-right">
          {item.descuento > 0 ? (
            <div>
              <span className="text-xs text-red-500 line-through">{formatCurrency(lineTotal)}</span>
              <span className="text-sm font-bold text-green-600 block">{formatCurrency(lineNet)}</span>
            </div>
          ) : (
            <span className="text-sm font-bold text-gray-900">{formatCurrency(lineTotal)}</span>
          )}
        </div>
      </div>
      {/* Descuento por item */}
      <div className="flex items-center gap-1 mt-1">
        <span className="text-xs text-gray-400">Dcto:</span>
        <input
          type="number" min="0" max="100" value={item.descuento}
          onChange={(e) => onUpdateDiscount(item.producto_id, Number(e.target.value))}
          className="w-12 text-center text-xs border border-gray-200 rounded px-1 py-0.5"
        />
        <span className="text-xs text-gray-400">%</span>
      </div>
    </div>
  )
}

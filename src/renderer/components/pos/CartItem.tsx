import { Plus, Minus, Trash2 } from 'lucide-react'
import { formatMoney, getSymbol } from '../../services/currency'
import ProductImage from '../ProductImage'

interface CartItemData {
  producto_id: number; nombre: string; precio_unitario: number
  cantidad: number; stock: number; unidad: string; tipo: 'producto' | 'servicio'; descuento: number
}

interface Props {
  item: CartItemData
  onUpdateQuantity: (id: number, delta: number) => void
  onUpdateDiscount: (id: number, descuento: number) => void
  onUpdatePrice: (id: number, price: number) => void
  onRemove: (id: number) => void
}

export default function CartItem({ item, onUpdateQuantity, onUpdateDiscount, onUpdatePrice, onRemove }: Props) {
  const lineTotal = item.precio_unitario * item.cantidad
  const lineDiscount = lineTotal * item.descuento / 100
  const lineNet = lineTotal - lineDiscount

  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ProductImage productoId={item.producto_id} className="w-10 h-10" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-gray-900 truncate">{item.nombre}</p>
              {item.tipo === 'servicio' && (
                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 flex-shrink-0">
                  Servicio
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-xs text-gray-400">{getSymbol()}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={item.precio_unitario}
                onChange={(e) => onUpdatePrice(item.producto_id, Math.max(0, Number(e.target.value)))}
                className="w-16 text-xs border border-gray-200 rounded px-1 py-0.5 text-right font-medium focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-400">c/u</span>
            </div>
          </div>
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
              <span className="text-xs text-red-500 line-through">{formatMoney(lineTotal)}</span>
              <span className="text-sm font-bold text-green-600 block">{formatMoney(lineNet)}</span>
            </div>
          ) : (
            <span className="text-sm font-bold text-gray-900">{formatMoney(lineTotal)}</span>
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

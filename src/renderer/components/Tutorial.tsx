import { useState } from 'react'
import { X, ChevronRight, ChevronLeft, Check, ShoppingCart, Package, DollarSign, BarChart3, Settings } from 'lucide-react'

const TUTORIAL_STEPS = [
  {
    icon: ShoppingCart,
    title: 'Punto de Venta (POS)',
    description: 'Aquí realizas las ventas. Busca productos por nombre o código de barras, agrégalos al carrito y cobra.',
    tip: 'Atajos: F2 = buscar, F5 = cobrar',
    color: 'bg-blue-500',
  },
  {
    icon: Package,
    title: 'Inventario',
    description: 'Gestiona tus productos: crear, editar, ajustar stock y ver alertas de stock bajo.',
    tip: 'Cada venta descuenta stock automáticamente',
    color: 'bg-green-500',
  },
  {
    icon: DollarSign,
    title: 'Caja',
    description: 'Abre la caja con un fondo inicial antes de usar el POS. Al cerrar, concilia el efectivo.',
    tip: 'Solo puede haber una caja abierta a la vez',
    color: 'bg-purple-500',
  },
  {
    icon: BarChart3,
    title: 'Reportes',
    description: 'Visualiza ventas por período, productos más vendidos y métodos de pago.',
    tip: 'Usa filtros rápidos para rango de fechas',
    color: 'bg-orange-500',
  },
  {
    icon: Settings,
    title: 'Configuración',
    description: 'Configura datos del negocio, usuarios, impuestos y haz backup de tu información.',
    tip: 'Haz backup regularmente para proteger tus datos',
    color: 'bg-red-500',
  },
]

const TUTORIAL_KEY = 'tog_tutorial_completed'

export function hasTutorialCompleted(): boolean {
  return localStorage.getItem(TUTORIAL_KEY) === 'true'
}

export function markTutorialCompleted() {
  localStorage.setItem(TUTORIAL_KEY, 'true')
}

export function resetTutorial() {
  localStorage.removeItem(TUTORIAL_KEY)
}

export default function Tutorial({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const current = TUTORIAL_STEPS[step]
  const Icon = current.icon
  const isLast = step === TUTORIAL_STEPS.length - 1

  const handleComplete = () => {
    markTutorialCompleted()
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className={`${current.color} px-6 py-8 text-center text-white relative`}>
          <button
            onClick={handleComplete}
            className="absolute top-3 right-3 p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icon className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold">{current.title}</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-600 text-center mb-4">{current.description}</p>
          {current.tip && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 text-center">
              💡 <strong>Tip:</strong> {current.tip}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex items-center justify-between">
          {/* Progress dots */}
          <div className="flex gap-1.5">
            {TUTORIAL_STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === step ? 'bg-blue-600' : i < step ? 'bg-blue-300' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" /> Anterior
              </button>
            )}
            {isLast ? (
              <button
                onClick={handleComplete}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1"
              >
                <Check className="w-4 h-4" /> ¡Entendido!
              </button>
            ) : (
              <button
                onClick={() => setStep(step + 1)}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

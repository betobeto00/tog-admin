import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ChevronRight, ChevronLeft, Check, ShoppingCart, Package, DollarSign, BarChart3, Settings } from 'lucide-react'

interface TutorialStep {
  icon: any
  titleKey: string
  descKey: string
  tipKey: string
  color: string
}

const TUTORIAL_STEPS: TutorialStep[] = [
  { icon: ShoppingCart, titleKey: 'tutorial.step1', descKey: 'tutorial.step1Desc', tipKey: 'tutorial.step1Tip', color: 'bg-blue-500' },
  { icon: Package, titleKey: 'tutorial.step2', descKey: 'tutorial.step2Desc', tipKey: 'tutorial.step2Tip', color: 'bg-green-500' },
  { icon: DollarSign, titleKey: 'tutorial.step3', descKey: 'tutorial.step3Desc', tipKey: 'tutorial.step3Tip', color: 'bg-purple-500' },
  { icon: BarChart3, titleKey: 'tutorial.step4', descKey: 'tutorial.step4Desc', tipKey: 'tutorial.step4Tip', color: 'bg-orange-500' },
  { icon: Settings, titleKey: 'tutorial.step5', descKey: 'tutorial.step5Desc', tipKey: 'tutorial.step5Tip', color: 'bg-red-500' },
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
  const { t } = useTranslation()
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
          <h2 className="text-xl font-bold">{t(current.titleKey)}</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-6">
          <p className="text-gray-600 text-center mb-4">{t(current.descKey)}</p>
          {current.tip && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 text-center">
              💡 <strong>Tip:</strong> {t(current.tipKey)}
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
                <ChevronLeft className="w-4 h-4" /> {t('tutorial.previous')}
              </button>
            )}
            {isLast ? (
              <button
                onClick={handleComplete}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1"
              >
                <Check className="w-4 h-4" /> {t('tutorial.finish')}
              </button>
            ) : (
              <button
                onClick={() => setStep(step + 1)}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center gap-1"
              >
                {t('tutorial.next')} <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

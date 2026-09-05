import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  HelpCircle, LayoutDashboard, ShoppingCart, Lock, Package, Receipt,
  Truck, Users, FileText, BarChart3, Settings, ChevronDown, ChevronRight,
  Search, Keyboard, Bell, Shield, Star, Zap
} from 'lucide-react'

interface Section {
  id: string
  icon: any
  title: string
  color: string
  content: {
    title: string
    description: string
    features?: string[]
    tips?: string[]
    shortcuts?: string[]
  }[]
}

function getSections(t: (key: string) => string): Section[] {
  return [
    {
      id: 'dashboard', icon: LayoutDashboard, title: t('nav.dashboard'), color: 'bg-blue-500',
      content: [
        { title: t('help.dashboardDailySummary'), description: t('help.dashboardDailySummaryDesc'),
          features: [t('help.dashboardFeature1'), t('help.dashboardFeature2'), t('help.dashboardFeature3'), t('help.dashboardFeature4')] },
        { title: t('help.dashboardLatestSales'), description: t('help.dashboardLatestSalesDesc'),
          features: [t('help.dashboardSalesFeature1'), t('help.dashboardSalesFeature2'), t('help.dashboardSalesFeature3'), t('help.dashboardSalesFeature4')] },
        { title: t('help.dashboardLowStock'), description: t('help.dashboardLowStockDesc'),
          features: [t('help.dashboardStockFeature1'), t('help.dashboardStockFeature2'), t('help.dashboardStockFeature3'), t('help.dashboardStockFeature4')],
          tips: [t('help.dashboardStockTip1'), t('help.dashboardStockTip2'), t('help.dashboardStockTip3')] },
      ],
    },
    {
      id: 'pos', icon: ShoppingCart, title: t('nav.pos'), color: 'bg-green-500',
      content: [
        { title: t('help.posSearch'), description: t('help.posSearchDesc'),
          features: [t('help.posSearchF1'), t('help.posSearchF2'), t('help.posSearchF3'), t('help.posSearchF4')],
          shortcuts: [t('help.posShortcut1')] },
        { title: t('help.posCart'), description: t('help.posCartDesc'),
          features: [t('help.posCartF1'), t('help.posCartF2'), t('help.posCartF3'), t('help.posCartF4'), t('help.posCartF5'), t('help.posCartF6')],
          tips: [t('help.posCartTip1'), t('help.posCartTip2'), t('help.posCartTip3')] },
        { title: t('help.posDiscounts'), description: t('help.posDiscountsDesc'),
          features: [t('help.posDiscountF1'), t('help.posDiscountF2'), t('help.posDiscountF3'), t('help.posDiscountF4')] },
        { title: t('help.posTotals'), description: t('help.posTotalsDesc'),
          features: [t('help.posTotalF1'), t('help.posTotalF2'), t('help.posTotalF3'), t('help.posTotalF4'), t('help.posTotalF5'), t('help.posTotalF6')] },
        { title: t('help.posPayment'), description: t('help.posPaymentDesc'),
          features: [t('help.posPaymentF1'), t('help.posPaymentF2'), t('help.posPaymentF3'), t('help.posPaymentF4')],
          tips: [t('help.posPaymentTip1'), t('help.posPaymentTip2'), t('help.posPaymentTip3')] },
        { title: t('help.posTicket'), description: t('help.posTicketDesc'),
          features: [t('help.posTicketF1'), t('help.posTicketF2'), t('help.posTicketF3'), t('help.posTicketF4'), t('help.posTicketF5')] },
        { title: t('help.posShortcuts'), description: t('help.posShortcutsDesc'),
          shortcuts: [t('help.posShortcutF1'), t('help.posShortcutF2')] },
        { title: t('help.posCashValidation'), description: t('help.posCashValidationDesc'),
          features: [t('help.posCashF1'), t('help.posCashF2'), t('help.posCashF3')] },
      ],
    },
    {
      id: 'caja', icon: Lock, title: t('nav.cash'), color: 'bg-purple-500',
      content: [
        { title: t('help.cashOpen'), description: t('help.cashOpenDesc'),
          features: [t('help.cashOpenF1'), t('help.cashOpenF2'), t('help.cashOpenF3'), t('help.cashOpenF4')] },
        { title: t('help.cashClose'), description: t('help.cashCloseDesc'),
          features: [t('help.cashCloseF1'), t('help.cashCloseF2'), t('help.cashCloseF3'), t('help.cashCloseF4'), t('help.cashCloseF5')],
          tips: [t('help.cashCloseTip1'), t('help.cashCloseTip2'), t('help.cashCloseTip3')] },
        { title: t('help.cashMovements'), description: t('help.cashMovementsDesc'),
          features: [t('help.cashMovF1'), t('help.cashMovF2'), t('help.cashMovF3'), t('help.cashMovF4')] },
        { title: t('help.cashHistory'), description: t('help.cashHistoryDesc'),
          features: [t('help.cashHistF1'), t('help.cashHistF2'), t('help.cashHistF3'), t('help.cashHistF4')] },
        { title: t('help.cashPrint'), description: t('help.cashPrintDesc'),
          features: [t('help.cashPrintF1'), t('help.cashPrintF2'), t('help.cashPrintF3'), t('help.cashPrintF4')] },
      ],
    },
    {
      id: 'inventario', icon: Package, title: t('nav.inventory'), color: 'bg-orange-500',
      content: [
        { title: t('help.invProducts'), description: t('help.invProductsDesc'),
          features: [t('help.invProductsF1'), t('help.invProductsF2'), t('help.invProductsF3'), t('help.invProductsF4'), t('help.invProductsF5')] },
        { title: t('help.invBarcode'), description: t('help.invBarcodeDesc'),
          features: [t('help.invBarcodeF1'), t('help.invBarcodeF2'), t('help.invBarcodeF3'), t('help.invBarcodeF4')] },
        { title: t('help.invCategories'), description: t('help.invCategoriesDesc'),
          features: [t('help.invCatF1'), t('help.invCatF2'), t('help.invCatF3'), t('help.invCatF4')] },
        { title: t('help.invUnits'), description: t('help.invUnitsDesc'),
          features: [t('help.invUnitsF1'), t('help.invUnitsF2'), t('help.invUnitsF3'), t('help.invUnitsF4')] },
        { title: t('help.invStock'), description: t('help.invStockDesc'),
          features: [t('help.invStockF1'), t('help.invStockF2'), t('help.invStockF3'), t('help.invStockF4')] },
        { title: t('help.invAdjust'), description: t('help.invAdjustDesc'),
          features: [t('help.invAdjustF1'), t('help.invAdjustF2'), t('help.invAdjustF3'), t('help.invAdjustF4'), t('help.invAdjustF5')],
          tips: [t('help.invAdjustTip1'), t('help.invAdjustTip2'), t('help.invAdjustTip3')] },
      ],
    },
    {
      id: 'ventas', icon: Receipt, title: t('nav.sales'), color: 'bg-teal-500',
      content: [
        { title: t('help.salesList'), description: t('help.salesListDesc'),
          features: [t('help.salesListF1'), t('help.salesListF2'), t('help.salesListF3'), t('help.salesListF4'), t('help.salesListF5'), t('help.salesListF6')] },
        { title: t('help.salesFilter'), description: t('help.salesFilterDesc'),
          features: [t('help.salesFilterF1'), t('help.salesFilterF2'), t('help.salesFilterF3'), t('help.salesFilterF4')] },
        { title: t('help.salesDetail'), description: t('help.salesDetailDesc'),
          features: [t('help.salesDetailF1'), t('help.salesDetailF2'), t('help.salesDetailF3'), t('help.salesDetailF4'), t('help.salesDetailF5')] },
        { title: t('help.salesVoid'), description: t('help.salesVoidDesc'),
          features: [t('help.salesVoidF1'), t('help.salesVoidF2'), t('help.salesVoidF3'), t('help.salesVoidF4')],
          tips: [t('help.salesVoidTip1'), t('help.salesVoidTip2'), t('help.salesVoidTip3')] },
        { title: t('help.salesReprint'), description: t('help.salesReprintDesc'),
          features: [t('help.salesReprintF1'), t('help.salesReprintF2'), t('help.salesReprintF3')] },
      ],
    },
    {
      id: 'compras', icon: Truck, title: t('nav.purchases'), color: 'bg-indigo-500',
      content: [
        { title: t('help.purchasesRegister'), description: t('help.purchasesRegisterDesc'),
          features: [t('help.purchasesRegF1'), t('help.purchasesRegF2'), t('help.purchasesRegF3'), t('help.purchasesRegF4'), t('help.purchasesRegF5')] },
        { title: t('help.purchasesStock'), description: t('help.purchasesStockDesc'),
          features: [t('help.purchasesStockF1'), t('help.purchasesStockF2'), t('help.purchasesStockF3'), t('help.purchasesStockF4')] },
      ],
    },
    {
      id: 'proveedores', icon: Users, title: t('nav.suppliers'), color: 'bg-pink-500',
      content: [
        { title: t('help.suppliersManage'), description: t('help.suppliersManageDesc'),
          features: [t('help.suppliersF1'), t('help.suppliersF2'), t('help.suppliersF3'), t('help.suppliersF4'), t('help.suppliersF5')] },
        { title: t('help.suppliersUsage'), description: t('help.suppliersUsageDesc'),
          features: [t('help.suppliersUseF1'), t('help.suppliersUseF2'), t('help.suppliersUseF3')] },
      ],
    },
    {
      id: 'quotes', icon: FileText, title: t('nav.quotes'), color: 'bg-amber-500',
      content: [
        { title: t('help.quotesCreate'), description: t('help.quotesCreateDesc'),
          features: [t('help.quotesCreateF1'), t('help.quotesCreateF2'), t('help.quotesCreateF3'), t('help.quotesCreateF4'), t('help.quotesCreateF5'), t('help.quotesCreateF6')] },
        { title: t('help.quotesManage'), description: t('help.quotesManageDesc'),
          features: [t('help.quotesManageF1'), t('help.quotesManageF2'), t('help.quotesManageF3'), t('help.quotesManageF4')] },
        { title: t('help.quotesPrint'), description: t('help.quotesPrintDesc'),
          features: [t('help.quotesPrintF1'), t('help.quotesPrintF2'), t('help.quotesPrintF3'), t('help.quotesPrintF4')] },
      ],
    },
    {
      id: 'reportes', icon: BarChart3, title: t('nav.reports'), color: 'bg-cyan-500',
      content: [
        { title: t('help.reportsPeriod'), description: t('help.reportsPeriodDesc'),
          features: [t('help.reportsPeriodF1'), t('help.reportsPeriodF2'), t('help.reportsPeriodF3'), t('help.reportsPeriodF4')] },
        { title: t('help.reportsTop'), description: t('help.reportsTopDesc'),
          features: [t('help.reportsTopF1'), t('help.reportsTopF2'), t('help.reportsTopF3'), t('help.reportsTopF4'), t('help.reportsTopF5')] },
        { title: t('help.reportsPayment'), description: t('help.reportsPaymentDesc'),
          features: [t('help.reportsPaymentF1'), t('help.reportsPaymentF2'), t('help.reportsPaymentF3'), t('help.reportsPaymentF4')] },
        { title: t('help.reportsCards'), description: t('help.reportsCardsDesc'),
          features: [t('help.reportsCardsF1'), t('help.reportsCardsF2'), t('help.reportsCardsF3'), t('help.reportsCardsF4')] },
      ],
    },
    {
      id: 'config', icon: Settings, title: t('nav.settings'), color: 'bg-gray-500',
      content: [
        { title: t('help.configBusiness'), description: t('help.configBusinessDesc'),
          features: [t('help.configBusinessF1'), t('help.configBusinessF2'), t('help.configBusinessF3'), t('help.configBusinessF4')] },
        { title: t('help.configTax'), description: t('help.configTaxDesc'),
          features: [t('help.configTaxF1'), t('help.configTaxF2'), t('help.configTaxF3')] },
        { title: t('help.configUsers'), description: t('help.configUsersDesc'),
          features: [t('help.configUsersF1'), t('help.configUsersF2'), t('help.configUsersF3'), t('help.configUsersF4')] },
        { title: t('help.configBackup'), description: t('help.configBackupDesc'),
          features: [t('help.configBackupF1'), t('help.configBackupF2'), t('help.configBackupF3'), t('help.configBackupF4')],
          tips: [t('help.configBackupTip1'), t('help.configBackupTip2'), t('help.configBackupTip3')] },
        { title: t('help.configTutorial'), description: t('help.configTutorialDesc'),
          features: [t('help.configTutorialF1'), t('help.configTutorialF2'), t('help.configTutorialF3'), t('help.configTutorialF4')] },
      ],
    },
    {
      id: 'terminal', icon: Shield, title: 'VP800 Terminal', color: 'bg-emerald-500',
      content: [
        { title: t('help.terminalConnect'), description: t('help.terminalConnectDesc'),
          features: [t('help.terminalConnectF1'), t('help.terminalConnectF2'), t('help.terminalConnectF3'), t('help.terminalConnectF4')],
          tips: [t('help.terminalConnectTip1'), t('help.terminalConnectTip2'), t('help.terminalConnectTip3')] },
        { title: t('help.terminalProcess'), description: t('help.terminalProcessDesc'),
          features: [t('help.terminalProcessF1'), t('help.terminalProcessF2'), t('help.terminalProcessF3'), t('help.terminalProcessF4'), t('help.terminalProcessF5'), t('help.terminalProcessF6'), t('help.terminalProcessF7')] },
        { title: t('help.terminalCodes'), description: t('help.terminalCodesDesc'),
          features: [t('help.terminalCodesF1'), t('help.terminalCodesF2'), t('help.terminalCodesF3'), t('help.terminalCodesF4'), t('help.terminalCodesF5'), t('help.terminalCodesF6'), t('help.terminalCodesF7')] },
        { title: t('help.terminalInfo'), description: t('help.terminalInfoDesc'),
          features: [t('help.terminalInfoF1'), t('help.terminalInfoF2'), t('help.terminalInfoF3'), t('help.terminalInfoF4'), t('help.terminalInfoF5')] },
      ],
    },
    {
      id: 'seguridad', icon: Shield, title: t('help.security'), color: 'bg-red-600',
      content: [
        { title: t('help.securityAuth'), description: t('help.securityAuthDesc'),
          features: [t('help.securityAuthF1'), t('help.securityAuthF2'), t('help.securityAuthF3'), t('help.securityAuthF4'), t('help.securityAuthF5')] },
        { title: t('help.securityRoles'), description: t('help.securityRolesDesc'),
          features: [t('help.securityRolesF1'), t('help.securityRolesF2'), t('help.securityRolesF3'), t('help.securityRolesF4'), t('help.securityRolesF5')] },
        { title: t('help.securityBackup'), description: t('help.securityBackupDesc'),
          features: [t('help.securityBackupF1'), t('help.securityBackupF2'), t('help.securityBackupF3'), t('help.securityBackupF4')] },
      ],
    },
    {
      id: 'atajos', icon: Keyboard, title: t('help.shortcuts'), color: 'bg-slate-600',
      content: [
        { title: t('help.shortcutsGeneral'), description: t('help.shortcutsGeneralDesc'),
          shortcuts: [t('help.shortcutF1'), t('help.shortcutF2'), t('help.shortcutF3')] },
      ],
    },
    {
      id: 'notificaciones', icon: Bell, title: t('help.notifications'), color: 'bg-rose-500',
      content: [
        { title: t('help.notifBell'), description: t('help.notifBellDesc'),
          features: [t('help.notifBellF1'), t('help.notifBellF2'), t('help.notifBellF3'), t('help.notifBellF4'), t('help.notifBellF5')],
          tips: [t('help.notifBellTip1'), t('help.notifBellTip2'), t('help.notifBellTip3')] },
      ],
    },
  ]
}

export default function HelpPage() {
  const { t } = useTranslation()
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const sections = getSections(t)

  const filtered = sections.filter(s =>
    !searchTerm || s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.content.some(c => c.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <HelpCircle className="w-7 h-7 text-blue-600" /> {t('help.title')}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{t('help.subtitle')}</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t('help.search')}
          className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((section) => {
          const Icon = section.icon
          const isOpen = activeSection === section.id
          return (
            <div key={section.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setActiveSection(isOpen ? null : section.id)}
                className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                <div className={`${section.color} p-2 rounded-lg`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{section.title}</h3>
                  <p className="text-xs text-gray-500">{section.content.length} {t('common.sections')}</p>
                </div>
                {isOpen
                  ? <ChevronDown className="w-5 h-5 text-gray-400" />
                  : <ChevronRight className="w-5 h-5 text-gray-400" />
                }
              </button>

              {isOpen && (
                <div className="px-6 pb-6 space-y-6 border-t border-gray-100">
                  {(section.content || []).map((item, i) => (
                    <div key={i} className="pt-4">
                      <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500" />
                        {item.title}
                      </h4>
                      <p className="text-sm text-gray-600 mb-3">{item.description}</p>

                      <div className="space-y-1.5">
                        {(item.features || []).map((f, j) => (
                          <div key={j} className="flex items-start gap-2 text-sm text-gray-700">
                            <Zap className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                            <span>{f}</span>
                          </div>
                        ))}
                      </div>

                      {(item.tips || []).length > 0 && (
                        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-blue-700 mb-1.5">💡 Tips</p>
                          {(item.tips || []).map((tip, j) => (
                            <p key={j} className="text-xs text-blue-600">• {tip}</p>
                          ))}
                        </div>
                      )}

                      {(item.shortcuts || []).length > 0 && (
                        <div className="mt-3 bg-gray-100 rounded-lg p-3">
                          <p className="text-xs font-semibold text-gray-700 mb-1.5">⌨️ {t('help.shortcuts')}</p>
                          {(item.shortcuts || []).map((s, j) => (
                            <p key={j} className="text-xs text-gray-600 font-mono">• {s}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="text-center text-xs text-gray-400 py-4">
        <p>{t('help.footerVersion')}</p>
        <p className="mt-1">{t('help.footerHelp')}</p>
      </div>
    </div>
  )
}

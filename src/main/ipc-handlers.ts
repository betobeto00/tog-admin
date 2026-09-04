import { registerAuthHandlers, registerUsuariosHandlers } from './core/auth'
import { registerInventarioHandlers } from './modules/inventario'
import { registerVentasModuleHandlers } from './modules/ventas'
import { registerConfiguracionHandlers } from './modules/configuracion'
import { registerTerminalHandlers } from './modules/terminal'
import { registerLicenseHandlers } from './modules/license'
import { registerDistribuidorHandlers } from './modules/distribuidor'
import { registerRestaurantHandlers } from './modules/restaurant'
import { registerCajaExtraHandlers } from './modules/caja-extra'
import { registerAppHandlers, registerI18nHandlers, registerFeedbackHandlers } from './modules/shared'
import { registerCrashReportHandlers } from './modules/crash-report'
import { registerUpdaterHandlers } from './services/updater'

export function registerIpcHandlers(): void {
  registerAuthHandlers()
  registerUsuariosHandlers()
  registerInventarioHandlers()
  registerVentasModuleHandlers()
  registerConfiguracionHandlers()
  registerTerminalHandlers()
  registerLicenseHandlers()
  registerDistribuidorHandlers()
  registerRestaurantHandlers()
  registerCajaExtraHandlers()
  registerAppHandlers()
  registerI18nHandlers()
  registerFeedbackHandlers()
  registerCrashReportHandlers()
  registerUpdaterHandlers()
}
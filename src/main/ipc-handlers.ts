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
import { registerRedHandlers } from './modules/red'
import { handleIpc } from './core/auth/ipc-guard'
import { IPC_CHANNELS } from '../shared/ipc-channels'
import { isHija } from './services/red-config'
import { rpcABase } from './services/red-client'
import { logger } from './services/logger'

// Canales que en una PC Hija se resuelven localmente (no se reenvían a la Base)
const HIJA_LOCAL_CHANNELS = new Set<string>([
  'app:version',
  'i18n:get-lang',
  'i18n:set-lang',
  'crash-report:save',
  'crash-report:list',
  'crash-report:read',
  'crash-report:delete',
  'crash-report:open-folder',
  'crash-report:path',
  'update:check',
  'update:download',
  'update:install',
  'feedback:send',
  'red:status',
  'red:vincular',
  'red:desvincular',
  'red:generar-codigo',
  'red:listar-pcs',
  'red:logout',
  'db:reset',
])

export function registerIpcHandlers(): void {
  if (isHija()) {
    // PC Hija: se registran solo los handlers locales y un forwarder por canal
    registerAppHandlers()
    registerI18nHandlers()
    registerFeedbackHandlers()
    registerCrashReportHandlers()
    registerUpdaterHandlers()
    registerRedHandlers()

    for (const canal of IPC_CHANNELS) {
      if (HIJA_LOCAL_CHANNELS.has(canal)) continue
      handleIpc(canal, async (_event, ...args: unknown[]) => {
        try {
          return await rpcABase(canal, args)
        } catch (err: any) {
          logger.warn('red', `RPC a Base falló en canal ${canal}:`, err?.message)
          return { success: false, error: err?.message || 'Error de comunicación con la PC Base' }
        }
      })
    }
    logger.info('red', 'Modo PC Hija: llamadas IPC redirigidas a la PC Base')
    return
  }

  // PC Base / local: handlers normales + red
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
  registerRedHandlers()
}
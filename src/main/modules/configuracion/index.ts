import { registerConfigHandlers } from './config'
import { registerMetodosPagoHandlers } from './metodos-pago'
import { registerBackupHandlers } from './backup'
import { registerNumeracionHandlers } from './numeracion'

export function registerConfiguracionHandlers(): void {
  registerConfigHandlers()
  registerMetodosPagoHandlers()
  registerBackupHandlers()
  registerNumeracionHandlers()
}

export {
  registerConfigHandlers,
  registerMetodosPagoHandlers,
  registerBackupHandlers,
  registerNumeracionHandlers,
}
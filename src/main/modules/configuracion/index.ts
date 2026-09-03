import { registerConfigHandlers } from './config'
import { registerMetodosPagoHandlers } from './metodos-pago'
import { registerBackupHandlers } from './backup'

export function registerConfiguracionHandlers(): void {
  registerConfigHandlers()
  registerMetodosPagoHandlers()
  registerBackupHandlers()
}

export {
  registerConfigHandlers,
  registerMetodosPagoHandlers,
  registerBackupHandlers,
}
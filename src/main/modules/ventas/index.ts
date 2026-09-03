import { registerVentasHandlers } from './ventas'
import { registerComprasHandlers } from './compras'
import { registerCajaHandlers } from './caja'
import { registerReportesHandlers } from './reportes'
import { registerQuotesHandlers } from './quotes'
import { registerProveedoresHandlers } from './proveedores'

export function registerVentasModuleHandlers(): void {
  registerProveedoresHandlers()
  registerVentasHandlers()
  registerComprasHandlers()
  registerCajaHandlers()
  registerReportesHandlers()
  registerQuotesHandlers()
}

export {
  registerVentasHandlers,
  registerComprasHandlers,
  registerCajaHandlers,
  registerReportesHandlers,
  registerQuotesHandlers,
  registerProveedoresHandlers,
}
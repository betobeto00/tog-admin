import { registerVentasHandlers } from './ventas'
import { registerCreditosHandlers } from './creditos'
import { registerComprasHandlers } from './compras'
import { registerCajaHandlers } from './caja'
import { registerReportesHandlers } from './reportes'
import { registerReportesVisualesHandlers } from './reportes-visuales'
import { registerQuotesHandlers } from './quotes'
import { registerProveedoresHandlers } from './proveedores'
import { registerBorradoresHandlers } from './borradores'

export function registerVentasModuleHandlers(): void {
  registerProveedoresHandlers()
  registerVentasHandlers()
  registerBorradoresHandlers()
  registerCreditosHandlers()
  registerComprasHandlers()
  registerCajaHandlers()
  registerReportesHandlers()
  registerReportesVisualesHandlers()
  registerQuotesHandlers()
}

export {
  registerVentasHandlers,
  registerCreditosHandlers,
  registerComprasHandlers,
  registerCajaHandlers,
  registerReportesHandlers,
  registerReportesVisualesHandlers,
  registerQuotesHandlers,
  registerProveedoresHandlers,
  registerBorradoresHandlers,
}
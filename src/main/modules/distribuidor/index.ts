import { registerClientesHandlers } from './clientes'
import { registerPedidosHandlers } from './pedidos'

export function registerDistribuidorHandlers(): void {
  registerClientesHandlers()
  registerPedidosHandlers()
}

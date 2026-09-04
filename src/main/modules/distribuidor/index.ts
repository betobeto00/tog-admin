import { registerClientesHandlers } from './clientes'
import { registerPedidosHandlers } from './pedidos'
import { registerRemitosHandlers } from './remitos'
import { registerListasPrecioHandlers } from './listas-precio'

export function registerDistribuidorHandlers(): void {
  registerClientesHandlers()
  registerPedidosHandlers()
  registerRemitosHandlers()
  registerListasPrecioHandlers()
}

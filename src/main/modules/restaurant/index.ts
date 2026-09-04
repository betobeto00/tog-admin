import { registerMesasHandlers } from './mesas'
import { registerComandasHandlers } from './comandas'

export function registerRestaurantHandlers(): void {
  registerMesasHandlers()
  registerComandasHandlers()
}
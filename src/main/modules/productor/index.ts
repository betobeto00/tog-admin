import { registerProductorHandlers } from './handlers'
import { registerCadenaHandlers } from './cadena'
import { registerLoteHandlers } from './lote'

export function registerAllProductorHandlers(): void {
  registerProductorHandlers()
  registerCadenaHandlers()
  registerLoteHandlers()
}

export { registerProductorHandlers, registerCadenaHandlers, registerLoteHandlers }

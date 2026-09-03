import { registerCategoriasHandlers } from './categorias'
import { registerUnidadesHandlers } from './unidades'
import { registerProductosHandlers } from './productos'
import { registerProductosCsvHandlers } from './csv'

export function registerInventarioHandlers(): void {
  registerCategoriasHandlers()
  registerUnidadesHandlers()
  registerProductosHandlers()
  registerProductosCsvHandlers()
}

export {
  registerCategoriasHandlers,
  registerUnidadesHandlers,
  registerProductosHandlers,
  registerProductosCsvHandlers,
}
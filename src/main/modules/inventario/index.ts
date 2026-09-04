import { registerCategoriasHandlers } from './categorias'
import { registerUnidadesHandlers } from './unidades'
import { registerSubcategoriasHandlers } from './subcategorias'
import { registerProductosHandlers } from './productos'
import { registerProductosCsvHandlers } from './csv'
import { registerCombosHandlers } from './combos'

export function registerInventarioHandlers(): void {
  registerCategoriasHandlers()
  registerUnidadesHandlers()
  registerSubcategoriasHandlers()
  registerProductosHandlers()
  registerProductosCsvHandlers()
  registerCombosHandlers()
}

export {
  registerCategoriasHandlers,
  registerUnidadesHandlers,
  registerSubcategoriasHandlers,
  registerProductosHandlers,
  registerProductosCsvHandlers,
  registerCombosHandlers,
}
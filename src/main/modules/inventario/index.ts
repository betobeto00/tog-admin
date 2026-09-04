import { registerCategoriasHandlers } from './categorias'
import { registerUnidadesHandlers } from './unidades'
import { registerSubcategoriasHandlers } from './subcategorias'
import { registerProductosHandlers } from './productos'
import { registerProductosCsvHandlers } from './csv'

export function registerInventarioHandlers(): void {
  registerCategoriasHandlers()
  registerUnidadesHandlers()
  registerSubcategoriasHandlers()
  registerProductosHandlers()
  registerProductosCsvHandlers()
}

export {
  registerCategoriasHandlers,
  registerUnidadesHandlers,
  registerSubcategoriasHandlers,
  registerProductosHandlers,
  registerProductosCsvHandlers,
}
import { registerCategoriasHandlers } from './categorias'
import { registerUnidadesHandlers } from './unidades'
import { registerSubcategoriasHandlers } from './subcategorias'
import { registerProductosHandlers } from './productos'
import { registerProductosCsvHandlers } from './csv'
import { registerCombosHandlers } from './combos'
import { registerAlmacenesHandlers } from './almacenes'

export function registerInventarioHandlers(): void {
  registerCategoriasHandlers()
  registerUnidadesHandlers()
  registerSubcategoriasHandlers()
  registerProductosHandlers()
  registerProductosCsvHandlers()
  registerCombosHandlers()
  registerAlmacenesHandlers()
}

export {
  registerCategoriasHandlers,
  registerUnidadesHandlers,
  registerSubcategoriasHandlers,
  registerProductosHandlers,
  registerProductosCsvHandlers,
  registerCombosHandlers,
  registerAlmacenesHandlers,
}

import { registerPropietariosHandlers } from './propietarios'
import { registerCaballosHandlers } from './caballos'
import { registerCarrerasHandlers } from './carreras'
import { registerResultadosHandlers } from './resultados'
import { registerApiHipicaHandlers } from './api-publica'
import { registerApuestasHandlers } from './apuestas'

export function registerHipicoHandlers(): void {
  registerPropietariosHandlers()
  registerCaballosHandlers()
  registerCarrerasHandlers()
  registerResultadosHandlers()
  registerApiHipicaHandlers()
  registerApuestasHandlers()
}

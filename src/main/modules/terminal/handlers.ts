import { handleIpc } from '../../core/auth/ipc-guard'
import { getTerminalService } from '../../services/valorTerminal'
import { checkPermissionOrFail } from '../../core/auth'
import { t } from '../../i18n'

export function registerTerminalHandlers(): void {
  const terminal = getTerminalService()

  handleIpc('terminal:conectar', async (_event, data: { puerto: string; baudRate?: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'terminal:conectar', 'config_terminal')
    if (fail) return fail
    try {
      await terminal.connect(data.puerto, data.baudRate || 9600)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  handleIpc('terminal:desconectar', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'terminal:desconectar', 'config_terminal')
    if (fail) return fail
    terminal.disconnect()
    return { success: true }
  })

  handleIpc('terminal:estado', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'terminal:estado', 'config_terminal')
    if (fail) return fail
    return terminal.consultarEstado()
  })

  handleIpc('terminal:procesar-pago', async (_event, data: { monto: number; timeoutMs?: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'terminal:procesar-pago', 'pos_access')
    if (fail) return fail
    try {
      const resultado = await terminal.enviarCobro(data.monto, data.timeoutMs)

      if (resultado.RESPONSE_CODE === '00') {
        return {
          success: true,
          referencia: resultado.REF_NUM,
          autorizacion: resultado.AUTH_CODE,
          tipo_tarjeta: resultado.CARD_TYPE,
          ultimos_4: resultado.MASKED_PAN,
          mensaje: 'Pago aprobado',
        }
      } else {
        return {
          success: false,
          error: resultado.RESPONSE_TEXT || t('errors.terminalDeclinedByTerminal'),
          codigo_respuesta: resultado.RESPONSE_CODE,
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
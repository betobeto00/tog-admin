/**
 * Servicio de comunicación con terminal Valor VP800
 * Protocolo: Semi-integración por cable USB (puerto COM virtual)
 *
 * El terminal se comunica con tramas JSON envueltas entre STX (0x02) y ETX (0x03).
 * Documentación: VP800-connect.md en docs/
 */

import { t } from '../i18n'

const STX = String.fromCharCode(0x02)
const ETX = String.fromCharCode(0x03)

export interface TerminalResponse {
  RESPONSE_CODE: string    // "00" = aprobado
  RESPONSE_TEXT: string
  REF_NUM?: string         // Número de referencia bancaria
  AUTH_CODE?: string       // Código de autorización
  CARD_TYPE?: string       // CRÉDITO, DÉBITO, etc.
  MASKED_PAN?: string      // Últimos 4 dígitos
  AMOUNT?: string
}

export class ValorTerminalService {
  private port: any = null
  private connected = false
  private SerialPort: any = null

  /**
   * Importar serialport dinámicamente (módulo nativo)
   */
  private async loadSerialPort() {
    if (!this.SerialPort) {
      try {
        const mod = await import('serialport')
        this.SerialPort = mod.SerialPort
      } catch (err) {
        throw new Error(
          'La librería serialport no está instalada. Ejecuta: npm install serialport\n' +
          'Luego rebuild: npx electron-rebuild --force'
        )
      }
    }
    return this.SerialPort
  }

  /**
   * Conectar al puerto COM asignado al VP800
   */
  async connect(path: string, baudRate = 9600): Promise<boolean> {
    const SerialPort = await this.loadSerialPort()

    return new Promise((resolve, reject) => {
      this.port = new SerialPort({ path, baudRate, autoOpen: false })

      this.port.open((err: any) => {
        if (err) {
          reject(new Error(`No se pudo abrir el puerto ${path}: ${err.message}`))
        } else {
          this.connected = true
          resolve(true)
        }
      })
    })
  }

  /**
   * Desconectar del terminal
   */
  disconnect(): void {
    if (this.port && this.port.isOpen) {
      this.port.close()
    }
    this.connected = false
    this.port = null
  }

  /**
   * Verificar si está conectado
   */
  isConnected(): boolean {
    return this.connected && this.port?.isOpen === true
  }

  /**
   * Enviar monto al terminal y esperar a que pase la tarjeta
   * @param monto - Monto en dólares (ej: 15.50)
   * @param timeoutMs - Timeout en milisegundos (default: 120s)
   */
  enviarCobro(monto: number, timeoutMs = 120000): Promise<TerminalResponse> {
    return new Promise((resolve, reject) => {
      if (!this.port || !this.port.isOpen) {
        return reject(new Error(t('errors.terminalNotConnected')))
      }

      // Estructura de payload requerida por la API semi-integrada de Valor
      const payload = {
        TRAN_MODE: '1',                    // 1 = Producción
        TRAN_CODE: '1',                    // 1 = Venta (Sale)
        AMOUNT: Math.round(monto * 100).toString(),  // En centavos
      }

      // Envolver con STX y ETX
      const tramaComando = `${STX}${JSON.stringify(payload)}${ETX}`

      // Timeout para evitar espera infinita
      const timeout = setTimeout(() => {
        this.port?.removeAllListeners('data')
        reject(new Error(t('errors.terminalClientTimeout')))
      }, timeoutMs)

      // Limpiar buffer previo
      let bufferRespuesta = ''

      // Escuchar respuesta del terminal
      const onData = (chunk: Buffer) => {
        bufferRespuesta += chunk.toString()

        if (bufferRespuesta.includes(ETX)) {
          clearTimeout(timeout)
          this.port?.removeListener('data', onData)

          try {
            // Limpiar caracteres de control
            const jsonLimpio = bufferRespuesta
              .replace(new RegExp(STX, 'g'), '')
              .replace(new RegExp(ETX, 'g'), '')
              .trim()

            const resultado: TerminalResponse = JSON.parse(jsonLimpio)
            resolve(resultado)
          } catch (e) {
            reject(new Error(t('errors.terminalConnection')))
          }
        }
      }

      this.port.on('data', onData)

      // Enviar comando al terminal
      this.port.write(tramaComando, (err: any) => {
        if (err) {
          clearTimeout(timeout)
          this.port?.removeListener('data', onData)
          reject(new Error(`Error al enviar comando: ${err.message}`))
        }
      })
    })
  }

  /**
   * Consultar estado del terminal
   */
  async consultarEstado(): Promise<{ conectado: boolean; puerto: string | null }> {
    return {
      conectado: this.isConnected(),
      puerto: this.port?.path || null,
    }
  }
}

// Singleton
let terminalInstance: ValorTerminalService | null = null

export function getTerminalService(): ValorTerminalService {
  if (!terminalInstance) {
    terminalInstance = new ValorTerminalService()
  }
  return terminalInstance
}

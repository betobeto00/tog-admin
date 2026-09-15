/**
 * Envío de bytes ESC/POS a una impresora térmica.
 *
 * Las ticketeras económicas se conectan por USB y exponen un puerto serie
 * (COM3, /dev/usb/lp0…), igual que el terminal VP800 del módulo `terminal`
 * (ver src/main/services/valorTerminal.ts). `serialport` es un módulo nativo:
 * se importa dinámicamente para que la app arranque aunque no esté compilado.
 */

export interface PuertoSerie {
  path: string
  fabricante?: string | null
}

export interface OpcionesImpresion {
  puerto: string
  baudRate?: number
}

export interface ResultadoImpresion {
  success: boolean
  bytes?: number
  error?: string
}

/** Lista los puertos serie disponibles (COM1, COM3…). */
export async function listarPuertosSerie(): Promise<PuertoSerie[]> {
  try {
    const mod: any = await import('serialport')
    const puertos = await mod.SerialPort.list()
    return puertos.map((p: any) => ({
      path: p.path,
      fabricante: p.manufacturer ?? p.friendlyName ?? null,
    }))
  } catch (err: any) {
    throw new Error(
      'No se pudo listar los puertos serie. Verificá que la impresora esté conectada. ' +
        `(${err?.message || err})`,
    )
  }
}

/**
 * Escribe los bytes en el puerto y cierra. Resuelve cuando el sistema confirmó
 * la escritura (drain), no cuando el papel terminó de salir.
 */
export async function enviarEscPos(bytes: number[], opciones: OpcionesImpresion): Promise<ResultadoImpresion> {
  const puerto = (opciones?.puerto || '').trim()
  if (!puerto) {
    return { success: false, error: 'No hay impresora configurada. Elegí el puerto en Configuración → Impresión.' }
  }
  if (!Array.isArray(bytes) || bytes.length === 0) {
    return { success: false, error: 'El ticket quedó vacío' }
  }

  let SerialPort: any
  try {
    const mod: any = await import('serialport')
    SerialPort = mod.SerialPort
  } catch (err: any) {
    return { success: false, error: `La librería serialport no está disponible (${err?.message || err})` }
  }

  return new Promise<ResultadoImpresion>((resolve) => {
    let terminado = false
    const finalizar = (resultado: ResultadoImpresion) => {
      if (terminado) return
      terminado = true
      resolve(resultado)
    }

    let port: any
    try {
      port = new SerialPort({ path: puerto, baudRate: opciones.baudRate || 9600, autoOpen: false })
    } catch (err: any) {
      return finalizar({ success: false, error: `Puerto inválido: ${err?.message || err}` })
    }

    port.open((errOpen: any) => {
      if (errOpen) {
        return finalizar({ success: false, error: `No se pudo abrir ${puerto}: ${errOpen.message || errOpen}` })
      }
      const buffer = Buffer.from(bytes)
      port.write(buffer, (errWrite: any) => {
        if (errWrite) {
          port.close(() => {})
          return finalizar({ success: false, error: `Error al enviar a ${puerto}: ${errWrite.message || errWrite}` })
        }
        port.drain((errDrain: any) => {
          port.close(() => {})
          if (errDrain) {
            return finalizar({ success: false, error: `Error al vaciar el buffer: ${errDrain.message || errDrain}` })
          }
          finalizar({ success: true, bytes: buffer.length })
        })
      })
    })
  })
}

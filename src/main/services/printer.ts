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
 * Nombres de puerto serie que aceptamos.
 *
 * Windows: `COM1`…`COM256`. Unix: cualquier cosa bajo `/dev/` (`ttyUSB0`,
 * `ttyACM0`, `cu.usbserial-1420`, `usb/lp0`, `serial/by-id/…`).
 */
const PUERTO_SERIE_RE = /^(COM\d{1,3}|\/dev\/[A-Za-z0-9._/-]+)$/i

/** Valida la *forma* del nombre del puerto (no que exista). */
export function esNombreDePuertoValido(puerto: string): boolean {
  const valor = (puerto || '').trim()
  if (!valor || valor.includes('..')) return false
  return PUERTO_SERIE_RE.test(valor)
}

/**
 * Comprueba que el puerto configurado sea real antes de abrirlo.
 *
 * El puerto sale de la configuración, y la configuración puede venir de un backup
 * restaurado o haber quedado apuntando a otra cosa: no alcanza con que un humano
 * lo haya elegido de una lista. Sin esta guarda, un valor arbitrario hacía que la
 * app escribiera bytes ESC/POS en el dispositivo que se le indicara (cualquier
 * `/dev/...`), con el permiso del proceso main.
 *
 * Si la enumeración falla (driver ausente, entorno de test) NO se bloquea la
 * impresión: el `open()` de abajo ya devuelve un error concreto.
 */
export async function validarPuertoDisponible(puerto: string): Promise<ResultadoImpresion> {
  if (!esNombreDePuertoValido(puerto)) {
    return {
      success: false,
      error: `Puerto de impresora inválido: "${puerto}". Elegí la ticketera en Configuración → Impresión.`,
    }
  }
  try {
    const puertos = await listarPuertosSerie()
    if (puertos.length > 0 && !puertos.some((p) => p.path === puerto)) {
      return {
        success: false,
        error: `El puerto ${puerto} no está disponible. Verificá que la impresora esté encendida o elegí otro puerto en Configuración → Impresión.`,
      }
    }
  } catch {
    // Sin enumeración disponible seguimos: la apertura real decide.
  }
  return { success: true }
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

  // El puerto se valida ANTES de importar el módulo nativo: así un valor
  // arbitrario se rechaza sin tocar el hardware.
  const puertoValido = await validarPuertoDisponible(puerto)
  if (!puertoValido.success) return puertoValido

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

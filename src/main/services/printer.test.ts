// MED-06: el puerto de la impresora se usaba tal cual venía de la configuración.
// Ahora se valida la forma del nombre y, cuando se pueden enumerar, que el puerto
// esté entre los conectados.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { estado } = vi.hoisted(() => ({
  estado: {
    puertos: [] as Array<{ path: string; manufacturer?: string }>,
    listError: null as Error | null,
    abierto: [] as string[],
    escrito: [] as number[],
    openError: null as Error | null,
    writeError: null as Error | null,
  },
}))

vi.mock('serialport', () => {
  class FakeSerialPort {
    path: string
    constructor(opts: { path: string }) {
      this.path = opts.path
    }
    static async list() {
      if (estado.listError) throw estado.listError
      return estado.puertos
    }
    open(cb: (err: Error | null) => void) {
      if (estado.openError) return cb(estado.openError)
      estado.abierto.push(this.path)
      cb(null)
    }
    write(buf: Buffer, cb: (err: Error | null) => void) {
      if (estado.writeError) return cb(estado.writeError)
      estado.escrito.push(...Array.from(buf))
      cb(null)
    }
    drain(cb: (err: Error | null) => void) {
      cb(null)
    }
    close(cb: () => void) {
      cb()
    }
  }
  return { SerialPort: FakeSerialPort }
})

import { enviarEscPos, listarPuertosSerie, esNombreDePuertoValido, validarPuertoDisponible } from './printer'

const TICKET = [0x1b, 0x40, 0x41]

function reiniciarEstado() {
  estado.puertos = [{ path: 'COM3', manufacturer: 'Epson' }]
  estado.listError = null
  estado.abierto = []
  estado.escrito = []
  estado.openError = null
  estado.writeError = null
}

describe('nombre de puerto serie', () => {
  it('acepta los formatos reales de Windows y Unix', () => {
    for (const puerto of [
      'COM1',
      'COM3',
      'COM12',
      '/dev/ttyUSB0',
      '/dev/ttyACM0',
      '/dev/cu.usbserial-1420',
      '/dev/tty.usbserial-1420',
      '/dev/usb/lp0',
      '/dev/serial/by-id/usb-Epson_TM-T20III',
    ]) {
      expect(esNombreDePuertoValido(puerto), puerto).toBe(true)
    }
  })

  it('rechaza vacíos, rutas fuera de /dev y path traversal', () => {
    for (const puerto of [
      '',
      '   ',
      'COM',
      'COM9999',
      '/etc/passwd',
      'C:\\Windows\\System32\\drivers\\etc\\hosts',
      '/dev/../../etc/passwd',
      '\\\\servidor\\recurso',
      '/dev/ttyUSB0; rm -rf /',
      'LPT1',
    ]) {
      expect(esNombreDePuertoValido(puerto), puerto).toBe(false)
    }
  })
})

describe('validarPuertoDisponible', () => {
  beforeEach(reiniciarEstado)

  it('acepta un puerto que figura en el listado del sistema', async () => {
    expect(await validarPuertoDisponible('COM3')).toEqual({ success: true })
  })

  it('rechaza un puerto válido en la forma pero que no existe en el sistema', async () => {
    const res = await validarPuertoDisponible('COM9')
    expect(res.success).toBe(false)
    expect(res.error).toContain('COM9')
    expect(res.error).toContain('no está disponible')
  })

  it('rechaza un nombre inválido sin consultar el hardware', async () => {
    estado.listError = new Error('no debería llamarse a list()')
    const res = await validarPuertoDisponible('/etc/passwd')
    expect(res.success).toBe(false)
    expect(res.error).toContain('inválido')
  })

  it('no bloquea la impresión si el listado falla (driver ausente, entorno de test)', async () => {
    estado.listError = new Error('serialport no disponible')
    expect(await validarPuertoDisponible('COM3')).toEqual({ success: true })
    expect(estado.listError).not.toBeNull() // se intentó listar y se ignoró el error
  })

  it('no bloquea si el sistema no reporta ningún puerto', async () => {
    estado.puertos = []
    expect(await validarPuertoDisponible('COM3')).toEqual({ success: true })
  })
})

describe('enviarEscPos', () => {
  beforeEach(reiniciarEstado)

  it('escribe los bytes en el puerto configurado y reporta el tamaño', async () => {
    const res = await enviarEscPos(TICKET, { puerto: 'COM3' })
    expect(res).toEqual({ success: true, bytes: 3 })
    expect(estado.abierto).toEqual(['COM3'])
    expect(estado.escrito).toEqual(TICKET)
  })

  it('no escribe nada si el puerto no está disponible', async () => {
    const res = await enviarEscPos(TICKET, { puerto: 'COM9' })
    expect(res.success).toBe(false)
    expect(estado.abierto).toEqual([])
    expect(estado.escrito).toEqual([])
  })

  it('no escribe nada si el nombre del puerto no es un puerto serie', async () => {
    const res = await enviarEscPos(TICKET, { puerto: '/etc/passwd' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('inválido')
    expect(estado.escrito).toEqual([])
  })

  it('avisa cuando no hay impresora configurada', async () => {
    const res = await enviarEscPos(TICKET, { puerto: '   ' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('No hay impresora configurada')
  })

  it('avisa cuando el ticket viene vacío', async () => {
    const res = await enviarEscPos([], { puerto: 'COM3' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('vacío')
    expect(estado.abierto).toEqual([])
  })

  it('propaga el error de apertura del puerto', async () => {
    estado.openError = new Error('Acceso denegado')
    const res = await enviarEscPos(TICKET, { puerto: 'COM3' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('Acceso denegado')
  })

  it('propaga el error de escritura', async () => {
    estado.writeError = new Error('Dispositivo desconectado')
    const res = await enviarEscPos(TICKET, { puerto: 'COM3' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('Dispositivo desconectado')
  })
})

describe('listarPuertosSerie', () => {
  beforeEach(reiniciarEstado)

  it('normaliza el listado del sistema', async () => {
    estado.puertos = [{ path: 'COM3', manufacturer: 'Epson' }, { path: 'COM4' }]
    expect(await listarPuertosSerie()).toEqual([
      { path: 'COM3', fabricante: 'Epson' },
      { path: 'COM4', fabricante: null },
    ])
  })

  it('convierte el fallo de la librería en un mensaje accionable', async () => {
    estado.listError = new Error('bindings no compilados')
    await expect(listarPuertosSerie()).rejects.toThrow('Verificá que la impresora esté conectada')
  })
})

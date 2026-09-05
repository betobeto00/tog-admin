import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { saveImagen, deleteImagen, getImagenPath, getImagenDataUrl, validateImagen, setImagenesDir } from './imagenes'

function jpgBuffer(): Buffer {
  // Cabecera mínima válida: FFD8FF + contenido
  return Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16, 0x41)])
}

function pngBuffer(): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(16, 0x41),
  ])
}

function webpBuffer(): Buffer {
  return Buffer.concat([
    Buffer.from('RIFF', 'ascii'),
    Buffer.alloc(4, 0x42),
    Buffer.from('WEBP', 'ascii'),
    Buffer.alloc(8, 0x41),
  ])
}

describe('imagenes service', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tog-imagenes-'))
    setImagenesDir(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('save + get + delete roundtrip (jpg)', async () => {
    const buf = jpgBuffer()
    const file = await saveImagen(999, buf)
    expect(file).toContain('999.jpg')
    expect(getImagenPath(999)).toBe(file)
    expect(getImagenDataUrl(999)).toContain('data:image/jpg;base64,')
    await deleteImagen(999)
    expect(getImagenPath(999)).toBeNull()
    expect(getImagenDataUrl(999)).toBeNull()
  })

  it('detecta extension por magic bytes (png/webp)', async () => {
    expect(validateImagen(pngBuffer())).toBe('png')
    expect(validateImagen(webpBuffer())).toBe('webp')
  })

  it('rechaza formatos inválidos', async () => {
    expect(validateImagen(Buffer.from('GIF89a-fake', 'ascii'))).toBeNull()
    expect(validateImagen(Buffer.alloc(0))).toBeNull()
    await expect(saveImagen(1, Buffer.from('no-imagen', 'ascii'))).rejects.toThrow()
  })

  it('rechaza archivos > 2MB', () => {
    expect(validateImagen(Buffer.alloc(3 * 1024 * 1024, 0x41))).toBeNull()
  })

  it('reemplaza extensión previa al guardar otra', async () => {
    await saveImagen(7, jpgBuffer())
    await saveImagen(7, pngBuffer())
    expect(getImagenPath(7)).toContain('7.png')
    expect(getImagenPath(7)?.endsWith('7.jpg')).toBe(false)
  })
})
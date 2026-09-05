import path from 'path'
import fs from 'fs'
import { app } from 'electron'

const EXTENSIONS = ['jpg', 'png', 'webp'] as const
export type ImagenExt = (typeof EXTENSIONS)[number]

const MAX_BYTES = 2 * 1024 * 1024

let _customDir: string | null = null

export function setImagenesDir(dir: string): void {
  _customDir = dir
}

function imagesDir(): string {
  return _customDir || path.join(app.getPath('userData'), 'imagenes')
}

function fileFor(productoId: number, ext: ImagenExt): string {
  return path.join(imagesDir(), `${productoId}.${ext}`)
}

function detectExt(buffer: Buffer): ImagenExt | null {
  if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg'
  }
  if (
    buffer.length > 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return 'png'
  }
  if (
    buffer.length > 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp'
  }
  return null
}

export function validateImagen(buffer: Buffer): ImagenExt | null {
  if (!buffer || buffer.length === 0 || buffer.length > MAX_BYTES) return null
  return detectExt(buffer)
}

export async function saveImagen(productoId: number, buffer: Buffer): Promise<string> {
  const ext = validateImagen(buffer)
  if (!ext) {
    throw new Error('Formato de imagen inválido (JPG, PNG o WebP, máx 2MB)')
  }
  await fs.promises.mkdir(imagesDir(), { recursive: true })
  for (const e of EXTENSIONS) {
    await fs.promises.unlink(fileFor(productoId, e)).catch(() => {})
  }
  const file = fileFor(productoId, ext)
  await fs.promises.writeFile(file, buffer)
  return file
}

export async function deleteImagen(productoId: number): Promise<void> {
  for (const e of EXTENSIONS) {
    await fs.promises.unlink(fileFor(productoId, e)).catch(() => {})
  }
}

export function getImagenPath(productoId: number): string | null {
  for (const e of EXTENSIONS) {
    const file = fileFor(productoId, e)
    if (fs.existsSync(file)) return file
  }
  return null
}

export function getImagenDataUrl(productoId: number): string | null {
  const file = getImagenPath(productoId)
  if (!file) return null
  const ext = path.extname(file).slice(1)
  const data = fs.readFileSync(file).toString('base64')
  return `data:image/${ext};base64,${data}`
}

export function hasImagenesDir(): boolean {
  return fs.existsSync(imagesDir())
}

export function getImagenesDir(): string {
  return imagesDir()
}

export { imagesDir as getImagesDirPath }
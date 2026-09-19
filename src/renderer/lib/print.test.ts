// @vitest-environment jsdom
// Generador único de documentos imprimibles: centraliza el `document.write`,
// escapa el título y dispara la impresión (una ventana sin `document.close()`
// no dispara `load` y sale en blanco).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { abrirDocumento, ESTILOS_BASE } from './print'

function mockVentana() {
  const html: string[] = []
  const win = {
    document: {
      write: (h: string) => html.push(h),
      close: vi.fn(),
    },
    focus: vi.fn(),
    print: vi.fn(),
  }
  vi.spyOn(window, 'open').mockReturnValue(win as any)
  return { html, win }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('abrirDocumento', () => {
  it('arma el documento, cierra e imprime', () => {
    const { html, win } = mockVentana()

    const ok = abrirDocumento({ titulo: 'Ticket 12', cuerpo: '<p>hola</p>' })

    expect(ok).toBe(true)
    expect(html[0]).toContain('<!DOCTYPE html>')
    expect(html[0]).toContain('<title>Ticket 12</title>')
    expect(html[0]).toContain('<p>hola</p>')
    expect(html[0]).toContain(ESTILOS_BASE.trim().split('\n')[0].trim())
    expect(win.document.close).toHaveBeenCalled()
    expect(win.print).toHaveBeenCalledTimes(1)
  })

  it('escapa el título (no puede inyectar markup ni script)', () => {
    const { html } = mockVentana()

    abrirDocumento({
      titulo: '</title><script>alert(1)</script>',
      cuerpo: '<p>x</p>',
    })

    expect(html[0]).not.toContain('<script>')
    expect(html[0]).toContain('&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('no imprime solo si el documento lo pide (trae su propio botón)', () => {
    const { win } = mockVentana()

    abrirDocumento({ titulo: 'Reporte', cuerpo: '<p>x</p>', imprimir: false })

    expect(win.print).not.toHaveBeenCalled()
    // Igual se cierra: el documento tiene que quedar cargado y visible
    expect(win.document.close).toHaveBeenCalled()
  })

  it('fusiona los estilos propios del documento con los base', () => {
    const { html } = mockVentana()

    abrirDocumento({ titulo: 'X', cuerpo: '', estilos: 'body{font-size:12px}' })

    expect(html[0]).toContain('body{font-size:12px}')
    expect(html[0]).toContain('@media print')
  })

  it('devuelve false si el navegador bloquea la ventana emergente', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)

    expect(abrirDocumento({ titulo: 'X', cuerpo: '' })).toBe(false)
  })
})

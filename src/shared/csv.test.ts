// CSV injection: un producto/cliente/nota con `=`, `+`, `-` o `@` al frente se
// ejecuta como fórmula al abrir el archivo exportado en Excel o Sheets.

import { describe, it, expect } from 'vitest'
import { aCsv, celdaCsv } from './csv'

describe('celdaCsv', () => {
  it('neutraliza celdas que la planilla tomaría como fórmula', () => {
    expect(celdaCsv('=HYPERLINK("http://malo","clic")')).toBe('"\'=HYPERLINK(""http://malo"",""clic"")"')
    expect(celdaCsv('+SUM(1+1)')).toBe("'+SUM(1+1)")
    expect(celdaCsv('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(celdaCsv('=1+1')).toBe("'=1+1")
    expect(celdaCsv('\t=cmd')).toBe(`'\t=cmd`)
  })

  it('no toca los números (los importes negativos son legítimos)', () => {
    expect(celdaCsv(-15.5)).toBe('-15.5')
    expect(celdaCsv('+3')).toBe('+3')
    expect(celdaCsv('-1e3')).toBe('-1e3')
    expect(celdaCsv(0)).toBe('0')
  })

  it('escapa comillas, separador y saltos de línea', () => {
    expect(celdaCsv('Harina 1kg, fina')).toBe('"Harina 1kg, fina"')
    expect(celdaCsv('dice "hola"')).toBe('"dice ""hola"""')
    expect(celdaCsv('linea1\nlinea2')).toBe('"linea1\nlinea2"')
    expect(celdaCsv(null)).toBe('')
    expect(celdaCsv(undefined)).toBe('')
  })

  it('respeta el separador de Excel en español', () => {
    expect(celdaCsv('Azúcar; morena', ';')).toBe('"Azúcar; morena"')
    // Con `;` la coma no necesita comillas
    expect(celdaCsv('Harina, fina', ';')).toBe('Harina, fina')
  })
})

describe('aCsv', () => {
  it('arma el archivo completo con encabezado y filas', () => {
    expect(aCsv([['nombre', 'precio'], ['Harina, fina', -15.5], ['=peligro', 3]])).toBe(
      ['nombre,precio', '"Harina, fina",-15.5', "'=peligro,3"].join('\n'),
    )
  })

  it('usa `;` cuando el consumer lo pide', () => {
    expect(aCsv([['a', 'b'], ['1', '2']], ';')).toBe('a;b\n1;2')
  })
})

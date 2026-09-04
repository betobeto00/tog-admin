import { describe, it, expect } from 'vitest'
import { isTrustedSender } from './ipc-guard'

const MAIN_URL = 'file:///C:/app/dist/index.html'

function makeEvent(url: string | undefined, sameFrame = true): any {
  const frame = url === undefined ? null : { url }
  return {
    senderFrame: frame,
    sender: {
      mainFrame: sameFrame ? frame : { url: 'file:///C:/app/evil-frame.html' },
    },
  }
}

describe('isTrustedSender', () => {
  it('acepta file:// (app empaquetada)', () => {
    expect(isTrustedSender(makeEvent(MAIN_URL))).toBe(true)
  })

  it('acepta el origen del dev server de Vite', () => {
    expect(isTrustedSender(makeEvent('http://localhost:5173/'))).toBe(true)
  })

  it('rechaza orígenes externos', () => {
    expect(isTrustedSender(makeEvent('https://evil.com/phish'))).toBe(false)
  })

  it('rechaza subframes (iframe)', () => {
    expect(isTrustedSender(makeEvent(MAIN_URL, false))).toBe(false)
  })

  it('rechaza senderFrame nulo o sin URL', () => {
    expect(isTrustedSender(makeEvent(undefined))).toBe(false)
    expect(isTrustedSender(makeEvent(''))).toBe(false)
  })

  it('rechaza URLs inválidas', () => {
    expect(isTrustedSender(makeEvent('not a url'))).toBe(false)
  })
})
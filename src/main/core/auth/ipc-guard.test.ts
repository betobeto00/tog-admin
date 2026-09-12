import { describe, it, expect } from 'vitest'
import { isTrustedSender } from './ipc-guard'
import type { IpcMainInvokeEvent } from 'electron'

const MAIN_URL = 'file:///C:/app/dist/index.html'

function makeEvent(url: string | undefined): any {
  const frame = url === undefined ? null : { url }
  return {
    senderFrame: frame,
    sender: {
      mainFrame: frame,
      getURL: () => url || '',
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

  it('rechaza URLs vacías', () => {
    expect(isTrustedSender(makeEvent(undefined))).toBe(false)
    expect(isTrustedSender(makeEvent(''))).toBe(false)
  })

  it('rechaza URLs inválidas', () => {
    expect(isTrustedSender(makeEvent('not a url'))).toBe(false)
  })

  it('acepta cuando getURL no es función (sandboxed)', () => {
    const event = {
      sender: {
        getURL: 'not a function',
      },
    } as unknown as IpcMainInvokeEvent
    expect(isTrustedSender(event)).toBe(false)
  })

  it('rechaza cuando getURL lanza error', () => {
    const event = {
      sender: {
        getURL: () => { throw new Error('no access') },
      },
    } as unknown as IpcMainInvokeEvent
    expect(isTrustedSender(event)).toBe(false)
  })
})

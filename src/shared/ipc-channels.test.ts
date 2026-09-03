import { describe, it, expect } from 'vitest'
import { PREAUTH_CHANNELS } from './ipc-channels'

describe('PREAUTH_CHANNELS', () => {
  it('keeps license channels pre-auth (lock-screen activation)', () => {
    // license:import must stay pre-auth: it is the only path to activate the
    // app from the lock screen, before any user is logged in.
    expect(PREAUTH_CHANNELS).toContain('license:import')
    expect(PREAUTH_CHANNELS).toContain('license:status')
    expect(PREAUTH_CHANNELS).toContain('license:validate')
  })

  it('does not allow data channels without a session', () => {
    for (const channel of ['ventas:create', 'productos:list', 'config:get', 'usuarios:list'] as const) {
      expect(PREAUTH_CHANNELS).not.toContain(channel)
    }
  })

  it('has no duplicates', () => {
    expect(new Set(PREAUTH_CHANNELS).size).toBe(PREAUTH_CHANNELS.length)
  })
})
import log from 'electron-log'

// electron-log necesita el runtime de Electron (app.getPath). En contextos CLI
// (ej. `npm run db:migrate` con tsx) se degrada a console para no romper.
let inElectron = true
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { app } = require('electron')
  if (!app || !app.getPath) inElectron = false
} catch {
  inElectron = false
}

function prefix(modulo: string): string {
  return `[${modulo}]`
}

function pick(modulo: string): Pick<typeof console, 'log' | 'info' | 'warn' | 'error'> {
  if (inElectron) return log as unknown as Pick<typeof console, 'log' | 'info' | 'warn' | 'error'>
  return console
}

export const logger = {
  info(modulo: string, message: string, ...args: unknown[]): void {
    pick(modulo).info(prefix(modulo), message, ...args)
  },
  warn(modulo: string, message: string, ...args: unknown[]): void {
    pick(modulo).warn(prefix(modulo), message, ...args)
  },
  error(modulo: string, message: string, ...args: unknown[]): void {
    pick(modulo).error(prefix(modulo), message, ...args)
  },
  debug(modulo: string, message: string, ...args: unknown[]): void {
    pick(modulo).log(prefix(modulo), message, ...args)
  },
}
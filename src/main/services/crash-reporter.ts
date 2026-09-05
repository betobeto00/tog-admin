import { app, dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { logger } from './logger'

// ============================================
// CRASH REPORTER - Informes de Error
// ============================================

export interface CrashReport {
  id: string
  timestamp: string
  type: 'uncaught-exception' | 'unhandled-rejection' | 'renderer-error' | 'gpu-process-crash' | 'manual'
  message: string
  stack?: string
  componentStack?: string
  // System info
  appVersion: string
  electronVersion: string
  nodeVersion: string
  chromeVersion: string
  osPlatform: string
  osRelease: string
  osArch: string
  totalMemory: number
  freeMemory: number
  uptime: number
  // Context
  currentUrl?: string
  userAgent?: string
  loggedUser?: string
  recentLogs?: string[]
}

function getCrashReportsDir(): string {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'crash-reports')
  }
  return path.join(process.cwd(), 'data', 'crash-reports')
}

function ensureCrashDir(): string {
  const dir = getCrashReportsDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

function generateId(): string {
  const now = new Date()
  const date = now.toISOString().split('T')[0]
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '')
  const random = Math.random().toString(36).substring(2, 6)
  return `crash-${date}-${time}-${random}`
}

// Buffer circular de logs recientes para incluir en reportes
const LOG_BUFFER_SIZE = 100
const logBuffer: string[] = []

export function captureLog(message: string): void {
  const timestamp = new Date().toISOString()
  logBuffer.push(`[${timestamp}] ${message}`)
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift()
  }
}

export function getRecentLogs(): string[] {
  return [...logBuffer]
}

function buildReport(data: {
  type: CrashReport['type']
  message: string
  stack?: string
  componentStack?: string
  currentUrl?: string
  userAgent?: string
  loggedUser?: string
}): CrashReport {
  return {
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: data.type,
    message: data.message,
    stack: data.stack,
    componentStack: data.componentStack,
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron || 'unknown',
    nodeVersion: process.versions.node || 'unknown',
    chromeVersion: process.versions.chrome || 'unknown',
    osPlatform: os.platform(),
    osRelease: os.release(),
    osArch: os.arch(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: os.uptime(),
    currentUrl: data.currentUrl,
    userAgent: data.userAgent,
    loggedUser: data.loggedUser,
    recentLogs: getRecentLogs(),
  }
}

function formatReportText(report: CrashReport): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════════════',
    '  TOG ADMIN - INFORME DE ERROR / CRASH REPORT',
    '═══════════════════════════════════════════════════════════════',
    '',
    `ID:            ${report.id}`,
    `Fecha/Hora:    ${report.timestamp}`,
    `Tipo:          ${report.type}`,
    '',
    '─── ERROR ───────────────────────────────────────────────────',
    '',
    report.message,
    '',
  ]

  if (report.stack) {
    lines.push('─── STACK TRACE ──────────────────────────────────────────────')
    lines.push('')
    lines.push(report.stack)
    lines.push('')
  }

  if (report.componentStack) {
    lines.push('─── COMPONENT STACK (React) ──────────────────────────────────')
    lines.push('')
    lines.push(report.componentStack)
    lines.push('')
  }

  lines.push('─── SISTEMA ─────────────────────────────────────────────────')
  lines.push('')
  lines.push(`App Version:       ${report.appVersion}`)
  lines.push(`Electron:          ${report.electronVersion}`)
  lines.push(`Node.js:           ${report.nodeVersion}`)
  lines.push(`Chrome:            ${report.chromeVersion}`)
  lines.push(`OS:                ${report.osPlatform} ${report.osRelease} (${report.osArch})`)
  lines.push(`RAM Total:         ${(report.totalMemory / 1024 / 1024 / 1024).toFixed(1)} GB`)
  lines.push(`RAM Libre:         ${(report.freeMemory / 1024 / 1024 / 1024).toFixed(1)} GB`)
  lines.push(`Uptime OS:         ${Math.floor(report.uptime / 3600)}h ${Math.floor((report.uptime % 3600) / 60)}m`)
  lines.push('')

  if (report.currentUrl) {
    lines.push('─── CONTEXTO ────────────────────────────────────────────────')
    lines.push('')
    lines.push(`URL Actual:        ${report.currentUrl}`)
    if (report.userAgent) lines.push(`User Agent:        ${report.userAgent}`)
    if (report.loggedUser) lines.push(`Usuario Logueado:  ${report.loggedUser}`)
    lines.push('')
  }

  if (report.recentLogs && report.recentLogs.length > 0) {
    lines.push('─── LOGS RECIENTES ──────────────────────────────────────────')
    lines.push('')
    for (const log of report.recentLogs.slice(-30)) {
      lines.push(log)
    }
    lines.push('')
  }

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('  Fin del informe. Adjunte este archivo al correo de soporte.')
  lines.push('═══════════════════════════════════════════════════════════════')

  return lines.join('\n')
}

/**
 * Genera y guarda un reporte de crash. Devuelve la ruta del archivo.
 */
export function saveCrashReport(data: {
  type: CrashReport['type']
  message: string
  stack?: string
  componentStack?: string
  currentUrl?: string
  userAgent?: string
  loggedUser?: string
}): string {
  const report = buildReport(data)
  const dir = ensureCrashDir()
  const filename = `${report.id}.txt`
  const filePath = path.join(dir, filename)

  const content = formatReportText(report)
  fs.writeFileSync(filePath, content, 'utf8')

  logger.info('crash', `Reporte guardado: ${filePath}`)
  return filePath
}

/**
 * Lista todos los reportes de crash existentes
 */
export function listCrashReports(): Array<{ id: string; filename: string; path: string; timestamp: string; size: number }> {
  const dir = getCrashReportsDir()
  if (!fs.existsSync(dir)) return []

  return fs.readdirSync(dir)
    .filter(f => f.startsWith('crash-') && f.endsWith('.txt'))
    .map(f => {
      const filePath = path.join(dir, f)
      const stat = fs.statSync(filePath)
      // Extraer timestamp del filename: crash-YYYY-MM-DD-HHMMSS-xxxx.txt
      const match = f.match(/crash-(\d{4}-\d{2}-\d{2})-(\d{6})/)
      return {
        id: f.replace('.txt', ''),
        filename: f,
        path: filePath,
        timestamp: match ? `${match[1]}T${match[2].replace(/(\d{2})(\d{2})(\d{2})/, '$1:$2:$3')}` : stat.mtime.toISOString(),
        size: stat.size,
      }
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}

/**
 * Obtiene el contenido de un reporte específico
 */
export function readCrashReport(filename: string): string | null {
  const dir = getCrashReportsDir()
  const filePath = path.join(dir, filename)
  if (!fs.existsSync(filePath)) return null
  return fs.readFileSync(filePath, 'utf8')
}

/**
 * Elimina un reporte específico
 */
export function deleteCrashReport(filename: string): boolean {
  const dir = getCrashReportsDir()
  const filePath = path.join(dir, filename)
  if (!fs.existsSync(filePath)) return false
  fs.unlinkSync(filePath)
  return true
}

/**
 * Abre la carpeta de reportes en el explorador
 */
export async function openCrashReportsFolder(): Promise<void> {
  const dir = ensureCrashDir()
  const { shell } = await import('electron')
  shell.openPath(dir)
}

/**
 * Obtiene la ruta de la carpeta de reportes
 */
export function getCrashReportsPath(): string {
  return getCrashReportsDir()
}

/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Plugin para quitar crossorigin de tags script/link (Electron file:// no soporta CORS)
function electronHtmlFix(): any {
  return {
    name: 'electron-html-fix',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, '')
    },
  }
}

// CSP: estricta en producción, relajada en dev (Vite necesita inline + ws para HMR).
//
// ⚠️ Este plugin REESCRIBE el meta tag de `index.html` en build: si no se
// actualiza acá, la edición del HTML no llega al instalador. Son tres lugares
// que deben coincidir: este archivo (build del renderer), `src/main/index.ts`
// (header de sesión de Electron) e `index.html` (fallback en dev).
//
// `connect-src 'self'`: el renderer de TOG Admin NO hace requests externos (es
// offline-first; todo el tráfico de red vive en el proceso main). Con `https:`
// abierto, un XSS podía exfiltrar la base del negocio a cualquier dominio.
const DEV_CSP = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:5173 ws://localhost:5173; object-src 'none'; base-uri 'self'; form-action 'self'"
const PROD_CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"

function injectCsp(): any {
  return {
    name: 'inject-csp',
    transformIndexHtml(html, ctx) {
      const csp = ctx.server ? DEV_CSP : PROD_CSP
      return html.replace(
        /<meta http-equiv="Content-Security-Policy"[^>]*>/,
        `<meta http-equiv="Content-Security-Policy" content="${csp}" />`
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), electronHtmlFix(), injectCsp()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/renderer'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@stores': path.resolve(__dirname, './src/renderer/core'),
      '@core': path.resolve(__dirname, './src/renderer/core'),
      '@lib': path.resolve(__dirname, './src/renderer/lib'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Formato IIFE para compatibilidad con file:// de Electron
    // (inlineDynamicImports se activa automáticamente con IIFE)
    rollupOptions: {
      output: {
        format: 'iife',
      },
    },
    // Electron 31 usa Chromium 126
    target: 'es2020',
    minify: 'esbuild',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environmentMatchGlobs: [
      ['src/renderer/**/*.test.tsx', 'jsdom'],
    ],
    setupFiles: ['src/test-setup.ts'],
  },
})

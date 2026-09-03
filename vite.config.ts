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

export default defineConfig({
  plugins: [react(), electronHtmlFix()],
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

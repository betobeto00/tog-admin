import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

function electronHtmlFix(): any {
  return {
    name: 'electron-html-fix',
    transformIndexHtml(html) {
      // Solo quitar crossorigin, MANTENER el <link> de CSS
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
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})

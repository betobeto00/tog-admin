/**
 * Post-build script: inline CSS into HTML for Electron asar compatibility.
 *
 * Electron's asar protocol doesn't properly load <link rel="stylesheet"> tags.
 * This script reads the CSS file referenced in the HTML and inlines it as a
 * <style> tag directly in the HTML.
 */
const fs = require('fs')
const path = require('path')

const htmlPath = path.resolve(__dirname, '../dist/index.html')
let html = fs.readFileSync(htmlPath, 'utf-8')

// Find the <link rel="stylesheet" ... href="..."> tag (may have crossorigin)
const linkMatch = html.match(/<link rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/)
if (!linkMatch) {
  console.log('[inline-css] No <link> stylesheet found, skipping')
  process.exit(0)
}

const cssRelPath = linkMatch[1]
const cssPath = path.resolve(__dirname, '../dist', cssRelPath)

if (!fs.existsSync(cssPath)) {
  console.error(`[inline-css] CSS file not found: ${cssPath}`)
  process.exit(1)
}

const cssContent = fs.readFileSync(cssPath, 'utf-8')

// Replace <link> with inline <style> and remove crossorigin
html = html
  .replace(/<link rel="stylesheet"[^>]+href="[^"]+"[^>]*>/, `<style>${cssContent}</style>`)
  .replace(/ crossorigin/g, '')

fs.writeFileSync(htmlPath, html)
console.log(`[inline-css] CSS inlined: ${cssContent.length} bytes → ${htmlPath}`)

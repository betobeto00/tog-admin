/**
 * Post-build script for Electron asar compatibility.
 * 1. Inlines CSS from <link> into <style> tag
 * 2. Removes crossorigin attributes
 * 3. Changes type="module" to type="text/javascript" (file:// doesn't support ES modules)
 */
const fs = require('fs')
const path = require('path')

const htmlPath = path.resolve(__dirname, '../dist/index.html')
let html = fs.readFileSync(htmlPath, 'utf-8')
let changed = false

// 1. Inline CSS if <link> exists
const linkMatch = html.match(/<link rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/)
if (linkMatch) {
  const cssPath = path.resolve(__dirname, '../dist', linkMatch[1])
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf-8')
    html = html.replace(/<link rel="stylesheet"[^>]+href="[^"]+"[^>]*>/, `<style>${css}</style>`)
    console.log(`[inline-css] CSS inlined: ${css.length} bytes`)
    changed = true
  }
}

// 2. Always fix script tags for Electron file:// protocol
const original = html
html = html
  .replace(/ crossorigin/g, '')
  .replace(/type="module"/g, 'type="text/javascript"')

if (html !== original) {
  console.log('[inline-css] Fixed script tags (removed crossorigin, changed module→text/javascript)')
  changed = true
}

if (changed) {
  fs.writeFileSync(htmlPath, html)
  console.log(`[inline-css] Done → ${htmlPath}`)
} else {
  console.log('[inline-css] No changes needed')
}

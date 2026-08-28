/**
 * Post-build: Extrae CSS de Tailwind y lo pone directo en HTML.
 * También quita crossorigin y cambia module -> text/javascript.
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const distDir = path.resolve(__dirname, '../dist')
const htmlPath = path.join(distDir, 'index.html')
const srcCssPath = path.resolve(__dirname, '../src/renderer/index.css')

// 1. Generate standalone CSS from Tailwind
console.log('[build] Generating standalone Tailwind CSS...')
try {
  // Use tailwind CLI to generate CSS from the source
  const tailwindBin = path.resolve(__dirname, '../node_modules/.bin/tailwindcss')
  const configPath = path.resolve(__dirname, '../tailwind.config.ts')

  // Read source CSS and process with Tailwind
  const srcCss = fs.readFileSync(srcCssPath, 'utf-8')

  // Write a temp input file with all source content
  const tempInput = path.join(distDir, '_temp_input.css')
  fs.writeFileSync(tempInput, srcCss)

  // Run tailwindcss CLI to generate output
  execSync(`"${tailwindBin}" -i "${tempInput}" -o "${path.join(distDir, '_tailwind.css')}" --minify`, {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'pipe'
  })

  const tailwindCss = fs.readFileSync(path.join(distDir, '_tailwind.css'), 'utf-8')
  console.log(`[build] Tailwind CSS generated: ${tailwindCss.length} bytes`)

  // Read current HTML
  let html = fs.readFileSync(htmlPath, 'utf-8')

  // 2. Inline the Tailwind CSS into a <style> tag in <head>
  // Replace the existing <style> block with one that includes Tailwind
  html = html.replace(
    /<style>[\s\S]*?<\/style>/,
    `<style>${tailwindCss}</style>`
  )

  // 3. Fix script tags
  html = html
    .replace(/ crossorigin/g, '')
    .replace(/type="module"/g, 'type="text/javascript"')

  // 4. Clean up
  fs.unlinkSync(tempInput)
  fs.unlinkSync(path.join(distDir, '_tailwind.css'))

  // 5. Write final HTML
  fs.writeFileSync(htmlPath, html)
  console.log(`[build] HTML updated: ${htmlPath}`)

} catch (err) {
  console.error('[build] Error:', err.message)
  // Fallback: just fix script tags
  let html = fs.readFileSync(htmlPath, 'utf-8')
  html = html
    .replace(/ crossorigin/g, '')
    .replace(/type="module"/g, 'type="text/javascript"')
  fs.writeFileSync(htmlPath, html)
  console.log('[build] Fallback: script tags fixed only')
}

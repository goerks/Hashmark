// KaTeX-Schriften und -Stile für die Runtime bereitstellen: src/runtime/katex.css + src/runtime/katex-fonts/*.woff2.
//
// Warum nicht `import 'katex/dist/katex.min.css'`: Das Original verweist auf drei Formate je Schrift (woff2, woff, ttf), Vite
// würde alle ausliefern (rund 1 MB). WebView2, Edge, Chrome, Firefox und Safari lesen woff2; nur das bleibt (296 KB, 20 Dateien).
// Nach einem Update von katex einmal ausführen: node scripts/katex-assets.ts

import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const dist = path.join(root, 'node_modules/katex/dist')
const target = path.join(root, 'src/runtime')
const fonts = path.join(target, 'katex-fonts')

fs.mkdirSync(fonts, { recursive: true })
for (const f of fs.readdirSync(fonts)) fs.rmSync(path.join(fonts, f))
let count = 0
for (const f of fs.readdirSync(path.join(dist, 'fonts'))) {
  if (!f.endsWith('.woff2')) continue
  fs.copyFileSync(path.join(dist, 'fonts', f), path.join(fonts, f))
  count++
}

const version = JSON.parse(fs.readFileSync(path.join(dist, '../package.json'), 'utf8')).version
const css = fs.readFileSync(path.join(dist, 'katex.min.css'), 'utf8')
  .replace(/,url\(fonts\/[^)]*\.woff\) format\("woff"\)/g, '')
  .replace(/,url\(fonts\/[^)]*\.ttf\) format\("truetype"\)/g, '')
  .replace(/url\(fonts\//g, 'url(katex-fonts/')
fs.writeFileSync(path.join(target, 'katex.css'), `/* KaTeX ${version}: erzeugt von scripts/katex-assets.ts (nur woff2), nicht von Hand ändern */\n${css}`)
console.log(`[hashmark] KaTeX ${version}: ${count} Schriften, katex.css ${(css.length / 1024).toFixed(0)} KB`)

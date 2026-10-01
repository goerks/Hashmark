// Single-File-Export: ein Build ohne Code-Splitting, danach JS/CSS direkt in die HTML-Datei.
// Ergebnis läuft per Doppelklick (file://), ohne Webserver und ohne Internet.

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { build, type InlineConfig } from 'vite'

/** `</script` im Code würde das Inline-Script vorzeitig beenden. */
const escapeScript = (code: string) => code.replace(/<\/script/gi, '<\\/script')

export async function exportSingleFile(config: InlineConfig, outFile: string) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'hashmark-export-'))
  try {
    await build({
      ...config,
      logLevel: 'warn',
      build: {
        outDir: tmp,
        emptyOutDir: true,
        cssCodeSplit: false,
        modulePreload: false,
        assetsInlineLimit: () => true,
        chunkSizeWarningLimit: 100_000,
        rolldownOptions: { output: { codeSplitting: false } },
      },
    })

    const read = (rel: string) => fs.readFile(path.join(tmp, rel), 'utf8')
    let html = await read('index.html')
    const used = new Set<string>(['index.html'])

    // Modul-Scripts laufen auch inline erst nach dem Parsen (wie defer), die Position bleibt also
    for (const [tag, src] of [...html.matchAll(/<script type="module"[^>]*src="\.\/([^"]+)"[^>]*><\/script>/g)]) {
      used.add(src)
      const code = escapeScript(await read(src))
      html = html.replace(tag, () => `<script type="module">${code}</script>`)
    }
    for (const [tag, href] of [...html.matchAll(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/g)]) {
      used.add(href)
      const css = await read(href)
      html = html.replace(tag, () => `<style>${css}</style>`)
    }
    html = html.replace(/<link rel="modulepreload"[^>]*>/g, '')

    const leftovers = (await fs.readdir(tmp, { recursive: true, withFileTypes: true }))
      .filter((e) => e.isFile())
      .map((e) => path.relative(tmp, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
      .filter((f) => !used.has(f))
    if (leftovers.length) console.warn(`[hashmark] nicht eingebettet: ${leftovers.join(', ')}`)

    await fs.mkdir(path.dirname(outFile), { recursive: true })
    await fs.writeFile(outFile, html)
    const size = (await fs.stat(outFile)).size / 1024 / 1024
    console.log(`[hashmark] Export: ${outFile} (${size.toFixed(1)} MB)`)
  } finally {
    await fs.rm(tmp, { recursive: true, force: true })
  }
}

// Sidecar der Desktop-App zu wenigen Dateien bündeln (src/desktop/sidecar.bundle.mjs + bundle-*.mjs).
//
// Warum: Beim ersten Start auf frisch kopierten Dateien liest Node hunderte kleine Dateien (unified, remark, micromark …).
// Jeder Zugriff wird vom Virenscanner geprüft – kalt dauert das 10 s und mehr, warm 0,3 s. Als Bündel sind es einige Dateien.
//
// Extern bleiben: Vite/Svelte (nur für den HTML-Export nötig, liegen in node_modules) und Shiki (lädt Sprachen erst bei Bedarf).
// Die Bündel liegen bewusst neben sidecar.ts, damit `new URL('../../', import.meta.url)` (Projektwurzel) und
// `../runtime/themes/` weiterhin stimmen.

import fs from 'node:fs'
import path from 'node:path'
import { build } from 'vite'

const root = path.resolve(import.meta.dirname, '..')
const outDir = path.join(root, 'src/desktop')

export function cleanBundle() {
  for (const f of fs.readdirSync(outDir)) if (/^(sidecar\.bundle|bundle-.*)\.mjs$/.test(f)) fs.rmSync(path.join(outDir, f))
}

export async function bundleSidecar(): Promise<string> {
  cleanBundle()
  await build({
    configFile: false,
    root,
    logLevel: 'warn',
    ssr: { noExternal: true },
    build: {
      ssr: path.join(root, 'src/desktop/sidecar.ts'),
      outDir,
      emptyOutDir: false,
      target: 'node24',
      minify: false,
      sourcemap: false,
      rolldownOptions: {
        external: [/^vite($|\/)/, /^@sveltejs\//, /^svelte($|\/)/, /^shiki($|\/)/, /^@shikijs\//, /^node:/],
        output: { format: 'es', entryFileNames: 'sidecar.bundle.mjs', chunkFileNames: 'bundle-[name]-[hash].mjs' },
      },
    },
  })
  return path.join(outDir, 'sidecar.bundle.mjs')
}

if (process.argv[1] && path.basename(process.argv[1]) === 'bundle-sidecar.ts') {
  const started = Date.now()
  const file = await bundleSidecar()
  const files = fs.readdirSync(outDir).filter((f) => /^(sidecar\.bundle|bundle-.*)\.mjs$/.test(f))
  const kb = files.reduce((s, f) => s + fs.statSync(path.join(outDir, f)).size, 0) / 1024
  console.log(`[hashmark] Sidecar gebündelt: ${path.relative(root, file)} + ${files.length - 1} Teile, ${kb.toFixed(0)} KB, ${((Date.now() - started) / 1000).toFixed(1)} s`)
}

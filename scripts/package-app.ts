// Portables Windows-Programm aus dem Release-Build: make app-package → dist-app/Strata/Strata.exe
//
//   Strata/
//     Strata.exe        Tauri-App (Fenster, Menü, Dialoge)
//     WebView2Loader.dll  Loader für WebView2 (bei der GNU-Toolchain dynamisch gelinkt)
//     node/node.exe     Node aus vendor/node für den Sidecar
//     app/              src/, examples/, README.md, package.json + nur die Laufzeit-Pakete (npm ci --omit=dev, offline)
//     app/runtime-dist/ vorgebaute Runtime (Präsentation, Editor, Presenter) – die App startet ohne Vite-Dev-Server
//
// Braucht auf dem Zielrechner nur WebView2 (in Windows 10/11 enthalten) und – für PDF – Edge.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { ensureRuntime, RUNTIME_OUT } from '../src/desktop/runtime-build.ts'
import { bundleSidecar, cleanBundle } from './bundle-sidecar.ts'

const root = path.resolve(import.meta.dirname, '..')
const exe = path.join(root, 'src-tauri/target/x86_64-pc-windows-gnullvm/release/strata.exe')
const exeFallback = path.join(root, 'src-tauri/target/release/strata.exe')
const out = path.resolve(process.argv[2] ?? path.join(root, 'dist-app/Strata'))
const started = Date.now()

const built = [exe, exeFallback].find((p) => fs.existsSync(p))
if (!built) {
  console.error('Release-Build fehlt – zuerst "make app-build".')
  process.exit(1)
}

fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(path.join(out, 'node'), { recursive: true })
fs.copyFileSync(built, path.join(out, 'Strata.exe'))
// Mit der GNU-Toolchain ist der WebView2-Loader nicht statisch gelinkt – die DLL muss neben die EXE
const loader = path.join(path.dirname(built), 'WebView2Loader.dll')
if (!fs.existsSync(loader)) {
  console.error(`WebView2Loader.dll fehlt neben ${built}`)
  process.exit(1)
}
fs.copyFileSync(loader, path.join(out, 'WebView2Loader.dll'))
fs.copyFileSync(path.join(root, 'vendor/node/node.exe'), path.join(out, 'node/node.exe'))

const app = path.join(out, 'app')
const copy = (rel: string) => fs.cpSync(path.join(root, rel), path.join(app, rel), { recursive: true })
await ensureRuntime(console.log)
// Sidecar als Bündel: wenige Dateien statt hunderter → schneller Erststart auf frisch kopierten Dateien
await bundleSidecar()
for (const rel of ['src', 'examples', 'README.md', 'package.json', 'package-lock.json']) copy(rel)
cleanBundle() // im Arbeitsbaum bleibt die Entwicklung bei den Quellen
fs.cpSync(RUNTIME_OUT, path.join(app, 'runtime-dist'), { recursive: true })

// nur Laufzeit-Pakete, offline aus dem Vendor-Cache
const npm = path.join(root, 'vendor/node/node_modules/npm/bin/npm-cli.js')
execFileSync(process.execPath, [npm, 'ci', '--omit=dev', '--offline', '--no-audit', '--no-fund', '--ignore-scripts',
  `--cache=${path.join(root, 'vendor/npm-cache')}`], { cwd: app, stdio: 'inherit' })
// Source Maps und Typ-Deklarationen braucht die App nicht
const prune = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) prune(p)
    else if (/\.(map|d\.ts|d\.mts|d\.cts|md)$/i.test(e.name) && !/^(readme|license)/i.test(e.name)) fs.rmSync(p)
  }
}
prune(path.join(app, 'node_modules'))
fs.rmSync(path.join(app, 'package-lock.json'))

const size = (p: string): number => fs.statSync(p).isDirectory() ? fs.readdirSync(p).reduce((s, f) => s + size(path.join(p, f)), 0) : fs.statSync(p).size
const mb = (p: string) => `${(size(p) / 1024 / 1024).toFixed(0)} MB`
console.log(`[strata] Programm: ${path.join(out, 'Strata.exe')}`)
console.log(`[strata] Größe: gesamt ${mb(out)} (Strata.exe ${mb(path.join(out, 'Strata.exe'))}, Node ${mb(path.join(out, 'node'))}, App ${mb(app)}) in ${((Date.now() - started) / 1000).toFixed(0)} s`)

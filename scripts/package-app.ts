// Standalone-Paket der Desktop-App (kein Installer) für eine Plattform:
//
//   node scripts/package-app.ts [ziel] [--version=1.2.0.abc1234] [--archive] [--online]
//
//   ziel     windows-amd64 (Standard) | windows-arm64 | linux-amd64 | linux-arm64 | darwin-amd64 | darwin-arm64
//   --archive    zusätzlich dist-app/hashmark-<version>-<ziel>.zip (Windows) bzw. .tar.gz
//   --online     npm-Pakete und Node aus dem Netz statt aus vendor/ (nötig für alles außer windows-amd64 lokal, Standard in der CI)
//
// Voraussetzung: die Go-Hülle liegt in dist-go/ (make app-cross bzw. make app-exe).
//
// Aufbau (Windows und Linux: Ordner Hashmark/, macOS: Hashmark.app/Contents/MacOS/):
//   Hashmark.exe | hashmark   Go-Hülle (Fenster, Menü, Dialoge, Webview-Bibliothek eingebettet)
//   node/node(.exe)           Node für den Sidecar
//   app/                      src/, examples/, README.md, package.json + nur die Laufzeit-Pakete (npm ci --omit=dev)
//   app/runtime-dist/         vorgebaute Runtime (Präsentation, Editor, Presenter) – die App startet ohne Vite-Dev-Server
//
// Voraussetzungen auf dem Zielrechner: Windows WebView2 (in Windows 10/11 enthalten), Linux WebKitGTK (+ zenity oder kdialog
// für Dialoge), macOS nichts. Für PDF Edge bzw. Chrome. Die eingebettete Webview-Bibliothek entpackt sich beim Start in den Temp-Ordner.

import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ensureRuntime, RUNTIME_OUT } from '../src/desktop/runtime-build.ts'
import { bundleSidecar, cleanBundle } from './bundle-sidecar.ts'

interface Target { os: 'windows' | 'linux' | 'darwin'; npmOs: string; cpu: 'x64' | 'arm64'; arch: string }

const TARGETS: Record<string, Target> = {
  'windows-amd64': { os: 'windows', npmOs: 'win32', cpu: 'x64', arch: 'amd64' },
  'windows-arm64': { os: 'windows', npmOs: 'win32', cpu: 'arm64', arch: 'arm64' },
  'linux-amd64': { os: 'linux', npmOs: 'linux', cpu: 'x64', arch: 'amd64' },
  'linux-arm64': { os: 'linux', npmOs: 'linux', cpu: 'arm64', arch: 'arm64' },
  'darwin-amd64': { os: 'darwin', npmOs: 'darwin', cpu: 'x64', arch: 'amd64' },
  'darwin-arm64': { os: 'darwin', npmOs: 'darwin', cpu: 'arm64', arch: 'arm64' },
}

const root = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const flag = (name: string) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
const option = (name: string) => flag(name)?.split('=')[1]
const targetName = args.find((a) => !a.startsWith('--')) ?? 'windows-amd64'
const target = TARGETS[targetName]
if (!target) {
  console.error(`Unbekanntes Ziel "${targetName}". Möglich: ${Object.keys(TARGETS).join(', ')}`)
  process.exit(1)
}
const version = option('version') ?? 'dev'
const online = !!flag('online') || targetName !== 'windows-amd64'
const started = Date.now()

const shell = path.join(root, 'dist-go', `hashmark-${targetName}${target.os === 'windows' ? '.exe' : ''}`)
if (!fs.existsSync(shell)) {
  console.error(`Go-Build fehlt (${path.relative(root, shell)}) – zuerst "make app-cross" (oder "make app-exe").`)
  process.exit(1)
}

// Windows-x64 lokal bleibt wie bisher: dist-app/Hashmark (make app-test), die anderen unter dist-app/<ziel>/
const outBase = path.join(root, 'dist-app', targetName === 'windows-amd64' && !flag('archive') ? '' : targetName)
const top = path.join(outBase, target.os === 'darwin' ? 'Hashmark.app' : 'Hashmark')
const bin = target.os === 'darwin' ? path.join(top, 'Contents/MacOS') : top
const exeName = target.os === 'windows' ? 'Hashmark.exe' : 'hashmark'
const nodeName = target.os === 'windows' ? 'node.exe' : 'node'

/** Node für das Ziel: lokal vendor/node (nur windows-amd64), sonst von nodejs.org (SHA256 gegen SHASUMS256.txt geprüft) */
async function nodeBinary(): Promise<string> {
  if (!online) return path.join(root, 'vendor/node/node.exe')
  const v = process.env.NODE_VERSION ?? process.versions.node
  const dist = `${target.os === 'windows' ? 'win' : target.os}-${target.cpu}`
  const cache = path.join(root, 'export/node-cache')
  fs.mkdirSync(cache, { recursive: true })
  const cached = path.join(cache, `node-v${v}-${dist}${target.os === 'windows' ? '.exe' : ''}`)
  if (fs.existsSync(cached)) return cached

  const base = `https://nodejs.org/dist/v${v}`
  const sums = await (await fetch(`${base}/SHASUMS256.txt`)).text()
  const expected = (name: string) => {
    const line = sums.split('\n').find((l) => l.trim().endsWith(`  ${name}`))
    if (!line) throw new Error(`${name} fehlt in SHASUMS256.txt (${base})`)
    return line.split(/\s+/)[0]
  }
  const download = async (url: string, name: string, file: string) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${url}: ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const sha = crypto.createHash('sha256').update(buf).digest('hex')
    if (sha !== expected(name)) throw new Error(`Prüfsumme von ${name} stimmt nicht`)
    fs.writeFileSync(file, buf)
  }
  console.log(`[hashmark] Lade Node ${v} (${dist}) …`)
  if (target.os === 'windows') {
    await download(`${base}/${dist}/node.exe`, `${dist}/node.exe`, cached)
  } else {
    const archive = `node-v${v}-${dist}.tar.gz`
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hashmark-node-'))
    await download(`${base}/${archive}`, archive, path.join(tmp, archive))
    // relative Pfade im tmp-Ordner: GNU tar (Git Bash) hält „C:“ sonst für einen Rechnernamen
    execFileSync('tar', ['-xzf', archive, '--strip-components=2', `node-v${v}-${dist}/bin/node`], { cwd: tmp })
    fs.copyFileSync(path.join(tmp, 'node'), cached)
    fs.rmSync(tmp, { recursive: true, force: true })
  }
  return cached
}

fs.rmSync(top, { recursive: true, force: true })
fs.mkdirSync(path.join(bin, 'node'), { recursive: true })
fs.copyFileSync(shell, path.join(bin, exeName))
fs.copyFileSync(await nodeBinary(), path.join(bin, 'node', nodeName))
if (target.os !== 'windows') {
  fs.chmodSync(path.join(bin, exeName), 0o755)
  fs.chmodSync(path.join(bin, 'node', nodeName), 0o755)
}
if (target.os === 'darwin') {
  const short = version.split('.').slice(0, 3).join('.')
  fs.writeFileSync(path.join(top, 'Contents/Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Hashmark</string>
  <key>CFBundleDisplayName</key><string>Hashmark</string>
  <key>CFBundleIdentifier</key><string>app.hashmark.desktop</string>
  <key>CFBundleExecutable</key><string>${exeName}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>${version}</string>
  <key>CFBundleShortVersionString</key><string>${short}</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
`)
}

const app = path.join(bin, 'app')
const copy = (rel: string) => fs.cpSync(path.join(root, rel), path.join(app, rel), { recursive: true })
await ensureRuntime(console.log)
// Sidecar als Bündel: wenige Dateien statt hunderter → schneller Erststart auf frisch kopierten Dateien
await bundleSidecar()
for (const rel of ['src', 'examples', 'README.md', 'package.json', 'package-lock.json']) copy(rel)
cleanBundle() // im Arbeitsbaum bleibt die Entwicklung bei den Quellen
fs.cpSync(RUNTIME_OUT, path.join(app, 'runtime-dist'), { recursive: true })

// nur Laufzeit-Pakete: lokal offline aus dem Vendor-Cache (nur Windows-Binärdateien), sonst online für das Ziel
const common = ['ci', '--omit=dev', '--no-audit', '--no-fund', '--ignore-scripts']
if (online) {
  const platform = [`--os=${target.npmOs}`, `--cpu=${target.cpu}`, ...(target.os === 'linux' ? ['--libc=glibc'] : [])]
  execFileSync('npm', [...common, ...platform], { cwd: app, stdio: 'inherit', shell: process.platform === 'win32' })
} else {
  const npm = path.join(root, 'vendor/node/node_modules/npm/bin/npm-cli.js')
  execFileSync(process.execPath, [npm, ...common, '--offline', `--cache=${path.join(root, 'vendor/npm-cache')}`], { cwd: app, stdio: 'inherit' })
}
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

let archive = ''
if (flag('archive')) {
  const name = `hashmark-${version}-${targetName}`
  archive = path.join(root, 'dist-app', target.os === 'windows' ? `${name}.zip` : `${name}.tar.gz`)
  fs.mkdirSync(path.dirname(archive), { recursive: true })
  fs.rmSync(archive, { force: true })
  const topName = path.basename(top)
  if (target.os === 'windows') {
    // zip, sonst bsdtar (Windows 10/11)
    const rel = path.relative(outBase, archive) // relativ: siehe oben (GNU tar und „C:“)
    try { execFileSync('zip', ['-qr', rel, topName], { cwd: outBase }) } catch { execFileSync('tar', ['-a', '-cf', rel, topName], { cwd: outBase }) }
  } else {
    execFileSync('tar', ['-czf', path.relative(outBase, archive), topName], { cwd: outBase })
  }
}

const size = (p: string): number => fs.statSync(p).isDirectory() ? fs.readdirSync(p).reduce((s, f) => s + size(path.join(p, f)), 0) : fs.statSync(p).size
const mb = (p: string) => `${(size(p) / 1024 / 1024).toFixed(0)} MB`
console.log(`[hashmark] Programm (${targetName}): ${path.join(bin, exeName)}`)
console.log(`[hashmark] Größe: gesamt ${mb(top)} (Hülle ${mb(path.join(bin, exeName))}, Node ${mb(path.join(bin, 'node'))}, App ${mb(app)}) in ${((Date.now() - started) / 1000).toFixed(0)} s`)
if (archive) console.log(`[hashmark] Archiv: ${archive} (${mb(archive)})`)

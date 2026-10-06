// Dokumentation bauen (GitLab Pages): make docs / node scripts/build-docs.ts [--out public] [--serve [port]]
//
//   <out>/index.html      Startseite mit Live-Beispielen (scripts/docs-landing.ts)
//   <out>/handbuch/       das Handbuch (docs/, ein Hashmark-Deck): Präsentation, ?reader = Lesemodus, ?card = Einzelfolie
//   <out>/beispiele/      alle Beispiel-Decks (examples/) mit Auswahlseite
//
// Keine zusätzlichen Abhängigkeiten: dieselbe Pipeline wie `hashmark build`. Die Beispiele auf der Startseite lesen ihren
// Quelltext aus dem Handbuch selbst, sie können also nicht von der Folie abweichen.

import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { build } from 'vite'
import { config } from '../src/cli/config.ts'
import { listExamples } from '../src/cli/examples.ts'
import { loadDeck } from '../src/core/deck.ts'
import type { DeckNode } from '../src/core/types.ts'
import { indexPage } from './build-examples.ts'
import { landingPage, type LandingDemo, type LandingRelease } from './docs-landing.ts'
import { execFileSync } from 'node:child_process'

/** Letzter Tag und die zugehörige Paketversion (wie `version` in der Pipeline); null ohne Tags (flacher Klon, neues Repo) */
function latestRelease(): LandingRelease | null {
  const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  try {
    const tag = process.env.HASHMARK_RELEASE_TAG || git('describe', '--tags', '--abbrev=0')
    const version = `${tag.replace(/^v/, '')}.${git('rev-parse', '--short', `${tag}^{commit}`)}`
    const api = process.env.CI_API_V4_URL, id = process.env.CI_PROJECT_ID
    return { tag, version, packageBase: api && id ? `${api}/projects/${id}/packages/generic/hashmark` : '' }
  } catch { return null }
}

const root = path.resolve(import.meta.dirname, '..')
export const docsDir = path.join(root, 'docs')

/** Beispiele der Startseite: Knoten-ID im Handbuch, Reiter und Hinweis */
export const DEMOS = [
  { id: 'baum', tab: 'Der Baum', hint: 'Aus den Überschriften wird der Baum: ## sind Details von #. Das Diagramm ist Mermaid, gerendert mit dem Deck.' },
  { id: 'schritte', tab: 'Schritte', hint: 'Ein Klick auf „Schritt“ blendet die Punkte nacheinander ein, wie im Vortrag (Pfeil rechts).' },
  { id: 'formeln', tab: 'Formeln', hint: 'LaTeX mit KaTeX. \\htmlData{step=n} blendet Teile der Formel schrittweise ein.' },
  { id: 'gestaltung', tab: 'Karten', hint: 'Container wie ::: cards bauen Kacheln mit Icon. Die Karten 3 und 4 erscheinen mit den Schritten.' },
]

function findNode(nodes: DeckNode[], id: string): DeckNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n
    const hit = findNode(n.children, id)
    if (hit) return hit
  }
}

/** Markdown-Abschnitt eines Knotens (Überschrift bis zur nächsten Überschrift, ohne Notizen), fence-bewusst */
export function sectionSource(file: string, line: number, dir = docsDir): string {
  const lines = fs.readFileSync(path.join(dir, file), 'utf8').split(/\r?\n/)
  const out: string[] = []
  let fence: string | null = null
  for (let i = line - 1; i < lines.length; i++) {
    const l = lines[i]
    const f = l.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (fence) {
      if (f && f[1][0] === fence[0] && f[1].length >= fence.length && l.trim() === f[1]) fence = null
    } else if (f) fence = f[1]
    else if (i > line - 1 && /^#{1,6}\s/.test(l)) break
    else if (/^:::\s*notes\b/.test(l)) break
    out.push(l)
  }
  return out.join('\n').trim()
}

export async function demosFromHandbook(): Promise<LandingDemo[]> {
  const { deck } = await loadDeck(docsDir)
  return DEMOS.map((d) => {
    const node = findNode(deck.nodes, d.id)
    if (!node) throw new Error(`Handbuch: Knoten „${d.id}“ für das Beispiel „${d.tab}“ fehlt`)
    return {
      tab: d.tab, id: d.id, hint: d.hint,
      steps: node.slides[0]?.steps.length ?? 0,
      file: node.source.file,
      source: sectionSource(node.source.file, node.source.line),
    }
  })
}

export async function buildDocs(out: string) {
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(out, { recursive: true })

  console.log('[hashmark] baue das Handbuch …')
  await build(config(docsDir, { logLevel: 'warn', build: { outDir: path.join(out, 'handbuch'), emptyOutDir: true, chunkSizeWarningLimit: 4000 } }))

  const examples = listExamples()
  for (const e of examples) {
    console.log(`[hashmark] baue Beispiel ${e.name} …`)
    await build(config(e.dir, { logLevel: 'warn', build: { outDir: path.join(out, 'beispiele', e.name), emptyOutDir: true, chunkSizeWarningLimit: 4000 } }))
  }
  fs.writeFileSync(path.join(out, 'beispiele', 'index.html'), indexPage(examples))

  const projectUrl = process.env.CI_PROJECT_URL ?? ''
  fs.writeFileSync(path.join(out, 'index.html'), landingPage({ title: 'Hashmark – Mächtige Präsentationen aus reinem Markdown', demos: await demosFromHandbook(), projectUrl, release: latestRelease() }))
  // GitLab Pages liefert .html ohne Endung nicht aus; eine Datei 404.html für unbekannte Adressen
  fs.writeFileSync(path.join(out, '404.html'), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=./"><title>Hashmark</title><a href="./">Zur Startseite</a>')
  console.log(`[hashmark] Dokumentation: ${out} (index.html, handbuch/, beispiele/)`)
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
}

/** Kleiner statischer Server (nur 127.0.0.1) zum lokalen Ansehen */
function serve(dir: string, port: number): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname).replace(/^\/+/, '')
    let file = path.resolve(dir, rel)
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')
    if (path.relative(dir, file).startsWith('..') || !fs.existsSync(file)) {
      res.statusCode = 404
      return res.end('nicht gefunden')
    }
    res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream')
    fs.createReadStream(file).pipe(res)
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const opt = (name: string) => {
    const i = args.indexOf(name)
    return i === -1 ? undefined : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : ''
  }
  const out = path.resolve(opt('--out') || 'public')
  await buildDocs(out)
  const serving = opt('--serve')
  if (serving !== undefined) {
    const port = Number(serving) || 4000
    await serve(out, port)
    console.log(`[hashmark] Vorschau: http://localhost:${port}/ (Strg+C beendet)`)
  }
}

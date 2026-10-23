// Dokumentation bauen (statische Seiten): make docs / node scripts/build-docs.ts [--out public] [--serve [port]]
//
//   <out>/index.html      Startseite mit Rubriken und Live-Beispielen (scripts/docs-landing.ts)
//   <out>/funktionen/     je Rubrik eine Funktionsseite (scripts/docs-features.ts)
//   <out>/screenshots/    Bilder aus assets/screenshots, ergänzt um die Aufnahmen in HASHMARK_SHOTS (make-screenshots.ts)
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
import { FEATURES, SHOTS, featurePage, featuresIndexPage, type CardRef } from './docs-features.ts'
import { execFileSync } from 'node:child_process'

/** Letzter Tag und die zugehörige Paketversion (wie die Version der Desktop-App); null ohne Tags (flacher Klon, neues Repo) */
function latestRelease(): LandingRelease | null {
  const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  try {
    const tag = process.env.HASHMARK_RELEASE_TAG || git('describe', '--tags', '--abbrev=0')
    const version = `${tag.replace(/^v/, '')}.${git('rev-parse', '--short', `${tag}^{commit}`)}`
    return { tag, version }
  } catch { return null }
}

const root = path.resolve(import.meta.dirname, '..')
export const docsDir = path.join(root, 'docs')

/** Beispiele der Startseite: Knoten-ID im Handbuch, Reiter und Hinweis */
export const DEMOS = [
  { id: 'lernen/idee/baum', tab: 'Der Baum', hint: 'Aus den Überschriften wird der Baum: ## sind Details von #. Das Diagramm ist Mermaid, gerendert mit dem Deck.' },
  { id: 'themen/schritte', tab: 'Schritte', hint: 'Ein Klick auf „Schritt“ blendet die Punkte nacheinander ein, wie im Vortrag (Pfeil rechts).' },
  { id: 'themen/medien/formeln', tab: 'Formeln', hint: 'LaTeX mit KaTeX. \\htmlData{step=n} blendet Teile der Formel schrittweise ein.' },
  { id: 'themen/gestaltung', tab: 'Karten', hint: 'Container wie ::: cards bauen Kacheln mit Icon. Die Karten 3 und 4 erscheinen mit den Schritten.' },
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

/** Deck-Ordner einer Kartenadresse: `handbuch` = docs/, `beispiele/<name>` = examples/<name> */
function deckDirOf(deck: string, examples: { name: string; dir: string }[]): string {
  if (deck === 'handbuch') return docsDir
  const e = examples.find((x) => `beispiele/${x.name}` === deck)
  if (!e) throw new Error(`Funktionsseiten: Deck „${deck}“ gibt es nicht`)
  return e.dir
}

/**
 * Schritte je eingebetteter Folie der Funktionsseiten (für den Schritt-Knopf). Prüft dabei, dass jede Folie und jeder
 * Handbuch-Verweis existiert: Ein umbenannter Knoten fällt beim Bau auf, nicht erst auf der Webseite.
 */
export async function cardSteps(examples = listExamples()): Promise<(c: CardRef) => number> {
  const decks = new Map<string, DeckNode[]>()
  const nodesOf = async (deck: string) => {
    if (!decks.has(deck)) decks.set(deck, (await loadDeck(deckDirOf(deck, examples))).deck.nodes)
    return decks.get(deck)!
  }
  const need = async (c: CardRef, where: string) => {
    if (!findNode(await nodesOf(c.deck), c.id)) throw new Error(`Funktionsseiten (${where}): Folie „${c.id}“ fehlt in ${c.deck}`)
  }
  for (const f of FEATURES) {
    await need(f.card, f.id)
    await need({ deck: 'handbuch', id: f.doc }, f.id)
    for (const h of f.highlights) {
      await need({ deck: 'handbuch', id: h.doc }, f.id)
      if (h.card) await need(h.card, f.id)
    }
  }
  // Aufnahmen von Einzelfolien: fehlt die Folie, ersetzt die Seite das Bild durch genau diese Folie
  for (const shot of SHOTS) {
    const m = shot.url.match(/^(.+?)\/\?card[^#]*#([^:]+)/)
    if (m) await need({ deck: m[1], id: decodeURI(m[2]) }, `Bild ${shot.name}`)
  }
  const steps = new Map<string, number>()
  for (const f of FEATURES) {
    const node = findNode(await nodesOf(f.card.deck), f.card.id)!
    steps.set(`${f.card.deck}#${f.card.id}`, node.slides[f.card.slide ?? 0]?.steps.length ?? 0)
  }
  return (c) => steps.get(`${c.deck}#${c.id}`) ?? 0
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

  // Bilder (kleine JPEGs, scripts/make-screenshots.ts): die vier aus dem Repository (README), darüber die Aufnahmen der Pipeline
  const shotsOut = path.join(out, 'screenshots')
  for (const dir of [path.join(root, 'assets', 'screenshots'), process.env.HASHMARK_SHOTS]) {
    if (dir && fs.existsSync(dir)) fs.cpSync(dir, shotsOut, { recursive: true })
  }
  const shots = new Set(fs.existsSync(shotsOut) ? fs.readdirSync(shotsOut) : [])

  const projectUrl = (process.env.HASHMARK_PROJECT_URL ?? '').replace(/\/+$/, '')
  const liveUrl = (process.env.HASHMARK_LIVE_URL ?? 'https://hashmark.onrender.com').replace(/\/+$/, '')
  fs.writeFileSync(path.join(out, 'index.html'), landingPage({ title: 'Hashmark – Mächtige Präsentationen aus reinem Markdown', demos: await demosFromHandbook(), projectUrl, release: latestRelease(), liveUrl, shots }))

  const stepsOf = await cardSteps(examples)
  const site = { shots, stepsOf, projectUrl, liveUrl }
  fs.mkdirSync(path.join(out, 'funktionen'), { recursive: true })
  fs.writeFileSync(path.join(out, 'funktionen', 'index.html'), featuresIndexPage(site))
  for (const f of FEATURES) {
    fs.mkdirSync(path.join(out, 'funktionen', f.id), { recursive: true })
    fs.writeFileSync(path.join(out, 'funktionen', f.id, 'index.html'), featurePage(f, site))
  }
  // Manche Hoster liefern .html ohne Endung nicht aus; eine Datei 404.html für unbekannte Adressen
  fs.writeFileSync(path.join(out, '404.html'), '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=./"><title>Hashmark</title><a href="./">Zur Startseite</a>')
  console.log(`[hashmark] Dokumentation: ${out} (index.html, funktionen/, handbuch/, beispiele/; ${shots.size} Bilder)`)
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

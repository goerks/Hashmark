// Baut alle Beispiel-Decks als statische Seiten mit einer Auswahlseite: dist/index.html + dist/<deck>/ (make build-examples).
// Grundlage für den Webservice (make docker-examples): nginx liefert dist/ aus, die Auswahlseite verlinkt jedes Deck.
import fs from 'node:fs'
import path from 'node:path'
import { build } from 'vite'
import { config } from '../src/cli/config.ts'
import { listExamples, type Example } from '../src/cli/examples.ts'

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Auswahlseite ohne externe Abhängigkeiten (Schrift, CSS inline), hell/dunkel nach Systemeinstellung. */
export function indexPage(examples: Example[]): string {
  const cards = examples.map((e) => `      <li><a href="./${encodeURIComponent(e.name)}/"><strong>${escapeHtml(e.name)}</strong><span>${escapeHtml(e.title)}</span></a></li>`).join('\n')
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Strata – Beispiele</title>
<style>
  :root { --bg: #ffffff; --fg: #1f2328; --muted: #667085; --accent: #2563eb; --surface: #f3f5f8; --border: #d5dbe3; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0d1117; --fg: #e6edf3; --muted: #8b949e; --accent: #22d3ee; --surface: #161b22; --border: #30363d; } }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.5 "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif; }
  main { max-width: 640px; margin: 0 auto; padding: 64px 24px; }
  h1 { margin: 0 0 4px; font-size: 32px; }
  p { margin: 0 0 32px; color: var(--muted); }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
  a { display: flex; flex-direction: column; gap: 2px; padding: 14px 18px; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: inherit; text-decoration: none; }
  a:hover, a:focus-visible { border-color: var(--accent); }
  a span { color: var(--muted); font-size: 14px; }
</style>
</head>
<body>
  <main>
    <h1>Strata</h1>
    <p>Beispiele – ein Deck wählen:</p>
    <ul>
${cards}
    </ul>
  </main>
</body>
</html>
`
}

if (import.meta.main) {
  const out = path.resolve(process.argv[2] ?? 'dist')
  const examples = listExamples()
  if (!examples.length) throw new Error('Keine Beispiel-Decks unter examples/ gefunden')
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(out, { recursive: true })
  for (const e of examples) {
    console.log(`[strata] baue ${e.name} …`)
    await build(config(e.dir, { build: { outDir: path.join(out, e.name), emptyOutDir: true, chunkSizeWarningLimit: 4000 } }))
  }
  fs.writeFileSync(path.join(out, 'index.html'), indexPage(examples))
  console.log(`[strata] ${examples.length} Beispiele → ${out} (Auswahl: index.html)`)
}

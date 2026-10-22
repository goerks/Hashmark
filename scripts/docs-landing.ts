// Startseite der Dokumentation (statische Seiten): Slogan, animierter Baum, Merkmale, Live-Beispiele mit Quelltext und
// Ergebnis, das Handbuch im Lesemodus und Downloads. Eine einzige HTML-Datei ohne externe Ressourcen.
// Die Folien stammen aus dem Handbuch-Deck (docs/): `handbuch/?card#id` zeigt eine Folie, `handbuch/?reader` den Lesemodus.

export interface LandingDemo {
  /** Beschriftung des Reiters */
  tab: string
  /** Knoten-ID im Handbuch-Deck */
  id: string
  /** Anzahl Schritte der Folie (0 = keine) */
  steps: number
  /** Datei der Quelle, z. B. 01-idee.md */
  file: string
  /** Quelltext der Folie (aus der echten Datei gelesen) */
  source: string
  hint: string
}

/** Aktueller Release (letzter Tag): Name und Paket-Version */
export interface LandingRelease {
  /** z. B. v0.2.0 */
  tag: string
  /** Paketversion wie beim Paketbau: <Tag ohne v>.<Kurz-Hash> */
  version: string
}

export interface LandingOptions {
  title: string
  demos: LandingDemo[]
  /** Projektadresse (GitHub), leer = Platzhalter */
  projectUrl: string
  /** letzter Release, falls bekannt */
  release?: LandingRelease | null
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function landingPage(o: LandingOptions): string {
  const r = o.release ?? null
  // Ohne bekannten Tag zeigt GitHub mit „releases/latest“ trotzdem den neuesten Release
  const releases = !o.projectUrl ? '#' : r ? `${o.projectUrl}/releases/tag/${r.tag}` : `${o.projectUrl}/releases/latest`
  const pkg = (ext: string, target: string) => (r && o.projectUrl ? `${o.projectUrl}/releases/download/${r.tag}/hashmark-${r.version}-${target}.${ext}` : releases)
  const link = (label: string, href: string, primary = false) => `<a class="btn${primary ? '' : ' ghost'}" href="${esc(href)}">${label}</a>`
  const latest = r ? `<p class="lead">Aktuelle Version: <strong>${esc(r.tag)}</strong> · <a href="${esc(releases)}">Release-Notizen</a></p>` : ''
  const demos = JSON.stringify(o.demos.map((d) => ({ tab: d.tab, id: d.id, steps: d.steps, file: d.file, source: d.source, hint: d.hint })))
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="Mächtige Präsentationen aus reinem Markdown: ein Baum statt einer Folienliste, offline, mit PDF- und PowerPoint-Export.">
<style>
  :root {
    --bg: #ffffff; --fg: #1f2328; --muted: #667085; --accent: #2563eb; --accent-fg: #fff; --surface: #f3f5f8; --border: #d5dbe3; --soft: #eef3fe;
    --hero: linear-gradient(180deg, #eef3fe 0%, #ffffff 100%);
    --font: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif; --code: "Cascadia Code", Consolas, "SF Mono", Menlo, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0d1117; --fg: #e6edf3; --muted: #8b949e; --accent: #22d3ee; --accent-fg: #0d1117; --surface: #161b22; --border: #30363d; --soft: #0f2a33; --hero: linear-gradient(180deg, #0f2a33 0%, #0d1117 100%); }
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; scroll-padding-top: 72px; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.65 var(--font); }
  a { color: var(--accent); }
  header.nav { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 4px; padding: 10px 24px; background: color-mix(in srgb, var(--bg) 90%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--border); flex-wrap: wrap; }
  .brand { font-weight: 800; font-size: 19px; margin-right: 18px; color: var(--fg); text-decoration: none; }
  .brand i { color: var(--accent); font-style: normal; }
  header.nav a.tab { color: var(--fg); text-decoration: none; font-size: 14.5px; padding: 6px 12px; border-radius: 8px; }
  header.nav a.tab:hover { background: var(--surface); }
  .spacer { flex: 1; }
  .btn { display: inline-block; font: inherit; font-weight: 700; font-size: 15px; text-decoration: none; cursor: pointer; border: 1px solid var(--accent); background: var(--accent); color: var(--accent-fg); padding: 9px 20px; border-radius: 10px; }
  .btn.ghost { background: transparent; color: var(--accent); }
  .btn:hover { filter: brightness(1.08); }
  .hero { background: var(--hero); padding: 70px 24px 36px; text-align: center; }
  .hero h1 { margin: 0 auto 10px; max-width: 780px; font-size: clamp(34px, 5.2vw, 56px); line-height: 1.08; letter-spacing: -0.025em; }
  .hero h1 em { font-style: normal; color: var(--accent); }
  .hero p.sub { margin: 0 auto 26px; max-width: 660px; font-size: 19px; color: var(--muted); }
  .hero .cta { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
  .treebox { max-width: 920px; margin: 34px auto 0; border: 1px solid var(--border); border-radius: 16px; background: var(--bg); padding: 18px 18px 8px; box-shadow: 0 12px 40px rgb(0 0 0 / .08); }
  .treebox svg { width: 100%; height: auto; display: block; }
  .tbar { display: flex; justify-content: space-between; align-items: center; font-size: 13.5px; color: var(--muted); padding: 4px 6px 12px; flex-wrap: wrap; gap: 8px; text-align: left; }
  kbd { background: var(--surface); border: 1px solid var(--border); border-bottom-width: 2px; border-radius: 6px; padding: 0 8px; font: 13px var(--code); color: var(--fg); }
  .n circle { fill: var(--bg); stroke: var(--accent); stroke-width: 2.5; transition: fill .25s, r .25s; }
  .n text { font: 600 13px var(--font); fill: var(--fg); text-anchor: middle; }
  .n.on circle { fill: var(--accent); r: 14; }
  .edge { stroke: var(--border); stroke-width: 2.5; fill: none; }
  .edge.main { stroke: var(--accent); opacity: .55; }
  section.block { max-width: 1080px; margin: 0 auto; padding: 68px 24px 8px; }
  section.block h2 { margin: 0 0 6px; font-size: 32px; letter-spacing: -0.02em; }
  section.block .lead { color: var(--muted); margin: 0 0 26px; font-size: 18px; max-width: 720px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .card { border: 1px solid var(--border); background: var(--surface); border-radius: 14px; padding: 18px 20px; }
  .card h3 { margin: 0 0 4px; font-size: 17px; display: flex; gap: 8px; align-items: center; }
  .card h3 .ic { color: var(--accent); font-size: 19px; }
  .card p { margin: 0; color: var(--muted); font-size: 14.5px; line-height: 1.55; }
  .dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .dl .card { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .dl-btns { display: flex; flex-wrap: wrap; gap: 8px; }
  /* Beispiel: Quelltext | Ergebnis */
  .demo { border: 1px solid var(--border); border-radius: 14px; overflow: hidden; background: var(--bg); }
  .demo-head { display: flex; align-items: center; gap: 4px; padding: 8px 10px; background: var(--surface); border-bottom: 1px solid var(--border); flex-wrap: wrap; }
  .demo-head button.t { font: inherit; font-size: 13.5px; border: 0; background: transparent; color: var(--muted); padding: 5px 12px; border-radius: 8px; cursor: pointer; }
  .demo-head button.t.on { background: var(--bg); color: var(--accent); font-weight: 700; box-shadow: 0 0 0 1px var(--border); }
  .demo-head .tag { margin-left: auto; font: 12px var(--code); color: var(--muted); }
  .demo-body { display: grid; grid-template-columns: 1fr 1fr; }
  .demo-src { border-right: 1px solid var(--border); min-width: 0; }
  .demo-src pre { margin: 0; padding: 16px 18px; font: 13px/1.65 var(--code); overflow: auto; max-height: 420px; }
  .demo-src .file { color: var(--muted); display: block; margin-bottom: 6px; }
  .demo-out { padding: 16px; display: flex; flex-direction: column; gap: 10px; min-width: 0; background: var(--surface); }
  .out-label { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); display: flex; justify-content: space-between; align-items: center; min-height: 26px; }
  .out-label button { font: inherit; font-size: 12.5px; text-transform: none; letter-spacing: 0; border: 1px solid var(--border); background: var(--bg); color: var(--fg); border-radius: 7px; padding: 2px 10px; cursor: pointer; }
  .out-label button:hover { border-color: var(--accent); color: var(--accent); }
  .frame { position: relative; aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; border: 1px solid var(--border); background: #0d1117; }
  .frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .out-hint { font-size: 12.5px; color: var(--muted); }
  /* Handbuch (Lesemodus) */
  .reader-frame { border: 1px solid var(--border); border-radius: 14px; overflow: hidden; height: 560px; box-shadow: 0 12px 40px rgb(0 0 0 / .08); }
  .reader-frame iframe { width: 100%; height: 100%; border: 0; display: block; }
  .reader-cta { display: flex; gap: 12px; margin-top: 18px; flex-wrap: wrap; }
  footer { margin-top: 80px; border-top: 1px solid var(--border); padding: 26px 24px; text-align: center; color: var(--muted); font-size: 14px; }
  @media (max-width: 900px) { .grid, .dl { grid-template-columns: 1fr; } .demo-body { grid-template-columns: 1fr; } .demo-src { border-right: 0; border-bottom: 1px solid var(--border); } .reader-frame { height: 420px; } }
</style>
</head>
<body>
<header class="nav">
  <a class="brand" href="./"><i>#</i> Hashmark</a>
  <a class="tab" href="handbuch/?reader">Handbuch</a>
  <a class="tab" href="handbuch/">Präsentation</a>
  <a class="tab" href="#beispiel">Beispiele</a>
  <a class="tab" href="beispiele/">Beispiel-Decks</a>
  <span class="spacer"></span>
  <a class="btn" href="#download">Download</a>
</header>

<section class="hero">
  <h1>Mächtige Präsentationen aus <em>reinem Markdown</em></h1>
  <p class="sub">Ein Baum statt einer Folienliste: → erzählt auf dem Hauptpfad weiter, ↓ taucht ins Detail. Offline, ohne Installer, mit PDF- und PowerPoint-Export.</p>
  <div class="cta"><a class="btn" href="#download">Hashmark laden</a><a class="btn ghost" href="handbuch/?reader">Handbuch lesen</a></div>
  <div class="treebox">
    <div class="tbar"><span>Der Baum einer Präsentation – so läuft ein Vortrag</span><span id="keys"><kbd>→</kbd> weiter · <kbd>↓</kbd> Detail · <kbd>↑</kbd> zurück</span></div>
    <svg viewBox="0 0 900 250" role="img" aria-label="Baum mit Hauptpfad und Details">
      <path class="edge main" d="M90 50H810"/>
      <path class="edge" d="M330 50V120H250V190M330 120H410V190"/>
      <path class="edge" d="M570 50V120"/>
      <g class="n" id="n0"><circle cx="90" cy="50" r="11"/><text x="90" y="24">Idee</text></g>
      <g class="n" id="n1"><circle cx="330" cy="50" r="11"/><text x="330" y="24">Architektur</text></g>
      <g class="n" id="n2"><circle cx="570" cy="50" r="11"/><text x="570" y="24">Demo</text></g>
      <g class="n" id="n3"><circle cx="810" cy="50" r="11"/><text x="810" y="24">Fazit</text></g>
      <g class="n" id="d0"><circle cx="250" cy="190" r="9"/><text x="250" y="222">Parser</text></g>
      <g class="n" id="d1"><circle cx="410" cy="190" r="9"/><text x="410" y="222">Runtime</text></g>
      <g class="n" id="d2"><circle cx="570" cy="120" r="9"/><text x="570" y="152">Optional</text></g>
    </svg>
  </div>
</section>

<section class="block">
  <h2>Warum Hashmark?</h2>
  <p class="lead">Präsentationen sind nicht linear. Hashmark macht die Struktur zum Prinzip.</p>
  <div class="grid">
    <div class="card"><h3><span class="ic">⌥</span>Baum statt Liste</h3><p>Überschriften sind Knoten. Der Hauptpfad erzählt, Details tauchen nur bei Fragen auf.</p></div>
    <div class="card"><h3><span class="ic">⏱</span>Vortragsplan</h3><p>Pfad, Optional, Anhang. Zeitbudget wirft das Unwichtigste raus, Space führt aus dem Ausflug zurück.</p></div>
    <div class="card"><h3><span class="ic">▶</span>Presenter-View</h3><p>Notizen, Timer, Zeitplan und der Baum auf dem zweiten Bildschirm.</p></div>
    <div class="card"><h3><span class="ic">∑</span>Formeln und Diagramme</h3><p>KaTeX, Mermaid, Code mit Zeilen-Schritten, QR-Codes. Alles ohne CDN.</p></div>
    <div class="card"><h3><span class="ic">▤</span>PDF und PowerPoint</h3><p>Bearbeitbare PPTX mit Animationen, dazu PDF, Handout und eine einzelne HTML-Datei.</p></div>
    <div class="card"><h3><span class="ic">▣</span>Offline, ohne Installer</h3><p>Standalone-App für Windows, Linux und macOS. Deine Dateien bleiben bei dir.</p></div>
  </div>
</section>

<section class="block" id="beispiel">
  <h2>So sieht das aus</h2>
  <p class="lead">Links der Markdown-Quelltext aus dem Handbuch, rechts die echte Folie. Probiere die Schritte aus.</p>
  <div class="demo" id="demo">
    <div class="demo-head"><span class="tabs" id="tabs"></span><span class="tag">Quelltext | Ergebnis</span></div>
    <div class="demo-body">
      <div class="demo-src"><pre id="src"></pre></div>
      <div class="demo-out">
        <div class="out-label"><span>Ergebnis</span><span id="ctl"></span></div>
        <div class="frame"><iframe id="card" title="Gerenderte Folie" loading="lazy" src="handbuch/?card&step=0#${esc(o.demos[0]?.id ?? '')}"></iframe></div>
        <div class="out-hint" id="hint"></div>
      </div>
    </div>
  </div>
</section>

<section class="block" id="handbuch">
  <h2>Das Handbuch ist selbst ein Hashmark-Deck</h2>
  <p class="lead">Lesemodus: der Baum als Inhaltsverzeichnis, die Erklärtexte aus den Sprechernotizen, die Folien als Karten dazwischen. Mit einem Klick auf eine Folie läuft dasselbe als Vortrag.</p>
  <div class="reader-frame"><iframe title="Handbuch im Lesemodus" loading="lazy" src="handbuch/?reader"></iframe></div>
  <div class="reader-cta"><a class="btn" href="handbuch/?reader">Handbuch öffnen</a><a class="btn ghost" href="handbuch/">Als Präsentation starten</a><a class="btn ghost" href="beispiele/">Beispiel-Decks</a></div>
</section>

<section class="block" id="download">
  <h2>Download</h2>
  <p class="lead">Die Pakete stehen in den GitHub-Releases: eine portable Datei je Plattform, ohne Installer.</p>
  ${latest}
  <div class="dl">
    <div class="card"><h3>Windows</h3><p>Entpacken und <code>Hashmark.exe</code> starten</p><div class="dl-btns">${link('x64', pkg('zip', 'windows-amd64'), true)}${link('ARM64', pkg('zip', 'windows-arm64'))}</div></div>
    <div class="card"><h3>macOS</h3><p>Apple Silicon und Intel (noch wenig erprobt)</p><div class="dl-btns">${link('Apple Silicon', pkg('tar.gz', 'darwin-arm64'))}${link('Intel', pkg('tar.gz', 'darwin-amd64'))}</div></div>
    <div class="card"><h3>Linux</h3><p>amd64 und arm64 (noch wenig erprobt)</p><div class="dl-btns">${link('x64', pkg('tar.gz', 'linux-amd64'))}${link('ARM64', pkg('tar.gz', 'linux-arm64'))}</div></div>
  </div>
  <p class="lead" style="margin-top:14px"><a href="${esc(o.projectUrl ? `${o.projectUrl}/releases` : '#')}">Alle Releases</a></p>
</section>

<footer>Hashmark · Dokumentation${o.projectUrl ? ` · <a href="${esc(o.projectUrl)}">Quellcode</a>` : ''}</footer>

<script>
const DEMOS = ${demos.replace(/</g, '\\u003c')}
const $ = (s) => document.querySelector(s)
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

// ---------- animierter Baum ----------
const seq = [['n0'], ['n1'], ['n1', 'd0'], ['n1', 'd1'], ['n1'], ['n2'], ['n2', 'd2'], ['n2'], ['n3']]
const keys = ['', '→', '↓', '→', '↑', '→', '↓', '↑', '→']
let si = 0
function tick() {
  document.querySelectorAll('.n').forEach((n) => n.classList.remove('on'))
  seq[si].forEach((id) => document.getElementById(id)?.classList.add('on'))
  $('#keys').innerHTML = '<kbd>→</kbd> weiter · <kbd>↓</kbd> Detail · <kbd>↑</kbd> zurück ' + (keys[si] ? '&nbsp;<b style="color:var(--accent)">gedrückt: ' + keys[si] + '</b>' : '')
  si = (si + 1) % seq.length
}
tick(); setInterval(tick, 1300)

// ---------- Beispiel: Quelltext | Ergebnis ----------
let cur = 0, step = 0
const card = $('#card')
function send() { card.contentWindow?.postMessage({ type: 'hashmark:card', id: DEMOS[cur].id, slide: 0, step }, location.origin) }
function draw() {
  const d = DEMOS[cur]
  document.querySelectorAll('#tabs button').forEach((b, i) => b.classList.toggle('on', i === cur))
  $('#src').innerHTML = '<span class="file">' + esc(d.file) + '</span>' + esc(d.source)
  $('#ctl').innerHTML = d.steps ? '<button id="stepbtn">Schritt ▸ ' + step + '/' + d.steps + '</button>' : ''
  const b = $('#stepbtn'); if (b) b.onclick = () => { step = (step + 1) % (d.steps + 1); draw(); send() }
  $('#hint').textContent = d.hint
}
DEMOS.forEach((d, i) => {
  const b = document.createElement('button'); b.className = 't'; b.textContent = d.tab
  b.onclick = () => { cur = i; step = 0; draw(); send() }
  $('#tabs').append(b)
})
card.addEventListener('load', send)
draw()
</script>
</body>
</html>
`
}

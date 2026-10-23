// Startseite der Dokumentation (statische Seiten): Satz und großes App-Bild, acht Rubriken als Bildkarten (je eine
// Funktionsseite, scripts/docs-features.ts), Live-Beispiele mit Quelltext und Ergebnis, Start in drei Schritten, Downloads.
// Eine HTML-Datei ohne externe Ressourcen; die Bilder (`screenshots/`, erzeugt von scripts/make-screenshots.ts) liegen
// daneben. Fehlt ein Bild, zeigt die Karte die echte Folie.
// Die Folien stammen aus dem Handbuch-Deck (docs/): `handbuch/?card#id` zeigt eine Folie, `handbuch/?reader` den Lesemodus.

import { FEATURES, featureCard, type CardRef } from './docs-features.ts'
import { esc, siteFooter, siteHead, siteNav } from './docs-site.ts'

export interface LandingDemo {
  /** Beschriftung des Reiters */
  tab: string
  /** Knoten-ID im Handbuch-Deck */
  id: string
  /** Anzahl Schritte der Folie (0 = keine) */
  steps: number
  /** Datei der Quelle, z. B. themen/02-schritte.md */
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
  /** Adresse der Live-Instanz (Webdienst), leer = ohne Verweis */
  liveUrl?: string
  /** vorhandene Bilder in screenshots/ */
  shots?: Set<string>
}

const LANDING_CSS = `
  .hero { background: var(--hero); padding: 64px 24px 40px; text-align: center; }
  .hero h1 { margin: 0 auto 12px; max-width: 800px; font-size: clamp(34px, 5.2vw, 58px); line-height: 1.06; letter-spacing: -0.03em; }
  .hero h1 em { font-style: normal; color: var(--accent); }
  .hero p.sub { margin: 0 auto 26px; max-width: 680px; font-size: 19px; color: var(--muted); }
  .hero .cta { justify-content: center; }
  .heroshot { position: relative; max-width: 1040px; margin: 40px auto 0; }
  .heroshot img { display: block; width: 100%; height: auto; border-radius: 14px; border: 1px solid var(--border); box-shadow: var(--shadow); }
  .heroshot .tag { position: absolute; font-size: 13px; font-weight: 700; background: var(--accent); color: var(--accent-fg); padding: 4px 11px; border-radius: 99px; box-shadow: 0 4px 14px rgb(0 0 0 / .25); white-space: nowrap; }
  .facts { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin: 24px auto 0; padding: 0; list-style: none; }
  .facts li { font-size: 14px; color: var(--muted); border: 1px solid var(--border); background: var(--bg); border-radius: 99px; padding: 4px 13px; }
  .vs { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .vs .card.after { border-color: var(--accent); background: var(--soft); }
  .vs .tag { font: 700 12px var(--font); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
  .vs .card.after .tag { color: var(--accent); }
  .vs ul { margin: 8px 0 0; padding-left: 18px; color: var(--muted); font-size: 14.5px; }
  .steps3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; counter-reset: s; }
  .steps3 .card { position: relative; padding-top: 46px; }
  .steps3 .card::before { counter-increment: s; content: counter(s); position: absolute; top: 14px; left: 18px; width: 24px; height: 24px; border-radius: 50%; background: var(--accent); color: var(--accent-fg); font: 700 13px/24px var(--font); text-align: center; }
  .dl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
  .dl .card { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
  .dl-btns { display: flex; flex-wrap: wrap; gap: 8px; }
  .more-row { display: flex; justify-content: center; margin-top: 22px; }
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
  .out-label button { text-transform: none; letter-spacing: 0; }
  .demo-out .frame { box-shadow: none; }
  .out-hint { font-size: 12.5px; color: var(--muted); }
  .reader { display: grid; grid-template-columns: 1.3fr 1fr; gap: 32px; align-items: center; }
  .reader > * { min-width: 0; }
  .reader ul { margin: 0 0 18px; padding-left: 20px; color: var(--muted); }
  @media (max-width: 900px) { .vs, .steps3, .dl, .reader { grid-template-columns: 1fr; } .demo-body { grid-template-columns: 1fr; } .demo-src { border-right: 0; border-bottom: 1px solid var(--border); } .heroshot .tag { display: none; } }
`

export function landingPage(o: LandingOptions): string {
  const r = o.release ?? null
  const shots = o.shots ?? new Set<string>()
  // Ohne bekannten Tag zeigt GitHub mit „releases/latest“ trotzdem den neuesten Release
  const releases = !o.projectUrl ? '#' : r ? `${o.projectUrl}/releases/tag/${r.tag}` : `${o.projectUrl}/releases/latest`
  const pkg = (ext: string, target: string) => (r && o.projectUrl ? `${o.projectUrl}/releases/download/${r.tag}/hashmark-${r.version}-${target}.${ext}` : releases)
  const link = (label: string, href: string, primary = false) => `<a class="btn${primary ? '' : ' ghost'}" href="${esc(href)}">${label}</a>`
  const latest = r ? `<p class="lead">Aktuelle Version: <strong>${esc(r.tag)}</strong> · <a href="${esc(releases)}">Release-Notizen</a></p>` : ''
  const demos = JSON.stringify(o.demos.map((d) => ({ tab: d.tab, id: d.id, steps: d.steps, file: d.file, source: d.source, hint: d.hint })))
  const site = { shots, projectUrl: o.projectUrl, liveUrl: o.liveUrl, stepsOf: (_: CardRef) => 0 }
  const hero = shots.has('presenter.jpg')
    ? `<div class="heroshot"><img src="screenshots/presenter.jpg" alt="Presenter-View: der Baum, die aktuelle und die nächste Folie, Notizen und Timer"><span class="tag" style="left:3%;bottom:16%">der Baum</span><span class="tag" style="left:40%;top:18%">aktuelle Folie</span><span class="tag" style="right:8%;top:40%">nächster Schritt</span><span class="tag" style="right:4%;top:58%">deine Notizen</span></div>`
    : `<div class="heroshot"><div class="frame"><iframe title="Folie aus dem Handbuch" src="handbuch/?card#lernen/idee/baum"></iframe></div></div>`
  const readerShot = shots.has('lesemodus.jpg')
    ? `<a href="handbuch/?reader"><img class="shot-img" src="screenshots/lesemodus.jpg" alt="Das Handbuch im Lesemodus: der Baum als Inhaltsverzeichnis, daneben Text und Folien" loading="lazy"></a>`
    : `<div class="frame"><iframe title="Handbuch" loading="lazy" src="handbuch/?card#start"></iframe></div>`
  return `${siteHead(o.title, 'Mächtige Präsentationen aus reinem Markdown: ein Baum statt einer Folienliste, mit Presenter-View, Schritten, Themes, PDF- und PowerPoint-Export. Offline, ohne Installer.', LANDING_CSS)}
<body>
${siteNav('', 'start', o.liveUrl)}

<section class="hero">
  <h1>Mächtige Präsentationen aus <em>reinem Markdown</em></h1>
  <p class="sub">Ein Baum statt einer Folienliste: → erzählt weiter, ↓ taucht ins Detail. Mit Presenter-View, Schritten, Themes und Export nach PDF und PowerPoint. Offline, ohne Installer.</p>
  <div class="cta"><a class="btn" href="#download">Hashmark laden</a>${o.liveUrl ? `<a class="btn ghost" href="${esc(o.liveUrl)}">Live ausprobieren</a>` : ''}<a class="btn ghost" href="funktionen/">Alle Funktionen</a></div>
  ${hero}
  <ul class="facts"><li>Windows · macOS · Linux</li><li>kein Konto, keine Cloud</li><li>PDF · PowerPoint · eine HTML-Datei</li><li>Formeln · Diagramme · Video</li></ul>
</section>

<section class="block" id="funktionen">
  <h2>Was Hashmark kann</h2>
  <p class="lead">Acht Bereiche, je mit eigener Seite, Bildern aus der App und Links ins Handbuch.</p>
  <div class="fgrid">${FEATURES.map((f) => featureCard(f, site, '')).join('')}</div>
</section>

<section class="block">
  <h2>Ein Vortrag ist nicht linear</h2>
  <p class="lead">Fragen kommen, die Zeit wird knapp, und manche Details sind mal gefragt und mal nicht.</p>
  <div class="vs">
    <div class="card"><div class="tag">Eine Folienliste</div><h3>Alles in einer Reihe</h3><p>Details wandern als Backup-Folien ans Ende. Bei einer Frage heißt es blättern und suchen, bei knapper Zeit streichen.</p><ul><li>40 Folien, eine Reihenfolge</li><li>Kürzen heißt löschen</li></ul></div>
    <div class="card after"><div class="tag">Ein Baum</div><h3>Pfad und Details</h3><p>Die Überschriften sind die Struktur. Du erzählst den Hauptpfad und tauchst bei Bedarf ins Detail. Von dort führt ein Tastendruck zurück.</p><ul><li><kbd>→</kbd> weiter, <kbd>↓</kbd> Detail, <kbd>↑</kbd> zurück</li><li>Ein Zeitbudget kürzt, ohne zu löschen</li></ul></div>
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
        <div class="frame"><iframe id="card" title="Gerenderte Folie" loading="lazy" src="handbuch/?card&step=0#${esc(encodeURI(o.demos[0]?.id ?? ''))}"></iframe></div>
        <div class="out-hint" id="hint"></div>
      </div>
    </div>
  </div>
</section>

<section class="block" id="start">
  <h2>In drei Minuten zur ersten Präsentation</h2>
  <div class="steps3">
    <div class="card"><h3>Laden</h3><p>Paket entpacken, <code>Hashmark.exe</code> starten. Kein Installer, kein Konto.</p></div>
    <div class="card"><h3>Schreiben</h3><p>Neues Deck anlegen und Überschriften schreiben. Der Editor zeigt die Vorschau live.</p></div>
    <div class="card"><h3>Präsentieren</h3><p><kbd>F5</kbd> startet den Vortrag mit Presenter-View, im Menü liegen PDF und PowerPoint.</p></div>
  </div>
</section>

<section class="block" id="handbuch">
  <div class="reader">
    <div>${readerShot}</div>
    <div>
      <h2>Das Handbuch ist selbst ein Hashmark-Deck</h2>
      <p class="lead">Im Lesemodus ist der Baum das Inhaltsverzeichnis, daneben stehen Text und Folien. Ein Klick auf eine Folie startet denselben Inhalt als Vortrag.</p>
      <ul><li><b>Lernen:</b> von der Idee zur ersten Präsentation</li><li><b>Themen:</b> jeder Bereich für sich, wie die Funktionsseiten</li><li><b>Nachschlagen:</b> alle Schreibweisen, Tasten und Befehle</li></ul>
      <div class="cta"><a class="btn" href="handbuch/?reader">Handbuch öffnen</a><a class="btn ghost" href="handbuch/">Als Präsentation</a><a class="btn ghost" href="beispiele/">Beispiel-Decks</a></div>
    </div>
  </div>
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
  <p class="lead" style="margin-top:14px"><a href="${esc(o.projectUrl ? `${o.projectUrl}/releases` : '#')}">Alle Releases</a> · Frei nutzbar, nicht für kommerzielle Zwecke (PolyForm Noncommercial).</p>
</section>${o.liveUrl ? `

<section class="block" id="live">
  <h2>Selbst betreiben</h2>
  <p class="lead">Hashmark läuft auch als Webdienst: Die Präsentation ist öffentlich, der Editor liegt hinter einem Passwort. Ein Docker-Image, ein Prozess.</p>
  <div class="cta"><a class="btn" href="${esc(o.liveUrl)}">Live-Instanz ansehen</a><a class="btn ghost" href="funktionen/editor/">Editor und App</a></div>
</section>` : ''}

${siteFooter(o.projectUrl)}

<script>
const DEMOS = ${demos.replace(/</g, '\\u003c')}
const $ = (s) => document.querySelector(s)
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

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

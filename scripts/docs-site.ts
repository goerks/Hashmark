// Gemeinsames Gerüst der statischen Doku-Seiten (Startseite, Funktionsseiten): Kopf mit Stil, Navigation, Fußzeile.
// Keine externen Ressourcen: Systemschriften, Stil inline, Bilder relativ (`screenshots/`).

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const CSS = `
  :root {
    --bg: #ffffff; --fg: #1f2328; --muted: #5b6577; --accent: #2563eb; --accent-fg: #fff; --surface: #f3f5f8; --border: #d5dbe3; --soft: #eef3fe;
    --hero: linear-gradient(180deg, #eef3fe 0%, #ffffff 100%); --shadow: 0 14px 40px rgb(15 23 42 / .12);
    --font: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif; --code: "Cascadia Code", Consolas, "SF Mono", Menlo, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #0d1117; --fg: #e6edf3; --muted: #8b949e; --accent: #22d3ee; --accent-fg: #0d1117; --surface: #161b22; --border: #30363d; --soft: #0f2a33; --hero: linear-gradient(180deg, #0f2a33 0%, #0d1117 100%); --shadow: 0 14px 40px rgb(0 0 0 / .45); }
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; scroll-padding-top: 72px; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.65 var(--font); }
  a { color: var(--accent); }
  a:focus-visible, button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  h1, h2, h3 { text-wrap: balance; }
  code, pre { font-family: var(--code); }
  header.nav { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 4px; padding: 10px max(24px, env(safe-area-inset-left)); background: color-mix(in srgb, var(--bg) 90%, transparent); backdrop-filter: blur(8px); border-bottom: 1px solid var(--border); flex-wrap: wrap; }
  .brand { font-weight: 800; font-size: 19px; margin-right: 18px; color: var(--fg); text-decoration: none; }
  .brand i { color: var(--accent); font-style: normal; }
  header.nav a.tab { color: var(--fg); text-decoration: none; font-size: 14.5px; padding: 6px 12px; border-radius: 8px; }
  header.nav a.tab:hover, header.nav a.tab.on { background: var(--soft); color: var(--accent); }
  .spacer { flex: 1; }
  .btn { display: inline-block; font: inherit; font-weight: 700; font-size: 15px; text-decoration: none; cursor: pointer; border: 1px solid var(--accent); background: var(--accent); color: var(--accent-fg); padding: 9px 20px; border-radius: 10px; }
  .btn.ghost { background: transparent; color: var(--accent); }
  .btn:hover { filter: brightness(1.08); }
  .cta { display: flex; gap: 12px; flex-wrap: wrap; }
  kbd { background: var(--surface); border: 1px solid var(--border); border-bottom-width: 2px; border-radius: 6px; padding: 0 8px; font: 13px var(--code); color: var(--fg); }
  .eyebrow { font-size: 12.5px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--muted); }
  .lead { color: var(--muted); font-size: 18px; max-width: 720px; margin: 0 0 22px; }
  section.block { max-width: 1120px; margin: 0 auto; padding: 64px 24px 8px; }
  section.block > h2, .page-title { margin: 0 0 6px; font-size: 32px; line-height: 1.2; letter-spacing: -0.02em; }
  .crumbs { max-width: 1120px; margin: 0 auto; padding: 18px 24px 0; font-size: 14px; color: var(--muted); }
  .card { border: 1px solid var(--border); background: var(--surface); border-radius: 14px; padding: 18px 20px; }
  .card h3 { margin: 0 0 4px; font-size: 17px; }
  .card p { margin: 0; color: var(--muted); font-size: 14.5px; line-height: 1.55; }
  .frame { position: relative; aspect-ratio: 16 / 9; max-width: 100%; border-radius: 12px; overflow: hidden; border: 1px solid var(--border); background: #0d1117; box-shadow: var(--shadow); }
  .frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .shot-img { display: block; width: 100%; height: auto; border-radius: 12px; border: 1px solid var(--border); box-shadow: var(--shadow); }
  /* Rubriken als Bildkarten */
  .fgrid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .fcard { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: 14px; overflow: hidden; background: var(--bg); color: inherit; text-decoration: none; transition: transform .15s, border-color .15s, box-shadow .15s; }
  .fcard:hover { transform: translateY(-3px); border-color: var(--accent); box-shadow: var(--shadow); }
  .fcard-v { display: block; position: relative; aspect-ratio: 16 / 10; overflow: hidden; background: #0d1117; border-bottom: 1px solid var(--border); }
  .fcard-v img { width: 100%; height: 100%; object-fit: cover; object-position: top left; display: block; }
  .fcard-v iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; pointer-events: none; }
  .fcard-t { display: flex; flex-direction: column; gap: 4px; padding: 13px 15px 15px; flex: 1; }
  .fcard-t b { font-size: 16px; }
  .fcard-t span { color: var(--muted); font-size: 14px; line-height: 1.5; }
  .fcard-t u { margin-top: auto; padding-top: 8px; color: var(--accent); font-size: 14px; font-weight: 700; text-decoration: none; }
  /* Funktionsseite */
  .fhead { max-width: 1120px; margin: 0 auto; padding: 14px 24px 0; display: grid; grid-template-columns: 1fr 1.1fr; gap: 36px; align-items: center; }
  .fhead > * { min-width: 0; }
  .fhead h1 { margin: 6px 0 10px; font-size: clamp(32px, 4.4vw, 46px); line-height: 1.08; letter-spacing: -0.025em; }
  .live { margin: 0; }
  .live figcaption { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: 10px; font-size: 13.5px; color: var(--muted); }
  .live button, .out-label button { font: inherit; font-size: 13px; border: 1px solid var(--border); background: var(--bg); color: var(--fg); border-radius: 8px; padding: 3px 12px; cursor: pointer; }
  .live button:hover, .out-label button:hover { border-color: var(--accent); color: var(--accent); }
  .hl { max-width: 1120px; margin: 0 auto; padding: 56px 24px 0; display: grid; gap: 56px; }
  .hl-row { display: grid; grid-template-columns: 1fr 1.25fr; gap: 40px; align-items: center; }
  .hl-row:nth-child(even) .hl-vis { order: -1; }
  .hl-row, .hl-row > * { min-width: 0; }
  .hl-text h2 { margin: 0 0 8px; font-size: 24px; line-height: 1.25; letter-spacing: -0.01em; }
  .hl-text p { margin: 0 0 12px; color: var(--muted); }
  .snip { margin: 0 0 12px; padding: 12px 14px; font-size: 13px; line-height: 1.6; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow-x: auto; }
  .more-link { font-size: 14.5px; font-weight: 700; text-decoration: none; }
  .more-link:hover { text-decoration: underline; }
  .morebox { display: flex; justify-content: space-between; align-items: center; gap: 20px; flex-wrap: wrap; border: 1px solid var(--accent); background: var(--soft); border-radius: 14px; padding: 22px 24px; }
  .morebox p { margin: 4px 0 0; color: var(--muted); max-width: 620px; }
  .prevnext { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 22px; font-size: 15px; }
  .prevnext a { text-decoration: none; font-weight: 600; }
  footer { margin-top: 80px; border-top: 1px solid var(--border); padding: 26px 24px; text-align: center; color: var(--muted); font-size: 14px; }
  @media (max-width: 1000px) { .fgrid { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 860px) { .fhead, .hl-row { grid-template-columns: 1fr; } .hl-row:nth-child(even) .hl-vis { order: 0; } }
  @media (max-width: 560px) { .fgrid { grid-template-columns: 1fr; } section.block { padding-top: 44px; } }
  @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } .fcard { transition: none; } }
`

/** `<!doctype>` bis `</head>`; `extraCss` für seitenspezifische Regeln */
export function siteHead(title: string, description: string, extraCss = ''): string {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<style>${CSS}${extraCss}</style>
</head>`
}

export function siteNav(base: string, active: 'start' | 'funktionen', liveUrl?: string): string {
  const on = (k: string) => (k === active ? ' on' : '')
  return `<header class="nav">
  <a class="brand" href="${base}"><i>#</i> Hashmark</a>
  <a class="tab${on('funktionen')}" href="${base}funktionen/">Funktionen</a>
  <a class="tab" href="${base}handbuch/?reader">Handbuch</a>
  <a class="tab" href="${base}beispiele/">Beispiele</a>${liveUrl ? `
  <a class="tab" href="${esc(liveUrl)}">Live ausprobieren</a>` : ''}
  <span class="spacer"></span>
  <a class="btn" href="${base}#download">Download</a>
</header>`
}

export function siteFooter(projectUrl: string): string {
  return `<footer>Hashmark · Mächtige Präsentationen aus reinem Markdown${projectUrl ? ` · <a href="${esc(projectUrl)}">Quellcode</a> · <a href="${esc(projectUrl)}/blob/main/roadmap.md">Roadmap</a> · <a href="${esc(projectUrl)}/blob/main/LICENSE">Lizenz</a>` : ''}</footer>`
}

/** Schritt-Knopf für die Folie im Iframe `#card` (CardView: postMessage `hashmark:card`) */
export function cardScript(id: string, slide: number): string {
  return `<script>
const card = document.getElementById('card'), btn = document.getElementById('stepbtn')
let step = 0
const max = Number(btn.dataset.steps)
btn.onclick = () => {
  step = (step + 1) % (max + 1)
  btn.textContent = 'Schritt ▸ ' + step + '/' + max
  card.contentWindow?.postMessage({ type: 'hashmark:card', id: ${JSON.stringify(id).replace(/</g, '\\u003c')}, slide: ${slide}, step }, location.origin)
}
</script>`
}

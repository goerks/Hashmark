// Mermaid im Client rendern; Farben und Schrift kommen aus den Theme-Tokens.

type Mermaid = typeof import('mermaid').default

let loader: Promise<Mermaid> | undefined
let configured = ''
const cache = new Map<string, string>()
let counter = 0

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function themeVariables() {
  const style = getComputedStyle(document.documentElement)
  const v = (name: string) => style.getPropertyValue(name).trim()
  return {
    background: v('--color-bg'),
    primaryColor: v('--color-surface'),
    primaryTextColor: v('--color-fg'),
    primaryBorderColor: v('--color-accent'),
    secondaryColor: v('--color-surface-2'),
    tertiaryColor: v('--color-bg'),
    lineColor: v('--color-muted'),
    textColor: v('--color-fg'),
    clusterBkg: v('--color-surface-2'),
    clusterBorder: v('--color-border'),
    edgeLabelBackground: v('--color-bg'),
    mainBkg: v('--color-surface'),
    nodeBorder: v('--color-accent'),
    actorBkg: v('--color-surface'),
    actorBorder: v('--color-accent'),
    actorTextColor: v('--color-fg'),
    signalColor: v('--color-muted'),
    signalTextColor: v('--color-fg'),
    noteBkgColor: v('--color-surface-2'),
    noteTextColor: v('--color-fg'),
    noteBorderColor: v('--color-border'),
    fontFamily: v('--font-body'),
    fontSize: '20px',
  }
}

/** Diagrammarten, die `classDef` kennen: dort stehen die Theme-Klassen `accent`, `muted`, `ok`, `warn`, `bad`, `important`, `actor` bereit (`A:::ok`). */
const CLASSDEF_TYPES = ['flowchart', 'graph', 'stateDiagram', 'stateDiagram-v2', 'classDiagram']

function themeClassDefs(): string {
  const style = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  const fill = (name: string, color: string) => `classDef ${name} fill:${color},stroke:${color},color:#fff`
  return [
    fill('accent', v('--color-accent', '#2563eb')),
    fill('ok', v('--color-success', '#1a7f37')),
    fill('warn', v('--color-warning', '#9a6700')),
    fill('bad', v('--color-danger', '#c62828')),
    fill('important', v('--color-important', '#8250df')),
    `classDef muted fill:${v('--color-surface-2', '#e7ebf1')},stroke:${v('--color-border', '#d5dbe3')},color:${v('--color-muted', '#667085')}`,
    `classDef actor fill:${v('--color-bg', '#fff')},stroke:${v('--color-heading', '#000')},color:${v('--color-heading', '#000')},stroke-width:2px`,
  ].join('\n')
}

/** Quelltext für Mermaid vorbereiten: Skizzen-Stil (`look=hand`) als Frontmatter, Theme-Klassen anhängen */
function prepare(src: string, look: string | undefined): string {
  const first = src.split(/\r?\n/).find((l) => l.trim() && !l.trim().startsWith('%%'))?.trim().split(/[\s;]/)[0] ?? ''
  let out = CLASSDEF_TYPES.includes(first) ? `${src}\n${themeClassDefs()}` : src
  if (look && /^(hand|handdrawn|sketch)$/i.test(look)) out = `---\nconfig:\n  look: handDrawn\n  handDrawnSeed: 7\n---\n${out}`
  return out
}

/** Rendert alle noch offenen Mermaid-Blöcke unterhalb von `root`. */
export async function renderMermaid(root: HTMLElement) {
  const blocks = [...root.querySelectorAll<HTMLElement>('.mermaid-block:not([data-rendered])')]
  if (!blocks.length) return
  loader ??= import('mermaid').then((m) => m.default)
  const mermaid = await loader

  const vars = themeVariables()
  const key = JSON.stringify(vars)
  if (key !== configured) {
    mermaid.initialize({
      startOnLoad: false, theme: 'base', themeVariables: vars, securityLevel: 'strict', fontFamily: vars.fontFamily,
      // Sequenzdiagramme haben eigene (kleine) Schriftgrößen
      flowchart: { padding: 14, nodeSpacing: 40, rankSpacing: 52, curve: 'basis', htmlLabels: true, useMaxWidth: true, wrappingWidth: 240 },
      sequence: { actorFontSize: 20, messageFontSize: 20, noteFontSize: 18, actorFontFamily: vars.fontFamily, messageFontFamily: vars.fontFamily, width: 180, height: 56 },
    })
    configured = key
    cache.clear()
  }

  for (const block of blocks) {
    // mehrere Quellen = eine Version je Schritt (`%% step`), übereinander im selben Rasterfeld
    const sources = [...block.querySelectorAll<HTMLElement>('.mermaid-src')]
    const stepped = sources.length > 1
    for (const pre of sources) {
      const src = prepare(pre.textContent ?? '', block.dataset.look)
      let svg = cache.get(src)
      if (svg === undefined) {
        try {
          svg = (await mermaid.render(`hashmark-mermaid-${counter++}`, src)).svg
        } catch (e) {
          // leere Anfangsversion (nur Diagramm-Typ) ist bei Schritten erlaubt
          svg = stepped ? '' : `<pre class="mermaid-error">Mermaid-Fehler:\n${escape((e as Error).message)}</pre>`
        }
        cache.set(src, svg)
      }
      if (!pre.isConnected) continue
      const state = document.createElement('div')
      state.className = 'mermaid-state'
      if (pre.dataset.step) state.dataset.step = pre.dataset.step
      if (pre.dataset.until) state.dataset.until = pre.dataset.until
      state.innerHTML = svg
      pre.replaceWith(state)
    }
    block.dataset.rendered = ''
  }
}

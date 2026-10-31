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

/** Diagrammarten, bei denen alle Versionen das Layout der letzten teilen (Knoten und Kanten haben stabile `id`s) */
const STABLE_TYPES = ['flowchart', 'graph']
const PARTS = 'g.node[id], g.cluster[id], .edgePaths path[id], path.flowchart-link[id]'

function typeOf(src: string): string {
  return src.split(/\r?\n/).find((l) => l.trim() && !l.trim().startsWith('%%') && !l.trim().startsWith('---'))?.trim().split(/[\s;]/)[0] ?? ''
}

/** Die `id`s von Knoten, Gruppen und Kanten einer gerenderten Version */
function partIds(svg: string): Set<string> {
  const t = document.createElement('template')
  t.innerHTML = svg
  return new Set([...t.content.querySelectorAll(PARTS)].map((e) => e.id))
}

/**
 * Version `ids` im Layout der letzten Version zeigen: was es in dieser Version noch nicht gibt, ist ausgeblendet.
 * Dadurch verschiebt sich beim Weiterschalten nichts. Was gegenüber der vorigen Version neu ist, bekommt `data-new`
 * (Aufwachsen bzw. Zeichnen, siehe base.css).
 */
function showVersion(state: HTMLElement, ids: Set<string>, before: Set<string> | undefined) {
  const parts = [...state.querySelectorAll<SVGElement>(PARTS)]
  for (const el of parts) {
    const edge = el.tagName.toLowerCase() === 'path'
    if (!ids.has(el.id)) el.style.display = 'none'
    else if (before && !before.has(el.id)) {
      el.dataset.new = edge ? 'edge' : 'node'
      if (edge) el.setAttribute('pathLength', '1')
    }
  }
  // Kantenbeschriftungen gehören zur Kante gleicher Reihenfolge (oder zur `data-id` im Label)
  const edges = parts.filter((e) => e.tagName.toLowerCase() === 'path')
  state.querySelectorAll<SVGElement>('.edgeLabels > g').forEach((label, i) => {
    const id = label.querySelector('[data-id]')?.getAttribute('data-id') ?? edges[i]?.id
    if (!id) return
    if (!ids.has(id)) label.style.display = 'none'
    else if (before && !before.has(id)) label.dataset.new = 'node'
  })
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
    const rendered: { pre: HTMLElement; src: string; svg: string }[] = []
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
      rendered.push({ pre, src, svg })
    }
    // Flussdiagramme mit Schritten: jede Version im Layout der letzten, damit nichts springt
    const last = [...rendered].reverse().find((r) => r.svg && !r.svg.includes('mermaid-error'))
    const stable = stepped && !!last && STABLE_TYPES.includes(typeOf(last.src)) && partIds(last.svg).size > 0
    let before: Set<string> | undefined
    for (const { pre, svg } of rendered) {
      if (!pre.isConnected) continue
      const state = document.createElement('div')
      state.className = 'mermaid-state'
      if (pre.dataset.step) state.dataset.step = pre.dataset.step
      if (pre.dataset.until) state.dataset.until = pre.dataset.until
      if (stable) {
        const ids = svg ? partIds(svg) : new Set<string>()
        state.innerHTML = last!.svg
        showVersion(state, ids, before)
        before = ids
      } else state.innerHTML = svg
      pre.replaceWith(state)
    }
    block.dataset.rendered = ''
  }
}

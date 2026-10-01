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
    fontFamily: v('--font-body'),
    fontSize: '20px',
  }
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
      const src = pre.textContent ?? ''
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

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
    mermaid.initialize({ startOnLoad: false, theme: 'base', themeVariables: vars, securityLevel: 'strict', fontFamily: vars.fontFamily })
    configured = key
    cache.clear()
  }

  for (const block of blocks) {
    const src = block.querySelector('.mermaid-src')?.textContent ?? ''
    let svg = cache.get(src)
    if (!svg) {
      try {
        svg = (await mermaid.render(`strata-mermaid-${counter++}`, src)).svg
      } catch (e) {
        svg = `<pre class="mermaid-error">Mermaid-Fehler:\n${escape((e as Error).message)}</pre>`
      }
      cache.set(src, svg)
    }
    if (!block.isConnected) continue
    block.innerHTML = svg
    block.dataset.rendered = ''
  }
}

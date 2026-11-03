// Markmap im Client zeichnen (Ticket #56). Der Baum kommt fertig aus dem Kern (`data-tree`), hier wird nur noch gezeichnet.
// Farben kommen aus den Theme-Tokens. Es wird nichts aus dem Netz geladen: markmap-view bringt seine Stile selbst mit,
// die Hilfen zum Nachladen von Zusatzdateien (markmap-lib, loadCSS/loadJS) werden nie aufgerufen.

type MarkmapModule = typeof import('markmap-view')
interface PureNode { content: string; children: PureNode[] }

let loader: Promise<MarkmapModule> | undefined

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function palette(): string[] {
  const style = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  return [
    v('--color-accent', '#2563eb'), v('--color-success', '#1a7f37'), v('--color-warning', '#9a6700'),
    v('--color-important', '#8250df'), v('--color-danger', '#c62828'),
  ]
}

/**
 * Die Folie hat feste 1280 × 720 Punkte und wird per `transform` ans Fenster angepasst. markmap-view misst mit
 * `getBoundingClientRect`, also in Bildschirmpunkten, und setzt die Karte falsch ein (zu klein, nach oben und links
 * verschoben, abgeschnitten). Darum passen wir die Karte selbst ein, mit den unverkleinerten Maßen aus dem Layout
 * (berechnete Breite und Höhe des SVG) und dem Rechteck, das markmap-view für den Baum meldet.
 */
const FIT = 0.97
const MAX_SCALE = 3

type Mm = {
  state: { rect: { x1: number; y1: number; x2: number; y2: number } }
  svg: { node(): (SVGSVGElement & { __zoom?: { constructor: new (k: number, x: number, y: number) => { scale(k: number): { translate(x: number, y: number): unknown } } } }) | null }
  zoom: { transform(selection: unknown, transform: unknown): unknown }
  fit(): Promise<unknown>
}

function fitMap(mm: Mm, svg: SVGSVGElement) {
  try {
    const style = getComputedStyle(svg)
    const width = parseFloat(style.width)
    const height = parseFloat(style.height)
    const { x1, y1, x2, y2 } = mm.state.rect
    const naturalWidth = x2 - x1
    const naturalHeight = y2 - y1
    const identity = (svg as unknown as { __zoom?: { constructor: new (k: number, x: number, y: number) => { scale(k: number): { translate(x: number, y: number): unknown } } } }).__zoom
    // Folie gerade nicht sichtbar (Übergang, Schritt): nichts tun, der ResizeObserver passt neu ein, sobald sie Maße hat
    if (!(width > 0 && height > 0 && naturalWidth > 0 && naturalHeight > 0)) return
    if (!identity) throw new Error('keine Kamera')
    const k = Math.min(width / naturalWidth * FIT, height / naturalHeight * FIT, MAX_SCALE)
    const transform = new identity.constructor(1, 0, 0).scale(k).translate((width / k - naturalWidth) / 2 - x1, (height / k - naturalHeight) / 2 - y1)
    mm.zoom.transform(mm.svg, transform)
  } catch {
    void mm.fit()
  }
}

/** Rendert alle noch offenen Markmap-Blöcke unterhalb von `root`. */
export async function renderMarkmap(root: HTMLElement) {
  const blocks = [...root.querySelectorAll<HTMLElement>('.markmap-block:not([data-rendered])')]
  if (!blocks.length) return
  loader ??= import('markmap-view')
  let mod: MarkmapModule
  try { mod = await loader } catch (e) {
    for (const block of blocks) fail(block, (e as Error).message)
    return
  }
  const colors = palette()
  for (const block of blocks) {
    // zwischen dem Laden des Moduls und hier kann die Folie gewechselt haben
    if (!block.isConnected || block.hasAttribute('data-rendered')) continue
    try {
      const tree = JSON.parse(block.dataset.tree ?? '{}') as PureNode
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('class', 'markmap-svg')
      block.querySelector('.markmap-src')?.replaceWith(svg)
      const fold = Number(block.dataset.fold)
      const mm = mod.Markmap.create(svg, {
        autoFit: false, duration: 0, zoom: false, pan: false,
        spacingVertical: 10, spacingHorizontal: 90, paddingX: 14,
        initialExpandLevel: fold >= 1 ? fold : -1,
        color: (node: { state?: { path?: string } }) => {
          // je oberstem Ast eine Farbe: der Pfad beginnt mit der Nummer des Astes (`1.2.3`)
          const branch = Number(String(node.state?.path ?? '').split('.')[1] ?? 0)
          return colors[(Number.isFinite(branch) ? branch : 0) % colors.length]
        },
      }, tree)
      // Größe ändert sich erst nach dem Layout (Schritte, Schriften, Fenster): neu einpassen
      const refit = () => fitMap(mm as unknown as Mm, svg)
      refit()
      requestAnimationFrame(refit)
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(refit).observe(block)
      void document.fonts?.ready.then(refit)
      block.dataset.rendered = ''
    } catch (e) {
      fail(block, (e as Error).message)
    }
  }
}

function fail(block: HTMLElement, message: string) {
  block.querySelector('.markmap-src')?.replaceWith(Object.assign(document.createElement('pre'), {
    className: 'markmap-error', innerHTML: `Markmap-Fehler:\n${escape(message)}`,
  }))
  block.dataset.rendered = ''
}

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
 * Wie stark die Bühne verkleinert ist (die Folie hat feste 1280 × 720 und wird per `transform` ans Fenster angepasst).
 * markmap-view misst mit `getBoundingClientRect`, also in Bildschirmpunkten: ohne Ausgleich passt es die Karte auf die
 * verkleinerte Fläche an und die Bühne verkleinert sie ein zweites Mal. Das Verhältnis aus beiden Maßen ist der Faktor.
 */
const stageScale = (el: HTMLElement) => (el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : 1) || 1
const FIT = 0.97

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
        autoFit: true, duration: 0, zoom: false, pan: false, fitRatio: FIT / stageScale(block), maxInitialScale: 3,
        spacingVertical: 10, spacingHorizontal: 90, paddingX: 14,
        initialExpandLevel: fold >= 1 ? fold : -1,
        color: (node: { state?: { path?: string } }) => {
          // je oberstem Ast eine Farbe: der Pfad beginnt mit der Nummer des Astes (`1.2.3`)
          const branch = Number(String(node.state?.path ?? '').split('.')[1] ?? 0)
          return colors[(Number.isFinite(branch) ? branch : 0) % colors.length]
        },
      }, tree)
      // Größe ändert sich erst nach dem Layout (Schritte, Schriften, Fenster): neu einpassen
      if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { mm.setOptions({ fitRatio: FIT / stageScale(block) }); void mm.fit() }).observe(block)
      void document.fonts?.ready.then(() => mm.fit())
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

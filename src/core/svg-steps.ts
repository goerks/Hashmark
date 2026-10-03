// Beliebige SVG-Dateien als Schritte: Elemente mit `id="step-N"` (bzw. `step_N`, `step-N-name`) erscheinen ab Schritt N.
// Gleiche Nummer = gleichzeitig. Funktioniert mit handgeschriebenen SVGs sowie Exporten aus Inkscape, Figma und Illustrator
// (Ebenen und Gruppen dort einfach `step-1`, `step-2` … nennen).

const TAG = /<([a-zA-Z][\w:-]*)\b([^>]*?)(\/?)>/g

/** Gibt das SVG mit `data-step` an den passenden Elementen zurück; `count` = höchste Schrittnummer (0 = nichts gefunden). */
export function svgIdSteps(source: string): { svg: string; count: number } {
  let count = 0
  const svg = source
    .replace(/<\?xml[^>]*\?>|<!DOCTYPE[^>]*>/gi, '')
    .replace(/<script[^]*?<\/script>/gi, '')
    .replace(TAG, (tag, name: string, attrs: string, close: string) => {
      const m = attrs.match(/\bid\s*=\s*["']step[-_]?(\d+)[^"']*["']/i)
      if (!m) return tag
      count = Math.max(count, Number(m[1]))
      return `<${name}${attrs} data-step="${m[1]}"${close}>`
    })
  return { svg, count }
}

// PPTX-Export, Teil 1: läuft IM Browser (per CDP als `(${extractPages})()` ausgewertet) und beschreibt jede
// Druckseite (`.print-page`) als Liste von Objekten (model.ts). Die Funktion muss in sich geschlossen sein:
// keine Imports, keine Verweise auf Module (sie wird als Text übertragen).
//
// Grundidee: Text, Listen, Code und Tabellen werden echte, bearbeitbare PowerPoint-Objekte. Alles, was sich
// nicht sinnvoll abbilden lässt (Diagramme, SVG, runde oder beschnittene Bilder, Drehungen), wird als Bild
// markiert (`data-pr`); Dekoration (Kacheln, Rahmen, Verläufe) bleibt im Hintergrundbild (`data-pn/pt/pr` blendet
// der Orchestrator dort aus, den Text macht er unsichtbar).

import type { Bullet, Extracted, Item, PageData, Para, Run, TableCell } from './model.ts'

export async function extractPages(options: { animate?: boolean } = {}): Promise<Extracted> {
  const animate = !!options.animate
  const STAGE_W = 1280
  const PT = 0.75 // 1 px = 0,75 pt
  const media: Record<string, string> = {}
  const pages: PageData[] = []
  let rasterId = 0

  // ---------- Hilfen ----------

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const g = canvas.getContext('2d', { willReadFrequently: true })!
  const colorCache = new Map<string, [number, number, number, number]>()
  /** beliebige CSS-Farbe (auch color-mix, oklch …) → r, g, b, a */
  function rgba(css: string): [number, number, number, number] {
    let c = colorCache.get(css)
    if (c) return c
    g.clearRect(0, 0, 1, 1)
    g.fillStyle = '#000'
    g.fillStyle = css
    g.fillRect(0, 0, 1, 1)
    const d = g.getImageData(0, 0, 1, 1).data
    c = [d[0], d[1], d[2], d[3] / 255]
    colorCache.set(css, c)
    return c
  }
  const hex = (r: number, gr: number, b: number) => [r, gr, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('').toUpperCase()
  const mix = (fg: [number, number, number, number], bg: string, alpha: number) => {
    const [br, bgr, bb] = rgba('#' + bg)
    const a = fg[3] * alpha
    return hex(fg[0] * a + br * (1 - a), fg[1] * a + bgr * (1 - a), fg[2] * a + bb * (1 - a))
  }
  const num = (v: string) => (parseFloat(v) || 0)

  const styles = new Map<Element, CSSStyleDeclaration>()
  const cs = (el: Element) => {
    let s = styles.get(el)
    if (!s) { s = getComputedStyle(el); styles.set(el, s) }
    return s
  }
  const zooms = new Map<Element, number>()
  function zoomOf(el: Element | null): number {
    if (!el) return 1
    let z = zooms.get(el)
    if (z === undefined) {
      const own = num(cs(el).zoom) || 1
      z = own * zoomOf(el.parentElement)
      zooms.set(el, z)
    }
    return z
  }

  /** Name der ersten Schrift, die PowerPoint kennt; Code immer Consolas, wenn möglich */
  function fontOf(family: string): string {
    const list = family.split(',').map((f) => f.trim().replace(/^["']|["']$/g, ''))
    const generic = /^(system-ui|ui-sans-serif|-apple-system|blinkmacsystemfont|sans-serif|ui-serif|serif|ui-monospace|monospace|cursive|fantasy|emoji|math)$/i
    if (list.some((f) => /^consolas$/i.test(f))) return 'Consolas'
    const first = list.find((f) => f && !generic.test(f))
    if (first && !/^(cascadia|jetbrains|sf mono|menlo|fira|source code)/i.test(first)) return first
    if (list.some((f) => /mono/i.test(f))) return 'Consolas'
    if (/serif/i.test(list[list.length - 1] ?? '') && !/sans/i.test(list[list.length - 1] ?? '')) return 'Georgia'
    return 'Segoe UI'
  }

  // ---------- Seite ----------

  const stage0 = document.querySelector('.print-stage') as HTMLElement | null
  if (!stage0) throw new Error('keine Druckseiten gefunden')
  const articles = [...document.querySelectorAll<HTMLElement>('.print-page')]

  // Animation: ab welchem Klick ist ein Element sichtbar, ab welchem verschwindet es (vererbt sich vom Elternelement)
  const stepCache = new Map<Element, { from: number; until: number }>()
  function stepOf(el: Element | null): { from: number; until: number } {
    if (!animate || !el || el.classList.contains('print-stage')) return { from: 0, until: Infinity }
    let r = stepCache.get(el)
    if (!r) {
      const p = stepOf(el.parentElement)
      const own = el.getAttribute('data-step')
      const until = el.getAttribute('data-until')
      r = { from: own !== null ? Math.max(p.from, Number(own) || 0) : p.from, until: until !== null ? Math.min(p.until, Number(until) || Infinity) : p.until }
      stepCache.set(el, r)
    }
    return r
  }
  const isStepped = (el: Element) => { const s = stepOf(el); return s.from > 0 || Number.isFinite(s.until) }
  const timing = (el: Element | null): { from?: number; until?: number } => {
    const s = stepOf(el)
    return { ...(s.from > 0 ? { from: s.from } : {}), ...(Number.isFinite(s.until) ? { until: s.until } : {}) }
  }

  for (const article of articles) {
    const stage = article.querySelector<HTMLElement>('.print-stage')!
    // Animation: alle Schritte zeigen (die Seite steht sonst im Endzustand, `until`-Elemente wären weg)
    if (animate) for (const e of article.querySelectorAll('.step-hidden, .step-current')) e.classList.remove('step-hidden', 'step-current')
    const R = stage.getBoundingClientRect()
    const k = R.width / STAGE_W || 1
    const items: Item[] = []
    let decor = false

    const rel = (r: DOMRect) => ({ x: (r.left - R.left) / k, y: (r.top - R.top) / k, w: r.width / k, h: r.height / k })

    /** Hintergrundfarbe, vor der Text liegt (für Transparenz) */
    function backdrop(el: Element | null): string {
      for (let e = el; e && e !== stage.parentElement; e = e.parentElement) {
        const c = rgba(cs(e).backgroundColor)
        if (c[3] > 0.5) return hex(c[0], c[1], c[2])
      }
      return 'FFFFFF'
    }
    const opacityOf = (el: Element | null): number => {
      let o = 1
      for (let e = el; e && e !== stage.parentElement; e = e.parentElement) o *= num(cs(e).opacity)
      return o
    }

    // ---------- Läufe ----------

    type Ctx = { deco: Set<string>; href?: string; hl?: string }
    interface Piece { run?: Run; br?: boolean; rects?: DOMRect[] }

    function textRects(node: Text): DOMRect[] {
      const r = document.createRange()
      r.selectNodeContents(node)
      return [...r.getClientRects()].filter((q) => q.width > 0.5 && q.height > 0.5)
    }

    /** Läufe aus Knoten (Text und Inline-Elemente); `pre`: Whitespace behalten */
    function pieces(nodes: Node[], ctx: Ctx, pre: boolean): Piece[] {
      const out: Piece[] = []
      const visit = (n: Node, c: Ctx) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const t = n as Text
          const parent = t.parentElement
          if (!parent) return
          let text = t.data
          const s = cs(parent)
          const keep = pre || s.whiteSpace.startsWith('pre')
          text = keep ? text.replace(/\t/g, '    ') : text.replace(/[\t\n\r\f ]+/g, ' ')
          if (!text) return
          if (s.textTransform === 'uppercase') text = text.toUpperCase()
          else if (s.textTransform === 'lowercase') text = text.toLowerCase()
          else if (s.textTransform === 'capitalize') text = text.replace(/(^|\s)(\S)/g, (_m, a, b) => a + b.toUpperCase())
          const z = zoomOf(parent) / k
          const size = num(s.fontSize) * z * PT
          const alpha = opacityOf(parent)
          const col = mix(rgba(s.color), backdrop(parent), alpha)
          const ls = s.letterSpacing === 'normal' ? 0 : num(s.letterSpacing) * z * PT
          const run: Run = { text, font: fontOf(s.fontFamily), size, color: col }
          if (num(s.fontWeight) >= 600 || s.fontWeight === 'bold') run.bold = true
          if (s.fontStyle === 'italic' || s.fontStyle === 'oblique') run.italic = true
          if (c.deco.has('underline') || s.textDecorationLine.includes('underline')) run.underline = true
          if (c.deco.has('line-through') || s.textDecorationLine.includes('line-through')) run.strike = true
          if (c.href) run.href = c.href
          if (c.hl) run.highlight = c.hl
          if (ls) run.spacing = ls
          if (s.verticalAlign === 'super') run.baseline = 'super'
          else if (s.verticalAlign === 'sub') run.baseline = 'sub'
          out.push({ run, rects: text.trim() ? textRects(t) : [] })
          return
        }
        if (n.nodeType !== Node.ELEMENT_NODE) return
        const el = n as Element
        const s = cs(el)
        if (s.display === 'none' || s.visibility === 'hidden' || num(s.opacity) === 0) return
        if (el.classList.contains('katex')) {
          // Formel im Satz: als Bild, im Text bleibt eine Lücke in Breite der Formel (geschützte Leerzeichen)
          const w = el.getBoundingClientRect().width / k
          const ps = el.parentElement ? cs(el.parentElement) : s
          const px = num(ps.fontSize) * (zoomOf(el.parentElement) / k)
          if (!el.hasAttribute('data-pr') && w >= 1) markRaster(el as HTMLElement, 'Formel')
          g.font = `${ps.fontWeight} ${num(ps.fontSize)}px ${ps.fontFamily}`
          const nb = g.measureText('\u00A0').width * (zoomOf(el.parentElement) / k) || px * 0.27
          const n = Math.max(1, Math.round(w / nb))
          out.push({
            // Schriftgröße der Lücke so, dass n geschützte Leerzeichen genau die Breite der Formel füllen
            run: { text: '\u00A0'.repeat(n), font: fontOf(ps.fontFamily), size: px * PT * Math.max(0.6, Math.min(1.6, w / (n * nb))), color: mix(rgba(ps.color), backdrop(el.parentElement), 1) },
            rects: [],
          })
          return
        }
        if (el.tagName === 'BR') { out.push({ br: true }); return }
        const deco = new Set(c.deco)
        for (const d of s.textDecorationLine.split(' ')) if (d && d !== 'none') deco.add(d)
        const href = el.tagName === 'A' ? (el.getAttribute('href') ?? undefined) : c.href
        // Inline-Code o. Ä. mit Hintergrund: als Textmarkierung statt als Kachel im Hintergrundbild
        let hl = c.hl
        const bgc = rgba(s.backgroundColor)
        if (s.display === 'inline' && bgc[3] > 0.05 && !num(s.borderTopWidth)) {
          hl = mix(bgc, backdrop(el.parentElement), 1)
          el.setAttribute('data-ph', '')
        }
        for (const child of el.childNodes) visit(child, { deco, href, hl })
      }
      for (const n of nodes) visit(n, ctx)
      return out
    }

    interface Measured { paras: Para[]; top: number; bottom: number; left: number; right: number; lines: number }

    /** Absätze (an `<br>` getrennt) samt Ausdehnung der Textzeilen, korrigiert um den Zeilenabstand */
    function measure(nodes: Node[], container: HTMLElement, pre = false): Measured | null {
      const ps = pieces(nodes, { deco: new Set() }, pre)
      const s = cs(container)
      const z = zoomOf(container) / k
      const lhPx = s.lineHeight === 'normal' ? num(s.fontSize) * 1.25 : num(s.lineHeight)
      const align = s.textAlign === 'center' ? 'center' : s.textAlign === 'right' || s.textAlign === 'end' ? 'right' : s.textAlign === 'justify' ? 'justify' : 'left'
      const paras: Para[] = []
      let cur: Run[] = []
      const push = () => {
        if (cur.length || paras.length === 0 || true) paras.push({ runs: cur, align, lineHeight: lhPx * z * PT, before: 0, after: 0 })
        cur = []
      }
      const rects: DOMRect[] = []
      for (const p of ps) {
        if (p.br) { push(); continue }
        cur.push(p.run!)
        if (p.rects) rects.push(...p.rects)
      }
      push()
      // führende/folgende Leerzeichen je Absatz entfernen, doppelte an Lauf-Grenzen zusammenziehen
      for (const para of paras) {
        const r = para.runs
        for (let i = 0; i < r.length; i++) if (i > 0 && r[i - 1].text.endsWith(' ') && r[i].text.startsWith(' ')) r[i].text = r[i].text.slice(1)
        if (!pre) {
          while (r.length && !r[0].text.trim()) r.shift()
          if (r.length) r[0].text = r[0].text.replace(/^ +/, '')
          while (r.length && !r[r.length - 1].text.trim()) r.pop()
          if (r.length) r[r.length - 1].text = r[r.length - 1].text.replace(/ +$/, '')
        }
      }
      if (!paras.some((p) => p.runs.some((r) => r.text.trim()))) return null
      if (!rects.length) return null
      const first = rects.reduce((a, b) => (b.top < a.top ? b : a))
      const last = rects.reduce((a, b) => (b.bottom > a.bottom ? b : a))
      const lh = lhPx * z
      const lineTops = new Set(rects.map((r) => Math.round(r.top / 2)))
      return {
        paras,
        top: (first.top - R.top) / k - Math.max(0, (lh - first.height / k) / 2),
        bottom: (last.bottom - R.top) / k + Math.max(0, (lh - last.height / k) / 2),
        left: Math.min(...rects.map((r) => (r.left - R.left) / k)),
        right: Math.max(...rects.map((r) => (r.right - R.left) / k)),
        lines: Math.max(lineTops.size, paras.length),
      }
    }

    /** Inhaltsbox eines Blocks (ohne Rahmen und Innenabstand) */
    function contentBox(el: HTMLElement) {
      const s = cs(el)
      const r = rel(el.getBoundingClientRect())
      const z = zoomOf(el) / k
      const l = (num(s.borderLeftWidth) + num(s.paddingLeft)) * z
      const t = (num(s.borderTopWidth) + num(s.paddingTop)) * z
      const rt = (num(s.borderRightWidth) + num(s.paddingRight)) * z
      const b = (num(s.borderBottomWidth) + num(s.paddingBottom)) * z
      return { x: r.x + l, y: r.y + t, w: Math.max(0, r.w - l - rt), h: Math.max(0, r.h - t - b) }
    }

    function emitText(m: Measured, container: HTMLElement, name?: string, title = false) {
      const box = contentBox(container)
      const s = cs(container)
      const centered = s.textAlign === 'center' || s.textAlign === 'right' || s.textAlign === 'end'
      let x = box.x
      let w = box.w
      // schmaler als die Spalte und linksbündig: Box eng um den Text (stört in PowerPoint beim Anklicken weniger)
      if (!centered && m.lines === 1) w = Math.max(m.right - m.left, 1)
      // linksbündig: der Text beginnt dort, wo die erste Zeile beginnt (Pseudo-Element davor, Einrückung)
      if (!centered) x = m.left
      if (centered) { x = Math.min(x, m.left); w = Math.max(w, m.right - x) }
      items.push({ kind: 'text', x, y: m.top, w, h: Math.max(m.bottom - m.top, 1), paras: m.paras, wrap: m.lines > 1, name, ...(title ? { title: true } : {}), ...timing(container) })
    }

    // ---------- Bausteine ----------

        const REPLACED = 'img,svg,canvas,video,iframe,object,picture,.mermaid-block,table,pre,ul,ol'

    const isInline = (el: Element) => cs(el).display.startsWith('inline') && !el.matches(REPLACED) && !el.querySelector(REPLACED)

    /** Muss als Bild eingefügt werden? */
    function rasterReason(el: Element): boolean {
      const s = cs(el)
      const tag = el.tagName
      if (el.classList.contains('katex-display') || el.classList.contains('katex')) return true
      if (tag === 'svg' || tag === 'CANVAS' || tag === 'VIDEO' || tag === 'IFRAME' || tag === 'OBJECT') return true
      if (el.classList.contains('mermaid-block')) return true
      if (s.transform !== 'none') {
        const m = s.transform.match(/matrix\(([^)]+)\)/)
        if (!m) return true
        const v = m[1].split(',').map(Number)
        if (Math.abs(v[1]) > 0.001 || Math.abs(v[2]) > 0.001) return true
      }
      if (s.filter !== 'none' || s.mixBlendMode !== 'normal') return true
      if ((s.maskImage && s.maskImage !== 'none') || (s.clipPath && s.clipPath !== 'none')) return true
      if (s.getPropertyValue('-webkit-background-clip') === 'text' || s.getPropertyValue('background-clip') === 'text') return true
      return false
    }

    function markRaster(el: HTMLElement | SVGElement, name?: string, overlay = false) {
      let r = rel(el.getBoundingClientRect())
      if (r.w < 1 || r.h < 1) return
      // Listenpunkt: das Aufzählungszeichen liegt links außerhalb der Box des Listenpunkts
      if (el.tagName === 'LI' && el.parentElement) {
        const gap = (el.getBoundingClientRect().left - el.parentElement.getBoundingClientRect().left) / k
        if (gap > 0) r = { ...r, x: r.x - gap, w: r.w + gap }
      }
      if (overlay || el.classList.contains('katex')) {
        // Beschriftungen, Schwänze und Schatten (bei Formeln Brüche und Indizes) ragen aus der Box heraus: Nachkommen und etwas Rand einschließen
        let x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h
        for (const d of el.querySelectorAll('*')) {
          const b = rel(d.getBoundingClientRect())
          if (b.w < 1 || b.h < 1) continue
          x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h)
        }
        const pad = overlay ? 16 : 2
        x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(STAGE_W, x1 + pad); y1 = Math.min(720, y1 + pad)
        r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
      }
      // unsichtbare Nachkommen merken, damit sie im Einzelbild nicht erscheinen
      for (const d of el.querySelectorAll('*')) {
        const s = cs(d)
        if (s.visibility === 'hidden' || num(s.opacity) === 0 || s.display === 'none') d.setAttribute('data-pr-off', '')
      }
      const id = ++rasterId
      el.setAttribute('data-pr', String(id))
      const alt = el.getAttribute('aria-label') ?? el.getAttribute('alt') ?? undefined
      items.push({ kind: 'raster', id, ...r, alt: alt || undefined, name, ...(overlay ? { overlay: true } : {}), ...timing(el) })
      // Formel mit \htmlData{step=n}{…}: jeder Teil mit Schritt wird ein eigenes Bild (das Grundbild lässt ihn aus)
      if (animate && (el.classList.contains('katex') || el.classList.contains('katex-display'))) {
        for (const sub of el.querySelectorAll<HTMLElement>('[data-step]')) {
          const outer = sub.parentElement?.closest('[data-step]')
          if (outer && el.contains(outer)) continue
          markRaster(sub, 'Formelteil')
        }
      }
    }

    async function toDataUrl(src: string): Promise<string | null> {
      if (src in media) return src
      try {
        const res = await fetch(src)
        const blob = await res.blob()
        const url = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader()
          fr.onload = () => resolve(String(fr.result))
          fr.onerror = reject
          fr.readAsDataURL(blob)
        })
        return url
      } catch { return null }
    }

    async function picture(img: HTMLImageElement): Promise<void> {
      const s = cs(img)
      const src = img.currentSrc || img.src
      if (!img.complete || !img.naturalWidth || !src) return
      const r = rel(img.getBoundingClientRect())
      if (r.w < 1 || r.h < 1) return
      const plain = !/svg/i.test(src.slice(0, 30)) && !/\.svg(\?|$)/i.test(src)
        && s.borderRadius.split(' ').every((v) => !num(v)) && s.filter === 'none' && num(s.opacity) === 1
        && s.boxShadow === 'none' && s.objectFit !== 'cover' && s.objectFit !== 'none' && s.objectFit !== 'scale-down' && !num(s.borderTopWidth)
        && s.transform === 'none' && (!s.clipPath || s.clipPath === 'none')
      if (!plain) return markRaster(img)
      const key = src.length > 200 ? src.slice(0, 60) + ':' + src.length + ':' + src.slice(-60) : src
      if (!(key in media)) {
        const url = await toDataUrl(src)
        if (!url || !/^data:image\/(png|jpeg|jpg|gif);/i.test(url)) return markRaster(img)
        media[key] = url
      }
      // object-fit: contain → gezeichnetes Rechteck
      let { x, y, w, h } = r
      if (s.objectFit === 'contain') {
        const ratio = img.naturalWidth / img.naturalHeight
        if (w / h > ratio) { const nw = h * ratio; x += (w - nw) / 2; w = nw } else { const nh = w / ratio; y += (h - nh) / 2; h = nh }
      }
      img.setAttribute('data-pn', '')
      const link = img.closest('a')?.getAttribute('href') ?? undefined
      items.push({ kind: 'picture', x, y, w, h, media: key, alt: img.alt || undefined, link, ...timing(img) })
    }

    function listType(s: CSSStyleDeclaration, ordered: boolean): Pick<Bullet, 'type' | 'code'> | null {
      const t = s.listStyleType
      if (t === 'none') return null
      if (ordered || /decimal|roman|alpha|latin/.test(t)) return { type: 'number' }
      return { type: 'bullet', code: t === 'circle' ? '25E6' : t === 'square' ? '25AA' : '2022' }
    }

    /** `<li>` samt verschachtelter Listen → Absätze; false, wenn der Inhalt zu verwickelt ist */
    function collectList(list: HTMLElement, level: number, out: { para: Para; top: number; bottom: number; left: number; right: number; lines: number }[], base: { left: number; from?: number }): boolean {
      const ordered = list.tagName === 'OL'
      let index = (list as HTMLOListElement).start || 1
      for (const li of list.children) {
        if (!(li instanceof HTMLElement) || li.tagName !== 'LI') continue
        const ls = cs(li)
        if (ls.display === 'none' || ls.visibility === 'hidden' || num(ls.opacity) === 0) continue
        const own: Node[] = []
        const nested: HTMLElement[] = []
        for (const c of li.childNodes) {
          if (c instanceof HTMLElement && (c.tagName === 'UL' || c.tagName === 'OL')) { nested.push(c); continue }
          if (c instanceof HTMLElement && c.tagName === 'P') {
            if (own.length) own.push(document.createElement('br'))
            own.push(...c.childNodes)
            continue
          }
          if (c instanceof HTMLElement && (!isInline(c) && cs(c).display !== 'none')) return false
          own.push(c)
        }
        const m = measure(own, li)
        if (m) {
          const bt = listType(cs(list), ordered)
          const first = m.paras[0]
          if (bt) {
            const mk = getComputedStyle(li, '::marker')
            first.bullet = { ...bt, color: mix(rgba(mk.color), backdrop(li), opacityOf(li)), level, indent: 0, start: bt.type === 'number' ? (li as HTMLLIElement).value || index : undefined }
          }
          if (m.paras.length > 1) for (const p of m.paras.slice(1)) p.bullet = undefined
          const own = stepOf(li).from
          if (own > (base.from ?? 0)) for (const p of m.paras) p.from = own
          for (let i = 0; i < m.paras.length; i++) out.push({ para: m.paras[i], top: m.top, bottom: m.bottom, left: m.left, right: m.right, lines: m.lines })
        }
        index++
        for (const n of nested) if (!collectList(n, level + 1, out, base)) return false
      }
      return true
    }

    function emitList(list: HTMLElement) {
      // Listenpunkte mit Formel im Satz werden einzeln als Bild eingefügt (walk), nicht als Liste
      if ([...list.querySelectorAll('.katex')].some((q) => !q.closest('.katex-display'))) return false
      const out: { para: Para; top: number; bottom: number; left: number; right: number; lines: number }[] = []
      if (!collectList(list, 0, out, { left: 0, from: stepOf(list).from })) return false
      if (!out.length) return true
      const box = rel(list.getBoundingClientRect())
      // Einzug: Abstand des Textes der ersten Ebene vom Listenrand
      const firstLevel0 = out.find((o) => o.para.bullet?.level === 0) ?? out[0]
      const indent = Math.max(8, firstLevel0.left - box.x)
      for (const o of out) if (o.para.bullet) o.para.bullet.indent = indent
      // Abstände zwischen den Absätzen aus den gemessenen Zeilen
      for (let i = 0; i < out.length - 1; i++) {
        const gap = out[i + 1].top - out[i].bottom
        if (out[i + 1].top !== out[i].top) out[i].para.after = Math.max(0, gap) * PT
      }
      const top = Math.min(...out.map((o) => o.top))
      const bottom = Math.max(...out.map((o) => o.bottom))
      const right = Math.max(...out.map((o) => o.right))
      const lines = out.reduce((n, o) => n + o.lines, 0)
      const multi = out.some((o) => o.lines > 1)
      items.push({ kind: 'text', x: box.x, y: top, w: Math.max(box.w, right - box.x), h: bottom - top, paras: out.map((o) => o.para), wrap: multi, name: 'Liste', ...timing(list) })
      void lines
      return true
    }

    function emitPre(pre: HTMLElement) {
      const s = cs(pre)
      const z = zoomOf(pre) / k
      const box = contentBox(pre)
      const lhPx = s.lineHeight === 'normal' ? num(s.fontSize) * 1.25 : num(s.lineHeight)
      const lines: Run[][] = [[]]
      const lineFrom: number[] = [0]
      const walkNode = (n: Node, deco: Set<string>) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const parts = (n as Text).data.split('\n')
          const ps = pieces([n], { deco }, true)
          const base = ps[0]?.run
          if (!base) return
          parts.forEach((part, i) => {
            if (i > 0) { lines.push([]); lineFrom.push(0) }
            if (part) {
              lines[lines.length - 1].push({ ...base, text: part.replace(/\t/g, '    ') })
              lineFrom[lines.length - 1] = Math.max(lineFrom[lines.length - 1], stepOf((n as Text).parentElement).from)
            }
          })
          return
        }
        if (!(n instanceof HTMLElement)) return
        const es = cs(n)
        if (es.display === 'none' || es.visibility === 'hidden') return
        const d = new Set(deco)
        for (const x of es.textDecorationLine.split(' ')) if (x && x !== 'none') d.add(x)
        for (const c of n.childNodes) walkNode(c, d)
      }
      for (const c of pre.childNodes) walkNode(c, new Set())
      while (lines.length > 1 && !lines[lines.length - 1].length) lines.pop()
      const align = 'left' as const
      const fallback: Run = { text: ' ', font: fontOf(s.fontFamily), size: num(s.fontSize) * z * PT, color: mix(rgba(s.color), backdrop(pre), 1) }
      const itemFrom = stepOf(pre).from
      const paras: Para[] = lines.map((runs, i) => ({ runs: runs.length ? runs : [fallback], align, lineHeight: lhPx * z * PT, before: 0, after: 0, ...(lineFrom[i] > itemFrom ? { from: lineFrom[i] } : {}) }))
      if (!paras.some((p) => p.runs.some((r) => r.text.trim()))) return
      items.push({ kind: 'text', x: box.x, y: box.y, w: box.w, h: lines.length * lhPx * z, paras, wrap: false, name: 'Code', ...timing(pre) })
    }

    function emitTable(table: HTMLTableElement) {
      const rows = [...table.rows]
      if (!rows.length) return
      const tr = rel(table.getBoundingClientRect())
      const edges = new Set<number>()
      const cellRects = rows.map((row) => [...row.cells].map((c) => rel(c.getBoundingClientRect())))
      for (const row of cellRects) for (const c of row) { edges.add(Math.round(c.x * 10) / 10); edges.add(Math.round((c.x + c.w) * 10) / 10) }
      const xs = [...edges].sort((a, b) => a - b).filter((v, i, a) => i === 0 || v - a[i - 1] > 1.5)
      if (xs.length < 2) return
      const cols = xs.slice(1).map((v, i) => v - xs[i])
      const near = (v: number) => xs.reduce((best, e, i) => (Math.abs(e - v) < Math.abs(xs[best] - v) ? i : best), 0)
      const rowItems: { h: number; cells: TableCell[] }[] = []
      const rowFrom: number[] = []
      rows.forEach((row, ri) => {
        const cells: TableCell[] = []
        ;[...row.cells].forEach((cell, ci) => {
          const s = cs(cell)
          const z = zoomOf(cell) / k
          const c0 = near(cellRects[ri][ci].x)
          const c1 = near(cellRects[ri][ci].x + cellRects[ri][ci].w)
          const m = measure([...cell.childNodes], cell)
          const bg = [cell, row, row.parentElement, table].map((e) => rgba(cs(e!).backgroundColor)).find((c) => c[3] > 0.05)
          const side = (w: string, st: string, col: string) => (num(w) > 0 && st !== 'none' && st !== 'hidden' ? { pt: num(w) * z * PT, color: mix(rgba(col), backdrop(cell), 1) } : null)
          const align = s.textAlign === 'center' ? 'center' : s.textAlign === 'right' || s.textAlign === 'end' ? 'right' : 'left'
          const paras = m ? m.paras : [{ runs: [{ text: ' ', font: fontOf(s.fontFamily), size: num(s.fontSize) * z * PT, color: '000000' }], align: align as Para['align'], lineHeight: 0, before: 0, after: 0 }]
          for (const p of paras) p.align = align as Para['align']
          cells.push({
            paras,
            fill: bg ? mix(bg, backdrop(table.parentElement), 1) : undefined,
            borders: [side(s.borderTopWidth, s.borderTopStyle, s.borderTopColor), side(s.borderRightWidth, s.borderRightStyle, s.borderRightColor), side(s.borderBottomWidth, s.borderBottomStyle, s.borderBottomColor), side(s.borderLeftWidth, s.borderLeftStyle, s.borderLeftColor)],
            margin: [num(s.paddingTop), num(s.paddingRight), num(s.paddingBottom), num(s.paddingLeft)].map((v) => v * z * PT),
            valign: s.verticalAlign === 'middle' ? 'middle' : s.verticalAlign === 'bottom' ? 'bottom' : 'top',
            colspan: c1 - c0 > 1 ? c1 - c0 : undefined,
            rowspan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
          })
        })
        rowItems.push({ h: rel(row.getBoundingClientRect()).h, cells })
        rowFrom.push(stepOf(row).from)
      })
      table.setAttribute('data-pt', '')
      const until = stepOf(table).until
      // Zeilen mit Schritt: je Schrittgruppe eine eigene Tabelle (PowerPoint kann Tabellenzeilen nicht einzeln einblenden)
      let start = 0
      while (start < rowItems.length) {
        let end = start + 1
        while (end < rowItems.length && rowFrom[end] === rowFrom[start]) end++
        const group = rowItems.slice(start, end)
        const y = start === 0 ? tr.y : rel(rows[start].getBoundingClientRect()).y
        const h = group.reduce((n, r) => n + r.h, 0)
        items.push({ kind: 'table', x: xs[0], y, w: xs[xs.length - 1] - xs[0], h, cols, rows: group, ...(rowFrom[start] > 0 ? { from: rowFrom[start] } : {}), ...(Number.isFinite(until) ? { until } : {}) })
        start = end
      }
    }

    // ---------- Baum ablaufen ----------

    function hasDecor(el: HTMLElement, s: CSSStyleDeclaration): boolean {
      let pseudo = false
      for (const p of ['::before', '::after'] as const) {
        const ps = getComputedStyle(el, p)
        if (ps.content && ps.content !== 'none' && ps.content !== 'normal') {
          pseudo = true
          // Text aus Pseudo-Elementen (Titel-Zeichen, Nummern) bleibt im Hintergrundbild: seine Farbe merken
          el.style.setProperty(p === '::before' ? '--hm-pb' : '--hm-pa', ps.color)
        }
      }
      if (el.matches('.slide, .print-slide, .print-stage')) return pseudo || s.backgroundImage !== 'none'
      if (pseudo || rgba(s.backgroundColor)[3] > 0.01 || s.backgroundImage !== 'none' || s.boxShadow !== 'none') return true
      for (const side of ['top', 'right', 'bottom', 'left']) {
        if (num(s.getPropertyValue(`border-${side}-width`)) > 0 && s.getPropertyValue(`border-${side}-style`) !== 'none' && rgba(s.getPropertyValue(`border-${side}-color`))[3] > 0.01) return true
      }
      return num(s.outlineWidth) > 0 && s.outlineStyle !== 'none'
    }

    /** Absatz, Listenpunkt oder Überschrift mit einer Formel mitten im Text */
    function hasInlineMath(el: HTMLElement): boolean {
      if (!el.matches('p, li, h1, h2, h3, h4, h5, h6, dt, dd, figcaption, blockquote') || el.querySelector('.katex-display')) return false
      return [...el.querySelectorAll('.katex')].some((q) => !q.closest('.katex-display'))
    }

    async function walk(el: HTMLElement): Promise<void> {
      const s = cs(el)
      if (s.display === 'none' || s.visibility === 'hidden' || num(s.opacity) === 0) return
      if (el.matches('script,style,template,.pptx-notes,.print-notes,[hidden]')) return
      if (el.tagName === 'IMG') return picture(el as HTMLImageElement)
      if (animate && el.classList.contains('mermaid-block')) {
        const states = [...el.querySelectorAll<HTMLElement>('.mermaid-state')]
        if (states.length > 1) { for (const st of states) markRaster(st, 'Diagramm'); return }
      }
      if (rasterReason(el)) { markRaster(el, el.classList.contains('mermaid-block') ? 'Diagramm' : undefined); return }
      if (el.tagName === 'TABLE') { emitTable(el as HTMLTableElement); return }
      if (hasInlineMath(el)) { markRaster(el, 'Absatz mit Formel'); return }
      if (el.tagName === 'PRE') {
        if (hasDecor(el, s)) {
          decor = true
          if (isStepped(el) && !el.closest('[data-po]')) { el.setAttribute('data-po', ''); markRaster(el, 'Dekoration', true) }
        }
        emitPre(el)
        return
      }
      if (hasDecor(el, s)) {
        decor = true
        // Dekoration über einem Bild (Sprechblasen, Rahmen, Marker) läge im Hintergrundbild unter dem Bild: eigenes Bild darüber
        if (!el.closest('[data-po]')) {
          const r = el.getBoundingClientRect()
          const over = items.some((it) => {
            if (it.kind === 'text') return false
            const b = { x: it.x * k + R.left, y: it.y * k + R.top, w: it.w * k, h: it.h * k }
            return r.left < b.x + b.w && r.right > b.x && r.top < b.y + b.h && r.bottom > b.y
          })
          if (isStepped(el) || (over && r.width < R.width * 0.9)) { el.setAttribute('data-po', ''); markRaster(el, 'Dekoration', true) }
        }
      }
      if (el.tagName === 'UL' || el.tagName === 'OL') {
        if (emitList(el)) return
      }
      if (el.tagName === 'FIGURE' && el.querySelector('svg.qr-svg')) { markRaster(el, 'QR-Code'); return }

      let group: Node[] = []
      const flush = () => {
        if (group.some((n) => (n.textContent ?? '').trim())) {
          const m = measure(group, el)
          if (m) {
            const isTitle = el.classList.contains('slide-title')
            emitText(m, el, isTitle ? 'Titel' : /^H[1-6]$/.test(el.tagName) ? 'Überschrift' : undefined, isTitle)
          }
        }
        group = []
      }
      for (const c of el.childNodes) {
        if (c.nodeType === Node.TEXT_NODE) { group.push(c); continue }
        if (!(c instanceof HTMLElement || c instanceof SVGElement)) continue
        if (c instanceof HTMLElement && isInline(c)) { group.push(c); continue }
        flush()
        if (c instanceof SVGElement) { if (cs(c).display !== 'none' && cs(c).visibility !== 'hidden') markRaster(c); continue }
        await walk(c)
      }
      flush()
    }

    const slideEl = stage.querySelector<HTMLElement>('.slide') ?? stage
    await walk(stage)

    // Notizen
    const notesEl = article.querySelector<HTMLElement>('.pptx-notes')
    let notes = ''
    if (notesEl) {
      const lines: string[] = []
      for (const b of notesEl.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, pre, [data-note-step]')) {
        if (b.matches('[data-note-step]')) { lines.push(`[Schritt ${b.getAttribute('data-note-step')}]`); continue }
        if (b.parentElement?.closest('p, li, h1, h2, h3, h4, h5, h6, pre')) continue
        const t = (b.textContent ?? '').trim()
        if (t) lines.push(b.tagName === 'LI' ? '• ' + t : t)
      }
      notes = lines.join('\n')
    }

    const bgEl = rgba(cs(slideEl).backgroundColor)[3] > 0.5 ? slideEl : stage
    const bgc = rgba(cs(bgEl).backgroundColor)
    pages.push({
      id: article.dataset.node ?? '',
      sub: Number(article.dataset.sub ?? 0),
      step: Number(article.dataset.step ?? 0),
      title: article.dataset.title ?? '',
      section: article.dataset.section ?? '',
      transition: article.dataset.transition,
      depth: Number(article.dataset.depth ?? 1),
      items,
      notes,
      solidBg: !decor && cs(slideEl).backgroundImage === 'none' && cs(stage).backgroundImage === 'none',
      bgColor: hex(bgc[0], bgc[1], bgc[2]),
    })
  }
  return { pages, media }
}

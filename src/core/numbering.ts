// Kapitelnummern und Inhaltsverzeichnis (Agenda-Folie): rein, ohne Abhängigkeiten, damit es ohne Deck-Laden testbar ist.

import type { DeckNode, Manifest } from './types.ts'

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Kapitel für die Agenda: Hauptpfad ohne Titel- und Agenda-Folien */
const isChapter = (n: DeckNode) => n.layout !== 'title' && n.layout !== 'agenda'

const OFF_VALUES = ['off', 'false', 'no', 'none']
const ON_VALUES = ['on', 'true', 'yes']
/** `{number=…}` / `{toc=…}`: `off` oder `on`; alles andere gilt als nicht angegeben (mit Hinweis) */
function switchOf(v: string | undefined): 'on' | 'off' | undefined {
  const t = v?.trim().toLowerCase()
  if (!t) return undefined
  return OFF_VALUES.includes(t) ? 'off' : ON_VALUES.includes(t) ? 'on' : undefined
}

export interface NumberingConfig { from: number; to: number; appendix: boolean; titles: boolean }

/** `numbering:` aus der deck.yaml; ohne Eintrag gibt es keine Nummern. Ungültiges wird gemeldet und durch den Standard ersetzt. */
export function numberingConfig(manifest: Manifest, maxDepth: number, warnings: string[]): NumberingConfig | undefined {
  const raw = manifest.numbering as unknown
  if (raw === undefined || raw === null || raw === false) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    warnings.push('deck.yaml: numbering muss ein Block sein, z. B. numbering: { from: 1, to: 2 }')
    return undefined
  }
  const m = raw as Record<string, unknown>
  const level = (key: 'from' | 'to', fallback: number) => {
    const v = m[key]
    if (v === undefined) return fallback
    if (!Number.isInteger(v) || (v as number) < 1 || (v as number) > maxDepth) {
      warnings.push(`deck.yaml: numbering.${key} „${v}“ ist ungültig (eine Ebene von 1 bis ${maxDepth}), genommen wird ${fallback}`)
      return fallback
    }
    return v as number
  }
  const from = level('from', 1)
  let to = level('to', Math.max(from, Math.min(2, maxDepth)))
  if (to < from) {
    warnings.push(`deck.yaml: numbering.from (${from}) liegt unter numbering.to (${to}), genommen wird to = ${from}`)
    to = from
  }
  for (const key of ['appendix', 'titles']) {
    if (m[key] !== undefined && typeof m[key] !== 'boolean') warnings.push(`deck.yaml: numbering.${key} muss true oder false sein`)
  }
  for (const key of Object.keys(m)) {
    if (!['from', 'to', 'appendix', 'titles'].includes(key)) warnings.push(`deck.yaml: numbering.${key} ist unbekannt (from, to, appendix, titles)`)
  }
  return { from, to, appendix: m.appendix === true, titles: m.titles !== false }
}

/**
 * Kapitelnummern (`numbering:` in der deck.yaml): zählt in Baumreihenfolge, nur die Ebenen von..bis, lückenlos.
 * Titel- und Agenda-Folien und der Anhang bekommen keine Nummer, `{number=off}` nimmt einen Knoten samt Unterbaum heraus,
 * `{number=on}` holt einen Knoten (und seinen Unterbaum) zurück. Die oberste gezählte Ebene läuft durch das ganze Deck,
 * darunter beginnt jede Ebene unter dem Elternkapitel neu (`2.1`, `2.2`). Die Nummer steht nie in der Id.
 */
export function applyNumbering(nodes: DeckNode[], cfg: NumberingConfig | undefined, warnings: string[]) {
  const counters = new Array(8).fill(0)
  const visit = (list: DeckNode[], inheritedBlocked: boolean) => {
    for (const node of list) {
      const raw = node.attrs.number
      const explicit = switchOf(raw)
      if (raw !== undefined && !explicit) warnings.push(`„${node.title}“: number „${raw}“ ist ungültig (off oder on)`)
      if (!cfg) {
        if (explicit) warnings.push(`„${node.title}“: number=${explicit} wirkt nur mit numbering: in der deck.yaml`)
        visit(node.children, false)
        continue
      }
      // Anhang und `number=off` gelten für den ganzen Unterbaum, `number=on` hebt sie auf
      const blocked = explicit === 'on' ? false : explicit === 'off' ? true : node.plan === 'appendix' && !cfg.appendix ? true : inheritedBlocked
      const d = node.depth
      for (let l = Math.max(d, cfg.from) + 1; l < counters.length; l++) counters[l] = 0
      if (!blocked && d >= cfg.from && d <= cfg.to && node.layout !== 'title' && node.layout !== 'agenda') {
        counters[d]++
        node.num = counters.slice(cfg.from, d + 1).filter((c) => c > 0).join('.')
        if (cfg.titles) node.numTitle = true
      }
      visit(node.children, blocked)
    }
  }
  visit(nodes, false)
}

/** `levels=2` bzw. `levels=1-2` an der Agenda → von/bis Ebene */
function parseLevels(v: string, maxDepth: number): [number, number] | undefined {
  const m = /^(\d+)(?:-(\d+))?$/.exec(v.trim())
  if (!m) return undefined
  const a = Number(m[1])
  const b = m[2] ? Number(m[2]) : a
  return a >= 1 && b >= a && b <= maxDepth ? [a, b] : undefined
}

/** Ab so vielen Einträgen passt ein Verzeichnis kaum noch lesbar auf eine Folie */
export const TOC_MAX_ITEMS = 16

/**
 * `layout=agenda`: listet die Kapitel des Hauptpfads. Steht die Agenda zwischen den Kapiteln,
 * sind die vorherigen erledigt und das folgende ist „als Nächstes“; unter einem Kapitel ist dieses „aktuell“.
 * Mit `levels=1-2` wird sie zum Inhaltsverzeichnis: alle Knoten dieser Ebenen, eingerückt, mit Kapitelnummer (`numbering:`).
 * `{toc=off}` lässt einen Knoten samt Unterbaum weg.
 */
export function injectAgendas(nodes: DeckNode[], numbered: boolean, maxDepth: number, warnings: string[]) {
  const tocOff = (n: DeckNode) => switchOf(n.attrs.toc) === 'off'
  const chapters = nodes.filter((c) => isChapter(c) && !tocOff(c))
  const visit = (list: DeckNode[], top: DeckNode | undefined) => {
    for (const node of list) {
      const chapter = top ?? node
      if (node.attrs.toc !== undefined && !switchOf(node.attrs.toc)) warnings.push(`„${node.title}“: toc „${node.attrs.toc}“ ist ungültig (off oder on)`)
      if (node.attrs.levels !== undefined && node.layout !== 'agenda') warnings.push(`„${node.title}“: levels= wirkt nur mit layout=agenda`)
      if (node.layout === 'agenda') {
        const topIndex = nodes.indexOf(chapter)
        // Index des Kapitels, das gerade dran ist bzw. als Nächstes kommt
        const pivot = chapters.findIndex((c) => nodes.indexOf(c) >= topIndex)
        const inside = top !== undefined && isChapter(chapter)
        const stateOf = (c: DeckNode) => {
          const i = chapters.indexOf(c)
          return i < pivot || pivot < 0 ? 'done' : i === pivot ? (inside ? 'current' : 'next') : 'todo'
        }
        const numSpan = (n: DeckNode) => (numbered ? `<span class="agenda-num">${n.num ?? ''}</span>` : '')
        const range = node.attrs.levels !== undefined ? parseLevels(node.attrs.levels, maxDepth) : undefined
        if (node.attrs.levels !== undefined && !range) warnings.push(`„${node.title}“: levels „${node.attrs.levels}“ ist ungültig (z. B. levels=2 oder levels=1-2, höchstens bis Ebene ${maxDepth})`)
        let items: string[]
        if (range) {
          items = []
          const walk = (children: DeckNode[], state: string) => {
            for (const c of children) {
              if (tocOff(c) || (c.depth === 1 && !isChapter(c))) continue
              const st = c.depth === 1 ? stateOf(c) : state
              if (c.depth >= range[0] && c.depth <= range[1] && isChapter(c)) {
                items.push(`<li class="agenda-${st}" data-depth="${c.depth}">${numSpan(c)}<a href="#${encodeURI(c.id)}">${escapeHtml(c.title)}</a></li>`)
              }
              if (c.depth < range[1]) walk(c.children, st)
            }
          }
          walk(nodes, 'todo')
          if (items.length > TOC_MAX_ITEMS) warnings.push(`„${node.title}“: Das Verzeichnis hat ${items.length} Einträge, mehr als etwa ${TOC_MAX_ITEMS} werden auf einer Folie klein (levels= enger fassen oder {toc=off} setzen)`)
        } else {
          items = chapters.map((c) => {
            const count = c.children.length ? `<span class="agenda-count">${c.children.length} Details</span>` : ''
            return `<li class="agenda-${stateOf(c)}">${numSpan(c)}<a href="#${encodeURI(c.id)}">${escapeHtml(c.title)}</a>${count}</li>`
          })
        }
        // Zeilen für die zweispaltige Darstellung ab 10 Kapiteln (siehe base.css)
        const html = `<ol class="agenda${numbered ? ' agenda-numbered' : ''}" style="--agenda-rows:${Math.ceil(items.length / 2)}">${items.join('')}</ol>`
        node.slides[0].html = node.slides[0].html ? `${node.slides[0].html}\n${html}` : html
      }
      visit(node.children, chapter)
    }
  }
  visit(nodes, undefined)
}

/** Titel mit Kapitelnummer für Listen und Verzeichnisse („2.1 Drei Hebel“); ohne Nummer nur der Titel */
export const labelOf = (n: { title: string; num?: string }): string => (n.num ? `${n.num} ${n.title}` : n.title)

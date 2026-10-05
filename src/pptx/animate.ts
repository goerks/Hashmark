// PPTX-Export, Animationen: Schritte (`data-step`, `data-until`) werden zu PowerPoint-Animationen.
// pptxgenjs kennt keine Animationen, deshalb schreiben wir den `<p:timing>`-Block selbst.
//
// Ein Schritt = ein Klick. Alles mit derselben Schrittnummer erscheint zusammen (der erste Effekt „bei Klick“, die
// übrigen „mit Vorherigem“), Elemente mit `until` verschwinden mit dem Klick ihrer Nummer. Listen und Code werden
// absatzweise aufgebaut (Absatzbereiche `pRg`), ganze Formen, Bilder und Tabellen als Ganzes.

/** Was an einer Form animiert wird; `name` ist der Objektname in der Folie (eindeutig je Folie) */
export interface AnimItem {
  name: string
  /** Text-Form (nur dort gibt es Absatz-Aufbau und `bldP`-Einträge) */
  text: boolean
  from?: number
  until?: number
  /** Schritt je Absatz (undefined = von Anfang an), nur bei Text-Formen */
  paras?: (number | undefined)[]
}

interface Effect {
  step: number
  kind: 'in' | 'out'
  spid: string
  text: boolean
  /** Absatzbereich (von, bis), 0-basiert, einschließlich */
  range?: [number, number]
}

const FADE_MS = 400

function effects(items: AnimItem[], idOf: (name: string) => string | undefined): { list: Effect[]; build: Map<string, boolean> } {
  const list: Effect[] = []
  // spid → true, wenn absatzweise aufgebaut wird
  const build = new Map<string, boolean>()
  for (const it of items) {
    const spid = idOf(it.name)
    if (!spid) continue
    const base = it.from ?? 0
    const perPara = it.text && it.paras?.some((p) => (p ?? 0) > base)
    if (perPara) {
      const steps = it.paras!.map((p) => Math.max(p ?? 0, base))
      let i = 0
      while (i < steps.length) {
        let j = i
        while (j + 1 < steps.length && steps[j + 1] === steps[i]) j++
        if (steps[i] > 0) list.push({ step: steps[i], kind: 'in', spid, text: true, range: [i, j] })
        i = j + 1
      }
      build.set(spid, true)
      continue
    }
    if (base > 0) list.push({ step: base, kind: 'in', spid, text: it.text })
    if (it.until && it.until > base) list.push({ step: it.until, kind: 'out', spid, text: it.text })
    if (it.text && (base > 0 || it.until)) build.set(spid, false)
  }
  return { list, build }
}

/** `<p:timing>` für eine Folie; null, wenn nichts animiert wird */
export function timingXml(items: AnimItem[], idOf: (name: string) => string | undefined): string | null {
  const { list, build } = effects(items, idOf)
  if (!list.length) return null
  let id = 2
  const next = () => ++id

  const target = (e: Effect) => (e.range
    ? `<p:spTgt spid="${e.spid}"><p:txEl><p:pRg st="${e.range[0]}" end="${e.range[1]}"/></p:txEl></p:spTgt>`
    : `<p:spTgt spid="${e.spid}"/>`)

  const setVisible = (e: Effect, value: 'visible' | 'hidden', delay: number) =>
    `<p:set><p:cBhvr><p:cTn id="${next()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst></p:cTn>`
    + `<p:tgtEl>${target(e)}</p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr>`
    + `<p:to><p:strVal val="${value}"/></p:to></p:set>`

  const fade = (e: Effect, transition: 'in' | 'out') =>
    `<p:animEffect transition="${transition}" filter="fade"><p:cBhvr><p:cTn id="${next()}" dur="${FADE_MS}"/>`
    + `<p:tgtEl>${target(e)}</p:tgtEl></p:cBhvr></p:animEffect>`

  const effect = (e: Effect, first: boolean) => {
    const node = first ? 'clickEffect' : 'withEffect'
    const cls = e.kind === 'in' ? 'entr' : 'exit'
    const body = e.kind === 'in'
      ? setVisible(e, 'visible', 0) + fade(e, 'in')
      : fade(e, 'out') + setVisible(e, 'hidden', FADE_MS - 1)
    return `<p:par><p:cTn id="${next()}" presetID="10" presetClass="${cls}" presetSubtype="0" fill="hold"${e.text ? ' grpId="0"' : ''} nodeType="${node}">`
      + `<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${body}</p:childTnLst></p:cTn></p:par>`
  }

  const steps = [...new Set(list.map((e) => e.step))].sort((a, b) => a - b)
  const clicks = steps.map((step) => {
    const group = list.filter((e) => e.step === step)
    const outer = next()
    const inner = next()
    return `<p:par><p:cTn id="${outer}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>`
      + `<p:par><p:cTn id="${inner}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>`
      + group.map((e, i) => effect(e, i === 0)).join('')
      + `</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`
  }).join('')

  const bld = [...build].map(([spid, byPara]) => `<p:bldP spid="${spid}" grpId="0"${byPara ? ' build="p"' : ''}/>`).join('')

  return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>`
    + `<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${clicks}</p:childTnLst></p:cTn>`
    + `<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>`
    + `<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>`
    + `</p:childTnLst></p:cTn></p:par></p:tnLst>${bld ? `<p:bldLst>${bld}</p:bldLst>` : ''}</p:timing>`
}

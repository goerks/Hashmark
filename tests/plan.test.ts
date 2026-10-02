import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadDeck } from '../src/core/deck.ts'
import { Navigator, type Position } from '../src/core/navigator.ts'
import {
  authorPlan, emptyPlanFile, parsePlanFile, planGroups, presetAll, presetBudget, presetDepth, resetSubtree, setSubtree, summarize,
} from '../src/core/plan.ts'
import { splitHeadingAttrs, parseAttrs } from '../src/core/syntax.ts'
import { lintText } from '../src/core/lint.ts'
import { DEFAULT_PRINT, printPages } from '../src/core/print.ts'
import type { DeckNode, PlanState } from '../src/core/types.ts'

const n = (id: string, children: DeckNode[] = [], plan?: PlanState, slides = 1): DeckNode => ({
  id, title: id, depth: id.split('/').length, attrs: {}, children, ...(plan ? { plan } : {}),
  slides: Array.from({ length: slides }, () => ({ html: '', steps: [] })), source: { file: '', line: 1 },
})

// intro, arch (fe, be (db*, api* (ep)), dep), res (c1 Anhang), fazit      * = optional
const tree = () => [
  n('intro'),
  n('arch', [n('arch/fe'), n('arch/be', [n('arch/be/db', [], 'optional'), n('arch/be/api', [n('arch/be/api/ep')], 'optional')]), n('arch/dep')]),
  n('res', [n('res/c1', [], 'appendix')]),
  n('fazit'),
]

const key = (p: Position) => `${p.id}:${p.slide}:${p.step ?? 0}`
/** Space bis zum Ende; `dive` taucht an diesen Knoten mit ↓ ab */
function walk(nav: Navigator, dive: string[] = [], from: Position | null = nav.first) {
  const seen: string[] = []
  const dived = new Set<string>()
  let cur = from
  for (let guard = 0; cur && guard < 50; guard++) {
    seen.push(key(cur))
    const dives = dive.includes(cur.id) && !dived.has(cur.id) && nav.node(cur.id)?.children.length
    if (dives) dived.add(cur.id)
    const move = dives ? nav.down(cur) : nav.forward(cur)
    nav.sync(move?.pos ?? cur)
    cur = move?.pos ?? null
  }
  return seen
}

describe('Plan: Syntax und Laden', () => {
  it('kennt {optional} und {appendix} als bare Flags', () => {
    expect(splitHeadingAttrs('API {optional}')).toEqual({ text: 'API', attrs: 'optional' })
    expect(splitHeadingAttrs('Messwerte {appendix}')).toEqual({ text: 'Messwerte', attrs: 'appendix' })
    expect(parseAttrs('optional layout=two-col')).toEqual({ optional: 'true', layout: 'two-col' })
  })
  it('liest den Standard des Autors', () => {
    expect(authorPlan({ optional: 'true' })).toBe('optional')
    expect(authorPlan({ appendix: 'true' })).toBe('appendix')
    expect(authorPlan({ plan: 'path' })).toBe('path')
    expect(authorPlan({ optional: 'false' })).toBeUndefined()
    expect(authorPlan({})).toBeUndefined()
  })
  it('setzt DeckNode.plan beim Laden und warnt bei ungültigem Plan', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashmark-plan-'))
    await fs.writeFile(path.join(dir, 'a.md'), '# A\n## B {optional}\n## C {appendix}\n## D {plan=quatsch}\n## E\n')
    const { deck, warnings } = await loadDeck(dir)
    const kids = deck.nodes[0].children
    expect(kids.map((k) => k.plan)).toEqual(['optional', 'appendix', undefined, undefined])
    expect(warnings.some((w) => w.includes('quatsch'))).toBe(true)
  })
  it('lintet unbekannte Pläne und bekennt die Flags', () => {
    expect(lintText('# A {optional}\n').length).toBe(0)
    const problems = lintText('# A {plan=optinal}\n')
    expect(problems[0]?.fix).toBe('optional')
    expect(lintText('# A {optionall}\n')[0]?.fix).toBe('optional')
  })
})

describe('Plan: Zustand', () => {
  it('erbt vom Elternknoten, der Knoten selbst gewinnt', () => {
    const nav = new Navigator(tree())
    expect(nav.state('arch/be/api/ep')).toBe('optional')
    expect(nav.state('res/c1')).toBe('appendix')
    expect(nav.state('arch/be')).toBe('path')
    const explicit = new Navigator([n('x', [n('x/y', [], 'path')], 'optional')])
    expect(explicit.state('x/y')).toBe('path')
  })
  it('lässt die Wahl des Vortragenden den Standard des Autors schlagen, auch im Unterbaum', () => {
    const nav = new Navigator(tree(), { states: { 'arch/be': 'appendix' } })
    expect(nav.state('arch/be')).toBe('appendix')
    expect(nav.state('arch/be/db')).toBe('appendix') // Autor: optional, Vortragender am Elternknoten: Anhang
    expect(nav.state('arch/fe')).toBe('path')
  })
  it('ignoriert den Plan mit all', () => {
    const nav = new Navigator(tree(), { all: true })
    expect(nav.state('res/c1')).toBe('path')
  })
})

describe('Plan: Space und Ausflug', () => {
  it('überspringt Optionales und Anhang', () => {
    expect(walk(new Navigator(tree()))).toEqual(['intro:0:0', 'arch:0:0', 'arch/fe:0:0', 'arch/be:0:0', 'arch/dep:0:0', 'res:0:0', 'fazit:0:0'])
  })
  it('läuft ohne Markierung wie früher durch alles (Tiefensuche)', () => {
    const plain = [n('a', [n('a/x', [n('a/x/y')]), n('a/z')]), n('b')]
    expect(walk(new Navigator(plain))).toEqual(['a:0:0', 'a/x:0:0', 'a/x/y:0:0', 'a/z:0:0', 'b:0:0'])
  })
  it('läuft mit all durch alles, auch Optionales und Anhang', () => {
    const seen = walk(new Navigator(tree(), { all: true }))
    expect(seen).toContain('arch/be/db:0:0')
    expect(seen).toContain('res/c1:0:0')
  })
  it('taucht per ↓ ab, läuft die Ausflug-Folien ab und kehrt zur Abzweigung zurück', () => {
    const nav = new Navigator(tree())
    const seen = walk(nav, ['arch/be'])
    expect(seen).toEqual([
      'intro:0:0', 'arch:0:0', 'arch/fe:0:0', 'arch/be:0:0',
      'arch/be/db:0:0', 'arch/be/api:0:0', // Ausflug, ep bleibt außen vor
      'arch/be:0:0', // zurück an die Abzweigung
      'arch/dep:0:0', 'res:0:0', 'fazit:0:0',
    ])
    expect(nav.trip).toEqual([])
  })
  it('kehrt an die gemerkte Folie und den Schritt zurück', () => {
    const t = [n('a', [n('a/x', [], 'optional')], undefined, 2), n('b')]
    const nav = new Navigator(t)
    const dive = nav.down({ id: 'a', slide: 1 })!
    expect(dive.pos).toEqual({ id: 'a/x', slide: 0 })
    expect(nav.trip).toHaveLength(1)
    const back = nav.forward(dive.pos)!
    expect(back).toEqual({ pos: { id: 'a', slide: 1 }, dir: 'up' })
    expect(nav.trip).toHaveLength(0)
    expect(nav.forward(back.pos)?.pos).toEqual({ id: 'b', slide: 0 })
  })
  it('verschachtelt Ausflüge mit einem Stapel von Rückkehrmarken', () => {
    const nav = new Navigator(tree())
    const seen = walk(nav, ['arch/be', 'arch/be/api'])
    expect(seen).toEqual([
      'intro:0:0', 'arch:0:0', 'arch/fe:0:0', 'arch/be:0:0',
      'arch/be/db:0:0', 'arch/be/api:0:0', 'arch/be/api/ep:0:0',
      'arch/be/api:0:0', // zurück aus dem inneren Ausflug
      'arch/be:0:0', // zurück aus dem äußeren
      'arch/dep:0:0', 'res:0:0', 'fazit:0:0',
    ])
  })
  it('startet nur dann einen Ausflug, wenn es Kinder abseits des Pfads gibt', () => {
    const nav = new Navigator(tree())
    expect(nav.down({ id: 'arch', slide: 0 })?.pos.id).toBe('arch/fe') // alle Kinder auf dem Pfad: wie Pfeile
    expect(nav.trip).toHaveLength(0)
    nav.down({ id: 'arch/be', slide: 0 })
    expect(nav.trip).toHaveLength(1)
  })
  it('taucht ins erste Kind abseits des Pfads, auch wenn davor Kinder auf dem Pfad liegen', () => {
    const mixed = new Navigator([n('p', [n('p/a'), n('p/b', [], 'optional'), n('p/c'), n('p/d', [], 'appendix')]), n('q')])
    const dive = mixed.down({ id: 'p', slide: 0 })!
    expect(dive.pos.id).toBe('p/b')
    expect(mixed.trip).toHaveLength(1)
    expect(mixed.forward(dive.pos)?.pos.id).toBe('p/d') // Ausflug: nur Kinder abseits des Pfads
    expect(mixed.forward({ id: 'p/d', slide: 0 })?.pos.id).toBe('p') // zurück
    expect(mixed.forward({ id: 'p', slide: 0 })?.pos.id).toBe('p/a') // danach der Pfad
  })
  it('beendet den Ausflug, wenn man ihn mit ↑ oder → verlässt', () => {
    const nav = new Navigator(tree())
    const dive = nav.down({ id: 'arch/be', slide: 0 })!
    expect(nav.trip).toHaveLength(1)
    nav.sync(nav.up(dive.pos)!.pos)
    expect(nav.trip).toHaveLength(0)
    nav.down({ id: 'arch/be', slide: 0 })
    nav.sync({ id: 'arch/dep', slide: 0 })
    expect(nav.trip).toHaveLength(0)
  })
  it('bricht mit ↑/Esc (leave) den Ausflug ab und kehrt zurück, nach einem Sprung dorthin, woher man kam', () => {
    const nav = new Navigator(tree())
    const dive = nav.down({ id: 'arch/be', slide: 0 })!
    expect(nav.leave(dive.pos)).toEqual({ pos: { id: 'arch/be', slide: 0 }, dir: 'up' })
    nav.sync({ id: 'arch/be', slide: 0 })
    expect(nav.trip).toHaveLength(0)
    const from = { id: 'arch/fe', slide: 0 }
    const jump = nav.jumpTo({ id: 'res/c1', slide: 0 }, from)
    expect(nav.leave(jump.pos)?.pos).toEqual(from) // nicht zum Elternknoten „res“
    expect(nav.leave({ id: 'arch/fe', slide: 0 } as Position)?.pos.id).toBe('arch') // ohne Ausflug wie up
  })
  it('zeigt mit peek nur an und verändert nichts', () => {
    const nav = new Navigator(tree())
    expect(nav.down({ id: 'arch/be', slide: 0 }, true)?.pos.id).toBe('arch/be/db')
    expect(nav.trip).toHaveLength(0)
    nav.down({ id: 'arch/be', slide: 0 })
    expect(nav.forward({ id: 'arch/be/api', slide: 0 }, true)?.pos.id).toBe('arch/be')
    expect(nav.trip).toHaveLength(1)
  })
  it('geht rückwärts durch den Ausflug und zurück an die Abzweigung', () => {
    const nav = new Navigator(tree())
    nav.down({ id: 'arch/be', slide: 0 })
    expect(nav.backward({ id: 'arch/be/api', slide: 0 })?.pos.id).toBe('arch/be/db')
    expect(nav.backward({ id: 'arch/be/db', slide: 0 })).toEqual({ pos: { id: 'arch/be', slide: 0 }, dir: 'up' })
    expect(nav.trip).toHaveLength(0)
  })
  it('geht rückwärts nur über Pfad-Knoten', () => {
    const nav = new Navigator(tree())
    expect(nav.backward({ id: 'arch/dep', slide: 0 })?.pos.id).toBe('arch/be')
    expect(nav.backward({ id: 'fazit', slide: 0 })?.pos.id).toBe('res')
  })
  it('geht vom Anhang oder Optionalen ohne Ausflug zum nächsten Pfad-Knoten', () => {
    const nav = new Navigator(tree())
    expect(nav.forward({ id: 'arch/be/db', slide: 0 })?.pos.id).toBe('arch/dep')
    expect(nav.forward({ id: 'res/c1', slide: 0 })?.pos.id).toBe('fazit')
  })
  it('macht aus einem Sprung abseits des Pfads einen Ausflug mit Rückkehr', () => {
    const nav = new Navigator(tree())
    const from = { id: 'arch/fe', slide: 0 }
    expect(nav.jumpTo({ id: 'arch/dep', slide: 0 }, from).pos.id).toBe('arch/dep')
    expect(nav.trip).toHaveLength(0)
    const m = nav.jumpTo({ id: 'res/c1', slide: 0 }, from)
    expect(nav.trip).toEqual([{ root: 'res/c1', kind: 'jump', back: from }])
    expect(nav.forward(m.pos)).toEqual({ pos: from, dir: 'up' })
    expect(nav.trip).toHaveLength(0)
  })
  it('behält Ausflüge beim Wechsel des Plans und überträgt sie als Stapel', () => {
    const nav = new Navigator(tree())
    nav.down({ id: 'arch/be', slide: 0 })
    const copy = nav.with({ states: { 'arch/fe': 'optional' } })
    expect(copy.trip).toEqual(nav.trip)
    expect(copy.state('arch/fe')).toBe('optional')
    const remote = new Navigator(tree()).with({ trip: nav.trip })
    expect(remote.forward({ id: 'arch/be/api', slide: 0 }, true)?.pos.id).toBe('arch/be')
  })
  it('bleibt auf der Folie stehen, wenn der Vortragende den aktuellen Knoten aus dem Pfad wirft', () => {
    const nav = new Navigator(tree(), { states: { 'arch/fe': 'optional' } })
    expect(nav.forward({ id: 'arch/fe', slide: 0 })?.pos.id).toBe('arch/be')
    expect(nav.backward({ id: 'arch/be', slide: 0 })?.pos.id).toBe('arch')
  })
  it('kann Optionales mit Pfad überstimmen', () => {
    const nav = new Navigator(tree(), { states: { 'arch/be/db': 'path' } })
    expect(walk(nav)).toContain('arch/be/db:0:0')
  })
})

describe('Plan: Vorlagen und Datei', () => {
  const nav = () => new Navigator(tree())
  it('setzt Unterbäume um und nimmt sie zurück', () => {
    const base = nav()
    const a = setSubtree(base, { 'arch/be/db': 'path' }, 'arch/be', 'appendix')
    expect(a).toEqual({ 'arch/be': 'appendix' })
    expect(resetSubtree(base, a, 'arch')).toEqual({})
    expect(setSubtree(base, {}, 'gibt-es-nicht', 'path')).toEqual({})
  })
  it('„Alles“ macht alle zu Pfad, „Bis Ebene n“ den Rest optional', () => {
    const all = new Navigator(tree(), { states: presetAll(nav()) })
    expect(planGroups(all).path).toHaveLength(11)
    const two = new Navigator(tree(), { states: presetDepth(nav(), 2) })
    expect(two.state('arch/fe')).toBe('path')
    expect(two.state('arch/be/db')).toBe('optional')
    expect(two.state('res/c1')).toBe('path') // Ebene 2: „Bis Ebene 2“ überstimmt auch den Anhang des Autors
  })
  it('„Zeitbudget“ wirft das Tiefste und Letzte zuerst raus und lässt den Anhang des Autors in Ruhe', () => {
    const base = nav()
    // Pfad: intro, arch, fe, be, dep, res, fazit = 7 Minuten
    expect(summarize(base)).toMatchObject({ path: 7 * 60, optional: 3 * 60, appendix: 60 })
    const states = presetBudget(base, 5 * 60)
    const short = new Navigator(tree(), { states })
    expect(summarize(short).path).toBe(5 * 60)
    expect(short.state('arch/dep')).toBe('optional') // Ebene 2, letzter Knoten
    expect(short.state('arch/be')).toBe('optional')
    expect(short.state('arch')).toBe('path')
    expect(short.state('res/c1')).toBe('appendix')
    expect(presetBudget(base, 100 * 60)).toEqual({})
  })
  it('liest Plan-Dateien tolerant', () => {
    expect(parsePlanFile(null)).toEqual(emptyPlanFile())
    expect(parsePlanFile('quatsch')).toEqual(emptyPlanFile())
    const file = parsePlanFile({
      active: 'Kurz',
      plans: { Kurz: { states: { a: 'optional', b: 'kaputt' }, budget: 900 }, Kaputt: { states: 3 } },
    })
    expect(file.active).toBe('Kurz')
    expect(file.plans.Kurz).toEqual({ states: { a: 'optional' }, budget: 900 })
    expect(file.plans.Kaputt).toBeUndefined()
    expect(file.plans.Standard).toEqual({ states: {} })
    expect(parsePlanFile({ active: 'weg', plans: {} }).active).toBe('Standard')
  })
  it('ordnet Handout und PDF: Pfad, Optionales, Anhang', () => {
    const g = planGroups(nav())
    expect(g.path.map((x) => x.id)).toEqual(['intro', 'arch', 'arch/fe', 'arch/be', 'arch/dep', 'res', 'fazit'])
    expect(g.optional.map((x) => x.id)).toEqual(['arch/be/db', 'arch/be/api', 'arch/be/api/ep'])
    expect(g.appendix.map((x) => x.id)).toEqual(['res/c1'])
  })
})

describe('Plan: Druck und PDF', () => {
  const ids = (plan: 'tree' | 'path' | 'grouped', depth = Infinity) => {
    const nav = new Navigator(tree())
    return printPages(nav.nodes, { ...DEFAULT_PRINT, plan, depth }, nav).map((pg) => pg.node.id)
  }
  it('lässt den Baum als Standard unverändert', () => {
    expect(ids('tree')).toEqual(['intro', 'arch', 'arch/fe', 'arch/be', 'arch/be/db', 'arch/be/api', 'arch/be/api/ep', 'arch/dep', 'res', 'res/c1', 'fazit'])
  })
  it('druckt nur den Pfad', () => {
    expect(ids('path')).toEqual(['intro', 'arch', 'arch/fe', 'arch/be', 'arch/dep', 'res', 'fazit'])
  })
  it('gruppiert: Pfad, Optionales, Anhang – mit Rolle je Seite', () => {
    const nav = new Navigator(tree())
    const pages = printPages(nav.nodes, { ...DEFAULT_PRINT, plan: 'grouped' }, nav)
    expect(pages.map((pg) => pg.node.id).slice(-4)).toEqual(['arch/be/db', 'arch/be/api', 'arch/be/api/ep', 'res/c1'])
    expect(pages.at(-1)?.role).toBe('appendix')
    expect(pages.find((pg) => pg.node.id === 'arch/be/db')?.role).toBe('optional')
    expect(pages[0].role).toBe('path')
    expect(pages.find((pg) => pg.node.id === 'arch/be/db')?.trail.map((t) => t.id)).toEqual(['arch', 'arch/be', 'arch/be/db'])
  })
  it('beachtet die Tiefe auch im Plan', () => {
    expect(ids('grouped', 2)).toEqual(['intro', 'arch', 'arch/fe', 'arch/be', 'arch/dep', 'res', 'fazit', 'res/c1'])
  })
})

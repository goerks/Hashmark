import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadDeck } from '../src/core/deck.ts'
import { findCodeBlockPlugin, listPlugins, pluginProblems, PLUGIN_API, registerPlugin, unregisterPlugin, type HashmarkPlugin } from '../src/core/plugins.ts'

async function tempDeck(files: Record<string, string>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashmark-plugin-'))
  for (const [name, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(dir, name)), { recursive: true })
    await fs.writeFile(path.join(dir, name), content)
  }
  return dir
}

const demo = (over: Partial<HashmarkPlugin> = {}): HashmarkPlugin => ({
  name: 'demo',
  api: PLUGIN_API,
  codeBlocks: [{ langs: ['demo'], render: (node) => ({ html: `<div class="demo-block">${node.value.trim()}</div>`, steps: [] }) }],
  ...over,
})

afterEach(() => { unregisterPlugin('demo'); unregisterPlugin('zwei') })

describe('Plugin-Schnittstelle', () => {
  it('meldet die mitgelieferten Codeblöcke als Plugins an', () => {
    const names = listPlugins().filter((p) => p.builtin).map((p) => p.name)
    expect(names).toEqual(expect.arrayContaining(['mermaid', 'qr', 'math', 'code']))
    expect(findCodeBlockPlugin('mermaid')).toBeDefined()
    // unbekannte Sprachen fallen auf den Code-Block (`*`)
    expect(findCodeBlockPlugin('typescript')?.langs).toContain('*')
  })

  it('prüft Name, Version und Aufbau, ohne etwas auszuführen', () => {
    expect(pluginProblems(demo())).toEqual([])
    expect(pluginProblems(demo({ name: 'Falsch Name' }))[0]).toMatch(/Name/)
    expect(pluginProblems(demo({ api: 99 }))[0]).toMatch(/Version 99/)
    expect(pluginProblems(demo({ codeBlocks: [{ langs: [], render: () => ({ html: '', steps: [] }) }] }))[0]).toMatch(/langs/)
    expect(pluginProblems(null)).toHaveLength(1)
  })

  it('wirft verständliche Fehler bei ungültigen, doppelten und belegten Plugins', () => {
    expect(() => registerPlugin(demo({ api: 2 }))).toThrow(/Version 2/)
    registerPlugin(demo())
    expect(() => registerPlugin(demo())).toThrow(/schon angemeldet/)
    expect(() => registerPlugin(demo({ name: 'zwei' }))).toThrow(/gehört schon dem Plugin „demo“/)
    // eingebaute Sprachen gewinnen immer
    expect(() => registerPlugin(demo({ name: 'zwei', codeBlocks: [{ langs: ['mermaid'], render: () => ({ html: '', steps: [] }) }] }))).toThrow(/„mermaid“ gehört schon dem Plugin „mermaid“/)
    // der Platzhalter `*` ist den mitgelieferten Plugins vorbehalten
    expect(() => registerPlugin(demo({ name: 'zwei', codeBlocks: [{ langs: ['*'], render: () => ({ html: '', steps: [] }) }] }))).toThrow(/„\*“/)
  })

  it('meldet ab, außer mitgelieferte', () => {
    registerPlugin(demo())
    expect(unregisterPlugin('demo')).toBe(true)
    expect(findCodeBlockPlugin('demo')?.langs).toContain('*')
    expect(unregisterPlugin('mermaid')).toBe(false)
    expect(findCodeBlockPlugin('mermaid')).toBeDefined()
  })

  it('rendert einen Codeblock des Plugins in der Folie', async () => {
    registerPlugin(demo())
    const dir = await tempDeck({ 'deck.yaml': '', 'a.md': '# Titel\n\n```demo\nHallo\n```\n' })
    const { deck } = await loadDeck(dir)
    expect(deck.nodes[0].slides[0].html).toContain('<div class="demo-block">Hallo</div>')
  })
})

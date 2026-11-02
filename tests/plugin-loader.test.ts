import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadDeck } from '../src/core/deck.ts'
import { findCodeBlockPlugin } from '../src/core/plugins.ts'
import { hashPlugin, loadDeckPlugins, readTrusted, revokeTrust, trustPlugin } from '../src/core/plugin-loader.ts'
import { runTrust } from '../src/cli/trust.ts'

async function tempDeck(files: Record<string, string>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashmark-loader-'))
  for (const [name, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(dir, name)), { recursive: true })
    await fs.writeFile(path.join(dir, name), content)
  }
  return dir
}

const PLUGIN = (name: string, text = 'Gruß') => `export default { name: '${name}', api: 1, codeBlocks: [{ langs: ['${name}'], render: (n) => ({ html: '<p class="${name}">${text}: ' + n.value.trim() + '</p>', steps: [] }) }] }\n`
const deck = (plugins: string[]) => ({ 'deck.yaml': `plugins: [${plugins.join(', ')}]\n`, 'a.md': '# Titel\n\n```demoplug\nWelt\n```\n' })

let trustFile = ''
beforeEach(async () => {
  trustFile = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'hashmark-trust-')), 'trusted.json')
  process.env.HASHMARK_TRUST_FILE = trustFile
  delete process.env.HASHMARK_PLUGINS
})
afterEach(async () => {
  delete process.env.HASHMARK_TRUST_FILE
  delete process.env.HASHMARK_PLUGINS
  await loadDeckPlugins(os.tmpdir(), undefined, []) // meldet die Plugins des letzten Decks ab
})

describe('Plugins aus dem Deck', () => {
  it('lädt ein nicht freigegebenes Plugin nicht und meldet es', async () => {
    const dir = await tempDeck({ ...deck(['plug.mjs']), 'plug.mjs': PLUGIN('demoplug') })
    const { warnings, deck: d } = await loadDeck(dir)
    expect(warnings.join('\n')).toMatch(/nicht freigegeben/)
    expect(findCodeBlockPlugin('demoplug')?.langs).toContain('*')
    expect(d.nodes[0].slides[0].html).not.toContain('class="demoplug"')
  })

  it('lädt es nach der Freigabe und rendert den Block', async () => {
    const dir = await tempDeck({ ...deck(['plug.mjs']), 'plug.mjs': PLUGIN('demoplug') })
    trustPlugin(hashPlugin(path.join(dir, 'plug.mjs')).hash, 'test')
    const { warnings, deck: d } = await loadDeck(dir)
    expect(warnings).toEqual([])
    expect(d.nodes[0].slides[0].html).toContain('<p class="demoplug">Gruß: Welt</p>')
  })

  it('verliert die Freigabe, sobald sich die Datei ändert', async () => {
    const dir = await tempDeck({ ...deck(['plug.mjs']), 'plug.mjs': PLUGIN('demoplug') })
    trustPlugin(hashPlugin(path.join(dir, 'plug.mjs')).hash, 'test')
    await fs.writeFile(path.join(dir, 'plug.mjs'), PLUGIN('demoplug', 'Hallo'))
    const { warnings, deck: d } = await loadDeck(dir)
    expect(warnings.join('\n')).toMatch(/nicht freigegeben/)
    expect(d.nodes[0].slides[0].html).not.toContain('class="demoplug"')
  })

  it('lädt im Webdienst (HASHMARK_PLUGINS=off) nichts, auch nicht Freigegebenes', async () => {
    const dir = await tempDeck({ ...deck(['plug.mjs']), 'plug.mjs': PLUGIN('demoplug') })
    trustPlugin(hashPlugin(path.join(dir, 'plug.mjs')).hash, 'test')
    process.env.HASHMARK_PLUGINS = 'off'
    const { warnings } = await loadDeck(dir)
    expect(warnings.join('\n')).toMatch(/Webdienst führt keine Plugins/)
    expect(findCodeBlockPlugin('demoplug')?.langs).toContain('*')
  })

  it('meldet das Plugin beim nächsten Laden ab, wenn es nicht mehr im Deck steht', async () => {
    const dir = await tempDeck({ ...deck(['plug.mjs']), 'plug.mjs': PLUGIN('demoplug') })
    trustPlugin(hashPlugin(path.join(dir, 'plug.mjs')).hash, 'test')
    await loadDeck(dir)
    expect(findCodeBlockPlugin('demoplug')?.langs).toEqual(['demoplug'])
    await fs.writeFile(path.join(dir, 'deck.yaml'), 'title: ohne\n')
    await loadDeck(dir)
    expect(findCodeBlockPlugin('demoplug')?.langs).toContain('*')
  })

  it('meldet fehlende, ungültige und fremde Plugins verständlich', async () => {
    const dir = await tempDeck({
      ...deck(['fehlt.mjs', 'alt.mjs', 'kaputt.mjs']),
      'alt.mjs': "export default { name: 'alt', api: 99 }\n",
      'kaputt.mjs': 'export default 42\n',
    })
    trustPlugin(hashPlugin(path.join(dir, 'alt.mjs')).hash, 'test')
    trustPlugin(hashPlugin(path.join(dir, 'kaputt.mjs')).hash, 'test')
    const { warnings } = await loadDeck(dir)
    const text = warnings.join('\n')
    expect(text).toMatch(/„fehlt.mjs“ nicht gefunden/)
    expect(text).toMatch(/„alt.mjs“ ungültig: .*Version 99/)
    expect(text).toMatch(/„kaputt.mjs“ ungültig/)
  })

  it('lehnt Pfade außerhalb des Deck-Ordners ab', async () => {
    const outside = path.join(os.tmpdir(), `hashmark-outside-${Date.now()}.mjs`)
    await fs.writeFile(outside, PLUGIN('demoplug'))
    const dir = await tempDeck(deck([`../${path.basename(outside)}`]))
    const { warnings } = await loadDeck(dir)
    expect(warnings.join('\n')).toMatch(/außerhalb des Deck-Ordners/)
    expect(findCodeBlockPlugin('demoplug')?.langs).toContain('*')
    await fs.rm(outside)
  })

  it('bildet die Prüfsumme über alle Dateien eines Plugin-Ordners', async () => {
    const dir = await tempDeck({ 'p/index.mjs': PLUGIN('demoplug'), 'p/hilfe.mjs': 'export const x = 1\n' })
    const first = hashPlugin(path.join(dir, 'p')).hash
    await fs.writeFile(path.join(dir, 'p/hilfe.mjs'), 'export const x = 2\n')
    expect(hashPlugin(path.join(dir, 'p')).hash).not.toBe(first)
    await fs.rm(path.join(dir, 'p/index.mjs'))
    expect(() => hashPlugin(path.join(dir, 'p'))).toThrow(/Einstiegsdatei/)
  })
})

describe('hashmark trust', () => {
  it('gibt mit --yes frei, listet auf und entzieht die Freigabe', async () => {
    const dir = await tempDeck({ ...deck(['plug.mjs']), 'plug.mjs': PLUGIN('demoplug') })
    const lines: string[] = []
    expect(await runTrust(dir, {}, (l) => lines.push(l))).toBe(1) // ohne Terminal und ohne --yes: nicht freigegeben
    expect(Object.keys(readTrusted())).toHaveLength(0)

    expect(await runTrust(dir, { yes: true }, (l) => lines.push(l))).toBe(0)
    const [hash] = Object.keys(readTrusted())
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(lines.join('\n')).toMatch(/freigegeben/)

    lines.length = 0
    await runTrust(dir, { list: true }, (l) => lines.push(l))
    expect(lines.join('\n')).toContain(hash.slice(0, 12))

    expect(await runTrust(dir, { revoke: 'abc' }, () => {})).toBe(1) // zu kurz
    expect(await runTrust(dir, { revoke: hash.slice(0, 10) }, () => {})).toBe(0)
    expect(readTrusted()).toEqual({})
    expect(revokeTrust(hash)).toEqual([])
  })

  it('sagt, wenn das Deck keine Plugins nutzt', async () => {
    const dir = await tempDeck({ 'deck.yaml': 'title: x\n', 'a.md': '# A\n' })
    const lines: string[] = []
    expect(await runTrust(dir, {}, (l) => lines.push(l))).toBe(0)
    expect(lines[0]).toMatch(/keine Plugins/)
  })
})

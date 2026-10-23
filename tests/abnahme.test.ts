// Abnahme-Präsentation (abnahme/): läuft in der Vorschau eines Pull Requests, muss immer ladbar sein.

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadDeck } from '../src/core/deck.ts'
import { seedDeck } from '../src/cli/serve.ts'

describe('Abnahme-Präsentation', () => {
  it('lädt ohne Hinweise und hat Folien', async () => {
    const { deck, warnings } = await loadDeck(path.resolve('abnahme'))
    expect(warnings).toEqual([])
    expect(deck.nodes.length).toBeGreaterThan(0)
  })
})

describe('Beispiel in den Deck-Ordner kopieren', () => {
  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hashmark-seed-'))
  const seedDir = () => {
    const dir = tmp()
    fs.writeFileSync(path.join(dir, 'a.md'), '# A')
    return dir
  }

  it('kopiert nur in einen leeren Ordner, außer mit reseed', () => {
    const seed = seedDir()
    const empty = path.join(tmp(), 'deck')
    expect(seedDeck(empty, seed)).toBe(true)
    expect(fs.existsSync(path.join(empty, 'a.md'))).toBe(true)

    const filled = tmp()
    fs.writeFileSync(path.join(filled, 'eigen.md'), '# Eigen')
    expect(seedDeck(filled, seed)).toBe(false)
    expect(fs.existsSync(path.join(filled, 'a.md'))).toBe(false)
    expect(seedDeck(filled, undefined, true)).toBe(false)

    expect(seedDeck(filled, seed, true)).toBe(true)
    expect(fs.readdirSync(filled).sort()).toEqual(['a.md'])
  })
})

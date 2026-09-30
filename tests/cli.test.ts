// CLI-Hilfen: Deck-Gerüst (make new).

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ScaffoldError, scaffoldDeck } from '../src/cli/scaffold.ts'
import { loadDeck } from '../src/core/deck.ts'

describe('Neues Deck', () => {
  it('legt ein ladbares Gerüst an und verweigert nicht leere Ordner', async () => {
    const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'strata-cli-')), 'Mein Vortrag')
    expect(scaffoldDeck(dir)).toEqual(['deck.yaml', '01-start.md', '02-hauptteil.md'])
    const { deck } = await loadDeck(dir)
    expect(deck.title).toBe('Mein Vortrag')
    expect(deck.nodes.map((n) => n.title)).toEqual(['Mein Vortrag', 'Hauptteil'])
    expect(deck.nodes[0].slides[0].notes).toContain('Presenter-View')
    expect(() => scaffoldDeck(dir)).toThrow(ScaffoldError)
  })
})

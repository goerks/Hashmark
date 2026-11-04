import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadDeck } from '../src/core/deck.ts'
import { countNotes, pageNeedsNotes, stripNotes } from '../src/core/notes.ts'
import { notesHint } from '../src/cli/notes.ts'

async function tempDeck(files: Record<string, string>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashmark-notes-'))
  for (const [name, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(dir, name)), { recursive: true })
    await fs.writeFile(path.join(dir, name), content)
  }
  return dir
}

const MD = '# Eins\nText\n\n::: notes\nGeheim eins\n:::\n\n## Unterfolie\nText\n\n<!-- notes -->\nGeheim zwei\n\n# Ohne\nKeine Notiz hier\n'

describe('Notizen zählen und entfernen', () => {
  it('zählt Folien mit Notizen, auch in Unterknoten', async () => {
    const { deck } = await loadDeck(await tempDeck({ 'deck.yaml': '', 'a.md': MD }))
    expect(countNotes(deck)).toBe(2)
  })

  it('entfernt alle Notizen aus einer Kopie und lässt das Original unberührt', async () => {
    const { deck } = await loadDeck(await tempDeck({ 'deck.yaml': '', 'a.md': MD }))
    const clean = stripNotes(deck)
    expect(countNotes(clean)).toBe(0)
    expect(JSON.stringify(clean)).not.toContain('Geheim')
    expect(clean.nodes[0].slides[0].html).toContain('Text')
    expect(countNotes(deck)).toBe(2)
    expect(JSON.stringify(deck)).toContain('Geheim eins')
  })

  it('erkennt die Seiten, die Notizen brauchen', () => {
    expect(pageNeedsNotes('', '/')).toBe(false)
    expect(pageNeedsNotes('?dual', '/')).toBe(false)
    expect(pageNeedsNotes('?presenter', '/')).toBe(true)
    expect(pageNeedsNotes('?reader', '/')).toBe(true)
    expect(pageNeedsNotes('?print&notes=1', '/')).toBe(true)
    expect(pageNeedsNotes('', '/editor.html')).toBe(true)
  })

  it('formuliert den Hinweis nur, wenn es Notizen gibt', () => {
    expect(notesHint(0, 'export')).toBe('')
    expect(notesHint(1, 'export')).toMatch(/^Achtung: 1 Folie hat Notizen.*hashmark export --no-notes$/)
    expect(notesHint(14, 'build')).toMatch(/14 Folien haben Notizen.*hashmark build --no-notes$/)
  })
})

describe('Webdienst: Notizen nur für Seiten, die sie brauchen', () => {
  async function start(web: boolean) {
    const { startLiveServer } = await import('../src/desktop/live-server.ts')
    const deckDir = await tempDeck({ 'deck.yaml': '', 'a.md': MD })
    const runtimeDir = await tempDeck({ 'index.html': '<title>x</title>', 'editor.html': '<title>editor</title>' })
    return { deckDir, server: await startLiveServer({ deckDir, runtimeDir, onAppAction: () => {}, log: () => {}, ...(web ? { web: { host: '127.0.0.1', port: 0 } } : {}) }) }
  }
  const get = async (base: string, p: string) => JSON.stringify(await (await fetch(base + p)).json())

  it('lässt sie in der einfachen Ansicht weg und liefert sie mit ?notes=1', async () => {
    const { server } = await start(true)
    try {
      expect(await get(server.url, '__hashmark/deck.json')).not.toContain('Geheim')
      expect(await get(server.url, '__hashmark/deck.json?notes=1')).toContain('Geheim eins')
    } finally { await server.close() }
  })

  it('lässt sie in der Desktop-App (ohne Webdienst) immer drin', async () => {
    const { server } = await start(false)
    try {
      expect(await get(server.url, '__hashmark/deck.json')).toContain('Geheim eins')
    } finally { await server.close() }
  })

  it('schickt Änderungen je Verbindung mit oder ohne Notizen', async () => {
    const { server, deckDir } = await start(true)
    const firstDeckEvent = async (query: string) => {
      const ctl = new AbortController()
      const res = await fetch(`${server.url}__hashmark/events${query}`, { signal: ctl.signal })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let text = ''
      // erst nach dem Verbinden ändern, sonst gibt es nichts zu senden
      await reader.read()
      await fs.writeFile(path.join(deckDir, 'a.md'), MD + '\nNeu\n')
      await server.reload()
      const deadline = Date.now() + 5000
      while (!text.includes('event: deck') && Date.now() < deadline) {
        const { value, done } = await reader.read()
        if (done) break
        text += decoder.decode(value)
      }
      ctl.abort()
      return text
    }
    try {
      expect(await firstDeckEvent('')).not.toContain('Geheim')
      expect(await firstDeckEvent('?notes=1')).toContain('Geheim eins')
    } finally { await server.close() }
  })
})

import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { versionOf } from '../src/vite/editor-api.ts'
import { diffCounts, diffLines } from '../src/core/diff.ts'

async function tempDir(files: Record<string, string>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashmark-konflikt-'))
  for (const [name, content] of Object.entries(files)) await fs.writeFile(path.join(dir, name), content)
  return dir
}

describe('Editor: Speichern mit Konflikterkennung (Ticket #52)', () => {
  async function start() {
    const { startLiveServer } = await import('../src/desktop/live-server.ts')
    const deckDir = await tempDir({ 'a.md': '# A\n\nEins\n' })
    const runtimeDir = await tempDir({ 'index.html': '<title>x</title>' })
    const server = await startLiveServer({ deckDir, runtimeDir, onAppAction: () => {}, log: () => {}, web: { host: '127.0.0.1', port: 0 } })
    const call = (method: string, p: string, body?: string, base?: string) =>
      fetch(`${server.url}__hashmark/file?path=${p}`, { method, body, headers: { 'X-Hashmark-Editor': '1', ...(base ? { 'X-Hashmark-Base': base } : {}) } })
    return { deckDir, server, call }
  }

  it('nennt beim Lesen die Version der Datei', async () => {
    const { server, call, deckDir } = await start()
    try {
      const res = await call('GET', 'a.md')
      expect(await res.text()).toBe('# A\n\nEins\n')
      expect(res.headers.get('X-Hashmark-Version')).toBe(versionOf(await fs.readFile(path.join(deckDir, 'a.md'), 'utf8')))
    } finally { await server.close() }
  })

  it('speichert mit der richtigen Version und liefert die neue', async () => {
    const { server, call, deckDir } = await start()
    try {
      const base = (await call('GET', 'a.md')).headers.get('X-Hashmark-Version')!
      const res = await call('PUT', 'a.md', '# A\n\nZwei\n', base)
      expect(res.status).toBe(200)
      expect((await res.json()).version).toBe(versionOf('# A\n\nZwei\n'))
      expect(await fs.readFile(path.join(deckDir, 'a.md'), 'utf8')).toBe('# A\n\nZwei\n')
    } finally { await server.close() }
  })

  it('überschreibt nichts, wenn die Datei inzwischen anders ist, und meldet den Stand auf dem Server', async () => {
    const { server, call, deckDir } = await start()
    try {
      const base = (await call('GET', 'a.md')).headers.get('X-Hashmark-Version')!
      await fs.writeFile(path.join(deckDir, 'a.md'), '# A\n\nFremd\n')
      const res = await call('PUT', 'a.md', '# A\n\nMein Stand\n', base)
      expect(res.status).toBe(409)
      const data = await res.json()
      expect(data).toMatchObject({ conflict: true, text: '# A\n\nFremd\n', version: versionOf('# A\n\nFremd\n') })
      expect(await fs.readFile(path.join(deckDir, 'a.md'), 'utf8')).toBe('# A\n\nFremd\n')
      // „Meine Fassung behalten“: mit der gemeldeten Version geht das Speichern durch
      expect((await call('PUT', 'a.md', '# A\n\nMein Stand\n', data.version)).status).toBe(200)
      expect(await fs.readFile(path.join(deckDir, 'a.md'), 'utf8')).toBe('# A\n\nMein Stand\n')
    } finally { await server.close() }
  })

  it('macht keinen Konflikt, wenn die Datei schon den neuen Inhalt hat oder keine Version mitkommt', async () => {
    const { server, call, deckDir } = await start()
    try {
      const base = (await call('GET', 'a.md')).headers.get('X-Hashmark-Version')!
      await fs.writeFile(path.join(deckDir, 'a.md'), '# A\n\nGleich\n')
      expect((await call('PUT', 'a.md', '# A\n\nGleich\n', base)).status).toBe(200)
      // ältere Clients schicken keine Version
      expect((await call('PUT', 'a.md', '# A\n\nOhne Version\n')).status).toBe(200)
      expect(await fs.readFile(path.join(deckDir, 'a.md'), 'utf8')).toBe('# A\n\nOhne Version\n')
    } finally { await server.close() }
  })
})

describe('Zeilenvergleich', () => {
  it('findet geänderte, neue und fehlende Zeilen', () => {
    const diff = diffLines('a\nb\nc\nd', 'a\nB\nc\nd\ne')
    expect(diff.filter((l) => l.type !== 'same')).toEqual([
      { type: 'del', text: 'b' }, { type: 'add', text: 'B' }, { type: 'add', text: 'e' },
    ])
    expect(diffCounts(diff)).toEqual({ del: 1, add: 2 })
  })

  it('kennt gleiche Texte und leere Seiten', () => {
    expect(diffLines('x\ny', 'x\ny').every((l) => l.type === 'same')).toBe(true)
    expect(diffCounts(diffLines('', 'neu'))).toEqual({ del: 1, add: 1 }) // leere Zeile wird durch „neu“ ersetzt
    expect(diffCounts(diffLines('a\nb', 'a'))).toEqual({ del: 1, add: 0 })
  })

  it('bleibt bei sehr großen Unterschieden schnell (grober Vergleich)', () => {
    const a = Array.from({ length: 3000 }, (_, i) => `a${i}`).join('\n')
    const b = Array.from({ length: 3000 }, (_, i) => `b${i}`).join('\n')
    const t = Date.now()
    const counts = diffCounts(diffLines(a, b))
    expect(counts).toEqual({ del: 3000, add: 3000 })
    expect(Date.now() - t).toBeLessThan(2000)
  })
})

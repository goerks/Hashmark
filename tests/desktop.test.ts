// Desktop-App: Logik des Sidecars ohne Tauri (Einstellungen, Deck-Erkennung, Protokoll).

import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { addRecent, existingRecent, isDeckDir, MAX_RECENT, readSettings, removeRecent, writeSettings } from '../src/desktop/settings.ts'
import { createSidecar } from '../src/desktop/sidecar.ts'

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'hashmark-desktop-'))

describe('Einstellungen', () => {
  it('liest fehlende oder kaputte Dateien als leer und schreibt/liest zurück', () => {
    const file = path.join(tmp(), 'sub', 'settings.json')
    expect(readSettings(file)).toEqual({ recent: [] })
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, '{kaputt')
    expect(readSettings(file)).toEqual({ recent: [] })
    writeSettings(file, { recent: ['C:\\a'] })
    expect(readSettings(file)).toEqual({ recent: ['C:\\a'] })
    fs.writeFileSync(file, JSON.stringify({ recent: ['x', 3, null] }))
    expect(readSettings(file).recent).toEqual(['x'])
  })
  it('führt die Liste der zuletzt geöffneten Decks', () => {
    const a = path.resolve('/decks/a')
    const b = path.resolve('/decks/b')
    const recent = addRecent(addRecent([], a), b)
    expect(recent).toEqual([b, a])
    // erneutes Öffnen holt nach vorne, Groß/Klein egal (Windows)
    expect(addRecent(recent, a.toUpperCase())).toHaveLength(2)
    expect(removeRecent(recent, a.toUpperCase())).toEqual([b])
    const many = Array.from({ length: 12 }, (_, i) => path.resolve(`/d/${i}`)).reduce(addRecent, [] as string[])
    expect(many).toHaveLength(MAX_RECENT)
    expect(many[0]).toBe(path.resolve('/d/11'))
    expect(existingRecent([a, b], (p) => p === b)).toEqual([b])
  })
  it('erkennt Deck-Ordner', () => {
    const dir = tmp()
    expect(isDeckDir(dir)).toBe(false)
    fs.writeFileSync(path.join(dir, 'a.md'), '# A')
    expect(isDeckDir(dir)).toBe(true)
    expect(isDeckDir(path.join(dir, 'a.md'))).toBe(false)
    expect(isDeckDir(path.join(dir, 'fehlt'))).toBe(false)
  })
})

describe('Vorgebaute Runtime', () => {
  it('Stempel hängt am Inhalt der Quellen, nicht am Ort', async () => {
    const { sourceHash } = await import('../src/desktop/runtime-build.ts')
    const make = () => {
      const root = tmp()
      fs.mkdirSync(path.join(root, 'src/runtime'), { recursive: true })
      fs.mkdirSync(path.join(root, 'src/core'), { recursive: true })
      fs.writeFileSync(path.join(root, 'src/runtime/a.ts'), 'export const a = 1')
      fs.writeFileSync(path.join(root, 'src/core/b.ts'), 'export const b = 2')
      fs.writeFileSync(path.join(root, 'package.json'), '{}')
      return root
    }
    const a = make()
    const b = make()
    expect(sourceHash(a)).toBe(sourceHash(b)) // anderer Ordner (z. B. gepackte App) → gleicher Stempel
    fs.writeFileSync(path.join(b, 'src/core/b.ts'), 'export const b = 3')
    expect(sourceHash(a)).not.toBe(sourceHash(b))
  })
})

describe('Deck vorab lesen', () => {
  it('erkennt Änderungen seit dem Vorab-Lesen', async () => {
    const { isStale } = await import('../src/desktop/sidecar.ts')
    const { loadDeck } = await import('../src/core/deck.ts')
    const dir = tmp()
    fs.writeFileSync(path.join(dir, 'a.md'), '# A')
    // Dateisystem-Zeitstempel können dem Zeitgeber leicht vorauseilen: erst warten, dann den Zeitpunkt nehmen
    await new Promise((r) => setTimeout(r, 150))
    const at = Date.now()
    await new Promise((r) => setTimeout(r, 150))
    const result = await loadDeck(dir)
    expect(isStale(dir, result, at)).toBe(false) // vor dem Zeitpunkt entstanden
    await new Promise((r) => setTimeout(r, 150))
    const later = Date.now()
    expect(isStale(dir, result, later)).toBe(false)
    await new Promise((r) => setTimeout(r, 150))
    fs.writeFileSync(path.join(dir, 'a.md'), '# A2')
    expect(isStale(dir, result, later)).toBe(true) // Datei geändert
    fs.writeFileSync(path.join(dir, 'b.md'), '# B')
    expect(isStale(dir, result, Date.now() + 1000)).toBe(false)
  }, 30_000)
})

describe('Beispiele', () => {
  it('listet die Beispiel-Decks mit Titel, auch das Theme-Beispiel', async () => {
    const { listExamples } = await import('../src/cli/examples.ts')
    const examples = listExamples()
    expect(examples.map((e) => e.name)).toEqual(expect.arrayContaining(['hashmark-demo', 'theme-demo']))
    expect(examples.find((e) => e.name === 'theme-demo')?.title).toContain('Eigenes Theme')
    expect(listExamples(path.join(tmp(), 'gibtsnicht'))).toEqual([])
  })

  it('Auswahlseite für den Webservice verlinkt jedes Deck und maskiert Titel', async () => {
    const { indexPage } = await import('../scripts/build-examples.ts')
    const html = indexPage([{ dir: '/x', name: 'a-b', title: 'Q&A <1>' }, { dir: '/y', name: 'theme-demo', title: 'T' }])
    expect(html).toContain('href="./a-b/"')
    expect(html).toContain('href="./theme-demo/"')
    expect(html).toContain('Q&amp;A &lt;1&gt;')
    expect(html).not.toMatch(/https?:\/\//)
  })
})

describe('Sidecar-Befehle', () => {
  it('antwortet mit id, meldet Fehler statt abzustürzen und legt Decks an', async () => {
    const out: Record<string, unknown>[] = []
    const sidecar = createSidecar({ dataDir: tmp(), emit: (m) => out.push(m) })
    await sidecar.handle({ id: 1, cmd: 'ping' })
    await sidecar.handle({ id: 2, cmd: 'gibtsnicht' })
    await sidecar.handle({ id: 3, cmd: 'open' })
    const dir = path.join(tmp(), 'neu')
    await sidecar.handle({ id: 4, cmd: 'scaffold', dir })
    await sidecar.handle({ id: 5, cmd: 'isDeck', dir })
    await sidecar.handle({ id: 6, cmd: 'pdf', out: 'x.pdf' })
    expect(out[0]).toMatchObject({ id: 1, ok: true })
    expect(out[1]).toMatchObject({ id: 2, ok: false, error: expect.stringContaining('Unbekannter Befehl') })
    expect(out[2]).toMatchObject({ id: 3, ok: false, error: 'dir fehlt' })
    expect(out[3]).toMatchObject({ id: 4, ok: true, result: ['deck.yaml', '01-start.md', '02-hauptteil.md'] })
    expect(out[4]).toMatchObject({ id: 5, ok: true, result: true })
    expect(out[5]).toMatchObject({ id: 6, ok: false, error: 'Kein Deck geöffnet' })
  })
})

describe('Webdienst (hashmark serve)', () => {
  const basic = (user: string, pw: string) => 'Basic ' + Buffer.from(`${user}:${pw}`).toString('base64')

  async function start(password?: string) {
    const { startLiveServer } = await import('../src/desktop/live-server.ts')
    const deckDir = tmp()
    fs.writeFileSync(path.join(deckDir, 'a.md'), '# A')
    const runtimeDir = tmp()
    fs.writeFileSync(path.join(runtimeDir, 'index.html'), '<title>x</title>')
    fs.writeFileSync(path.join(runtimeDir, 'editor.html'), '<title>editor</title>')
    return startLiveServer({
      deckDir, runtimeDir, onAppAction: () => {}, log: () => {},
      web: { host: '127.0.0.1', port: 0, editorPassword: password },
    })
  }

  it('Präsentation und Gesundheitsprüfung sind öffentlich, der Editor braucht das Passwort', async () => {
    const server = await start('geheim')
    try {
      const get = (p: string, headers: Record<string, string> = {}) => fetch(server.url + p.replace(/^\//, ''), { headers })
      expect((await get('/healthz')).status).toBe(200)
      expect((await get('/')).status).toBe(200)
      expect((await get('/__hashmark/deck.json')).status).toBe(200)
      expect((await get('/editor.html')).status).toBe(401)
      expect((await get('/__hashmark/files', { 'X-Hashmark-Editor': '1' })).status).toBe(401)
      expect((await get('/editor.html', { Authorization: basic('editor', 'falsch') })).status).toBe(401)
      expect((await get('/editor.html', { Authorization: basic('anderer', 'geheim') })).status).toBe(401)
      expect((await get('/editor.html', { Authorization: basic('editor', 'geheim') })).status).toBe(200)
      const files = await get('/__hashmark/files', { Authorization: basic('editor', 'geheim'), 'X-Hashmark-Editor': '1' })
      expect((await files.json()).files.map((f: { path: string }) => f.path)).toEqual(['a.md'])
    } finally {
      await server.close()
    }
  })

  it('verlangt auch mit Passwort den Editor-Header und einen passenden Ursprung', async () => {
    const server = await start('geheim')
    try {
      const auth = { Authorization: basic('editor', 'geheim') }
      const url = server.url + '__hashmark/files'
      expect((await fetch(url, { headers: auth })).status).toBe(403)
      expect((await fetch(url, { headers: { ...auth, 'X-Hashmark-Editor': '1', Origin: 'https://fremd.example' } })).status).toBe(403)
      expect((await fetch(url, { headers: { ...auth, 'X-Hashmark-Editor': '1', Origin: new URL(server.url).origin } })).status).toBe(200)
    } finally {
      await server.close()
    }
  })

  it('ohne EDITOR_PASSWORD gibt es keinen Editor', async () => {
    const server = await start(undefined)
    try {
      expect((await fetch(server.url)).status).toBe(200)
      expect((await fetch(server.url + 'editor.html')).status).toBe(404)
      expect((await fetch(server.url + '__hashmark/files', { headers: { 'X-Hashmark-Editor': '1' } })).status).toBe(404)
    } finally {
      await server.close()
    }
  })
})

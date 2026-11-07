// Webdienst mit Sessions: Adressen, Rollen, Seiten mit Skript-Freigabe, Neuladen (echter Live-Server, kleine Runtime-Attrappe)

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { startLiveServer, type LiveServer } from '../src/desktop/live-server.ts'

const tmp = (n: string) => fs.mkdtempSync(path.join(os.tmpdir(), `hashmark-${n}-`))
const ID = 'A'.repeat(22)
const ED = 'e'.repeat(24)
const OW = 'o'.repeat(24)

const PAGE = '<!doctype html><html><head><title>x</title><script type="module" crossorigin src="/assets/a.js"></script><script>window.__HASHMARK_LIVE__=true</script><link rel="stylesheet" href="/__hashmark/theme.css"></head><body></body></html>'

describe('Webdienst mit Sessions', () => {
  let srv: LiveServer
  let U: string
  const j = async (p: string, init: RequestInit = {}) => {
    const r = await fetch(U + p, { redirect: 'manual', ...init })
    return { r, t: await r.text() }
  }
  const title = (t: string) => JSON.parse(t).deck.nodes[0].title as string
  const put = (id: string, hdr: Record<string, string> = {}) => j(`/api/sessions/${id}`, { method: 'PUT', headers: hdr, body: JSON.stringify({ editToken: ED, ownerToken: OW }) })
  const upload = (p: string, body: string, ifMatch = 'none') => j(`/api/sessions/${ID}/file?path=${p}`, { method: 'PUT', headers: { 'X-Hashmark-Owner': OW, 'If-Match': ifMatch }, body })

  beforeAll(async () => {
    const root = tmp('root')
    fs.writeFileSync(path.join(root, 'a.md'), '# Einzel\n')
    const rt = tmp('rt')
    fs.mkdirSync(path.join(rt, 'assets'))
    fs.writeFileSync(path.join(rt, 'index.html'), PAGE)
    fs.writeFileSync(path.join(rt, 'editor.html'), PAGE)
    fs.writeFileSync(path.join(rt, 'assets/a.js'), 'console.log(1)')
    srv = await startLiveServer({ deckDir: root, runtimeDir: rt, onAppAction() {}, log() {}, web: { host: '127.0.0.1', port: 0, sessions: { dir: tmp('s'), key: 'k', maxSessions: 2 } } })
    U = srv.url.replace(/\/$/, '')
  })
  afterAll(() => srv.close())

  it('lässt das Einzel-Deck unter / unverändert', async () => {
    expect(title((await j('/__hashmark/deck.json')).t)).toBe('Einzel')
    expect((await j('/')).t).not.toContain('__HASHMARK_SESSION__')
  })
  it('antwortet auf unbekannte oder ungültige Adressen mit 404 und ergänzt den Schrägstrich', async () => {
    expect((await j(`/s/${ID}/`)).r.status).toBe(404)
    expect((await j('/s/kurz/')).r.status).toBe(404)
    const r = (await j(`/s/${ID}`)).r
    expect(r.status).toBe(301)
    expect(r.headers.get('location')).toBe(`/s/${ID}/`)
  })
  it('legt Sessions nur mit Dienst-Schlüssel an', async () => {
    expect((await put(ID)).r.status).toBe(401)
    expect((await put(ID, { Authorization: 'Bearer k' })).r.status).toBe(201)
    expect((await upload('01.md', '# Eins\n')).r.status).toBe(200)
  })
  it('liefert jeder Session ihr eigenes Deck, ohne Token zum Ansehen', async () => {
    expect(title((await j(`/s/${ID}/__hashmark/deck.json`)).t)).toBe('Eins')
    expect(title((await j('/__hashmark/deck.json')).t)).toBe('Einzel')
  })
  it('liefert Seiten mit Skript-Freigabe, Basisadresse und eigener Theme-Adresse', async () => {
    const { r, t } = await j(`/s/${ID}/?reader`)
    const csp = r.headers.get('content-security-policy') ?? ''
    const nonce = /nonce-([^']+)'/.exec(csp)?.[1]
    expect(nonce).toBeTruthy()
    expect(csp).toContain("script-src 'self'")
    expect(t).toContain(`<script nonce="${nonce}">window.__HASHMARK_SESSION__=`)
    expect(t).toContain(`href="/s/${ID}/__hashmark/theme.css"`)
    expect((t.match(/<script(?![^>]*nonce)/g) ?? []).length).toBe(0)
    expect(r.headers.get('referrer-policy')).toBe('no-referrer')
    expect((await j(`/s/${ID}/editor.html`)).r.status).toBe(200)
    expect((await j(`/s/${ID}/assets/a.js`)).r.status).toBe(200)
  })
  it('erlaubt Schreiben nur mit Bearbeiten- oder Besitzer-Token', async () => {
    const w = (hdr: Record<string, string> = {}) => j(`/s/${ID}/__hashmark/file?path=01.md`, { method: 'PUT', headers: { 'X-Hashmark-Editor': '1', ...hdr }, body: '# Eins, online\n' })
    expect((await w()).r.status).toBe(403)
    expect((await w({ 'X-Hashmark-Token': 'falsch' })).r.status).toBe(403)
    expect((await w({ 'X-Hashmark-Token': ED })).r.status).toBe(200)
    expect((await j(`/s/${ID}/__hashmark/files`, { headers: { 'X-Hashmark-Editor': '1' } })).r.status).toBe(403)
    expect((await j(`/s/${ID}/__hashmark/files`, { headers: { 'X-Hashmark-Editor': '1', 'X-Hashmark-Token': ED } })).r.status).toBe(200)
    expect((await j(`/s/${ID}/__hashmark/pptx`, { headers: { 'X-Hashmark-Token': ED } })).r.status).toBe(404)
  })
  it('lädt nach Änderungen über die Schnittstelle neu und meldet es per Ereignis', async () => {
    const ev = await fetch(`${U}/s/${ID}/__hashmark/events`)
    const reader = ev.body!.getReader()
    await reader.read()
    const cur = (await j(`/api/sessions/${ID}/manifest`, { headers: { 'X-Hashmark-Owner': OW } })).t
    expect(cur).toContain('01.md')
    await upload('02.md', '# Zwei\n')
    let got = ''
    const t0 = Date.now()
    while (!got.includes('Zwei') && Date.now() - t0 < 5000) got += new TextDecoder().decode((await reader.read()).value)
    expect(got).toContain('event: deck')
    await reader.cancel()
  })
  it('löscht Sessions und verdrängt die älteste bei Überschreiten der Höchstzahl', async () => {
    expect((await j(`/api/sessions/${ID}`, { method: 'DELETE', headers: { 'X-Hashmark-Owner': OW } })).r.status).toBe(200)
    expect((await j(`/s/${ID}/`)).r.status).toBe(404)
    const ids = ['B', 'C', 'D'].map((c) => c.repeat(22))
    for (const id of ids) expect((await put(id, { Authorization: 'Bearer k' })).r.status).toBe(201)
    expect((await j(`/s/${ids[0]}/`)).r.status).toBe(404)
    expect((await j(`/s/${ids[2]}/`)).r.status).toBe(200)
  })
})

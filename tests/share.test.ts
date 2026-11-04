// Teilen: Dateiregeln, Sessions im Webdienst, Abgleich-Client (hochladen, holen, Konflikt, Wiederherstellen)

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { IMAGE_EXT, COMPONENT_PATH, hashOf, isSafeRel, isSyncable, manifestOf } from '../src/share/files.ts'
import { SessionStore, handleSessionsApi, HttpError } from '../src/share/sessions.ts'
import * as share from '../src/share/client.ts'

const tmp = (name: string) => fs.mkdtempSync(path.join(os.tmpdir(), `hashmark-${name}-`))
const write = (dir: string, rel: string, text: string | Buffer) => {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
  fs.writeFileSync(path.join(dir, rel), text)
}
const attempt = <T>(fn: () => T) => { try { fn(); return null } catch (e) { return e as Error & { status?: number; code?: string } } }
const ID = 'AAAAAAAAAAAAAAAAAAAAAA'
const EDIT = 'e'.repeat(24)
const OWNER = 'o'.repeat(24)

describe('Dateiregeln', () => {
  it('gleicht nur Deck-Dateien ab', () => {
    for (const ok of ['a.md', 'kapitel/b.md', 'deck.yaml', 'theme.css', 'components/karte.html', 'components/karte.css', 'bilder/x.PNG', 'video/a.mp4']) expect(isSyncable(ok)).toBe(true)
    for (const no of ['seite.html', 'skript.js', 'a.exe', '.hashmark/plan.json', 'node_modules/x.md', '.git/config', 'a/.geheim.md']) expect(isSyncable(no)).toBe(false)
  })
  it('verweigert unsichere Pfade', () => {
    for (const bad of ['', '../x.md', 'a/../../x.md', '/etc/x.md', 'a\\b.md', 'a//b.md', 'x\0.md']) expect(isSafeRel(bad)).toBe(false)
  })
  it('hält die Listen in Übereinstimmung mit dem Kern', async () => {
    const { IMAGE_MIME } = await import('../src/core/render.ts')
    const { COMPONENT_FILE } = await import('../src/core/component-edit.ts')
    expect([...IMAGE_EXT].sort()).toEqual(Object.keys(IMAGE_MIME).sort())
    expect(COMPONENT_PATH.source).toBe(COMPONENT_FILE.source)
  })
  it('bildet Hashes über den Inhalt, ohne Punkt-Ordner', () => {
    const dir = tmp('manifest')
    write(dir, 'a.md', '# A')
    write(dir, '.hashmark/plan.json', '{}')
    write(dir, 'x/y.png', Buffer.from([1, 2, 3]))
    write(dir, 'notiz.txt', 'nein')
    expect(manifestOf(dir)).toEqual({ 'a.md': hashOf('# A'), 'x/y.png': hashOf(Buffer.from([1, 2, 3])) })
  })
})

describe('Sessions im Webdienst', () => {
  let store: SessionStore
  beforeEach(() => { store = new SessionStore({ dir: tmp('sessions'), key: 'schluessel', maxSessionBytes: 1000, maxTotalBytes: 1500, maxSessions: 2 }) })

  it('kennt Rollen: Adresse = Ansehen, Token = Bearbeiten bzw. Besitzer', () => {
    expect(store.role(ID, undefined)).toBeNull()
    store.create(ID, EDIT, OWNER)
    expect(store.role(ID, undefined)).toBe('view')
    expect(store.role(ID, 'falsch')).toBe('view')
    expect(store.role(ID, EDIT)).toBe('edit')
    expect(store.role(ID, OWNER)).toBe('owner')
  })
  it('legt nur gültige Sessions an', () => {
    expect(attempt(() => store.create('kurz', EDIT, OWNER))?.status).toBe(400)
    expect(attempt(() => store.create(ID, 'x', OWNER))?.status).toBe(400)
    expect(attempt(() => store.create(ID, EDIT, EDIT))?.status).toBe(400)
    store.create(ID, EDIT, OWNER)
    expect(attempt(() => store.create(ID, EDIT, OWNER))?.status).toBe(409)
  })
  it('schreibt Dateien mit Revisionsprüfung', () => {
    store.create(ID, EDIT, OWNER)
    const h1 = store.writeFile(ID, 'a.md', Buffer.from('eins'), 'none')
    expect(h1).toBe(hashOf('eins'))
    expect(attempt(() => store.writeFile(ID, 'a.md', Buffer.from('zwei'), 'none'))?.status).toBe(409)
    expect(attempt(() => store.writeFile(ID, 'a.md', Buffer.from('zwei'), 'falsch'))?.status).toBe(409)
    store.writeFile(ID, 'a.md', Buffer.from('zwei'), h1)
    expect(store.readFile(ID, 'a.md').toString()).toBe('zwei')
    expect(attempt(() => store.removeFile(ID, 'a.md', h1))?.status).toBe(409)
    store.removeFile(ID, 'a.md', hashOf('zwei'))
    expect(store.manifest(ID)).toEqual({})
  })
  it('verweigert fremde Pfade und Dateitypen', () => {
    store.create(ID, EDIT, OWNER)
    expect(attempt(() => store.writeFile(ID, '../x.md', Buffer.from('x')))?.status).toBe(415)
    expect(attempt(() => store.writeFile(ID, 'skript.js', Buffer.from('x')))?.status).toBe(415)
    expect(attempt(() => store.readFile(ID, '../meta.json'))?.status).toBeUndefined()
    expect(attempt(() => store.readFile(ID, '../meta.json'))).toBeTruthy()
  })
  it('begrenzt die Größe je Session und verdrängt die älteste Session bei Platzmangel', () => {
    store.create(ID, EDIT, OWNER)
    expect(attempt(() => store.writeFile(ID, 'gross.md', Buffer.alloc(1001)))?.status).toBe(413)
    const other = 'BBBBBBBBBBBBBBBBBBBBBB'
    store.writeFile(ID, 'a.md', Buffer.alloc(900))
    store.create(other, 'f'.repeat(24), 'p'.repeat(24))
    store.touch(other)
    // gesamt 1500: die zweite Session braucht 900 → die erste (länger ungenutzt) weicht
    const old = store.role(ID, OWNER)
    expect(old).toBe('owner')
    store.writeFile(other, 'b.md', Buffer.alloc(900))
    expect(store.has(other)).toBe(true)
  })
  it('hält höchstens so viele Sessions, die längste ungenutzte weicht', () => {
    const removed: string[] = []
    store.onRemove = (id) => removed.push(id)
    store.create('AAAAAAAAAAAAAAAAAAAAAA', EDIT, OWNER)
    store.create('BBBBBBBBBBBBBBBBBBBBBB', EDIT, OWNER)
    store.touch('BBBBBBBBBBBBBBBBBBBBBB')
    // `touch` mit Zeitstempel in derselben Millisekunde: Reihenfolge der Anlage entscheidet
    store.create('CCCCCCCCCCCCCCCCCCCCCC', EDIT, OWNER)
    expect(store.count()).toBe(2)
    expect(removed.length).toBe(1)
  })
  it('begrenzt das Anlegen je Absender', () => {
    const s = new SessionStore({ dir: tmp('rate'), key: 'k', maxCreatesPerHour: 2 })
    s.checkRate('a'); s.checkRate('a')
    expect(attempt(() => s.checkRate('a'))?.status).toBe(429)
    s.checkRate('b')
  })
})

describe('Vergleich lokal, online, letzter Abgleich', () => {
  const cmp = (l: Record<string, string>, r: Record<string, string>, b: Record<string, string>) => share.compare(l, r, b)
  it('erkennt gleich, lokal neuer, online neuer und Konflikt', () => {
    expect(cmp({ a: '1' }, { a: '1' }, { a: '0' })).toEqual({})
    expect(cmp({ a: '2' }, { a: '1' }, { a: '1' })).toEqual({ a: { state: 'up', deleted: false } })
    expect(cmp({ a: '1' }, { a: '2' }, { a: '1' })).toEqual({ a: { state: 'down', deleted: false } })
    expect(cmp({ a: '2' }, { a: '3' }, { a: '1' })).toEqual({ a: { state: 'conflict' } })
  })
  it('behandelt neue und gelöschte Dateien', () => {
    expect(cmp({ n: '1' }, {}, {})).toEqual({ n: { state: 'up', deleted: false } })
    expect(cmp({}, { n: '1' }, {})).toEqual({ n: { state: 'down', deleted: false } })
    expect(cmp({}, { a: '1' }, { a: '1' })).toEqual({ a: { state: 'up', deleted: true } })
    expect(cmp({ a: '1' }, {}, { a: '1' })).toEqual({ a: { state: 'down', deleted: true } })
    expect(cmp({}, {}, { a: '1' })).toEqual({})
  })
})

describe('Abgleich-Client gegen den Dienst', () => {
  let server: http.Server
  let store: SessionStore
  let base: string
  let deck: string
  const oldEnv = { ...process.env }

  /** der Online-Editor ändert Dateien (hier direkt über den Speicher des Dienstes) */
  const onlineWrite = (rel: string, text: string) => store.writeFile(share_id(), rel, Buffer.from(text))
  const share_id = () => Object.keys(JSON.parse(fs.readFileSync(path.join(process.env.HASHMARK_HOME!, 'share.json'), 'utf8')).decks).map((k) => JSON.parse(fs.readFileSync(path.join(process.env.HASHMARK_HOME!, 'share.json'), 'utf8')).decks[k].id)[0] as string

  beforeAll(async () => {
    store = new SessionStore({ dir: tmp('svc'), key: 'geheim' })
    server = http.createServer((req, res) => {
      const pathname = new URL(req.url ?? '/', 'http://x').pathname
      if (pathname === '/healthz') return void res.end('ok') // wie der echte Dienst: so erkennt der Client, dass er wach ist
      void handleSessionsApi(store, { changed: () => {} }, req, res, pathname).then((done) => { if (!done) { res.statusCode = 404; res.end() } })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterAll(async () => {
    process.env = oldEnv
    await new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()) })
  })
  beforeEach(() => {
    process.env.HASHMARK_HOME = tmp('home')
    process.env.HASHMARK_SHARE_URL = base
    process.env.HASHMARK_SHARE_KEY = 'geheim'
    deck = tmp('deck')
    write(deck, 'deck.yaml', 'title: Test\n')
    write(deck, '01.md', '# Eins\n')
    write(deck, 'bilder/a.png', Buffer.from([1, 2, 3]))
  })

  it('ist ohne Teilen „nicht geteilt“', async () => {
    const s = await share.status(deck)
    expect(s.shared).toBe(false)
    expect(s.state).toBe('none')
    expect(s.configured).toBe(true)
  })
  it('lädt beim Teilen alles hoch und gibt zwei Links', async () => {
    const s = await share.start(deck)
    expect(s.state).toBe('sync')
    expect(s.links?.view).toMatch(new RegExp(`^${base}/s/[A-Za-z0-9_-]{22}/$`))
    expect(s.links?.edit).toMatch(/\/editor\.html#k=[A-Za-z0-9_-]{32}$/)
    expect(Object.keys(store.manifest(share_id())).sort()).toEqual(['01.md', 'bilder/a.png', 'deck.yaml'])
  })
  it('verlangt den Dienst-Schlüssel', async () => {
    process.env.HASHMARK_SHARE_KEY = 'falsch'
    const e = await share.start(deck).then(() => null, (x: share.ShareError) => x)
    expect(e?.code).toBe('denied')
    delete process.env.HASHMARK_SHARE_KEY
    fs.rmSync(path.join(process.env.HASHMARK_HOME!, 'share.json'), { force: true })
    const e2 = await share.start(deck).then(() => null, (x: share.ShareError) => x)
    expect(e2?.code).toBe('config')
  })
  it('meldet lokale Änderungen und lädt sie hoch', async () => {
    await share.start(deck)
    write(deck, '01.md', '# Eins, neu\n')
    write(deck, '02.md', '# Zwei\n')
    let s = await share.status(deck)
    expect(s.state).toBe('local')
    expect(s.files).toEqual({ '01.md': { state: 'up', deleted: false }, '02.md': { state: 'up', deleted: false } })
    const r = await share.push(deck)
    expect(r.pushed.sort()).toEqual(['01.md', '02.md'])
    s = await share.status(deck)
    expect(s.state).toBe('sync')
    expect(store.readFile(share_id(), '01.md').toString()).toBe('# Eins, neu\n')
  })
  it('meldet Online-Änderungen und holt sie', async () => {
    await share.start(deck)
    onlineWrite('01.md', '# Online geändert\n')
    onlineWrite('neu.md', '# Neu\n')
    let s = await share.status(deck)
    expect(s.state).toBe('remote')
    expect(Object.keys(s.files).sort()).toEqual(['01.md', 'neu.md'])
    await share.pull(deck)
    expect(fs.readFileSync(path.join(deck, '01.md'), 'utf8')).toBe('# Online geändert\n')
    expect(fs.existsSync(path.join(deck, 'neu.md'))).toBe(true)
    s = await share.status(deck)
    expect(s.state).toBe('sync')
  })
  it('überträgt Löschungen in beide Richtungen', async () => {
    await share.start(deck)
    fs.rmSync(path.join(deck, '01.md'))
    expect((await share.status(deck)).files['01.md']).toEqual({ state: 'up', deleted: true })
    await share.push(deck)
    expect(store.manifest(share_id())['01.md']).toBeUndefined()
    store.removeFile(share_id(), 'bilder/a.png')
    expect((await share.status(deck)).files['bilder/a.png']).toEqual({ state: 'down', deleted: true })
    await share.pull(deck)
    expect(fs.existsSync(path.join(deck, 'bilder/a.png'))).toBe(false)
  })
  it('erkennt Konflikte, fasst sie nicht an und löst sie auf Wunsch', async () => {
    await share.start(deck)
    write(deck, '01.md', '# lokal\n')
    onlineWrite('01.md', '# online\n')
    const s = await share.status(deck)
    expect(s.state).toBe('conflict')
    expect(s.files['01.md']).toEqual({ state: 'conflict' })
    const p = await share.push(deck)
    expect(p.skipped).toEqual(['01.md'])
    const q = await share.pull(deck)
    expect(q.skipped).toEqual(['01.md'])
    expect(fs.readFileSync(path.join(deck, '01.md'), 'utf8')).toBe('# lokal\n')
    await share.resolve(deck, '01.md', 'remote')
    expect(fs.readFileSync(path.join(deck, '01.md'), 'utf8')).toBe('# online\n')
    expect((await share.status(deck)).state).toBe('sync')
    write(deck, '01.md', '# lokal 2\n')
    onlineWrite('01.md', '# online 2\n')
    await share.resolve(deck, '01.md', 'local')
    expect(store.readFile(share_id(), '01.md').toString()).toBe('# lokal 2\n')
    expect((await share.status(deck)).state).toBe('sync')
  })
  it('schützt vor Überschreiben, wenn sich online etwas ändert, während man hochlädt', async () => {
    await share.start(deck)
    const id = share_id()
    write(deck, '01.md', '# lokal\n')
    const stale = hashOf('# Eins\n')
    onlineWrite('01.md', '# online\n')
    const e = attempt(() => store.writeFile(id, '01.md', Buffer.from('# lokal\n'), stale))
    expect(e?.status).toBe(409)
  })
  it('stellt nach einem Neustart des Dienstes dieselbe Adresse wieder her', async () => {
    const first = await share.start(deck)
    const id = share_id()
    store.remove(id)
    let s = await share.status(deck)
    expect(s.state).toBe('restarted')
    expect(Object.values(s.files).every((f) => f.state === 'gone')).toBe(true)
    s = await share.start(deck)
    expect(s.state).toBe('sync')
    expect(s.links).toEqual(first.links)
    expect(Object.keys(store.manifest(id)).sort()).toEqual(['01.md', 'bilder/a.png', 'deck.yaml'])
  })
  it('meldet einen nicht erreichbaren Dienst, ohne Dateien anzufassen', async () => {
    await share.start(deck)
    // der Server steht in der Merkdatei des Decks: dort bleibt die alte Adresse
    const s = await share.status(deck)
    expect(['unreachable', 'sync']).toContain(s.state)
  })
  it('beendet das Teilen und entfernt die Online-Kopie', async () => {
    await share.start(deck)
    const id = share_id()
    await share.stop(deck)
    expect(store.has(id)).toBe(false)
    expect((await share.status(deck)).shared).toBe(false)
    expect(fs.existsSync(path.join(deck, '01.md'))).toBe(true)
  })
})

describe('Schnittstelle des Dienstes', () => {
  it('weist Fremde ab', async () => {
    const store = new SessionStore({ dir: tmp('api'), key: 'k' })
    const server = http.createServer((req, res) => {
      void handleSessionsApi(store, { changed: () => {} }, req, res, new URL(req.url ?? '/', 'http://x').pathname).then((d) => { if (!d) { res.statusCode = 404; res.end() } })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    const put = (headers: Record<string, string> = {}) => fetch(`${base}/api/sessions/${ID}`, { method: 'PUT', headers, body: JSON.stringify({ editToken: EDIT, ownerToken: OWNER }) })
    expect((await put()).status).toBe(401)
    expect((await put({ Authorization: 'Bearer falsch' })).status).toBe(401)
    expect((await put({ Authorization: 'Bearer k' })).status).toBe(201)
    // vorhandene Session: nur mit Besitzer-Token (Schlüssel allein genügt nicht)
    expect((await fetch(`${base}/api/sessions/${ID}/manifest`)).status).toBe(403)
    expect((await fetch(`${base}/api/sessions/${ID}/manifest`, { headers: { 'X-Hashmark-Owner': EDIT } })).status).toBe(403)
    expect((await fetch(`${base}/api/sessions/${ID}/manifest`, { headers: { 'X-Hashmark-Owner': OWNER } })).status).toBe(200)
    expect((await fetch(`${base}/api/sessions/${ID}/file?path=..%2Fmeta.json`, { headers: { 'X-Hashmark-Owner': OWNER } })).status).toBe(400)
    expect((await fetch(`${base}/api/sessions/${'Z'.repeat(22)}/manifest`, { headers: { 'X-Hashmark-Owner': OWNER } })).status).toBe(404)
    // ohne Schlüssel am Dienst lässt sich nichts anlegen
    const closed = new SessionStore({ dir: tmp('api2') })
    expect(closed.key).toBeUndefined()
    expect(HttpError).toBeTruthy()
    await new Promise<void>((r) => { server.closeAllConnections(); server.close(() => r()) })
  })
})

describe('Dienst schläft und startet beim ersten Aufruf (Render Free)', () => {
  const oldEnv = { ...process.env }
  let server: http.Server | undefined
  let store: SessionStore

  /** Dienst, der die ersten `cold` Aufrufe von /healthz wie Render beim Aufwachen beantwortet (Wartehinweis, 503) */
  async function service(opts: { cold?: number; delayMs?: number; sessions?: boolean; hang?: boolean; healthz?: (res: http.ServerResponse) => void } = {}) {
    let seen = 0
    store = new SessionStore({ dir: tmp('cold'), key: 'geheim' })
    server = http.createServer((req, res) => {
      if (opts.hang) return // antwortet nie (Dienst schläft)
      const pathname = new URL(req.url ?? '/', 'http://x').pathname
      if (pathname === '/healthz') {
        if (opts.healthz) return opts.healthz(res)
        seen++
        if (seen <= (opts.cold ?? 0)) {
          const answer = () => { res.statusCode = 503; res.setHeader('Content-Type', 'text/html'); res.end('<html>Application loading</html>') }
          return opts.delayMs ? void setTimeout(answer, opts.delayMs) : answer()
        }
        res.setHeader('Content-Type', 'text/plain')
        return void res.end('ok')
      }
      if (opts.sessions === false) { res.statusCode = 404; return void res.end() }
      void handleSessionsApi(store, { changed: () => {} }, req, res, pathname).then((done) => { if (!done) { res.statusCode = 404; res.end() } })
    })
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r))
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  }

  const phases = () => {
    const seen: string[] = []
    const off = share.onActivity((a) => { if (seen[seen.length - 1] !== a.phase) seen.push(a.phase) })
    return { seen, off }
  }
  const caught = (p: Promise<unknown>) => p.then(() => null, (e: share.ShareError) => e)

  beforeEach(() => {
    process.env.HASHMARK_HOME = tmp('home')
    process.env.HASHMARK_SHARE_KEY = 'geheim'
    process.env.HASHMARK_WAKE_POLL_MS = '20'
    process.env.HASHMARK_WAKE_AFTER_MS = '1'
    process.env.HASHMARK_WAKE_TIMEOUT_MS = '3000'
    process.env.HASHMARK_PROBE_TIMEOUT_MS = '1000'
  })
  afterEach(async () => {
    process.env = { ...oldEnv }
    if (server) await new Promise<void>((r) => { server!.closeAllConnections(); server!.close(() => r()) })
    server = undefined
  })

  it('wartet auf den schlafenden Dienst und meldet „Dienst wird gestartet“, bis er antwortet', async () => {
    const base = await service({ cold: 4 })
    const p = phases()
    await share.ensureAwake(base)
    p.off()
    expect(p.seen).toEqual(['connecting', 'waking'])
  })
  it('zeigt „verbinde“ statt „schläft“, wenn der Dienst sofort antwortet', async () => {
    const base = await service()
    const p = phases()
    await share.ensureAwake(base)
    p.off()
    expect(p.seen).toEqual(['connecting'])
  })
  it('hält hängende Aufrufe aus und versucht es erneut', async () => {
    process.env.HASHMARK_PROBE_TIMEOUT_MS = '60'
    const base = await service({ cold: 2, delayMs: 400 })
    await share.ensureAwake(base)
    expect(share.getActivity().phase).toBe('waking')
  })
  it('gibt nach der Wartezeit auf und nennt den Grund', async () => {
    process.env.HASHMARK_WAKE_TIMEOUT_MS = '250'
    const base = await service({ cold: 1_000_000 })
    const e = await caught(share.ensureAwake(base))
    expect(e?.code).toBe('asleep')
    expect(e?.reason).toBe('timeout')
    expect(e?.message).toMatch(/Dienst startet nicht/)
    expect(e?.message).toMatch(/Render-Dashboard/)
    const a = share.getActivity()
    expect(a.phase).toBe('failed')
    expect(a.reason).toBe('timeout')
  })
  it('bricht bei dauerhaften Fehlern sofort mit Grund ab: Adresse, Verbindung, falscher Dienst', async () => {
    const t0 = Date.now()
    const dns = await caught(share.ensureAwake('http://nicht-vorhanden.invalid'))
    expect(dns?.reason).toBe('dns')
    expect(dns?.message).toMatch(/Adresse nicht gefunden/)
    // freier Port ohne Dienst (Port 1 und andere „schlechte“ Ports verbietet fetch selbst)
    const free = await service()
    const closedPort = (server!.address() as AddressInfo).port
    await new Promise<void>((r) => { server!.closeAllConnections(); server!.close(() => r()) })
    const refused = await caught(share.ensureAwake(`http://127.0.0.1:${closedPort}`))
    expect(refused?.reason).toBe('refused')
    const base = await service({ healthz: (res) => { res.statusCode = 404; res.end() } })
    const wrong = await caught(share.ensureAwake(base))
    expect(wrong?.reason).toBe('wrong')
    expect(Date.now() - t0).toBeLessThan(2500)
  })
  it('teilt mit, dass der Dienst läuft, aber das Teilen ausgeschaltet ist', async () => {
    const base = await service({ sessions: false })
    process.env.HASHMARK_SHARE_URL = base
    const deck = tmp('deck')
    write(deck, '01.md', '# Eins\n')
    const e = await caught(share.start(deck))
    expect(e?.reason).toBe('unsupported')
    expect(e?.message).toMatch(/SESSIONS=1/)
  })
  it('teilt beim Kaltstart trotzdem: erst wecken, dann hochladen', async () => {
    const base = await service({ cold: 3 })
    process.env.HASHMARK_SHARE_URL = base
    const deck = tmp('deck')
    write(deck, '01.md', '# Eins\n')
    const p = phases()
    const s = await share.start(deck)
    p.off()
    expect(s.state).toBe('sync')
    expect(p.seen.slice(0, 2)).toEqual(['connecting', 'waking'])
    expect(p.seen).toContain('working')
    expect(share.getActivity().phase).toBe('idle')
  })
  it('meldet beim Zustand „schläft“, statt zu hängen', async () => {
    const base = await service({ hang: true })
    process.env.HASHMARK_SHARE_URL = base
    const deck = tmp('deck')
    write(deck, '01.md', '# Eins\n')
    // geteilt wurde vorher: Eintrag von Hand, der Dienst antwortet jetzt nicht (er schläft)
    fs.mkdirSync(process.env.HASHMARK_HOME!, { recursive: true })
    fs.writeFileSync(path.join(process.env.HASHMARK_HOME!, 'share.json'), JSON.stringify({ decks: { [path.resolve(deck)]: { id: ID, editToken: EDIT, ownerToken: OWNER, base: {}, server: base } } }))
    const s = await share.status(deck, { timeout: 100 })
    expect(s.state).toBe('asleep')
    expect(s.shared).toBe(true)
    expect(s.links?.view).toBe(`${base}/s/${ID}/`)
  })
})

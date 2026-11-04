// Lokaler Teil des Teilens: Deck-Ordner mit der Session im Webdienst abgleichen (hochladen, holen, Konflikte).
// Das lokale Deck ist das Original. Die Online-Kopie liegt im flüchtigen Speicher und kann verschwinden;
// dann stellt `restore` sie unter derselben Adresse wieder her (Id und Token liegen hier, nicht im Dienst).
//
// Abgleich wie in einer Quellcode-Verwaltung, je Datei drei Stände: lokal (L), online (R) und der Stand des letzten
// Abgleichs (B). L = R: gleich. L = B: online neuer (down). R = B: lokal neuer (up). Sonst Konflikt.

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { hashOf, manifestOf, resolveIn } from './files.ts'

export const DEFAULT_SERVER = 'https://hashmark.onrender.com'

export type FileState = 'up' | 'down' | 'conflict' | 'gone'
export type ShareState = 'none' | 'sync' | 'local' | 'remote' | 'conflict' | 'asleep' | 'restarted' | 'unreachable'

export interface ShareStatus {
  /** Server und Schlüssel sind bekannt */
  configured: boolean
  server: string
  shared: boolean
  state: ShareState
  links?: { view: string; edit: string }
  /** nur Dateien, die nicht gleich sind */
  files: Record<string, { state: FileState; deleted?: boolean }>
  lastSync?: number
  error?: string
}

interface Record_ { id: string; editToken: string; ownerToken: string; base: Record<string, string>; server: string; lastSync?: number }
interface Config { server?: string; key?: string; decks: Record<string, Record_> }

export class ShareError extends Error {
  code: 'config' | 'asleep' | 'gone' | 'unreachable' | 'denied' | 'conflict' | 'server'
  constructor(code: ShareError['code'], message: string) {
    super(message)
    this.code = code
  }
}

const configFile = () => path.join(process.env.HASHMARK_HOME ?? path.join(os.homedir(), '.hashmark'), 'share.json')

function loadConfig(): Config {
  try {
    const c = JSON.parse(fs.readFileSync(configFile(), 'utf8')) as Config
    return { ...c, decks: c.decks ?? {} }
  } catch {
    return { decks: {} }
  }
}

function saveConfig(c: Config) {
  const file = configFile()
  fs.mkdirSync(path.dirname(file), { recursive: true })
  // enthält Schlüssel und Token: nur für den Benutzer lesbar
  fs.writeFileSync(file, JSON.stringify(c, null, 2), { mode: 0o600 })
}

const keyOf = (deckDir: string) => path.resolve(deckDir)
const random = (bytes: number) => crypto.randomBytes(bytes).toString('base64url')

export function setServer(server: string | undefined, key: string | undefined) {
  const c = loadConfig()
  if (server !== undefined) c.server = server.replace(/\/+$/, '') || undefined
  if (key !== undefined) c.key = key || undefined
  saveConfig(c)
}

export function settings() {
  const c = loadConfig()
  const key = process.env.HASHMARK_SHARE_KEY ?? c.key
  return { server: (process.env.HASHMARK_SHARE_URL ?? c.server ?? DEFAULT_SERVER).replace(/\/+$/, ''), key }
}

const linksOf = (r: Record_) => ({ view: `${r.server}/s/${r.id}/`, edit: `${r.server}/s/${r.id}/editor.html#k=${r.editToken}` })

async function call(server: string, route: string, init: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const { timeout = 60_000, ...rest } = init
  let res: Response
  try {
    res = await fetch(server + route, { ...rest, signal: AbortSignal.timeout(timeout) })
  } catch (e) {
    const name = (e as Error).name
    // Render Free: der schlafende Dienst antwortet erst nach bis zu einer Minute
    if (name === 'TimeoutError' || name === 'AbortError') throw new ShareError('asleep', 'Der Dienst antwortet nicht (er schläft vermutlich und startet gerade)')
    throw new ShareError('unreachable', `Dienst nicht erreichbar: ${server} (${(e as Error).cause ? String(((e as Error).cause as Error).message ?? (e as Error).cause) : (e as Error).message})`)
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    // Render antwortet beim Aufwachen mit einer Wartehinweis-Seite, aber auch der Dienst selbst meldet 503, wenn er nichts annimmt
    const text = await res.text().catch(() => '')
    if (/SHARE_KEY/.test(text)) throw new ShareError('config', 'Der Dienst nimmt keine Präsentationen an (SHARE_KEY fehlt)')
    throw new ShareError('asleep', 'Der Dienst startet gerade')
  }
  return res
}

async function fail(res: Response): Promise<never> {
  let msg = res.statusText
  try { msg = ((await res.json()) as { error?: string }).error ?? msg } catch { /* kein JSON */ }
  if (res.status === 404) throw new ShareError('gone', msg)
  if (res.status === 401 || res.status === 403) throw new ShareError('denied', msg)
  if (res.status === 409) throw new ShareError('conflict', msg)
  throw new ShareError('server', msg)
}

const ownerHeaders = (r: Record_) => ({ 'X-Hashmark-Owner': r.ownerToken })

async function remoteManifest(r: Record_, timeout?: number): Promise<Record<string, string>> {
  const res = await call(r.server, `/api/sessions/${r.id}/manifest`, { headers: ownerHeaders(r), timeout })
  if (!res.ok) await fail(res)
  return ((await res.json()) as { files: Record<string, string> }).files
}

/** Vergleich der drei Stände (siehe Kopf) */
export function compare(local: Record<string, string>, remote: Record<string, string>, base: Record<string, string>): ShareStatus['files'] {
  const out: ShareStatus['files'] = {}
  for (const p of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const l = local[p]
    const r = remote[p]
    const b = base[p]
    if (l === r) continue
    if (l === b) out[p] = { state: 'down', deleted: r === undefined }
    else if (r === b) out[p] = { state: 'up', deleted: l === undefined }
    else out[p] = { state: 'conflict' }
  }
  return out
}

export async function status(deckDir: string, opts: { timeout?: number } = {}): Promise<ShareStatus> {
  const { server, key } = settings()
  const rec = loadConfig().decks[keyOf(deckDir)]
  const base: ShareStatus = { configured: !!key, server, shared: !!rec, state: 'none', files: {} }
  if (!rec) return base
  const out: ShareStatus = { ...base, server: rec.server, links: linksOf(rec), lastSync: rec.lastSync }
  const local = manifestOf(deckDir)
  try {
    const remote = await remoteManifest(rec, opts.timeout ?? 12_000)
    out.files = compare(local, remote, rec.base)
  } catch (e) {
    if (!(e instanceof ShareError)) throw e
    if (e.code === 'gone') {
      // Dienst neu gestartet: Online-Kopie ist weg, lokal ist alles noch da
      for (const p of Object.keys(local)) out.files[p] = { state: 'gone' }
      out.state = 'restarted'
      return out
    }
    out.state = e.code === 'asleep' ? 'asleep' : 'unreachable'
    out.error = e.message
    return out
  }
  const states = Object.values(out.files).map((f) => f.state)
  out.state = states.includes('conflict') ? 'conflict' : states.includes('down') ? 'remote' : states.includes('up') ? 'local' : 'sync'
  return out
}

async function putFile(r: Record_, p: string, data: Buffer, ifMatch: string) {
  const res = await call(r.server, `/api/sessions/${r.id}/file?path=${encodeURIComponent(p)}`, { method: 'PUT', headers: { ...ownerHeaders(r), 'If-Match': ifMatch }, body: new Uint8Array(data) })
  if (!res.ok) await fail(res)
}

/** true = neu angelegt (oder wiederhergestellt), false = gab es schon */
async function createRemote(r: Record_, key: string): Promise<boolean> {
  const res = await call(r.server, `/api/sessions/${r.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ editToken: r.editToken, ownerToken: r.ownerToken }),
  })
  if (!res.ok) await fail(res)
  return res.status === 201
}

/** Höchstens `n` Aufrufe gleichzeitig */
async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  const queue = [...items]
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => { for (let x = queue.shift(); x !== undefined; x = queue.shift()) await fn(x) }))
}

/** Teilen: Adresse und Token erzeugen, Session anlegen, alles hochladen. Gibt es das Deck schon geteilt, stellt es die Session wieder her. */
export async function start(deckDir: string): Promise<ShareStatus> {
  const { server, key } = settings()
  if (!key) throw new ShareError('config', 'Dienst-Schlüssel fehlt (hashmark share --key …)')
  const cfg = loadConfig()
  let rec = cfg.decks[keyOf(deckDir)]
  if (!rec) {
    rec = { id: random(16), editToken: random(24), ownerToken: random(24), base: {}, server }
    cfg.decks[keyOf(deckDir)] = rec
    saveConfig(cfg)
  }
  // frisch angelegt oder wiederhergestellt: online ist leer, alles lokal ist neu. Gab es die Session noch, bleibt der Abgleichstand.
  if (await createRemote(rec, key)) rec.base = {}
  saveConfig(cfg)
  await push(deckDir)
  return status(deckDir)
}

/** Neuere lokale Dateien hochladen (und neue, und gelöschte). Konflikte bleiben liegen. */
export async function push(deckDir: string, only?: string[]): Promise<{ pushed: string[]; skipped: string[] }> {
  const cfg = loadConfig()
  const rec = cfg.decks[keyOf(deckDir)]
  if (!rec) throw new ShareError('config', 'Dieses Deck ist nicht geteilt')
  const local = manifestOf(deckDir)
  const remote = await remoteManifest(rec)
  const todo = compare(local, remote, rec.base)
  const pushed: string[] = []
  const skipped: string[] = []
  const paths = Object.keys(todo).filter((p) => !only || only.includes(p))
  await pool(paths, 4, async (p) => {
    const t = todo[p]
    if (t.state !== 'up') { skipped.push(p); return }
    if (t.deleted) {
      const res = await call(rec.server, `/api/sessions/${rec.id}/file?path=${encodeURIComponent(p)}`, { method: 'DELETE', headers: { ...ownerHeaders(rec), 'If-Match': remote[p] ?? 'none' } })
      if (!res.ok) await fail(res)
      delete rec.base[p]
    } else {
      await putFile(rec, p, fs.readFileSync(resolveIn(deckDir, p)), remote[p] ?? 'none')
      rec.base[p] = local[p]
    }
    pushed.push(p)
  })
  // Dateien, die schon gleich sind, gelten als abgeglichen
  for (const p of Object.keys(local)) if (local[p] === remote[p]) rec.base[p] = local[p]
  rec.lastSync = Date.now()
  saveConfig(cfg)
  return { pushed, skipped }
}

/** Neuere Online-Dateien holen. Lokal geänderte (Konflikt) bleiben unangetastet. */
export async function pull(deckDir: string, only?: string[]): Promise<{ pulled: string[]; skipped: string[] }> {
  const cfg = loadConfig()
  const rec = cfg.decks[keyOf(deckDir)]
  if (!rec) throw new ShareError('config', 'Dieses Deck ist nicht geteilt')
  const local = manifestOf(deckDir)
  const remote = await remoteManifest(rec)
  const todo = compare(local, remote, rec.base)
  const pulled: string[] = []
  const skipped: string[] = []
  const paths = Object.keys(todo).filter((p) => !only || only.includes(p))
  await pool(paths, 4, async (p) => {
    const t = todo[p]
    if (t.state !== 'down') { skipped.push(p); return }
    await fetchInto(rec, deckDir, p, t.deleted === true)
    if (t.deleted) delete rec.base[p]
    else rec.base[p] = remote[p]
    pulled.push(p)
  })
  for (const p of Object.keys(local)) if (local[p] === remote[p]) rec.base[p] = local[p]
  rec.lastSync = Date.now()
  saveConfig(cfg)
  return { pulled, skipped }
}

async function fetchInto(rec: Record_, deckDir: string, p: string, deleted: boolean) {
  const abs = resolveIn(deckDir, p)
  if (deleted) { fs.rmSync(abs, { force: true }); return }
  const res = await call(rec.server, `/api/sessions/${rec.id}/file?path=${encodeURIComponent(p)}`, { headers: ownerHeaders(rec) })
  if (!res.ok) await fail(res)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, Buffer.from(await res.arrayBuffer()))
}

/** Konflikt lösen: lokale Fassung nach online (`local`) oder Online-Fassung nach lokal (`remote`) */
export async function resolve(deckDir: string, p: string, keep: 'local' | 'remote'): Promise<void> {
  const cfg = loadConfig()
  const rec = cfg.decks[keyOf(deckDir)]
  if (!rec) throw new ShareError('config', 'Dieses Deck ist nicht geteilt')
  const local = manifestOf(deckDir)
  const remote = await remoteManifest(rec)
  if (keep === 'local') {
    if (local[p] === undefined) {
      const res = await call(rec.server, `/api/sessions/${rec.id}/file?path=${encodeURIComponent(p)}`, { method: 'DELETE', headers: { ...ownerHeaders(rec), 'If-Match': remote[p] ?? 'none' } })
      if (!res.ok) await fail(res)
      delete rec.base[p]
    } else {
      await putFile(rec, p, fs.readFileSync(resolveIn(deckDir, p)), remote[p] ?? 'none')
      rec.base[p] = local[p]
    }
  } else {
    await fetchInto(rec, deckDir, p, remote[p] === undefined)
    if (remote[p] === undefined) delete rec.base[p]
    else rec.base[p] = remote[p]
  }
  saveConfig(cfg)
}

/** Teilen beenden: Session online löschen (ist sie schon weg, genügt das) und das lokale Merkblatt entfernen */
export async function stop(deckDir: string): Promise<void> {
  const cfg = loadConfig()
  const rec = cfg.decks[keyOf(deckDir)]
  if (!rec) return
  try {
    const res = await call(rec.server, `/api/sessions/${rec.id}`, { method: 'DELETE', headers: ownerHeaders(rec), timeout: 20_000 })
    if (!res.ok && res.status !== 404) await fail(res)
  } catch (e) {
    if (!(e instanceof ShareError) || e.code === 'denied') throw e
    // Dienst nicht erreichbar: Online-Kopie verschwindet ohnehin beim nächsten Neustart
  }
  delete cfg.decks[keyOf(deckDir)]
  saveConfig(cfg)
}

export { hashOf }

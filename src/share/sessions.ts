// Sessions des Webdienstes: je geteilter Präsentation ein Deck-Ordner im flüchtigen Speicher (Render Free hat keine Disk,
// der Dienst schläft und startet neu, dann ist alles weg). Das Original liegt immer lokal, der Besitzer stellt eine
// verlorene Session mit denselben Zugangsdaten wieder her (`PUT /api/sessions/<id>`).
//
// Zugang ohne Konten, nur über unratbare Werte:
//   Adresse `<id>`  → Ansehen (Rolle view)
//   Bearbeiten-Token → Bearbeiten im Online-Editor (Rolle edit)
//   Besitzer-Token   → Abgleich per CLI/App (Rolle owner), kann alles
// Id und beide Token entstehen lokal; der Dienst speichert nur die Hashes der Token.
// Anlegen (auch Wiederherstellen) verlangt zusätzlich den Dienst-Schlüssel `SHARE_KEY`.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { MAX_FILE_BYTES, hashOf, isSyncable, manifestOf, resolveIn } from './files.ts'

export const ID_PATTERN = /^[A-Za-z0-9_-]{22}$/
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22,64}$/

export type Role = 'owner' | 'edit' | 'view'

export interface SessionsOptions {
  /** Ordner der Sessions (Standard: Temp-Ordner) */
  dir: string
  /** Dienst-Schlüssel zum Anlegen. Ohne Schlüssel lässt sich nichts anlegen. */
  key?: string
  maxSessionBytes?: number
  maxTotalBytes?: number
  maxSessions?: number
  /** Anlegen je Stunde und Absender */
  maxCreatesPerHour?: number
}

interface Meta { id: string; editHash: string; ownerHash: string; created: number; lastUsed: number }

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex')
const same = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))

function sizeOf(dir: string): number {
  let sum = 0
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.isFile()) sum += fs.statSync(p).size
    }
  }
  try { walk(dir) } catch { /* leer */ }
  return sum
}

export class SessionStore {
  readonly dir: string
  readonly key?: string
  readonly maxSessionBytes: number
  readonly maxTotalBytes: number
  readonly maxSessions: number
  readonly maxCreatesPerHour: number
  private metas = new Map<string, Meta>()
  private creates = new Map<string, number[]>()
  /** wird aufgerufen, wenn eine Session verschwindet (gelöscht oder verdrängt), damit der Server ihren Zustand freigibt */
  onRemove: (id: string) => void = () => {}

  constructor(opts: SessionsOptions) {
    this.dir = path.resolve(opts.dir)
    this.key = opts.key
    this.maxSessionBytes = opts.maxSessionBytes ?? 20 * 1024 * 1024
    this.maxTotalBytes = opts.maxTotalBytes ?? 200 * 1024 * 1024
    this.maxSessions = opts.maxSessions ?? 50
    this.maxCreatesPerHour = opts.maxCreatesPerHour ?? 20
    fs.mkdirSync(this.dir, { recursive: true })
    // Sessions eines früheren Laufs (lokal, im selben Ordner) weiterverwenden; auf Render ist der Ordner nach dem Start leer
    for (const id of fs.readdirSync(this.dir)) {
      try {
        const meta = JSON.parse(fs.readFileSync(path.join(this.dir, id, 'meta.json'), 'utf8')) as Meta
        if (ID_PATTERN.test(id) && meta.id === id) this.metas.set(id, meta)
      } catch { /* kein Session-Ordner */ }
    }
  }

  deckDir(id: string): string { return path.join(this.dir, id, 'deck') }
  has(id: string): boolean { return this.metas.has(id) }
  count(): number { return this.metas.size }

  /** Rolle zu einem Token. Die Adresse allein gibt `view`, wenn es die Session gibt. */
  role(id: string, token: string | undefined): Role | null {
    const meta = this.metas.get(id)
    if (!meta) return null
    if (token) {
      const h = sha(token)
      if (same(h, meta.ownerHash)) return 'owner'
      if (same(h, meta.editHash)) return 'edit'
    }
    return 'view'
  }

  touch(id: string) {
    const meta = this.metas.get(id)
    if (meta) meta.lastUsed = Date.now()
  }

  private saveMeta(meta: Meta) {
    fs.writeFileSync(path.join(this.dir, meta.id, 'meta.json'), JSON.stringify(meta))
  }

  /** Absender dürfen nur begrenzt oft anlegen (Missbrauch, auch mit gültigem Schlüssel) */
  checkRate(who: string) {
    const now = Date.now()
    const list = (this.creates.get(who) ?? []).filter((t) => now - t < 3600_000)
    if (list.length >= this.maxCreatesPerHour) throw new HttpError(429, 'Zu viele neue Sessions, bitte später erneut versuchen')
    list.push(now)
    this.creates.set(who, list)
  }

  create(id: string, editToken: string, ownerToken: string): Meta {
    if (!ID_PATTERN.test(id)) throw new HttpError(400, 'Ungültige Adresse (22 Zeichen A–Z, a–z, 0–9, - und _)')
    if (!TOKEN_PATTERN.test(editToken) || !TOKEN_PATTERN.test(ownerToken) || editToken === ownerToken) throw new HttpError(400, 'Ungültige Token')
    if (this.metas.has(id)) throw new HttpError(409, 'Session existiert schon')
    // zu viele Sessions: die am längsten ungenutzte weichen
    while (this.metas.size >= this.maxSessions) this.evictOldest()
    fs.mkdirSync(this.deckDir(id), { recursive: true })
    const now = Date.now()
    const meta: Meta = { id, editHash: sha(editToken), ownerHash: sha(ownerToken), created: now, lastUsed: now }
    this.metas.set(id, meta)
    this.saveMeta(meta)
    return meta
  }

  remove(id: string) {
    if (!this.metas.delete(id)) return
    fs.rmSync(path.join(this.dir, id), { recursive: true, force: true })
    this.onRemove(id)
  }

  private evictOldest(except?: string) {
    let oldest: Meta | undefined
    for (const m of this.metas.values()) if (m.id !== except && (!oldest || m.lastUsed < oldest.lastUsed)) oldest = m
    if (!oldest) throw new HttpError(507, 'Kein Platz für weitere Sessions')
    this.remove(oldest.id)
  }

  manifest(id: string): Record<string, string> { return manifestOf(this.deckDir(id)) }

  readFile(id: string, rel: string): Buffer {
    const abs = resolveIn(this.deckDir(id), rel)
    if (!isSyncable(rel) || !fs.existsSync(abs)) throw new HttpError(404, 'Datei nicht gefunden')
    return fs.readFileSync(abs)
  }

  /** `ifMatch`: erwarteter Hash der alten Datei, `'none'` = darf noch nicht existieren, `undefined` = ohne Prüfung */
  writeFile(id: string, rel: string, data: Buffer, ifMatch?: string): string {
    if (!isSyncable(rel)) throw new HttpError(415, 'Dateityp oder Pfad nicht erlaubt')
    if (data.length > MAX_FILE_BYTES) throw new HttpError(413, 'Datei zu groß')
    const abs = resolveIn(this.deckDir(id), rel)
    const old = fs.existsSync(abs) ? hashOf(fs.readFileSync(abs)) : null
    this.checkMatch(old, ifMatch)
    const grow = data.length - (old ? fs.statSync(abs).size : 0)
    if (grow > 0) {
      if (sizeOf(this.deckDir(id)) + grow > this.maxSessionBytes) throw new HttpError(413, `Session zu groß (höchstens ${Math.round(this.maxSessionBytes / 1024 / 1024)} MB)`)
      // insgesamt zu voll: andere, lange ungenutzte Sessions weichen
      while (this.totalBytes() + grow > this.maxTotalBytes) this.evictOldest(id)
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, data)
    return hashOf(data)
  }

  removeFile(id: string, rel: string, ifMatch?: string) {
    const abs = resolveIn(this.deckDir(id), rel)
    const old = fs.existsSync(abs) ? hashOf(fs.readFileSync(abs)) : null
    this.checkMatch(old, ifMatch)
    if (old) fs.rmSync(abs)
  }

  private checkMatch(current: string | null, ifMatch: string | undefined) {
    if (ifMatch === undefined) return
    if (ifMatch === 'none' ? current !== null : current !== ifMatch) throw new HttpError(409, 'Die Datei wurde online inzwischen geändert')
  }

  private totalBytes(): number {
    let sum = 0
    for (const id of this.metas.keys()) sum += sizeOf(this.deckDir(id))
    return sum
  }
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += (chunk as Buffer).length
    if (size > limit) throw new HttpError(413, 'Anfrage zu groß')
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

export interface SessionsApiHooks {
  /** Dateien einer Session haben sich über die Schnittstelle geändert: Seiten neu laden */
  changed: (id: string) => void
}

const bearer = (req: IncomingMessage) => /^Bearer (.+)$/.exec(String(req.headers.authorization ?? ''))?.[1]

/**
 * `/api/sessions/…` (Abgleich durch den Besitzer). Gedacht für CLI und lokale App, nicht für Browser:
 * Es gibt keine CORS-Freigabe, Browser anderer Herkunft scheitern an der Vorabfrage.
 * Gibt `true` zurück, wenn die Anfrage behandelt wurde.
 */
export async function handleSessionsApi(store: SessionStore, hooks: SessionsApiHooks, req: IncomingMessage, res: ServerResponse, pathname: string): Promise<boolean> {
  const m = /^\/api\/sessions\/([^/]+)(?:\/(manifest|file))?$/.exec(pathname)
  if (!m) return false
  const [, id, sub] = m
  const send = (status: number, data: unknown, type = 'application/json') => {
    res.statusCode = status
    res.setHeader('Content-Type', type)
    res.setHeader('Cache-Control', 'no-store')
    res.end(type === 'application/json' ? JSON.stringify(data) : (data as Buffer))
  }
  try {
    if (!ID_PATTERN.test(id)) throw new HttpError(400, 'Ungültige Adresse')
    const url = new URL(req.url ?? '/', 'http://x')
    const owner = () => {
      if (!store.has(id)) throw new HttpError(404, 'Session unbekannt')
      const token = String(req.headers['x-hashmark-owner'] ?? '')
      if (store.role(id, token) !== 'owner') throw new HttpError(403, 'Besitzer-Token fehlt oder falsch')
      store.touch(id)
    }

    // Anlegen bzw. Wiederherstellen: mit Dienst-Schlüssel, danach idempotent mit Besitzer-Token
    if (!sub && req.method === 'PUT') {
      const data = JSON.parse((await readBody(req, 4096)).toString('utf8') || '{}') as { editToken?: string; ownerToken?: string }
      if (store.has(id)) {
        if (store.role(id, data.ownerToken) !== 'owner') throw new HttpError(403, 'Besitzer-Token falsch')
        store.touch(id)
        return send(200, { id, created: false }), true
      }
      if (!store.key) throw new HttpError(503, 'Der Dienst nimmt keine Präsentationen an (SHARE_KEY fehlt)')
      const given = bearer(req)
      if (!given || !same(sha(given), sha(store.key))) throw new HttpError(401, 'Dienst-Schlüssel fehlt oder falsch')
      store.checkRate(String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() || req.socket.remoteAddress || '?')
      store.create(id, String(data.editToken ?? ''), String(data.ownerToken ?? ''))
      return send(201, { id, created: true }), true
    }
    if (!sub && req.method === 'DELETE') {
      owner()
      store.remove(id)
      return send(200, { ok: true }), true
    }
    if (sub === 'manifest' && req.method === 'GET') {
      owner()
      return send(200, { files: store.manifest(id) }), true
    }
    if (sub === 'file') {
      owner()
      const rel = url.searchParams.get('path') ?? ''
      const ifMatch = typeof req.headers['if-match'] === 'string' ? req.headers['if-match'].replace(/"/g, '') : undefined
      if (req.method === 'GET') return send(200, store.readFile(id, rel), 'application/octet-stream'), true
      if (req.method === 'PUT') {
        const hash = store.writeFile(id, rel, await readBody(req, MAX_FILE_BYTES), ifMatch)
        hooks.changed(id)
        return send(200, { hash }), true
      }
      if (req.method === 'DELETE') {
        store.removeFile(id, rel, ifMatch)
        hooks.changed(id)
        return send(200, { ok: true }), true
      }
    }
    throw new HttpError(405, 'Methode nicht erlaubt')
  } catch (e) {
    if (e instanceof SyntaxError) return send(400, { error: 'Kein gültiges JSON' }), true
    const status = e instanceof HttpError ? e.status : /Pfad|Ungültiger/.test((e as Error).message) ? 400 : 500
    send(status, { error: (e as Error).message })
    return true
  }
}

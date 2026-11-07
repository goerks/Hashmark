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
import { IDLE, explain, type Activity, type Reason } from './reasons.ts'

export type { Activity, Reason }

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
  /** Grund, wenn der Dienst nicht erreichbar ist */
  reason?: Reason
}

interface Record_ { id: string; editToken: string; ownerToken: string; base: Record<string, string>; server: string; lastSync?: number }
interface Config { server?: string; key?: string; decks: Record<string, Record_> }

export class ShareError extends Error {
  code: 'config' | 'asleep' | 'gone' | 'unreachable' | 'denied' | 'conflict' | 'server'
  reason?: Reason
  constructor(code: ShareError['code'], message: string, reason?: Reason) {
    super(message)
    this.code = code
    this.reason = reason
  }
}

// ---------- Was geschieht gerade (für die Anzeige) ----------

let activity: Activity = IDLE
const listeners = new Set<(a: Activity) => void>()
const setActivity = (a: Activity) => { activity = a; for (const l of listeners) l(a) }
export const getActivity = (): Activity => ({ ...activity })
/** Abonnieren (Befehlszeile); gibt die Abmeldung zurück */
export function onActivity(fn: (a: Activity) => void): () => void { listeners.add(fn); return () => { listeners.delete(fn) } }

/** Zeiten sind für Tests einstellbar */
const num = (name: string, fallback: number) => Number(process.env[name]) || fallback
const wakeLimit = () => num('HASHMARK_WAKE_TIMEOUT_MS', 100_000)
const wakePoll = () => num('HASHMARK_WAKE_POLL_MS', 2_000)
const probeTimeout = () => num('HASHMARK_PROBE_TIMEOUT_MS', 15_000)
/** ab dieser Wartezeit gilt der Dienst als „schläft“ (vorher: „verbinde“) */
const wakeAfter = () => num('HASHMARK_WAKE_AFTER_MS', 2_500)

const hostOf = (server: string) => { try { return new URL(server).host } catch { return server } }

/** Technischer Grund aus einem fehlgeschlagenen `fetch`; `retry` = kann sich von selbst geben (Dienst startet) */
function classify(e: unknown): { reason: Reason; retry: boolean; detail: string } {
  // Node meldet bei mehreren Adressen (IPv4 und IPv6) einen AggregateError: der Code steckt dann in den Einzelfehlern
  type Cause = { code?: string; message?: string; errors?: Cause[] }
  const err = e as Error & { cause?: Cause }
  const cause = err.cause
  const code = cause?.code || cause?.errors?.find((x) => x.code)?.code || ''
  const detail = cause?.message || cause?.errors?.find((x) => x.message)?.message || err.message
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return { reason: 'dns', retry: false, detail }
  if (code === 'ECONNREFUSED') return { reason: 'refused', retry: false, detail }
  if (/CERT|SSL|TLS|SELF_SIGNED|UNABLE_TO_VERIFY/i.test(code + ' ' + detail)) return { reason: 'tls', retry: false, detail }
  // Zeitüberschreitung, ECONNRESET, Abbruch der Verbindung: der Dienst startet gerade
  return { reason: 'timeout', retry: true, detail }
}

/** Ein Probeaufruf an /healthz. Nur die Antwort „ok“ des Hashmark-Dienstes zählt (Render zeigt beim Aufwachen eine eigene Seite). */
async function probe(server: string): Promise<{ ok: true } | { ok: false; reason: Reason; retry: boolean; detail: string }> {
  try {
    const res = await fetch(server + '/healthz', { signal: AbortSignal.timeout(probeTimeout()), headers: { 'Cache-Control': 'no-cache' } })
    const text = (await res.text().catch(() => '')).trim()
    if (res.ok && text === 'ok') return { ok: true }
    if (res.status === 404) return { ok: false, reason: 'wrong', retry: false, detail: 'Status 404' }
    // 502/503/504 und Wartehinweis des Hosters: Dienst ist noch nicht da
    return { ok: false, reason: 'timeout', retry: true, detail: `Status ${res.status}` }
  } catch (e) {
    return { ok: false, ...classify(e) }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Sicherstellen, dass der Dienst antwortet. Render Free startet ihn erst beim ersten Aufruf (30 bis 60 s): Dann wird
 * wiederholt gefragt und der Zustand „Dienst wird gestartet“ angezeigt. Dauerhafte Fehler (Adresse, Zertifikat,
 * falscher Dienst) brechen sofort mit Grund ab, der Rest nach der Wartezeit.
 */
export async function ensureAwake(server: string): Promise<void> {
  const host = hostOf(server)
  const t0 = Date.now()
  setActivity({ phase: 'connecting', since: t0, label: `Verbinde mit ${host} …` })
  for (let attempt = 1; ; attempt++) {
    const r = await probe(server)
    if (r.ok) return
    if (!r.retry) throw failed(new ShareError(r.reason === 'wrong' ? 'config' : 'unreachable', explain(r.reason, host, r.detail), r.reason), t0)
    const waited = Date.now() - t0
    if (waited > wakeLimit()) throw failed(new ShareError('asleep', explain('timeout', host, `nach ${Math.round(waited / 1000)} Sekunden`), 'timeout'), t0)
    if (waited >= wakeAfter() || attempt > 1) setActivity({ phase: 'waking', since: t0, label: 'Der Dienst schläft und wird gestartet …' })
    await sleep(wakePoll())
  }
}

function failed(e: ShareError, since: number): ShareError {
  setActivity({ phase: 'failed', since, label: 'Verbindung fehlgeschlagen', reason: e.reason, message: e.message })
  return e
}

/** Aktion mit Anzeige: erst wecken, dann `fn`; am Ende ist die Anzeige wieder ruhig (außer bei Fehlern, die bleiben stehen) */
async function withDienst<T>(server: string, label: string, fn: () => Promise<T>): Promise<T> {
  await ensureAwake(server)
  const since = Date.now()
  setActivity({ phase: 'working', since, label })
  try {
    const r = await fn()
    setActivity(IDLE)
    return r
  } catch (e) {
    if (e instanceof ShareError) throw failed(e, since)
    setActivity(IDLE)
    throw e
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

/**
 * Adresse des Dienstes aus einer Eingabe machen: `localhost:10000`, `192.168.1.5:10000` oder `hashmark.onrender.com`.
 * Ohne Angabe gilt `http://` für lokale Namen und IP-Adressen, sonst `https://`. Pfad und Schrägstrich am Ende fallen weg.
 */
export function normalizeServer(input: string): string {
  const text = input.trim()
  if (!text) return ''
  const local = /^(localhost|\[[0-9a-f:]+\]|\d{1,3}(\.\d{1,3}){3}|[^./:]+)(:\d+)?(\/|$)/i.test(text.replace(/^[a-z]+:\/\//i, ''))
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `${local ? 'http' : 'https'}://${text}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Schema')
    return u.origin
  } catch {
    throw new ShareError('config', `Adresse „${input.trim()}“ ist ungültig. Beispiele: hashmark.onrender.com oder localhost:10000`)
  }
}

/** Adresse und Schlüssel des Dienstes merken. Leere Werte lassen das Gemerkte unverändert; `null` löscht es. */
export function setServer(server: string | null | undefined, key: string | null | undefined) {
  const c = loadConfig()
  if (server === null) c.server = undefined
  else if (server !== undefined && server.trim() !== '') c.server = normalizeServer(server)
  if (key === null) c.key = undefined
  else if (key !== undefined && key.trim() !== '') c.key = key.trim()
  saveConfig(c)
}

/** Gemerktes zuerst (was man im Dialog oder mit --server eingibt), dann die Umgebung, dann der Standard */
export function settings() {
  const c = loadConfig()
  const key = c.key ?? process.env.HASHMARK_SHARE_KEY
  return { server: normalizeServer(c.server ?? process.env.HASHMARK_SHARE_URL ?? DEFAULT_SERVER), key }
}

const linksOf = (r: Record_) => ({ view: `${r.server}/s/${r.id}/`, edit: `${r.server}/s/${r.id}/editor.html#k=${r.editToken}` })

async function call(server: string, route: string, init: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const { timeout = 60_000, ...rest } = init
  let res: Response
  try {
    res = await fetch(server + route, { ...rest, signal: AbortSignal.timeout(timeout) })
  } catch (e) {
    const c = classify(e)
    const host = hostOf(server)
    // Zeitüberschreitung: der Dienst schläft vermutlich (Render Free antwortet nach dem Schlaf erst nach bis zu einer Minute)
    if (c.retry) throw new ShareError('asleep', 'Der Dienst antwortet nicht (er schläft vermutlich und startet gerade)', 'timeout')
    throw new ShareError('unreachable', explain(c.reason, host, c.detail), c.reason)
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    // Render antwortet beim Aufwachen mit einer Wartehinweis-Seite, aber auch der Dienst selbst meldet 503, wenn er nichts annimmt
    const text = await res.text().catch(() => '')
    if (/SHARE_KEY/.test(text)) throw new ShareError('config', explain('unsupported', hostOf(server)), 'unsupported')
    throw new ShareError('asleep', 'Der Dienst startet gerade', 'timeout')
  }
  return res
}

/** Antwort des Dienstes mit Fehlerstatus in einen Fehler übersetzen. Ein 404 ohne unsere Meldung heißt: der Dienst kennt das Teilen nicht. */
async function fail(res: Response, server = ''): Promise<never> {
  let msg = res.statusText
  let known = false
  try { const e = ((await res.json()) as { error?: string }).error; if (e) { msg = e; known = true } } catch { /* kein JSON */ }
  const host = hostOf(server)
  if (res.status === 404) {
    if (!known && server) throw new ShareError('config', explain('unsupported', host), 'unsupported')
    throw new ShareError('gone', msg)
  }
  if (res.status === 401 || res.status === 403) throw new ShareError('denied', server ? explain('denied', host) + ` (${msg})` : msg, 'denied')
  if (res.status === 409) throw new ShareError('conflict', msg)
  throw new ShareError('server', msg, 'server')
}

const ownerHeaders = (r: Record_) => ({ 'X-Hashmark-Owner': r.ownerToken })

async function remoteManifest(r: Record_, timeout?: number): Promise<Record<string, string>> {
  const res = await call(r.server, `/api/sessions/${r.id}/manifest`, { headers: ownerHeaders(r), timeout })
  if (!res.ok) await fail(res, r.server)
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
    out.reason = e.reason
    return out
  }
  const states = Object.values(out.files).map((f) => f.state)
  out.state = states.includes('conflict') ? 'conflict' : states.includes('down') ? 'remote' : states.includes('up') ? 'local' : 'sync'
  return out
}

async function putFile(r: Record_, p: string, data: Buffer, ifMatch: string) {
  const res = await call(r.server, `/api/sessions/${r.id}/file?path=${encodeURIComponent(p)}`, { method: 'PUT', headers: { ...ownerHeaders(r), 'If-Match': ifMatch }, body: new Uint8Array(data) })
  if (!res.ok) await fail(res, r.server)
}

/** true = neu angelegt (oder wiederhergestellt), false = gab es schon */
async function createRemote(r: Record_, key: string): Promise<boolean> {
  const res = await call(r.server, `/api/sessions/${r.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ editToken: r.editToken, ownerToken: r.ownerToken }),
  })
  if (!res.ok) await fail(res, r.server)
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
  // Erst nach dem Anlegen merken: scheitert es (falsche Adresse, falscher Schlüssel), bleibt nichts Halbes zurück,
  // und die Adresse lässt sich im Dialog wieder ändern. Ein vorhandener Eintrag (Wiederherstellen) behält seine Adresse.
  const existing = cfg.decks[keyOf(deckDir)]
  const rec: Record_ = existing ?? { id: random(16), editToken: random(24), ownerToken: random(24), base: {}, server }
  // frisch angelegt oder wiederhergestellt: online ist leer, alles lokal ist neu. Gab es die Session noch, bleibt der Abgleichstand.
  const created = await withDienst(rec.server, 'Lege die Online-Kopie an …', () => createRemote(rec, key))
  if (created) rec.base = {}
  cfg.decks[keyOf(deckDir)] = rec
  saveConfig(cfg)
  await withDienst(rec.server, 'Lade die Dateien hoch …', () => pushInner(deckDir))
  return status(deckDir)
}

/** Neuere lokale Dateien hochladen (und neue, und gelöschte). Konflikte bleiben liegen. */
async function pushInner(deckDir: string, only?: string[]): Promise<{ pushed: string[]; skipped: string[] }> {
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
      if (!res.ok) await fail(res, rec.server)
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
async function pullInner(deckDir: string, only?: string[]): Promise<{ pulled: string[]; skipped: string[] }> {
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
  if (!res.ok) await fail(res, rec.server)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, Buffer.from(await res.arrayBuffer()))
}

/** Konflikt lösen: lokale Fassung nach online (`local`) oder Online-Fassung nach lokal (`remote`) */
async function resolveInner(deckDir: string, p: string, keep: 'local' | 'remote'): Promise<void> {
  const cfg = loadConfig()
  const rec = cfg.decks[keyOf(deckDir)]
  if (!rec) throw new ShareError('config', 'Dieses Deck ist nicht geteilt')
  const local = manifestOf(deckDir)
  const remote = await remoteManifest(rec)
  if (keep === 'local') {
    if (local[p] === undefined) {
      const res = await call(rec.server, `/api/sessions/${rec.id}/file?path=${encodeURIComponent(p)}`, { method: 'DELETE', headers: { ...ownerHeaders(rec), 'If-Match': remote[p] ?? 'none' } })
      if (!res.ok) await fail(res, rec.server)
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
async function stopInner(deckDir: string, rec: Record_): Promise<void> {
  const cfg = loadConfig()
  try {
    const res = await call(rec.server, `/api/sessions/${rec.id}`, { method: 'DELETE', headers: ownerHeaders(rec), timeout: 20_000 })
    if (!res.ok && res.status !== 404) await fail(res, rec.server)
  } catch (e) {
    if (!(e instanceof ShareError) || e.code === 'denied') throw e
    // Dienst nicht erreichbar: Online-Kopie verschwindet ohnehin beim nächsten Neustart
  }
  delete cfg.decks[keyOf(deckDir)]
  saveConfig(cfg)
}

function recOf(deckDir: string): Record_ {
  const rec = loadConfig().decks[keyOf(deckDir)]
  if (!rec) throw new ShareError('config', 'Dieses Deck ist nicht geteilt')
  return rec
}

/** Neuere lokale Dateien hochladen (und neue, und gelöschte). Konflikte bleiben liegen. */
export const push = (deckDir: string, only?: string[]) => withDienst(recOf(deckDir).server, 'Lade Änderungen hoch …', () => pushInner(deckDir, only))
/** Neuere Online-Dateien holen. Lokal geänderte (Konflikt) bleiben unangetastet. */
export const pull = (deckDir: string, only?: string[]) => withDienst(recOf(deckDir).server, 'Hole Änderungen …', () => pullInner(deckDir, only))
/** Konflikt lösen: lokale Fassung nach online (`local`) oder Online-Fassung nach lokal (`remote`) */
export const resolve = (deckDir: string, p: string, keep: 'local' | 'remote') => withDienst(recOf(deckDir).server, 'Löse den Konflikt …', () => resolveInner(deckDir, p, keep))

export const isShared = (deckDir: string): boolean => !!loadConfig().decks[keyOf(deckDir)]

/** Der Dienst hat eine andere Adresse bekommen (z. B. neuer Render-Name): dieselbe Session dort weiterführen */
export function retarget(deckDir: string, server: string): void {
  const cfg = loadConfig()
  const rec = cfg.decks[keyOf(deckDir)]
  if (!rec) throw new ShareError('config', 'Dieses Deck ist nicht geteilt')
  rec.server = normalizeServer(server)
  saveConfig(cfg)
}

/** Nur lokal vergessen, ohne den Dienst zu fragen (falsche Adresse, Dienst für immer weg). Die Online-Kopie, falls es sie gibt, bleibt dort liegen. */
export function forget(deckDir: string): void {
  const cfg = loadConfig()
  delete cfg.decks[keyOf(deckDir)]
  saveConfig(cfg)
}

/** Teilen beenden: Online-Kopie löschen (ist sie schon weg oder der Dienst nicht erreichbar, genügt das) und das lokale Merkblatt entfernen */
export async function stop(deckDir: string): Promise<void> {
  const cfg = loadConfig()
  const rec = cfg.decks[keyOf(deckDir)]
  if (!rec) return
  // schläft der Dienst, wird er für das Löschen nicht extra geweckt: die Online-Kopie verschwindet ohnehin beim nächsten Neustart
  await stopInner(deckDir, rec)
}

export { hashOf }

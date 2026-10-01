// Datei-API für den Editor (nur `hashmark edit`): Deck-Dateien lesen, schreiben, anlegen, Bilder hochladen.
// Schutz: nur localhost, nur mit Header X-Hashmark-Editor (erzwingt CORS-Preflight → keine fremden Seiten),
// nur Pfade innerhalb des Deck-Ordners und nur erlaubte Dateitypen.

import fs from 'node:fs/promises'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect } from 'vite'
import YAML from 'yaml'
import { IMAGE_MIME } from '../core/render.ts'

export const API_PREFIX = '/__hashmark'
const TEXT_EXT = /\.(md|ya?ml)$/i
const MAX_BODY = 25 * 1024 * 1024
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i

class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const toPosix = (p: string) => p.split(path.sep).join('/')

function inside(deckDir: string, rel: string | null): string {
  if (!rel) throw new HttpError(400, 'Pfad fehlt')
  const abs = path.resolve(deckDir, rel)
  const r = path.relative(deckDir, abs)
  if (!r || r.startsWith('..') || path.isAbsolute(r)) throw new HttpError(403, 'Pfad außerhalb des Decks')
  return abs
}

async function body(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw new HttpError(413, 'Datei zu groß')
    chunks.push(chunk as Buffer)
  }
  return Buffer.concat(chunks)
}

async function listFiles(deckDir: string) {
  const out: { path: string; kind: 'markdown' | 'yaml' | 'image' }[] = []
  const walk = async (dir: string) => {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue
      const abs = path.join(dir, e.name)
      if (e.isDirectory()) await walk(abs)
      else if (/\.md$/i.test(e.name)) out.push({ path: toPosix(path.relative(deckDir, abs)), kind: 'markdown' })
      else if (/\.ya?ml$/i.test(e.name)) out.push({ path: toPosix(path.relative(deckDir, abs)), kind: 'yaml' })
      else if (IMAGE_MIME[path.extname(e.name).toLowerCase()]) out.push({ path: toPosix(path.relative(deckDir, abs)), kind: 'image' })
    }
  }
  await walk(deckDir)
  return out.sort((a, b) => a.path.localeCompare(b.path, 'de'))
}

/** Neue Datei ins Manifest eintragen, falls es eine mount-Liste gibt (Kommentare bleiben erhalten). */
async function addToManifest(deckDir: string, rel: string) {
  const file = path.join(deckDir, 'deck.yaml')
  let text: string
  try { text = await fs.readFile(file, 'utf8') } catch { return false }
  const doc = YAML.parseDocument(text)
  const mount = doc.get('mount')
  if (!YAML.isSeq(mount)) return false
  mount.add(doc.createNode({ file: rel }))
  await fs.writeFile(file, doc.toString())
  return true
}

const APP_ACTIONS = new Set(['present', 'presenter', 'pdf', 'position', 'close'])

/**
 * Desktop-App: `POST /__hashmark/app` mit `{ action, … }` → an die App weiterreichen.
 * Gleicher Schutz wie die Datei-API: nur localhost, nur mit Header (erzwingt CORS-Preflight).
 */
export function appApi(onAction: (action: Record<string, unknown>) => void): Connect.NextHandleFunction {
  return async (req, res: ServerResponse, next) => {
    if (req.url?.split('?')[0] !== API_PREFIX + '/app') return next()
    const reply = (status: number, error?: string) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(error ? { error } : { ok: true }))
    }
    if (!LOCAL_HOST.test(req.headers.host ?? '') || req.headers['x-hashmark-editor'] !== '1') return reply(403, 'nicht erlaubt')
    if (req.method !== 'POST') return reply(405, 'nur POST')
    try {
      const data = JSON.parse((await body(req)).toString('utf8'))
      if (!data || typeof data !== 'object' || !APP_ACTIONS.has(data.action)) return reply(400, 'unbekannte Aktion')
      // nur einfache Werte weiterreichen
      const clean: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(data)) if (typeof v === 'string' && v.length < 2000) clean[k] = v
      onAction(clean)
      return reply(200)
    } catch {
      return reply(400, 'ungültige Anfrage')
    }
  }
}

export function editorApi(deckDir: string): Connect.NextHandleFunction {
  return async (req, res: ServerResponse, next) => {
    if (!req.url?.startsWith(API_PREFIX + '/')) return next()
    const send = (status: number, data: unknown, type = 'application/json') => {
      res.statusCode = status
      res.setHeader('Content-Type', type)
      res.setHeader('Cache-Control', 'no-store')
      res.end(type === 'application/json' ? JSON.stringify(data) : (data as string))
    }
    try {
      if (!LOCAL_HOST.test(req.headers.host ?? '')) throw new HttpError(403, 'Editor nur über localhost')
      if (req.headers['x-hashmark-editor'] !== '1') throw new HttpError(403, 'Header fehlt')

      const url = new URL(req.url, 'http://localhost')
      const route = url.pathname.slice(API_PREFIX.length)
      const rel = url.searchParams.get('path')

      if (route === '/files' && req.method === 'GET') {
        return send(200, { deck: path.basename(deckDir), files: await listFiles(deckDir) })
      }
      if (route === '/file' && req.method === 'GET') {
        const abs = inside(deckDir, rel)
        if (!TEXT_EXT.test(abs)) throw new HttpError(415, 'Nur .md/.yaml')
        return send(200, await fs.readFile(abs, 'utf8'), 'text/plain; charset=utf-8')
      }
      if (route === '/file' && req.method === 'PUT') {
        const abs = inside(deckDir, rel)
        if (!TEXT_EXT.test(abs)) throw new HttpError(415, 'Nur .md/.yaml')
        const text = (await body(req)).toString('utf8')
        // nur schreiben, wenn sich etwas ändert (sonst unnötiger Reload)
        const old = await fs.readFile(abs, 'utf8').catch(() => null)
        if (old !== text) await fs.writeFile(abs, text)
        return send(200, { ok: true })
      }
      if (route === '/new' && req.method === 'POST') {
        const abs = inside(deckDir, rel)
        if (!/\.md$/i.test(abs)) throw new HttpError(415, 'Neue Dateien müssen auf .md enden')
        const exists = await fs.stat(abs).then(() => true, () => false)
        if (exists) throw new HttpError(409, 'Datei existiert bereits')
        await fs.mkdir(path.dirname(abs), { recursive: true })
        const title = path.basename(abs, path.extname(abs)).replace(/^\d+[-_ ]*/, '').replace(/[-_]+/g, ' ')
        await fs.writeFile(abs, `# ${title.charAt(0).toUpperCase() + title.slice(1) || 'Neues Kapitel'}\n\n`)
        const mounted = await addToManifest(deckDir, toPosix(path.relative(deckDir, abs)))
        return send(200, { path: toPosix(path.relative(deckDir, abs)), mounted })
      }
      if (route === '/upload' && req.method === 'POST') {
        const name = (url.searchParams.get('name') ?? 'bild.png').replace(/[^\w.-]+/g, '-').replace(/^-+/, '') || 'bild.png'
        const ext = path.extname(name).toLowerCase()
        if (!IMAGE_MIME[ext]) throw new HttpError(415, 'Kein unterstütztes Bildformat')
        const dir = path.join(deckDir, 'bilder')
        await fs.mkdir(dir, { recursive: true })
        let target = path.join(dir, name)
        for (let i = 2; await fs.stat(target).then(() => true, () => false); i++) {
          target = path.join(dir, `${path.basename(name, ext)}-${i}${ext}`)
        }
        await fs.writeFile(target, await body(req))
        return send(200, { path: toPosix(path.relative(deckDir, target)) })
      }
      throw new HttpError(404, 'Unbekannte Route')
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500
      send(status, { error: (e as Error).message })
    }
  }
}

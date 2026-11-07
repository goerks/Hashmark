// Teilen-Schnittstelle des lokalen Editors: `/__hashmark/share/…`. Der Browser spricht nur mit dem lokalen Server,
// der lokale Server spricht mit dem Webdienst (Schlüssel und Token verlassen den Rechner nie Richtung Seite).
// Gleicher Schutz wie die Datei-API (localhost, Header, Ursprung).

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect } from 'vite'
import { HttpError, guard, type EditorApiOptions } from '../vite/editor-api.ts'
import * as share from './client.ts'

async function json(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const c of req) {
    size += (c as Buffer).length
    if (size > 64 * 1024) throw new HttpError(413, 'Anfrage zu groß')
    chunks.push(c as Buffer)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') } catch { throw new HttpError(400, 'Kein gültiges JSON') }
}

export function shareApi(deckDir: string, options: EditorApiOptions = {}): Connect.NextHandleFunction {
  const allowHost = options.allowHost ?? ((h: string) => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(h))
  return async (req, res: ServerResponse, next) => {
    const route = /^\/__hashmark\/share\/([a-z]+)(?:\?|$)/.exec(req.url ?? '')?.[1]
    if (!route) return next()
    const send = (status: number, data: unknown) => {
      res.statusCode = status
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.end(JSON.stringify(data))
    }
    try {
      guard(req, allowHost)
      if (route === 'status' && req.method === 'GET') return send(200, await share.status(deckDir))
      // was gerade geschieht (Dienst wird geweckt, lädt hoch …): ohne Netzzugriff, der Editor fragt es jede Sekunde
      if (route === 'activity' && req.method === 'GET') return send(200, share.getActivity())
      if (req.method !== 'POST') throw new HttpError(405, 'Nur POST')
      const body = await json(req)
      switch (route) {
        case 'config': {
          const server = typeof body.server === 'string' ? body.server : undefined
          share.setServer(server, typeof body.key === 'string' ? body.key : undefined)
          // ist das Deck schon geteilt, gilt die neue Adresse für diese Session (die alte Adresse war falsch oder hat sich geändert)
          if (server?.trim() && share.isShared(deckDir)) share.retarget(deckDir, server)
          return send(200, await share.status(deckDir))
        }
        case 'forget': share.forget(deckDir); return send(200, await share.status(deckDir))
        case 'start': await share.start(deckDir); return send(200, await share.status(deckDir))
        case 'push': await share.push(deckDir); return send(200, await share.status(deckDir))
        case 'pull': await share.pull(deckDir); return send(200, await share.status(deckDir))
        case 'resolve':
          if (typeof body.path !== 'string' || (body.keep !== 'local' && body.keep !== 'remote')) throw new HttpError(400, 'path und keep (local|remote) fehlen')
          await share.resolve(deckDir, body.path, body.keep)
          return send(200, await share.status(deckDir))
        case 'stop': await share.stop(deckDir); return send(200, await share.status(deckDir))
      }
      throw new HttpError(404, 'Unbekannte Route')
    } catch (e) {
      if (e instanceof HttpError) return send(e.status, { error: e.message })
      if (e instanceof share.ShareError) return send(e.code === 'asleep' ? 504 : e.code === 'conflict' ? 409 : 502, { error: e.message, code: e.code, reason: e.reason })
      send(500, { error: (e as Error).message })
    }
  }
}

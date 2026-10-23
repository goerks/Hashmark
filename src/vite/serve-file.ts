// Dateien ausliefern, mit Teilabrufen (Range): Browser brauchen sie, damit man in einem Video vorspulen kann.
// Gemeinsam für den Vite-Dev-Server und den Live-Server der Desktop-App bzw. des Webdienstes.

import fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * `Range: bytes=…` → Bereich in Bytes (beide Grenzen enthalten). `null` = kein brauchbarer Header, dann kommt die ganze Datei.
 * `'unsatisfiable'` = der Bereich liegt hinter dem Dateiende (Antwort 416). Mehrere Bereiche gelten als nicht brauchbar.
 */
export function parseRange(header: string | undefined, size: number): { start: number; end: number } | 'unsatisfiable' | null {
  const m = header?.match(/^bytes=(\d*)-(\d*)$/)
  if (!m || (m[1] === '' && m[2] === '')) return null
  let start: number
  let end: number
  if (m[1] === '') {
    // letzte N Bytes
    const n = Number(m[2])
    if (n === 0) return 'unsatisfiable'
    start = Math.max(0, size - n)
    end = size - 1
  } else {
    start = Number(m[1])
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  if (start >= size) return 'unsatisfiable'
  if (start > end) return null
  return { start, end }
}

export interface ServeOptions {
  /** Content-Type; fehlt er, setzt der Aufrufer ihn vorher selbst */
  type?: string
  cache?: string
}

/** Datei senden: ganz (200), als Teil (206) oder nur die Kopfzeilen (HEAD). */
export function serveFile(req: IncomingMessage, res: ServerResponse, file: string, options: ServeOptions = {}): void {
  let size: number
  try {
    size = fs.statSync(file).size
  } catch {
    res.statusCode = 404
    res.end()
    return
  }
  if (options.type) res.setHeader('Content-Type', options.type)
  if (options.cache) res.setHeader('Cache-Control', options.cache)
  res.setHeader('Accept-Ranges', 'bytes')

  const range = parseRange(req.headers.range, size)
  if (range === 'unsatisfiable') {
    res.statusCode = 416
    res.setHeader('Content-Range', `bytes */${size}`)
    res.end()
    return
  }
  const [start, end] = range ? [range.start, range.end] : [0, size - 1]
  if (range) {
    res.statusCode = 206
    res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
  }
  res.setHeader('Content-Length', size === 0 ? 0 : end - start + 1)
  if (req.method === 'HEAD' || size === 0) return void res.end()
  const stream = fs.createReadStream(file, { start, end })
  stream.on('error', () => res.destroy())
  res.on('close', () => stream.destroy())
  stream.pipe(res)
}

// Client für die Datei-API des Dev-Servers (src/vite/editor-api.ts).

export interface FileEntry { path: string; kind: 'markdown' | 'yaml' | 'image' | 'template' | 'style' }

export interface NewComponent { name: string; description?: string; attrs?: string[]; children?: boolean }

/** Beim Speichern war die Datei inzwischen geändert: `text` ist der Stand auf dem Server, `version` seine Version */
export class ConflictError extends Error {
  text: string
  version: string
  constructor(text: string, version: string) {
    super('Die Datei wurde inzwischen geändert.')
    this.text = text
    this.version = version
  }
}

export const NO_API = 'Keine Datei-API: Der Editor braucht den Server von `make edit` (nicht `make dev`).'

async function call(method: string, route: string, params: Record<string, string> = {}, body?: BodyInit, extra: Record<string, string> = {}): Promise<Response> {
  const query = new URLSearchParams(params).toString()
  const res = await fetch(`/__hashmark${route}${query ? `?${query}` : ''}`, { method, body, headers: { 'X-Hashmark-Editor': '1', ...extra } })
  if (res.status === 409) {
    const data = await res.json().catch(() => ({}))
    if (data.conflict) throw new ConflictError(String(data.text ?? ''), String(data.version ?? ''))
  }
  if (!res.ok) {
    let msg = res.statusText
    try { msg = (await res.json()).error ?? msg } catch { /* kein JSON */ }
    throw new Error(msg)
  }
  // ohne Datei-API (z. B. `make dev`) antwortet der Server mit der Startseite statt mit JSON/Text
  if ((res.headers.get('content-type') ?? '').includes('text/html')) throw new Error(NO_API)
  return res
}

export const api = {
  files: (): Promise<{ deck: string; files: FileEntry[] }> => call('GET', '/files').then((r) => r.json()),
  read: (path: string) => call('GET', '/file', { path }).then((r) => r.text()),
  /** Text samt Version der Datei (für die Konflikterkennung beim Speichern) */
  readFile: (path: string) => call('GET', '/file', { path }).then(async (r) => ({ text: await r.text(), version: r.headers.get('X-Hashmark-Version') ?? '' })),
  /** Speichert; `base` = Version, die der Editor zuletzt gesehen hat. Wirft `ConflictError`, wenn die Datei inzwischen anders ist. */
  write: (path: string, text: string, base = ''): Promise<{ version: string }> =>
    call('PUT', '/file', { path }, text, base ? { 'X-Hashmark-Base': base } : {}).then((r) => r.json()),
  create: (path: string): Promise<{ path: string; mounted: boolean }> => call('POST', '/new', { path }).then((r) => r.json()),
  /** Gerüst für eine Komponente anlegen (Vorlage und Gestaltung in components/) */
  createComponent: (input: NewComponent): Promise<{ template: string; style: string }> =>
    call('POST', '/new-component', {}, JSON.stringify(input)).then((r) => r.json()),
  /** PowerPoint-Datei vom Server rendern lassen (braucht Edge/Chrome auf dem Server) */
  pptx: (query: string) => call('GET', '/pptx', { query }).then((r) => r.blob()),
  upload: (file: File): Promise<{ path: string }> => call('POST', '/upload', { name: file.name || 'bild.png' }, file).then((r) => r.json()),
}

/** Pfad `target` (relativ zum Deck) relativ zur Datei `from` ausdrücken, z. B. "../bilder/x.png". */
export function relativeTo(from: string, target: string): string {
  const fromDir = from.split('/').slice(0, -1)
  const to = target.split('/')
  let i = 0
  while (i < fromDir.length && i < to.length - 1 && fromDir[i] === to[i]) i++
  return [...Array(fromDir.length - i).fill('..'), ...to.slice(i)].join('/')
}

// Gemeinsame Regeln fürs Teilen: welche Dateien eines Decks abgeglichen werden, wie Pfade geprüft und Inhalte
// verglichen werden. Lokal (Abgleich-Client) und im Webdienst (Sessions) gilt dasselbe, sonst liefe etwas auseinander.

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { VIDEO_MIME } from '../core/media.ts'

// Bewusst ohne core/render.ts und core/component-edit.ts (ziehen Markdown-Werkzeuge und Shiki nach): Der Sidecar der
// Desktop-App soll schnell starten. tests/share.test.ts prüft, dass die Listen mit denen aus render.ts übereinstimmen.
export const IMAGE_EXT = ['.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico', '.bmp']
export const COMPONENT_PATH = /(^|\/)components\/[^/]+\.(html|css)$/i

/** Einzelne Datei höchstens so groß (Videos sind online bewusst klein zu halten) */
export const MAX_FILE_BYTES = 25 * 1024 * 1024

const TEXT_EXT = /\.(md|ya?ml|css)$/i

/** Pfad eines Decks (POSIX, relativ): abgleichbar? Markdown, YAML, Stile, Komponenten, Bilder und Videos. Nie Punkt-Ordner. */
export function isSyncable(rel: string): boolean {
  if (!isSafeRel(rel)) return false
  const ext = path.posix.extname(rel).toLowerCase()
  return TEXT_EXT.test(rel) || COMPONENT_PATH.test(rel) || IMAGE_EXT.includes(ext) || ext in VIDEO_MIME
}

/** Relativer POSIX-Pfad ohne Ausbrechen, ohne Punkt-Ordner, ohne node_modules, ohne Sonderzeichen */
export function isSafeRel(rel: string): boolean {
  if (!rel || rel.length > 300 || rel.includes('\\') || rel.includes('\0') || rel.startsWith('/')) return false
  const parts = rel.split('/')
  return parts.every((p) => p !== '' && p !== '..' && !p.startsWith('.') && p !== 'node_modules')
}

export const hashOf = (data: Buffer | string): string => crypto.createHash('sha256').update(data).digest('hex').slice(0, 24)

/** Alle abgleichbaren Dateien eines Ordners: Pfad → Inhalts-Hash */
export function manifestOf(dir: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (abs: string, rel: string) => {
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(abs, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (e.name.startsWith('.') || e.name === 'node_modules') continue
      const r = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) walk(path.join(abs, e.name), r)
      else if (e.isFile() && isSyncable(r)) {
        try {
          const stat = fs.statSync(path.join(abs, e.name))
          if (stat.size <= MAX_FILE_BYTES) out[r] = hashOf(fs.readFileSync(path.join(abs, e.name)))
        } catch { /* Datei verschwunden */ }
      }
    }
  }
  walk(dir, '')
  return out
}

/** Datei unterhalb von `dir` (nie außerhalb) */
export function resolveIn(dir: string, rel: string): string {
  if (!isSafeRel(rel)) throw new Error(`Ungültiger Pfad: ${rel}`)
  const abs = path.resolve(dir, rel)
  const r = path.relative(dir, abs)
  if (!r || r.startsWith('..') || path.isAbsolute(r)) throw new Error(`Pfad außerhalb des Decks: ${rel}`)
  return abs
}

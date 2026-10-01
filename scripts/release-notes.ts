// Release-Notizen aus den Commit-Betreffzeilen seit dem vorherigen Tag (Markdown auf stdout).
//
//   node scripts/release-notes.ts [tag]      Standard: neuester Tag
//
// Vorrang hat die gemeinsam geprüfte Datei release-notes/<tag>.md (Vorschlag von Claude, Freigabe durch den Nutzer);
// nur ohne sie entsteht der automatische Entwurf aus den Commit-Betreffzeilen:
//
// Einteilung nach der Betreffzeile:
//   - Behobene Fehler: beginnt mit „Fix“/„Bugfix“/„Hotfix“ oder enthält „behoben“, „behebt“, „Fehler“, „Bug“
//   - Neue Funktionen: alles andere
//   - weggelassen: Merge-Commits, Präfix docs:/chore:/ci:/test:/style:, „[skip changelog]“
// Ein Präfix wie „feat:“ bzw. „Fix:“ wird aus der Anzeige entfernt.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export interface Notes { features: string[]; fixes: string[] }

const SKIP = /^(merge\b|(docs|chore|ci|test|style|build)(\([^)]*\))?!?:)|\[skip changelog\]/i
const FIX = /^(fix|bugfix|hotfix)(\([^)]*\))?!?:?\s|\b(behoben|behebt|behebung|fehler|bug)\b/i
const PREFIX = /^(feat|fix|bugfix|hotfix|perf|refactor)(\([^)]*\))?!?:\s*/i

/** Betreffzeilen in Funktionen und Fehlerbehebungen einteilen (Reihenfolge bleibt, Duplikate fallen weg) */
export function classify(subjects: string[]): Notes {
  const notes: Notes = { features: [], fixes: [] }
  for (const raw of subjects) {
    const subject = raw.trim()
    if (!subject || SKIP.test(subject)) continue
    const text = subject.replace(PREFIX, '').replace(/^./, (c) => c.toUpperCase())
    const list = FIX.test(subject) ? notes.fixes : notes.features
    if (!list.includes(text)) list.push(text)
  }
  return notes
}

export function render(notes: Notes, tag: string, previous: string | null): string {
  const lines = [`# Hashmark ${tag}`, '', previous ? `Änderungen seit ${previous}.` : 'Erste Version.', '']
  if (notes.features.length) lines.push('## Neue Funktionen', '', ...notes.features.map((s) => `- ${s}`), '')
  if (notes.fixes.length) lines.push('## Behobene Fehler', '', ...notes.fixes.map((s) => `- ${s}`), '')
  if (!notes.features.length && !notes.fixes.length) lines.push('Keine inhaltlichen Änderungen.', '')
  return lines.join('\n')
}

const git = (...a: string[]) => execFileSync('git', a, { encoding: 'utf8' }).trim()

if (import.meta.main) {
  const tag = process.argv[2] ?? git('describe', '--tags', '--abbrev=0')
  const curated = path.join(import.meta.dirname, '..', 'release-notes', `${tag}.md`)
  if (fs.existsSync(curated)) {
    process.stdout.write(fs.readFileSync(curated, 'utf8'))
    process.exit(0)
  }
  let previous: string | null = null
  try { previous = git('describe', '--tags', '--abbrev=0', `${tag}^`) } catch { /* erster Tag: gesamte Historie */ }
  const range = previous ? `${previous}..${tag}` : tag
  const subjects = git('log', range, '--no-merges', '--pretty=format:%s').split('\n')
  process.stdout.write(render(classify(subjects), tag, previous))
}

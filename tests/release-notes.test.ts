// Release-Notizen: Einteilung der Commit-Betreffzeilen in Funktionen und Fehlerbehebungen.
import { describe, expect, it } from 'vitest'
import { classify, render } from '../scripts/release-notes.ts'

describe('release-notes', () => {
  it('teilt nach Betreffzeile ein und entfernt Präfixe', () => {
    const n = classify([
      'Presenter-View mit Timer',
      'feat: Suche mit Ctrl+K',
      'Fix: Überlauf bei Tabellen',
      'Titel-Bug auf Ebene 2 behoben',
      'Merge branch main',
      'docs: README ergänzt',
      '[skip changelog] Tippfehler',
      'Presenter-View mit Timer',
    ])
    expect(n.features).toEqual(['Presenter-View mit Timer', 'Suche mit Ctrl+K'])
    expect(n.fixes).toEqual(['Überlauf bei Tabellen', 'Titel-Bug auf Ebene 2 behoben'])
  })

  it('rendert Abschnitte nur, wenn sie Einträge haben', () => {
    const md = render({ features: ['A'], fixes: [] }, 'v1.1.0', 'v1.0.0')
    expect(md).toContain('Änderungen seit v1.0.0.')
    expect(md).toContain('## Neue Funktionen')
    expect(md).not.toContain('## Behobene Fehler')
    expect(render({ features: [], fixes: [] }, 'v1.0.0', null)).toContain('Erste Version.')
  })
})

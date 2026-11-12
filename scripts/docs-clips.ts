// Drehbuch der Anleitungs-Clips (Ticket #90). scripts/make-clips.ts spielt es in der echten App ab und nimmt es auf.
// Die Seiten der Doku (docs-landing.ts, docs-features.ts) binden die Clips über ihren Namen ein; fehlt ein Clip, zeigen sie ihr Bild.
//
// Ein Clip läuft auf einem Deck aus examples/ (hier: anleitung-demo, bewusst stabil). Jeder Schritt drückt optional eine Taste
// (sichtbar als Tastenkappe), blendet eine Einblendung ein und wartet dann `wait` Millisekunden.

export interface ClipStep {
  /** Taste (KeyboardEvent.key), z. B. ArrowRight; ohne Taste nur Einblendung und Warten */
  key?: string
  /** Einblendung unten im Bild */
  say?: string
  /** Wartezeit nach dem Schritt in ms */
  wait: number
}

export interface Clip {
  /** Dateiname ohne Endung: <name>.webm, <name>.mp4, <name>.jpg (Standbild) */
  name: string
  /** Ordner in examples/ */
  deck: string
  width: number
  height: number
  /** Beschreibung für alt-Text und Titel */
  title: string
  steps: ClipStep[]
}

export const CLIPS: Clip[] = [
  {
    name: 'baum-navigation',
    deck: 'anleitung-demo',
    width: 960,
    height: 540,
    title: 'Im Baum navigieren: → erzählt weiter, ↓ taucht ins Detail ab, ↑ kehrt zurück',
    steps: [
      { say: 'Eine Präsentation ist ein Baum aus Überschriften', wait: 2400 },
      { key: 'ArrowRight', say: '→ erzählt auf dem Hauptpfad weiter', wait: 2200 },
      { key: 'ArrowDown', say: '↓ taucht ins Detail ab', wait: 2400 },
      { key: 'ArrowUp', say: '↑ führt zurück auf den Hauptpfad', wait: 2200 },
      { key: 'ArrowRight', say: '→ weiter mit dem nächsten Kapitel', wait: 2200 },
      { key: 'ArrowRight', say: 'Du entscheidest im Vortrag, wohin es geht', wait: 2600 },
    ],
  },
]

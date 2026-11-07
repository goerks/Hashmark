// Zeilenvergleich für den Editor (Ticket #52): zeigt bei einem Speicherkonflikt, was sich zwischen der Datei und dem
// eigenen Stand unterscheidet. Rein, ohne Abhängigkeiten.

export interface DiffLine {
  /** `del` = nur in der alten Fassung, `add` = nur in der neuen */
  type: 'same' | 'add' | 'del'
  text: string
}

/** Über dieser Größe (Zeilen alt × neu) wird nicht mehr genau verglichen, sondern grob: gleicher Anfang und Schluss, dazwischen alles ersetzt */
const MAX_CELLS = 4_000_000

/** Vergleicht zwei Texte zeilenweise (längste gemeinsame Teilfolge, Anfang und Schluss vorab abgetrennt) */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split('\n')
  const b = newText.split('\n')
  let start = 0
  while (start < a.length && start < b.length && a[start] === b[start]) start++
  let endA = a.length
  let endB = b.length
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB-- }

  const out: DiffLine[] = a.slice(0, start).map((text) => ({ type: 'same', text }))
  const midA = a.slice(start, endA)
  const midB = b.slice(start, endB)

  if (midA.length * midB.length > MAX_CELLS) {
    out.push(...midA.map((text) => ({ type: 'del' as const, text })), ...midB.map((text) => ({ type: 'add' as const, text })))
  } else {
    // Tabelle der Längen der gemeinsamen Teilfolgen, von hinten
    const n = midA.length
    const m = midB.length
    const len: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) len[i][j] = midA[i] === midB[j] ? len[i + 1][j + 1] + 1 : Math.max(len[i + 1][j], len[i][j + 1])
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (midA[i] === midB[j]) { out.push({ type: 'same', text: midA[i] }); i++; j++ }
      else if (len[i + 1][j] >= len[i][j + 1]) out.push({ type: 'del', text: midA[i++] })
      else out.push({ type: 'add', text: midB[j++] })
    }
    while (i < n) out.push({ type: 'del', text: midA[i++] })
    while (j < m) out.push({ type: 'add', text: midB[j++] })
  }
  out.push(...a.slice(endA).map((text) => ({ type: 'same' as const, text })))
  return out
}

/** Anzahl geänderter Zeilen: `del` (nur alt) und `add` (nur neu) */
export function diffCounts(diff: DiffLine[]): { del: number; add: number } {
  return { del: diff.filter((l) => l.type === 'del').length, add: diff.filter((l) => l.type === 'add').length }
}

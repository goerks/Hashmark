// Neues Deck-Gerüst anlegen (make new, Desktop-App „Neues Deck“).

import fs from 'node:fs'
import path from 'node:path'

export class ScaffoldError extends Error {}

/** Legt deck.yaml und zwei Beispieldateien an. Der Ordner darf fehlen oder muss leer sein. */
export function scaffoldDeck(dir: string): string[] {
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) throw new ScaffoldError(`Ordner ${dir} existiert bereits und ist nicht leer.`)
  const title = path.basename(path.resolve(dir))
  const files: Record<string, string> = {
    'deck.yaml': `title: ${title}\ntheme: minimal        # minimal | dark-tech | ./eigenes.css | Objekt mit tokens/layouts/css (README)\nmaxDepth: 3\nmount:\n  - file: 01-start.md\n  - file: 02-hauptteil.md\n`,
    '01-start.md': `# ${title} {layout=title}\n\nUntertitel\n\n::: notes\nBegrüßung – S öffnet die Presenter-View.\n:::\n`,
    '02-hauptteil.md': `# Hauptteil {layout=section}\n\nKurze Einleitung – ↓ taucht in die Details ab.\n\n## Detail A\n\n- Punkt 1\n- Punkt 2\n\n## Detail B\n\n\`\`\`ts {title="beispiel.ts"}\nconst hallo = 'Welt'\n\`\`\`\n`,
  }
  fs.mkdirSync(dir, { recursive: true })
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content)
  return Object.keys(files)
}

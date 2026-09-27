// Legt ein neues Deck-Gerüst an: make new DECK=decks/mein-vortrag
import fs from 'node:fs'
import path from 'node:path'

const dir = process.argv[2]
if (!dir) {
  console.error('Aufruf: make new DECK=pfad/zum/deck')
  process.exit(1)
}
if (fs.existsSync(dir) && fs.readdirSync(dir).length) {
  console.error(`Ordner ${dir} existiert bereits und ist nicht leer.`)
  process.exit(1)
}
const title = path.basename(dir)
const files: Record<string, string> = {
  'deck.yaml': `title: ${title}\ntheme: minimal        # minimal | dark-tech | ./eigenes.css\nmaxDepth: 3\nmount:\n  - file: 01-start.md\n  - file: 02-hauptteil.md\n`,
  '01-start.md': `# ${title} {layout=title}\n\nUntertitel\n`,
  '02-hauptteil.md': `# Hauptteil {layout=section}\n\nKurze Einleitung – ↓ taucht in die Details ab.\n\n## Detail A\n\n- Punkt 1\n- Punkt 2\n\n## Detail B\n\n\`\`\`ts {title="beispiel.ts"}\nconst hallo = 'Welt'\n\`\`\`\n`,
}
fs.mkdirSync(dir, { recursive: true })
for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content)
console.log(`Deck angelegt: ${dir}\nStarten mit: make dev DECK=${dir.split(path.sep).join('/')}`)

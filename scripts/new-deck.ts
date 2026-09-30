// Legt ein neues Deck-Gerüst an: make new DECK=decks/mein-vortrag
import path from 'node:path'
import { ScaffoldError, scaffoldDeck } from '../src/cli/scaffold.ts'

const dir = process.argv[2]
if (!dir) {
  console.error('Aufruf: make new DECK=pfad/zum/deck')
  process.exit(1)
}
try {
  scaffoldDeck(dir)
} catch (e) {
  if (!(e instanceof ScaffoldError)) throw e
  console.error(e.message)
  process.exit(1)
}
console.log(`Deck angelegt: ${dir}\nStarten mit: make dev DECK=${dir.split(path.sep).join('/')}`)

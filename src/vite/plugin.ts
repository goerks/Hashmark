// Vite-Plugin: liefert den Deck-Baum als virtuelles Modul und pusht Änderungen per HMR.

import fs from 'node:fs'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { loadDeck, type LoadResult } from '../core/deck.ts'
import { ASSET_PREFIX } from '../core/render.ts'

export const DECK_ID = 'virtual:strata/deck'
export const THEME_ID = 'virtual:strata/theme.css'
const RESOLVED_DECK = '\0strata-deck'
const MIME: Record<string, string> = {
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif',
}

/** Payload für den Client: entweder ein Deck oder eine Fehlermeldung. */
type Payload = { deck: LoadResult['deck'] } | { error: string }

export interface StrataOptions {
  deckDir: string
  /** Bilder als Data-URI in den Deck-Baum einbetten (Single-File-Export) */
  inlineAssets?: boolean
}

export function strata(options: StrataOptions): Plugin {
  const deckDir = path.resolve(options.deckDir)
  let current: Promise<LoadResult> = loadDeck(deckDir)
  let lastTheme: string | undefined

  const payload = async (): Promise<Payload> => {
    try {
      return { deck: (await current).deck }
    } catch (e) {
      return { error: (e as Error).message }
    }
  }

  async function reload(server: ViteDevServer) {
    current = loadDeck(deckDir)
    const mod = server.moduleGraph.getModuleById(RESOLVED_DECK)
    if (mod) server.moduleGraph.invalidateModule(mod)
    const data = await payload()
    const theme = await current.then((r) => r.themePath, () => lastTheme)
    if (theme !== lastTheme) {
      lastTheme = theme
      server.ws.send({ type: 'full-reload' })
      return
    }
    server.ws.send({ type: 'custom', event: 'strata:deck', data })
    const msg = 'error' in data ? `Fehler: ${data.error}` : `Deck neu geladen (${data.deck.nodes.length} Kapitel)`
    server.config.logger.info(`[strata] ${msg}`, { timestamp: true })
  }

  return {
    name: 'strata',
    enforce: 'pre',

    async resolveId(id) {
      if (id === DECK_ID) return RESOLVED_DECK
      if (id === THEME_ID) {
        const r = await current.catch(() => undefined)
        lastTheme = r?.themePath ?? path.join(import.meta.dirname, '../runtime/themes/minimal.css')
        return lastTheme
      }
    },

    async load(id) {
      if (id !== RESOLVED_DECK) return
      let json = JSON.stringify(await payload())
      if (options.inlineAssets) json = inlineAssets(json, deckDir, (msg) => this.warn(msg))
      return `export default ${json}`
    },

    configureServer(server) {
      server.watcher.add(deckDir)
      let timer: NodeJS.Timeout | undefined
      const onFile = (file: string) => {
        const rel = path.relative(deckDir, file)
        if (rel.startsWith('..') || !/\.(md|ya?ml)$/i.test(file)) return
        clearTimeout(timer)
        timer = setTimeout(() => reload(server), 50)
      }
      server.watcher.on('change', onFile).on('add', onFile).on('unlink', onFile)

      // Bilder aus dem Deck-Ordner ausliefern
      server.middlewares.use('/' + ASSET_PREFIX.slice(0, -1), (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '')
        const file = path.resolve(deckDir, rel)
        if (path.relative(deckDir, file).startsWith('..') || !fs.existsSync(file)) return next()
        const type = MIME[path.extname(file).toLowerCase()]
        if (type) res.setHeader('Content-Type', type)
        fs.createReadStream(file).pipe(res)
      })
    },

    async buildStart() {
      await current // Fehler brechen den Build ab
    },

    async generateBundle() {
      if (options.inlineAssets) return
      for (const asset of (await current).assets) {
        if (!fs.existsSync(asset)) {
          this.warn(`Bild nicht gefunden: ${path.relative(deckDir, asset)}`)
          continue
        }
        this.emitFile({
          type: 'asset',
          fileName: ASSET_PREFIX + path.relative(deckDir, asset).split(path.sep).join('/'),
          source: fs.readFileSync(asset),
        })
      }
    },
  }
}

/** Ersetzt `deck-assets/…`-Verweise im Deck-JSON durch Data-URIs. */
function inlineAssets(json: string, deckDir: string, warn: (msg: string) => void): string {
  // im JSON endet der Pfad am escapten Anführungszeichen (\") bzw. an ")" in style-URLs
  const pattern = new RegExp(ASSET_PREFIX + String.raw`([^"\\)\s]+)`, 'g')
  return json.replace(pattern, (match, rel: string) => {
    const file = path.resolve(deckDir, decodeURIComponent(rel))
    if (path.relative(deckDir, file).startsWith('..') || !fs.existsSync(file)) {
      warn(`Bild nicht gefunden: ${rel}`)
      return match
    }
    const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
    return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`
  })
}

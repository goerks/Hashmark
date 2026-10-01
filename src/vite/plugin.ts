// Vite-Plugin: liefert den Deck-Baum als virtuelles Modul und pusht Änderungen per HMR.

import fs from 'node:fs'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { listExamples } from '../cli/examples.ts'
import { realPath } from '../cli/paths.ts'
import { loadDeck, type LoadResult } from '../core/deck.ts'
import { ASSET_PREFIX, IMAGE_MIME, toDataUri } from '../core/render.ts'
import { editorApi } from './editor-api.ts'

export const DECK_ID = 'virtual:hashmark/deck'
export const THEME_ID = 'virtual:hashmark/theme.css'
const RESOLVED_DECK = '\0hashmark-deck'
const RESOLVED_THEME = '\0hashmark-theme.css'

/** Payload für den Client: entweder ein Deck oder eine Fehlermeldung. */
type Payload = { deck: LoadResult['deck'] } | { error: string }

export interface HashmarkOptions {
  deckDir: string
  /** Bilder als Data-URI in den Deck-Baum einbetten (Single-File-Export) */
  inlineAssets?: boolean
  /** Datei-API für den Editor aktivieren (nur `hashmark edit`, nur localhost) */
  editor?: boolean
  /** Dev-Server: Ordner mit Beispiel-Decks, zwischen denen die Seite umschalten darf (`make dev` ohne `DECK=`) */
  examples?: string
}

export function hashmark(options: HashmarkOptions): Plugin {
  let deckDir = path.resolve(options.deckDir)
  let current: Promise<LoadResult> = loadDeck(deckDir)
  let lastTheme: string | undefined
  let themeFiles: string[] = []

  const payload = async (): Promise<Payload> => {
    try {
      return { deck: (await current).deck }
    } catch (e) {
      return { error: (e as Error).message }
    }
  }

  const logWarnings = (log: (msg: string) => void) =>
    current.then((r) => r.warnings.forEach((w) => log(`[hashmark] ${w}`)), () => {})

  async function reload(server: ViteDevServer) {
    current = loadDeck(deckDir)
    const mod = server.moduleGraph.getModuleById(RESOLVED_DECK)
    if (mod) server.moduleGraph.invalidateModule(mod)
    const data = await payload()
    const r = await current.catch(() => undefined)
    themeFiles = r?.themeFiles ?? themeFiles
    server.watcher.add(themeFiles)
    if (r && r.themeCss !== lastTheme) {
      lastTheme = r.themeCss
      const themeMod = server.moduleGraph.getModuleById(RESOLVED_THEME)
      if (themeMod) server.moduleGraph.invalidateModule(themeMod)
      server.ws.send({ type: 'full-reload' })
      return
    }
    server.ws.send({ type: 'custom', event: 'hashmark:deck', data })
    const msg = 'error' in data ? `Fehler: ${data.error}` : `Deck neu geladen (${data.deck.nodes.length} Kapitel)`
    server.config.logger.info(`[hashmark] ${msg}`, { timestamp: true })
    logWarnings((m) => server.config.logger.warn(m, { timestamp: true }))
  }

  return {
    name: 'hashmark',
    enforce: 'pre',

    async resolveId(id) {
      if (id === DECK_ID) return RESOLVED_DECK
      if (id === THEME_ID) return RESOLVED_THEME
    },

    async load(id) {
      if (id === RESOLVED_THEME) {
        const r = await current.catch(() => undefined)
        lastTheme = r?.themeCss ?? ''
        themeFiles = r?.themeFiles ?? []
        return lastTheme
      }
      if (id !== RESOLVED_DECK) return
      let json = JSON.stringify(await payload())
      if (options.inlineAssets) json = inlineAssets(json, deckDir, (msg) => this.warn(msg))
      return `export default ${json}`
    },

    configureServer(server) {
      server.watcher.add(deckDir)
      current.then((r) => server.watcher.add(r.themeFiles), () => {})
      if (options.editor) server.middlewares.use(editorApi(deckDir))
      if (options.examples) {
        const root = options.examples
        // GET: Liste + aktuelles Deck; POST {name}: Deck wechseln (nur Ordner aus der Liste), danach lädt die Seite neu
        server.middlewares.use('/__hashmark/examples', (req, res) => {
          const send = (status: number, data: unknown) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)) }
          const examples = listExamples(root)
          const currentName = examples.find((e) => e.dir === realPath(deckDir))?.name
          if (req.method !== 'POST') return send(200, { current: currentName, examples: examples.map(({ name, title }) => ({ name, title })) })
          let raw = ''
          req.on('data', (c) => { raw += c })
          req.on('end', async () => {
            const target = examples.find((e) => { try { return e.name === JSON.parse(raw).name } catch { return false } })
            if (!target) return send(400, { error: 'Unbekanntes Beispiel' })
            deckDir = target.dir
            server.watcher.add(deckDir)
            await reload(server)
            send(200, { current: target.name })
          })
        })
      }
      logWarnings((m) => server.config.logger.warn(m))
      let timer: NodeJS.Timeout | undefined
      const onFile = (file: string) => {
        const rel = path.relative(deckDir, file)
        const isTheme = /\.css$/i.test(file) && themeFiles.some((t) => file === t || !path.relative(t, file).startsWith('..'))
        if (!isTheme && (rel.startsWith('..') || !/\.(md|ya?ml)$/i.test(file))) return
        clearTimeout(timer)
        timer = setTimeout(() => reload(server), 50)
      }
      server.watcher.on('change', onFile).on('add', onFile).on('unlink', onFile)

      // Bilder aus dem Deck-Ordner ausliefern
      server.middlewares.use('/' + ASSET_PREFIX.slice(0, -1), (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '')
        const file = path.resolve(deckDir, rel)
        if (path.relative(deckDir, file).startsWith('..') || !fs.existsSync(file)) return next()
        const type = IMAGE_MIME[path.extname(file).toLowerCase()]
        if (type) res.setHeader('Content-Type', type)
        fs.createReadStream(file).pipe(res)
      })
    },

    async buildStart() {
      await current // Fehler brechen den Build ab
      await logWarnings((m) => this.warn(m))
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
    return toDataUri(file)
  })
}

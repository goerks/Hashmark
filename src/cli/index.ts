#!/usr/bin/env node
// CLI: strata dev | build | preview

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cac from 'cac'
import { build, createServer, preview, type InlineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { strata } from '../vite/plugin.ts'

const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const RUNTIME_DIR = path.join(PROJECT_ROOT, 'src/runtime')

function config(deckDir: string, extra: InlineConfig = {}): InlineConfig {
  const dir = path.resolve(deckDir)
  return {
    configFile: false,
    root: RUNTIME_DIR,
    base: './',
    cacheDir: path.join(PROJECT_ROOT, 'node_modules/.vite'),
    plugins: [svelte({ configFile: false }), strata({ deckDir: dir })],
    server: { fs: { allow: [PROJECT_ROOT, dir] } },
    build: { chunkSizeWarningLimit: 4000 },
    ...extra,
  }
}

const cli = cac('strata')

cli
  .command('dev [deck]', 'Dev-Server mit Hot Reload starten')
  .option('--port <port>', 'Port', { default: 3030 })
  .option('--open', 'Browser öffnen')
  .action(async (deck = '.', opts: { port: number; open?: boolean }) => {
    const server = await createServer(config(deck, { server: { port: Number(opts.port), open: opts.open, fs: { allow: [PROJECT_ROOT, path.resolve(deck)] } } }))
    await server.listen()
    server.printUrls()
    server.bindCLIShortcuts({ print: true })
  })

cli
  .command('build [deck]', 'Statisches HTML bauen')
  .option('--out <dir>', 'Ausgabeordner', { default: 'dist' })
  .action(async (deck = '.', opts: { out: string }) => {
    await build(config(deck, { build: { outDir: path.resolve(opts.out), emptyOutDir: true, chunkSizeWarningLimit: 4000 } }))
  })

cli
  .command('preview [deck]', 'Gebautes Deck lokal ausliefern')
  .option('--out <dir>', 'Ausgabeordner des Builds', { default: 'dist' })
  .option('--port <port>', 'Port', { default: 4173 })
  .action(async (deck = '.', opts: { out: string; port: number }) => {
    const server = await preview(config(deck, { build: { outDir: path.resolve(opts.out) }, preview: { port: Number(opts.port) } }))
    server.printUrls()
  })

cli.help()
cli.parse()

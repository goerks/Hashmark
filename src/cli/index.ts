#!/usr/bin/env node
// CLI: strata dev | build | preview | export

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import cac from 'cac'
import { build, createServer, preview, type InlineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { strata, type StrataOptions } from '../vite/plugin.ts'
import { exportSingleFile } from './export.ts'
import { exportPdf } from './pdf.ts'
import { printQuery } from '../core/print.ts'

const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url))
const RUNTIME_DIR = path.join(PROJECT_ROOT, 'src/runtime')

function config(deckDir: string, extra: InlineConfig = {}, plugin: Partial<StrataOptions> = {}): InlineConfig {
  const dir = path.resolve(deckDir)
  return {
    configFile: false,
    root: RUNTIME_DIR,
    base: './',
    cacheDir: path.join(PROJECT_ROOT, 'node_modules/.vite'),
    plugins: [svelte({ configFile: false }), strata({ deckDir: dir, ...plugin })],
    build: { chunkSizeWarningLimit: 4000 },
    ...extra,
    server: { fs: { allow: [PROJECT_ROOT, dir] }, ...extra.server },
  }
}

/** `--host` ohne Wert = alle Netzwerk-Interfaces, sonst die angegebene Adresse */
const hostOf = (host: string | boolean | undefined) => (host === '' || host === true ? true : host || undefined)

const cli = cac('strata')

cli
  .command('dev [deck]', 'Dev-Server mit Hot Reload starten')
  .option('--port <port>', 'Port', { default: 3030 })
  .option('--host [host]', 'Im Netzwerk erreichbar machen (ohne Wert: alle Interfaces)')
  .option('--open', 'Browser öffnen')
  .action(async (deck = '.', opts: { port: number; host?: string | boolean; open?: boolean }) => {
    const server = await createServer(config(deck, { server: { port: Number(opts.port), host: hostOf(opts.host), open: opts.open } }))
    await server.listen()
    server.printUrls()
    server.bindCLIShortcuts({ print: true })
  })

cli
  .command('edit [deck]', 'Editor starten: links Markdown, rechts Live-Vorschau (nur localhost)')
  .option('--port <port>', 'Port', { default: 3030 })
  .option('--no-open', 'Browser nicht öffnen')
  .action(async (deck = '.', opts: { port: number; open: boolean }) => {
    // bewusst ohne --host: die Datei-API darf nur lokal erreichbar sein
    const server = await createServer(config(deck, {
      server: { port: Number(opts.port), host: 'localhost', open: opts.open ? '/editor.html' : false },
    }, { editor: true }))
    await server.listen()
    const url = server.resolvedUrls?.local[0]
    server.config.logger.info(`\n  Editor:        ${url}editor.html\n  Präsentation:  ${url}\n`)
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
  .option('--host [host]', 'Im Netzwerk erreichbar machen (ohne Wert: alle Interfaces)')
  .action(async (deck = '.', opts: { out: string; port: number; host?: string | boolean }) => {
    const server = await preview(config(deck, {
      build: { outDir: path.resolve(opts.out) },
      preview: { port: Number(opts.port), host: hostOf(opts.host) },
    }))
    server.printUrls()
  })

cli
  .command('export [deck]', 'Eine einzelne HTML-Datei erzeugen (läuft offline per Doppelklick)')
  .option('--out <file>', 'Zieldatei (Standard: export/<deck>.html)')
  .action(async (deck = '.', opts: { out?: string }) => {
    const out = path.resolve(opts.out ?? path.join('export', `${path.basename(path.resolve(deck))}.html`))
    await exportSingleFile(config(deck, {}, { inlineAssets: true }), out)
  })

cli
  .command('pdf [deck]', 'PDF erzeugen (nutzt installiertes Edge/Chrome, offline)')
  .option('--out <file>', 'Zieldatei (Standard: export/<deck>.pdf)')
  .option('--depth <n>', 'nur bis Ebene n (1 = Hauptpfad)')
  .option('--steps', 'jeder Schritt eine eigene Seite')
  .option('--notes', 'Handout: A4 hoch mit Sprechernotizen')
  .option('--no-footer', 'ohne Breadcrumb und Seitenzahl')
  .option('--browser <path>', 'Pfad zu Edge/Chrome (sonst automatisch, oder STRATA_BROWSER)')
  .action(async (deck = '.', opts: { out?: string; depth?: string; steps?: boolean; notes?: boolean; footer: boolean; browser?: string }) => {
    const name = path.basename(path.resolve(deck)) + (opts.notes ? '-handout' : '')
    const out = path.resolve(opts.out ?? path.join('export', `${name}.pdf`))
    const query = printQuery({ depth: opts.depth ? Number(opts.depth) : undefined, steps: opts.steps, notes: opts.notes, footer: opts.footer })
    await exportPdf(config(deck), { out, query, browser: opts.browser })
  })

cli.help()
cli.parse()

#!/usr/bin/env node
// CLI: hashmark dev | edit | serve | build | preview | export | pdf | check

import path from 'node:path'
import cac from 'cac'
import { build, createServer, preview } from 'vite'
import { PROJECT_ROOT, config } from './config.ts'
import { exportSingleFile, mediaSink } from './export.ts'
import { checkDeck, formatFinding } from './check.ts'
import { exportPdf } from './pdf.ts'
import { exportPptx } from './pptx.ts'
import { serve } from './serve.ts'
import { printQuery } from '../core/print.ts'

/** `--host` ohne Wert = alle Netzwerk-Interfaces, sonst die angegebene Adresse */
const hostOf = (host: string | boolean | undefined) => (host === '' || host === true ? true : host || undefined)

const cli = cac('hashmark')

cli
  .command('dev [deck]', 'Dev-Server mit Hot Reload starten')
  .option('--port <port>', 'Port', { default: 3030 })
  .option('--host [host]', 'Im Netzwerk erreichbar machen (ohne Wert: alle Interfaces)')
  .option('--open', 'Browser öffnen')
  .option('--examples', 'Auswahl der Beispiel-Decks (examples/) in der Seite anbieten')
  .action(async (deck = '.', opts: { port: number; host?: string | boolean; open?: boolean; examples?: boolean }) => {
    const server = await createServer(config(deck, { server: { port: Number(opts.port), host: hostOf(opts.host), open: opts.open } }, opts.examples ? { examples: path.join(PROJECT_ROOT, 'examples') } : {}))
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
  .command('serve [deck]', 'Webdienst (Docker/Render): Präsentation öffentlich, Editor mit Passwort (EDITOR_PASSWORD)')
  .option('--port <port>', 'Port (Standard: $PORT oder 3030)')
  .option('--host <host>', 'Adresse', { default: '0.0.0.0' })
  .option('--seed <dir>', 'Deck, das in einen leeren Deck-Ordner kopiert wird')
  .action(async (deck = process.env.DECK_DIR ?? '.', opts: { port?: string; host: string; seed?: string }) => {
    await serve({
      deck,
      seed: opts.seed ?? process.env.DECK_SEED,
      reseed: process.env.DECK_SEED_RESET === '1',
      host: opts.host,
      port: Number(opts.port ?? process.env.PORT ?? 3030),
      editorUser: process.env.EDITOR_USER || undefined,
      editorPassword: process.env.EDITOR_PASSWORD || undefined,
      siteDir: process.env.SITE_DIR || undefined,
    })
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
    const media = mediaSink(out)
    await exportSingleFile(config(deck, {}, { inlineAssets: true, media }), out, media)
  })

cli
  .command('pdf [deck]', 'PDF erzeugen (nutzt installiertes Edge/Chrome, offline)')
  .option('--out <file>', 'Zieldatei (Standard: export/<deck>.pdf)')
  .option('--depth <n>', 'nur bis Ebene n (1 = Hauptpfad)')
  .option('--steps', 'jeder Schritt eine eigene Seite')
  .option('--notes', 'Handout: A4 hoch mit Sprechernotizen')
  .option('--plan <modus>', 'Reihenfolge nach dem Vortragsplan: path (nur Pfad) oder grouped (Pfad, Optionales, Anhang)')
  .option('--no-footer', 'ohne Breadcrumb und Seitenzahl')
  .option('--browser <path>', 'Pfad zu Edge/Chrome (sonst automatisch, oder HASHMARK_BROWSER)')
  .action(async (deck = '.', opts: { out?: string; depth?: string; steps?: boolean; notes?: boolean; plan?: string; footer: boolean; browser?: string }) => {
    const name = path.basename(path.resolve(deck)) + (opts.notes ? '-handout' : '')
    const out = path.resolve(opts.out ?? path.join('export', `${name}.pdf`))
    const query = printQuery({ depth: opts.depth ? Number(opts.depth) : undefined, steps: opts.steps, notes: opts.notes, footer: opts.footer, plan: opts.plan === 'path' || opts.plan === 'grouped' ? opts.plan : undefined })
    await exportPdf(config(deck), { out, query, browser: opts.browser })
  })

cli
  .command('pptx [deck]', 'PowerPoint-Datei (.pptx) erzeugen: Text, Listen, Code und Tabellen bleiben bearbeitbar (nutzt Edge/Chrome, offline)')
  .option('--out <file>', 'Zieldatei (Standard: export/<deck>.pptx)')
  .option('--depth <n>', 'nur bis Ebene n (1 = Hauptpfad)')
  .option('--steps', 'jeder Schritt eine eigene Folie (statt Animationen)')
  .option('--no-animations', 'Schritte nicht als PowerPoint-Animationen exportieren (Endzustand)')
  .option('--plan <modus>', 'Reihenfolge nach dem Vortragsplan: path (nur Pfad) oder grouped (Pfad, Optionales, Anhang)')
  .option('--footer', 'mit Breadcrumb und Seitenzahl')
  .option('--browser <path>', 'Pfad zu Edge/Chrome (sonst automatisch, oder HASHMARK_BROWSER)')
  .action(async (deck = '.', opts: { out?: string; depth?: string; steps?: boolean; animations: boolean; plan?: string; footer?: boolean; browser?: string }) => {
    const out = path.resolve(opts.out ?? path.join('export', `${path.basename(path.resolve(deck))}.pptx`))
    const query = printQuery({ depth: opts.depth ? Number(opts.depth) : undefined, steps: opts.steps, footer: !!opts.footer, plan: opts.plan === 'path' || opts.plan === 'grouped' ? opts.plan : undefined }) + (opts.animations ? '' : '&anim=0')
    await exportPptx(config(deck), { out, query, browser: opts.browser })
  })

cli
  .command('check [deck]', 'Deck prüfen: Layouts, Attribute, Bilder, Theme und Überlauf der Folien (Exit-Code 1 bei Fehlern)')
  .option('--no-overflow', 'nur statisch prüfen, ohne Browser (schnell)')
  .option('--browser <path>', 'Pfad zu Edge/Chrome (sonst automatisch, oder HASHMARK_BROWSER)')
  .option('--strict', 'auch Hinweise gelten als Fehler')
  .action(async (deck = '.', opts: { overflow: boolean; browser?: string; strict?: boolean }) => {
    const findings = await checkDeck(deck, { overflow: opts.overflow, browser: opts.browser })
    for (const f of findings) console.log(formatFinding(f))
    const errors = findings.filter((f) => f.level === 'error').length
    const hints = findings.length - errors
    console.log(findings.length ? `\n${errors} Fehler, ${hints} Hinweise` : '[hashmark] Alles in Ordnung')
    if (errors || (opts.strict && hints)) process.exitCode = 1
  })

cli.help()
cli.parse()

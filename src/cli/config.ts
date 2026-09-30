// Gemeinsame Vite-Konfiguration für CLI (strata dev/build/…) und Desktop-App.

import path from 'node:path'
import type { InlineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { strata, type StrataOptions } from '../vite/plugin.ts'
import { strataLive } from '../vite/live-plugin.ts'
import { PROJECT_ROOT, RUNTIME_DIR, realPath } from './paths.ts'

export { PROJECT_ROOT, RUNTIME_DIR, realPath }

export interface ConfigOptions {
  /** Ablage für vorgebündelte Abhängigkeiten (Standard: node_modules/.vite im Projekt) */
  cacheDir?: string
}

/**
 * Vorgebaute Runtime der Desktop-App (Präsentation, Editor, Presenter, Druckansicht) – unabhängig vom Deck.
 * Wird vom Live-Server ausgeliefert, deshalb `base: '/'`.
 */
export function liveConfig(outDir: string, opts: ConfigOptions = {}): InlineConfig {
  return {
    configFile: false,
    root: RUNTIME_DIR,
    base: '/',
    logLevel: 'warn',
    cacheDir: opts.cacheDir ?? path.join(PROJECT_ROOT, 'node_modules/.vite'),
    plugins: [svelte({ configFile: false }), strataLive()],
    build: {
      outDir,
      emptyOutDir: true,
      chunkSizeWarningLimit: 100_000,
      rolldownOptions: { input: { index: path.join(RUNTIME_DIR, 'index.html'), editor: path.join(RUNTIME_DIR, 'editor.html') } },
    },
  }
}

export function config(deckDir: string, extra: InlineConfig = {}, plugin: Partial<StrataOptions> = {}, opts: ConfigOptions = {}): InlineConfig {
  const dir = realPath(deckDir)
  return {
    configFile: false,
    root: RUNTIME_DIR,
    base: './',
    cacheDir: opts.cacheDir ?? path.join(PROJECT_ROOT, 'node_modules/.vite'),
    plugins: [svelte({ configFile: false }), strata({ deckDir: dir, ...plugin })],
    build: { chunkSizeWarningLimit: 4000 },
    ...extra,
    server: { fs: { allow: [PROJECT_ROOT, dir] }, ...extra.server },
  }
}

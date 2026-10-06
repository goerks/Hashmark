import { defineConfig } from 'vitest/config'

// Tests laden echte Decks (Shiki, KaTeX, Mermaid-Quellen) und laufen parallel: unter Last reichen die 5 s Standard nicht immer
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], testTimeout: 30_000, hookTimeout: 30_000 },
})

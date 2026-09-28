<script lang="ts">
  import { onMount, tick } from 'svelte'
  import initial from 'virtual:strata/deck'
  import { Navigator } from '../core/navigator.ts'
  import { printPages, printQuery, type PrintOptions } from '../core/print.ts'
  import type { DeckNode } from '../core/types.ts'
  import Slide from './Slide.svelte'

  let { options, autoprint }: { options: PrintOptions; autoprint: boolean } = $props()

  const deck = 'deck' in initial ? initial.deck : null
  const error = 'error' in initial ? initial.error : null
  const nav = new Navigator(deck?.nodes ?? [])
  const pages = $derived(deck ? printPages(deck.nodes, options) : [])
  const maxDepth = $derived(deck ? Math.max(1, ...[...nav.walk()].map((n) => n.depth)) : 1)

  let root: HTMLElement
  let ready = $state(false)
  let fit = $state(1)

  const layoutOf = (n: DeckNode) => n.attrs.layout ?? deck?.layout ?? 'default'
  /** Titel als h1…h6 nach Tiefe → hierarchische PDF-Lesezeichen; Folgeseiten ohne Überschrift */
  const titleTag = (n: DeckNode, first: boolean) => (first ? `h${Math.min(n.depth, 6)}` : 'div')

  function update(patch: Partial<PrintOptions>) {
    location.search = printQuery({ ...options, ...patch })
  }

  /** Warten, bis Diagramme, Bilder und Schriften fertig sind – erst dann ist die Seite druckbereit. */
  async function waitUntilRendered() {
    await tick()
    const deadline = Date.now() + 30_000
    while (root.querySelector('.mermaid-block:not([data-rendered])') && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 100))
    }
    await Promise.all([...root.querySelectorAll('img')].map((img) => img.decode().catch(() => {})))
    await document.fonts.ready
  }

  /** Querverweise (#backend/db) auf volle IDs umschreiben → im PDF klickbare interne Links */
  function resolveLinks() {
    for (const a of root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
      const target = nav.find(decodeURI(a.getAttribute('href')!.slice(1)).replace(/:\d+$/, ''))
      if (target) a.setAttribute('href', `#${encodeURI(target.id)}`)
    }
  }

  onMount(() => {
    const measure = () => (fit = Math.min(1, (window.innerWidth - 48) / (options.notes ? 794 : 1280)))
    measure()
    window.addEventListener('resize', measure)
    document.title = `${deck?.title ?? 'Strata'} – Druckansicht`
    document.documentElement.classList.add(options.notes ? 'print-handout' : 'print-slides')
    // Seitenformat: Folien 16:9 (1280 × 720 px = 13,33 × 7,5 Zoll), Handout A4 hoch
    const page = document.createElement('style')
    page.textContent = options.notes ? '@page { size: A4 portrait; margin: 12mm }' : '@page { size: 1280px 720px; margin: 0 }'
    document.head.append(page)
    ;(async () => {
      await waitUntilRendered()
      resolveLinks()
      ready = true
      // Signal für `strata pdf` (Headless-Browser)
      document.documentElement.dataset.printReady = '1'
      if (autoprint) window.print()
    })()
    return () => window.removeEventListener('resize', measure)
  })
</script>

<div class="print-root" bind:this={root} style="--fit:{fit}">
  <header class="print-bar">
    <strong>{deck?.title ?? 'Strata'}</strong>
    <span class="print-count">{pages.length} Seiten</span>
    <label>
      Tiefe
      <select value={Number.isFinite(options.depth) ? String(options.depth) : 'all'}
        onchange={(e) => update({ depth: e.currentTarget.value === 'all' ? Infinity : Number(e.currentTarget.value) })}>
        <option value="all">alle Ebenen</option>
        {#each { length: maxDepth } as _, i (i)}
          <option value={String(i + 1)}>bis Ebene {i + 1}{i === 0 ? ' (Hauptpfad)' : ''}</option>
        {/each}
      </select>
    </label>
    <label><input type="checkbox" checked={options.steps} onchange={(e) => update({ steps: e.currentTarget.checked })} /> jeder Schritt eine Seite</label>
    <label><input type="checkbox" checked={options.notes} onchange={(e) => update({ notes: e.currentTarget.checked })} /> Handout mit Notizen</label>
    <label><input type="checkbox" checked={options.footer} onchange={(e) => update({ footer: e.currentTarget.checked })} /> Fußzeile</label>
    <button class="print-go" disabled={!ready} onclick={() => window.print()}>{ready ? 'Drucken / PDF' : 'Rendert …'}</button>
    <span class="print-hint">Im Druckdialog: Ziel „Als PDF speichern“, Ränder „Keine“, Kopf- und Fußzeilen aus.</span>
  </header>

  {#if error}
    <p class="print-error">Deck-Fehler: {error}</p>
  {/if}

  {#each pages as page, i (`${page.node.id}:${page.slide}:${page.step}`)}
    <article class="print-page" id={page.first ? page.node.id : undefined}>
      <div class="print-slide">
        <div class="print-stage">
          <Slide node={page.node} slide={page.slide} step={page.step} layout={layoutOf(page.node)} titleTag={titleTag(page.node, page.first)} />
          {#if options.footer}
            <div class="print-crumb">{page.trail.map((t) => t.title).join(' › ')}</div>
            <div class="print-num">{i + 1} / {pages.length}</div>
          {/if}
        </div>
      </div>
      {#if options.notes}
        <div class="print-notes">
          {#if page.first && page.node.notes}{@html page.node.notes}{:else if page.first}<p class="print-empty">Keine Notizen</p>{/if}
        </div>
      {/if}
    </article>
  {/each}
</div>

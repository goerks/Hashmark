<script lang="ts">
  import { onMount } from 'svelte'
  import initial from 'virtual:strata/deck'
  import { Navigator } from '../core/navigator.ts'
  import { printPages, printQuery, type PrintOptions } from '../core/print.ts'
  import PrintPages from './PrintPages.svelte'

  let { options, autoprint }: { options: PrintOptions; autoprint: boolean } = $props()

  const deck = 'deck' in initial ? initial.deck : null
  const error = 'error' in initial ? initial.error : null
  const count = $derived(deck ? printPages(deck.nodes, options).length : 0)
  const maxDepth = $derived(deck ? Math.max(1, ...[...new Navigator(deck.nodes).walk()].map((n) => n.depth)) : 1)

  let ready = $state(false)
  let fit = $state(1)

  function update(patch: Partial<PrintOptions>) {
    location.search = printQuery({ ...options, ...patch })
  }

  function onready() {
    if (ready) return
    ready = true
    // Signal für `strata pdf` (Headless-Browser)
    document.documentElement.dataset.printReady = '1'
    if (autoprint) window.print()
  }

  onMount(() => {
    const measure = () => (fit = Math.min(1, (window.innerWidth - 48) / (options.notes ? 794 : 1280)))
    measure()
    window.addEventListener('resize', measure)
    document.title = `${deck?.title ?? 'Strata'} – Druckansicht`
    // Seitenformat: Folien 16:9 (1280 × 720 px = 13,33 × 7,5 Zoll), Handout A4 hoch
    const page = document.createElement('style')
    page.textContent = options.notes ? '@page { size: A4 portrait; margin: 12mm }' : '@page { size: 1280px 720px; margin: 0 }'
    document.head.append(page)
    return () => window.removeEventListener('resize', measure)
  })
</script>

<div class="print-root print-view {options.notes ? 'print-handout' : 'print-slides'}" style="--fit:{fit}">
  <header class="print-bar">
    <strong>{deck?.title ?? 'Strata'}</strong>
    <span class="print-count">{count} Seiten</span>
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
    <span class="print-hint">Im Druckdialog: Ziel „Als PDF speichern“; unter „Seiten“ lässt sich ein Bereich wählen, z. B. 5-12.</span>
  </header>

  {#if error}
    <p class="print-error">Deck-Fehler: {error}</p>
  {/if}
  {#if deck}<PrintPages {deck} {options} {onready} />{/if}
</div>

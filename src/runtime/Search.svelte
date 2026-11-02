<script lang="ts">
  import { onMount } from 'svelte'
  import { buildSearchIndex, search, type SearchHit } from '../core/search.ts'
  import type { Position } from '../core/navigator.ts'
  import type { DeckNode } from '../core/types.ts'

  // Suche / Sprung (Ctrl+K bzw. /): Titel, Pfad und Folientext, Pfeiltasten + Enter springt.

  let { nodes, onjump, onclose }: {
    nodes: DeckNode[]
    onjump: (pos: Position) => void
    onclose: () => void
  } = $props()

  const index = $derived(buildSearchIndex(nodes))
  let query = $state('')
  let selected = $state(0)
  let input: HTMLInputElement
  let list = $state<HTMLElement>()

  /** ohne Anfrage: alle Kapitel und Details als Inhaltsverzeichnis */
  const hits = $derived<SearchHit[]>(
    query.trim() ? search(index, query) : index.filter((e) => e.slide === 0).map((e) => ({ ...e, score: 0 })),
  )

  $effect(() => {
    void query
    selected = 0
  })

  $effect(() => {
    list?.querySelector(`[data-hit="${selected}"]`)?.scrollIntoView({ block: 'nearest' })
  })

  function choose(i: number) {
    const hit = hits[i]
    if (hit) onjump({ id: hit.id, slide: hit.slide })
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onclose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); selected = Math.min(hits.length - 1, selected + 1); return }
    if (e.key === 'ArrowUp') { e.preventDefault(); selected = Math.max(0, selected - 1); return }
    if (e.key === 'Enter') { e.preventDefault(); choose(selected) }
  }

  onMount(() => input.focus())
</script>

<div class="search" role="dialog" aria-modal="true" aria-label="Suche" tabindex="-1"
  onclick={(e) => e.target === e.currentTarget && onclose()} onkeydown={() => {}}>
  <div class="sr-panel">
    <input
      bind:this={input}
      bind:value={query}
      {onkeydown}
      class="sr-input"
      type="search"
      placeholder="Folie suchen – Titel oder Inhalt …"
      aria-label="Suchbegriff"
      autocomplete="off"
      spellcheck="false"
    />
    <ul class="sr-list" bind:this={list} role="listbox">
      {#each hits as hit, i (`${hit.id}:${hit.slide}`)}
        <li role="option" aria-selected={i === selected}>
          <button class="sr-hit" class:selected={i === selected} data-hit={i}
            onclick={() => choose(i)} onmouseenter={() => (selected = i)}>
            <span class="sr-title">
              {#if !query.trim()}<span class="sr-indent" style:width="{hit.trail.length * 18}px"></span>{/if}
              {#if hit.num}<span class="sr-num">{hit.num}</span> {/if}{hit.title}{#if hit.slide > 0}<span class="sr-sub"> · Folie {hit.slide + 1}</span>{/if}
            </span>
            {#if hit.trail.length && query.trim()}<span class="sr-trail">{hit.trail.join(' › ')}</span>{/if}
            {#if hit.snippet}<span class="sr-snippet">{hit.snippet}</span>{/if}
          </button>
        </li>
      {:else}
        <li class="sr-empty">Keine Treffer</li>
      {/each}
    </ul>
    <div class="sr-foot">↑ ↓ wählen · Enter springt · Esc schließt</div>
  </div>
</div>

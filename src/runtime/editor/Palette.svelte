<script lang="ts" module>
  export interface PaletteItem {
    group: string
    title: string
    detail?: string
    run: () => void
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte'
  import { fold } from '../../core/vocab.ts'

  let { items, only = '', onclose }: { items: PaletteItem[]; only?: string; onclose: () => void } = $props()

  let query = $state('')
  let index = $state(0)
  let input: HTMLInputElement
  let list: HTMLElement

  const shown = $derived.by(() => {
    const q = fold(query)
    return items
      .filter((i) => (!only || i.group === only) && (!q || fold(`${i.title} ${i.detail ?? ''} ${i.group}`).includes(q)))
      .slice(0, 60)
  })
  const current = $derived(Math.min(index, Math.max(0, shown.length - 1)))

  function run(i: number) {
    const item = shown[i]
    onclose()
    item?.run()
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); index = Math.min(shown.length - 1, current + 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); index = Math.max(0, current - 1) }
    else if (e.key === 'Enter') { e.preventDefault(); run(current) }
    else if (e.key === 'Escape') { e.preventDefault(); onclose() }
  }

  $effect(() => {
    current
    list?.querySelector(`[data-i="${current}"]`)?.scrollIntoView({ block: 'nearest' })
  })

  onMount(() => input.focus())
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="pal" onpointerdown={(e) => e.target === e.currentTarget && onclose()}>
  <div class="pal-box" role="dialog" aria-label="Befehle, Folien und Bausteine">
    <input
      bind:this={input}
      bind:value={query}
      oninput={() => (index = 0)}
      {onkeydown}
      placeholder={only ? `${only} einfügen …` : 'Folie suchen, Baustein einfügen, Aktion …'}
      aria-label="Suchen"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
    />
    <div class="pal-list" bind:this={list} role="listbox">
      {#each shown as item, i (item.group + item.title + i)}
        {#if i === 0 || shown[i - 1].group !== item.group}<div class="pal-g">{item.group}</div>{/if}
        <div
          class="pal-i"
          class:on={i === current}
          role="option"
          aria-selected={i === current}
          data-i={i}
          onpointerdown={(e) => { e.preventDefault(); run(i) }}
        >
          <span>{item.title}</span>{#if item.detail}<small>{item.detail}</small>{/if}
        </div>
      {:else}
        <div class="pal-g">Nichts gefunden</div>
      {/each}
    </div>
  </div>
</div>

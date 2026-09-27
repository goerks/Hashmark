<script lang="ts">
  import type { DeckNode } from '../core/types.ts'

  let { nodes, current, trail, onjump, onclose }: {
    nodes: DeckNode[]
    current: string
    /** IDs der Vorfahren des aktuellen Knotens */
    trail: string[]
    onjump: (id: string) => void
    onclose: () => void
  } = $props()

  let panel: HTMLElement
  $effect(() => {
    panel.querySelector('.current')?.scrollIntoView({ block: 'center' })
  })
</script>

{#snippet tree(list: DeckNode[])}
  <ul>
    {#each list as node (node.id)}
      <li>
        <button
          class:current={node.id === current}
          class:trail={trail.includes(node.id)}
          data-depth={node.depth}
          onclick={() => onjump(node.id)}
        >
          <span class="ov-title">{node.title}</span>
          {#if node.slides.length > 1}<span class="ov-meta">{node.slides.length} Folien</span>{/if}
        </button>
        {#if node.children.length}{@render tree(node.children)}{/if}
      </li>
    {/each}
  </ul>
{/snippet}

<div class="overview" role="dialog" aria-label="Übersicht" tabindex="-1" onclick={(e) => e.target === e.currentTarget && onclose()} onkeydown={() => {}}>
  <div class="overview-panel" bind:this={panel}>
    <div class="overview-head">
      <strong>Übersicht</strong>
      <span class="hint">Klick springt · O / Esc schließt</span>
    </div>
    <div class="overview-tree">{@render tree(nodes)}</div>
  </div>
</div>

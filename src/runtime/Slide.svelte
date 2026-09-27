<script lang="ts">
  import type { DeckNode } from '../core/types.ts'
  import { renderMermaid } from './mermaid.ts'

  let { node, slide, layout }: { node: DeckNode; slide: number; layout: string } = $props()

  let el: HTMLElement
  const html = $derived(node.slides[slide]?.html ?? '')
  const showTiles = $derived(layout === 'section' && node.children.length > 0 && !html.includes('data-children'))

  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  const tiles = (children: DeckNode[]) =>
    children
      .map((c) => `<a class="tile" href="#${encodeURI(c.id)}"><span class="tile-title">${escape(c.title)}</span>${
        c.children.length ? `<span class="tile-count">${c.children.length} Details</span>` : ''}</a>`)
      .join('')

  $effect(() => {
    void html
    // `::: children` als Kacheln füllen, Diagramme rendern
    for (const slot of el.querySelectorAll<HTMLElement>('[data-children]')) slot.innerHTML = tiles(node.children)
    renderMermaid(el)
  })
</script>

<section class="slide layout-{layout} {node.attrs.class ?? ''}" data-depth={node.depth} bind:this={el}>
  {#if layout === 'title'}
    <div class="title-wrap">
      <h1 class="slide-title">{node.title}</h1>
      <div class="content">{@html html}</div>
    </div>
  {:else}
    <header><h1 class="slide-title">{node.title}</h1></header>
    <div class="content">{@html html}</div>
    {#if showTiles}
      <div class="d-children">{@html tiles(node.children)}</div>
    {/if}
  {/if}
</section>

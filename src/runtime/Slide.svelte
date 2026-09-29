<script lang="ts">
  import { untrack } from 'svelte'
  import type { DeckNode } from '../core/types.ts'
  import { renderMermaid } from './mermaid.ts'

  let { node, slide, layout, step = Infinity, titleTag = 'h1' }: {
    node: DeckNode
    slide: number
    layout: string
    /** abgespielte Schritte; Infinity = alles sichtbar (z. B. Miniaturen) */
    step?: number
    /** Element des Titels, z. B. h2 im PDF (Lesezeichen-Hierarchie) oder div für Folgeseiten */
    titleTag?: string
  } = $props()

  let el: HTMLElement
  const html = $derived(node.slides[slide]?.html ?? '')
  const showTiles = $derived(layout === 'section' && node.children.length > 0 && !html.includes('data-children'))

  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  const tiles = (children: DeckNode[]) =>
    children
      .map((c) => `<a class="tile" href="#${encodeURI(c.id)}"><span class="tile-title">${escape(c.title)}</span>${
        c.children.length ? `<span class="tile-count">${c.children.length} Details</span>` : ''}</a>`)
      .join('')

  /** Element mit `data-step="k"` ist ab Schritt k sichtbar, mit `data-until="m"` nur bis vor Schritt m. */
  function applySteps(root: HTMLElement, current: number) {
    for (const item of root.querySelectorAll<HTMLElement>('[data-step]')) {
      const from = Number(item.dataset.step)
      const until = item.dataset.until ? Number(item.dataset.until) : Infinity
      const visible = current >= from && current < until
      item.classList.toggle('step-hidden', !visible)
      item.classList.toggle('step-current', visible && from === current && from > 0)
    }
    // Code `lines="2-3|5|all"`: Abschnitt k ab Schritt k; danach bleibt der letzte stehen
    for (const pre of root.querySelectorAll<HTMLElement>('pre[data-hl-count]')) {
      const active = Math.min(current, Number(pre.dataset.hlCount) - 1)
      const all = (pre.dataset.hlAll ?? '').includes(` ${active} `)
      pre.classList.toggle('hl-active', !all)
      for (const line of pre.querySelectorAll<HTMLElement>('.line')) {
        line.classList.toggle('hl', !all && (line.dataset.hl ?? '').includes(` ${active} `))
      }
    }
  }

  $effect(() => {
    void html
    // `::: children` als Kacheln füllen, Diagramme rendern (neue SVGs danach ebenfalls ein-/ausblenden)
    for (const slot of el.querySelectorAll<HTMLElement>('[data-children]')) slot.innerHTML = tiles(node.children)
    untrack(() => applySteps(el, step))
    renderMermaid(el).then(() => untrack(() => applySteps(el, step)))
  })

  $effect(() => {
    applySteps(el, step)
  })
</script>

<section
  class="slide layout-{layout} {node.attrs.class ?? ''}"
  class:has-bg={!!node.attrs.bg}
  data-depth={node.depth}
  style:background={node.attrs.bg}
  style:--bg-dim={node.attrs.bgdim}
  bind:this={el}
>
  {#if layout === 'title' || layout === 'statement'}
    <div class="title-wrap">
      <svelte:element this={titleTag} class="slide-title">{node.title}</svelte:element>
      <div class="content">{@html html}</div>
    </div>
  {:else}
    <header><svelte:element this={titleTag} class="slide-title">{node.title}</svelte:element></header>
    <div class="content">{@html html}</div>
    {#if showTiles}
      <div class="d-children">{@html tiles(node.children)}</div>
    {/if}
  {/if}
</section>

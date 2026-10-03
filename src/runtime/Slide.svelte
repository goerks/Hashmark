<script lang="ts">
  import { untrack } from 'svelte'
  import type { DeckNode } from '../core/types.ts'
  import { renderMermaid } from './mermaid.ts'
  import { MIN_ZOOM, fitSlide } from './fit.ts'

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
  const fit = $derived(!!node.attrs.fit && !['false', 'off', 'no'].includes(node.attrs.fit.toLowerCase()))
  // Überlauf-Hinweis nur beim Schreiben (Dev-Server, Editor-Vorschau), nie im Vortrag oder Export
  const showOverflow = import.meta.env.DEV || window.parent !== window
  let overflow = $state(false)
  let zoom = $state(1)
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

  function measure() {
    const r = fitSlide(el, fit)
    overflow = r.overflow
    zoom = r.zoom
  }

  $effect(() => {
    void html
    void layout
    void fit
    // `::: children` als Kacheln füllen, Diagramme rendern (neue SVGs danach ebenfalls ein-/ausblenden)
    for (const slot of el.querySelectorAll<HTMLElement>('[data-children]')) slot.innerHTML = tiles(node.children)
    untrack(() => { applySteps(el, step); measure() })
    // Diagramme und Schriften ändern die Größe erst nach dem Laden: danach neu messen
    renderMermaid(el).then(() => untrack(() => { applySteps(el, step); measure() }))
    void document.fonts?.ready.then(() => untrack(measure))
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
  style:--banner-h={node.attrs.bannerh ? (/^[\d.]+$/.test(node.attrs.bannerh) ? node.attrs.bannerh + 'px' : node.attrs.bannerh) : undefined}
  data-fit={zoom < 1 ? zoom : undefined}
  data-overflow={overflow ? '' : undefined}
  bind:this={el}
>
  {#if overflow && showOverflow}
    <span class="overflow-badge" title={fit ? `Der Inhalt passt auch bei ${Math.round(MIN_ZOOM * 100)} % nicht: kürzen oder auf mehrere Folien verteilen` : 'Der Inhalt ist höher oder breiter als die Folie: kürzen, auf mehrere Folien verteilen (---) oder {fit} an die Überschrift setzen'}>Überlauf</span>
  {/if}
  {#if node.attrs.banner}
    <div class="slide-banner" style:background-image={node.attrs.banner} style:background-position={node.attrs.bannerpos}></div>
  {/if}
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
  {#if node.footer}
    <footer class="slide-footer">
      <span class="footer-text">{node.footer.text ?? ''}</span>
      <span class="footer-number">{node.footer.number ? node.footer.number.replace('{n}', String((node.slideNo ?? 1) + slide)) : ''}</span>
    </footer>
  {/if}
</section>

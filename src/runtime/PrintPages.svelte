<script lang="ts">
  import { tick } from 'svelte'
  import { Navigator } from '../core/navigator.ts'
  import { PLAN_LABEL, type PlanStates } from '../core/plan.ts'
  import { printPages, type PrintOptions } from '../core/print.ts'
  import type { Deck, DeckNode } from '../core/types.ts'
  import Slide from './Slide.svelte'

  // Die druckbaren Seiten eines Decks – genutzt von der Druckansicht (?print)
  // und unsichtbar von der Präsentation (damit Ctrl+P alle Folien druckt).
  let { deck, options, states = {}, onready }: { deck: Deck; options: PrintOptions; states?: PlanStates; onready?: () => void } = $props()

  const nav = $derived(new Navigator(deck.nodes, { states }))
  const pages = $derived(printPages(deck.nodes, options, nav))

  let root: HTMLElement

  const layoutOf = (n: DeckNode) => n.layout ?? n.attrs.layout ?? deck.layout ?? 'default'
  /** Titel als h1…h6 nach Tiefe → hierarchische PDF-Lesezeichen; Folgeseiten ohne Überschrift */
  const titleTag = (n: DeckNode, first: boolean) => (first ? `h${Math.min(n.depth, 6)}` : 'div')

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

  $effect(() => {
    void pages
    let cancelled = false
    ;(async () => {
      await waitUntilRendered()
      if (cancelled) return
      resolveLinks()
      onready?.()
    })()
    return () => { cancelled = true }
  })
</script>

<div class="print-pages" bind:this={root}>
  {#each pages as page, i (`${page.node.id}:${page.slide}:${page.step}`)}
    <article class="print-page" id={page.first ? page.node.id : undefined} data-node={page.node.id} data-sub={page.slide} data-step={page.step}
      data-title={page.node.title} data-transition={page.node.attrs.transition ?? (page.node.depth > 1 && page.first ? 'zoom' : 'slide')} data-depth={page.node.depth} data-section={page.trail[0]?.title ?? page.node.title}>
      <div class="print-slide">
        <div class="print-stage">
          <Slide node={page.node} slide={page.slide} step={page.step} layout={layoutOf(page.node)} titleTag={titleTag(page.node, page.first)} />
          <!-- eine im Deck eingestellte Fußzeile (deck.yaml: footer/slideNumber) ersetzt die Druck-Fußzeile, sonst lägen beide übereinander -->
          {#if options.footer && !page.node.footer}
            <div class="print-crumb">{#if page.role && page.role !== 'path'}<b>{PLAN_LABEL[page.role]}</b> · {/if}{page.trail.map((t) => t.title).join(' › ')}</div>
            <div class="print-num">{i + 1} / {pages.length}</div>
          {/if}
        </div>
      </div>
      <!-- für den PPTX-Export (Sprechernotizen), nie sichtbar -->
      {#if page.node.slides[page.slide].notes}<div class="pptx-notes" hidden>{@html page.node.slides[page.slide].notes}</div>{/if}
      {#if options.notes}
        <div class="print-notes">
          {#if page.slideFirst && page.node.slides[page.slide].notes}{@html page.node.slides[page.slide].notes}{:else if page.slideFirst}<p class="print-empty">Keine Notizen</p>{/if}
        </div>
      {/if}
    </article>
  {/each}
</div>

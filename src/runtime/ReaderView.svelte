<script lang="ts">
  import { onMount } from 'svelte'
  import initial from 'virtual:hashmark/deck'
  import { Navigator } from '../core/navigator.ts'
  import { PLAN_LABEL } from '../core/plan.ts'
  import type { DeckNode } from '../core/types.ts'
  import Lazy from './Lazy.svelte'
  import ScaledSlide from './ScaledSlide.svelte'
  import './reader.css'

  // Lesemodus (?reader): das Deck als Handbuch. Der Baum ist das Inhaltsverzeichnis, jede Überschrift ein Abschnitt,
  // die Sprechernotizen sind der Text und die Folien stehen als Karten dazwischen (Klick = Präsentation ab dort).

  const deck = 'deck' in initial ? initial.deck : null
  const error = 'error' in initial ? initial.error : null
  const nav = deck ? new Navigator(deck.nodes) : null
  const nodes: DeckNode[] = nav ? [...nav.walk()] : []
  const layoutOf = (n: DeckNode) => n.layout ?? n.attrs.layout ?? deck?.layout ?? 'default'
  const hrefOf = (n: DeckNode, slide: number) => `./#${encodeURI(n.id)}${slide ? ':' + (slide + 1) : ''}`

  let details = $state(true)
  let active = $state('')

  onMount(() => {
    document.title = `${deck?.title ?? 'Hashmark'} – Lesemodus`
    document.body.classList.add('reader')
    const spy = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) active = (e.target as HTMLElement).dataset.s ?? ''
    }, { rootMargin: '-25% 0px -65% 0px' })
    document.querySelectorAll('[data-s]').forEach((el) => spy.observe(el))
    return () => spy.disconnect()
  })

  const role = (n: DeckNode) => (nav ? nav.state(n.id) : 'path')
</script>

<div class="reader" class:no-details={!details}>
  <header class="rd-top">
    <span class="rd-brand"><i>#</i> {deck?.title ?? 'Hashmark'}</span>
    <span class="rd-spacer"></span>
    <button onclick={() => (details = !details)} title="Details (↓) im Text und im Inhaltsverzeichnis ein- oder ausblenden">Details: {details ? 'an' : 'aus'}</button>
    <a class="rd-btn primary" href="./">▶ Präsentieren</a>
    <a class="rd-btn" href="./?print" title="Druckansicht und PDF">PDF</a>
  </header>

  {#if error}
    <p class="rd-error">Deck-Fehler: {error}</p>
  {:else}
    <div class="rd-layout">
      <nav class="rd-toc" aria-label="Inhalt">
        <h4>Inhalt = der Baum</h4>
        {#each nodes as n (n.id)}
          <a class="rd-toc-item depth-{n.depth}" class:on={active === n.id} href="#{n.id}">
            <span class="k">{n.depth === 1 ? '→' : '↓'}</span>{n.title}
          </a>
        {/each}
        <p class="rd-legend"><b>→</b> Hauptpfad, <b>↓</b> Detail. Das Inhaltsverzeichnis ist der Baum der Präsentation.</p>
      </nav>

      <main class="rd-main">
        <h1>{deck?.title ?? 'Hashmark'}</h1>
        {#each nodes as n (n.id)}
          <section class="rd-node depth-{n.depth}" id={n.id} data-s={n.id}>
            <svelte:element this={n.depth === 1 ? 'h2' : 'h3'}>
              {n.title}
              {#if n.depth > 1}<span class="rd-badge">↓ Detail</span>{/if}
              {#if role(n) !== 'path'}<span class="rd-badge soft">{PLAN_LABEL[role(n)]}</span>{/if}
            </svelte:element>
            {#each n.slides as s, i (i)}
              {#if s.notes}<div class="rd-prose">{@html s.notes}</div>{/if}
              <a class="rd-card" href={hrefOf(n, i)} title="Präsentation ab dieser Folie">
                <Lazy><ScaledSlide node={n} slide={i} step={Infinity} layout={layoutOf(n)} /></Lazy>
                <span class="rd-card-hint">▶ ab hier präsentieren{n.slides.length > 1 ? ` · Folie ${i + 1} / ${n.slides.length}` : ''}</span>
              </a>
            {/each}
          </section>
        {/each}
      </main>
    </div>
  {/if}
</div>

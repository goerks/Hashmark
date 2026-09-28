<script lang="ts">
  import { onMount } from 'svelte'
  import { printQuery } from '../core/print.ts'
  import { Navigator, formatHash, parseHash, stepsOf, type Direction, type Move, type Position } from '../core/navigator.ts'
  import type { Deck, DeckNode } from '../core/types.ts'
  import initial from 'virtual:strata/deck'
  import Slide from './Slide.svelte'
  import NavOverview from './NavOverview.svelte'
  import { enter, leave } from './transitions.ts'

  type Payload = { deck: Deck } | { error: string }

  const initialDeck = 'deck' in initial ? initial.deck : null
  const initialNav = new Navigator(initialDeck?.nodes ?? [])

  let deck = $state.raw<Deck | null>(initialDeck)
  let error = $state<string | null>('error' in initial ? initial.error : null)
  let nav = $state.raw(initialNav)
  let pos = $state.raw<Position | null>(fromHash(initialNav) ?? initialNav.first)
  let dir = $state<Direction>('jump')
  let overview = $state(false)
  let scale = $state(1)

  const node = $derived(pos ? nav.node(pos.id) : undefined)
  const trail = $derived(pos ? nav.path(pos.id) : [])
  const layout = $derived(node ? (node.attrs.layout ?? deck?.layout ?? 'default') : 'default')
  const stepCount = $derived(pos ? stepsOf(node, pos.slide) : 0)
  const topIndex = $derived(trail[0] ? nav.nodes.indexOf(trail[0]) : -1)

  function fromHash(navigator: Navigator): Position | null {
    const p = parseHash(location.hash)
    if (!p) return null
    const n = navigator.find(p.id)
    return n ? { id: n.id, slide: Math.min(p.slide, n.slides.length - 1) } : null
  }

  function go(move: Move | null) {
    if (!move) return
    dir = move.dir
    pos = move.pos
  }

  function jump(id: string, slide = 0) {
    const target = nav.find(id)
    if (!target || !pos) return
    overview = false
    slide = Math.min(slide, target.slides.length - 1)
    if (target.id === pos.id && slide === pos.slide) return
    const d: Direction =
      target.id === pos.id ? (slide > pos.slide ? 'right' : 'left')
      : nav.parent(target.id)?.id === pos.id ? 'down'
      : target.id === nav.parent(pos.id)?.id ? 'up'
      : 'jump'
    go({ pos: { id: target.id, slide }, dir: d })
  }

  const layoutOf = (n: DeckNode) => n.attrs.layout ?? deck?.layout ?? 'default'

  /** Navigations-Übersicht: Ctrl+Shift+O (oder kurz O) */
  const isOverviewKey = (e: KeyboardEvent) =>
    (e.key === 'o' || e.key === 'O') && !e.altKey && !e.metaKey && (!e.ctrlKey || e.shiftKey)

  // Deep-Link im URL-Fragment mitführen
  $effect(() => {
    if (!pos) return
    const hash = formatHash(pos)
    if (location.hash !== hash) history.replaceState(null, '', hash)
  })

  // Im Editor (Vorschau-Iframe): Position an den Editor melden
  const embedded = window.parent !== window
  $effect(() => {
    if (embedded && pos) window.parent.postMessage({ type: 'strata:position', pos }, location.origin)
  })

  $effect(() => {
    document.title = node && deck ? `${node.title} · ${deck.title}` : (deck?.title ?? 'Strata')
  })

  function openPrintView() {
    window.open(location.pathname + printQuery({}, { autoprint: '1' }), '_blank')
  }

  function onkeydown(e: KeyboardEvent) {
    // bei offener Übersicht übernimmt NavOverview die Tasten
    if (overview || !pos) return
    if ((e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable]')) return
    if (isOverviewKey(e)) {
      overview = true
      e.preventDefault()
      return
    }
    // P bzw. Ctrl+P / Cmd+P: statt der Bildschirmansicht die Druckansicht drucken
    const isPrintKey = (e.key === 'p' || e.key === 'P') && !e.altKey && !e.shiftKey
    if (isPrintKey) {
      e.preventDefault()
      openPrintView()
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const handlers: Record<string, () => Move | null> = {
      ArrowRight: () => nav.next(pos!),
      PageDown: () => nav.next(pos!),
      ' ': () => (e.shiftKey ? nav.prev(pos!) : nav.next(pos!)),
      ArrowLeft: () => nav.prev(pos!),
      PageUp: () => nav.prev(pos!),
      ArrowDown: () => nav.down(pos!),
      Enter: () => nav.down(pos!),
      ArrowUp: () => nav.up(pos!),
      Escape: () => nav.up(pos!),
      Home: () => (nav.first ? { pos: nav.first, dir: 'jump' } : null),
    }
    const handler = handlers[e.key]
    if (!handler) return
    e.preventDefault()
    go(handler())
  }

  function fit() {
    scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720)
  }

  onMount(() => {
    fit()
    const onHash = () => {
      const p = parseHash(location.hash)
      if (p && pos && (p.id !== pos.id || p.slide !== pos.slide)) jump(p.id, p.slide)
    }
    window.addEventListener('hashchange', onHash)

    // Editor → Vorschau: zur Folie unter dem Cursor springen (step 'all' = vollständig aufgedeckt)
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.type !== 'strata:goto') return
      const target = nav.node(e.data.id)
      if (!target) return
      const slide = Math.max(0, Math.min(Number(e.data.slide) || 0, target.slides.length - 1))
      const step = e.data.step === 'all' ? stepsOf(target, slide) : 0
      if (pos && pos.id === target.id && pos.slide === slide && (pos.step ?? 0) === step) return
      overview = false
      go({ pos: step ? { id: target.id, slide, step } : { id: target.id, slide }, dir: 'jump' })
    }
    window.addEventListener('message', onMessage)

    // Hot Reload: neuer Baum, Position bleibt (oder die nächstliegende)
    import.meta.hot?.on('strata:deck', (payload: Payload) => {
      if ('error' in payload) {
        error = payload.error
        return
      }
      error = null
      const next = new Navigator(payload.deck.nodes)
      const relocated = pos ? next.relocate(pos, nav) : next.first
      dir = 'jump'
      deck = payload.deck
      nav = next
      pos = relocated
    })
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('message', onMessage)
    }
  })
</script>

<svelte:window {onkeydown} onresize={fit} />

<main class="viewport">
  {#if deck && node && pos}
    <div class="stage" style="--scale:{scale}">
      {#key `${node.id}:${pos.slide}`}
        <div class="stage-slide" in:enter={{ dir, kind: node.attrs.transition }} out:leave={{ dir, kind: node.attrs.transition }}>
          <Slide {node} slide={pos.slide} {layout} step={pos.step ?? 0} />
        </div>
      {/key}

      <nav class="breadcrumb" aria-label="Position">
        {#each trail as crumb, i (crumb.id)}
          {#if i > 0}<span class="sep">›</span>{/if}
          <button class:active={crumb.id === node.id} onclick={() => jump(crumb.id)}>{crumb.title}</button>
        {/each}
        <span class="subslide">
          {#if stepCount}
            <span class="step-dots" title="Schritt {pos.step ?? 0} von {stepCount}">
              {#each { length: stepCount } as _, i (i)}<i class:done={i < (pos.step ?? 0)}></i>{/each}
            </span>
          {/if}
          {#if node.slides.length > 1}{pos.slide + 1}/{node.slides.length}{/if}
        </span>
      </nav>

      <footer class="status">
        {#if node.children.length}
          <button class="children-hint" onclick={() => go(nav.down(pos!))} title="↓ abtauchen">
            <span class="dots">{#each node.children as c (c.id)}<i></i>{/each}</span>
            ↓ {node.children.length} {node.children.length === 1 ? 'Detail' : 'Details'}
          </button>
        {/if}
        <span class="progress">{topIndex + 1} / {nav.nodes.length}</span>
      </footer>
    </div>
  {:else if !error}
    <p class="empty">Keine Folien gefunden.</p>
  {/if}

  {#if overview && deck && pos}
    <NavOverview
      nodes={deck.nodes}
      current={pos}
      trail={trail.map((t) => t.id)}
      {layoutOf}
      onjump={(p) => jump(p.id, p.slide)}
      onclose={() => (overview = false)}
    />
  {/if}

  {#if error}
    <div class="error" role="alert"><strong>Deck-Fehler</strong><pre>{error}</pre></div>
  {/if}
</main>

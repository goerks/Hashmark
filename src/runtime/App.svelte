<script lang="ts">
  import { onMount } from 'svelte'
  import { Navigator, formatHash, parseHash, type Direction, type Move, type Position } from '../core/navigator.ts'
  import type { Deck } from '../core/types.ts'
  import initial from 'virtual:strata/deck'
  import Slide from './Slide.svelte'
  import Overview from './Overview.svelte'
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

  function jump(id: string) {
    const target = nav.find(id)
    if (!target || !pos) return
    overview = false
    if (target.id === pos.id) return
    const d: Direction = nav.parent(target.id)?.id === pos.id ? 'down' : target.id === nav.parent(pos.id)?.id ? 'up' : 'jump'
    go({ pos: { id: target.id, slide: 0 }, dir: d })
  }

  // Deep-Link im URL-Fragment mitführen
  $effect(() => {
    if (!pos) return
    const hash = formatHash(pos)
    if (location.hash !== hash) history.replaceState(null, '', hash)
  })

  $effect(() => {
    document.title = node && deck ? `${node.title} · ${deck.title}` : (deck?.title ?? 'Strata')
  })

  function onkeydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if ((e.target as HTMLElement).closest('input, textarea, [contenteditable]')) return
    if (overview) {
      if (e.key === 'Escape' || e.key === 'o' || e.key === 'O') { overview = false; e.preventDefault() }
      return
    }
    if (!pos) return
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
    if (e.key === 'o' || e.key === 'O') {
      overview = true
      e.preventDefault()
      return
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
      if (p && pos && p.id !== pos.id) jump(p.id)
    }
    window.addEventListener('hashchange', onHash)

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
    return () => window.removeEventListener('hashchange', onHash)
  })
</script>

<svelte:window {onkeydown} onresize={fit} />

<main class="viewport">
  {#if deck && node && pos}
    <div class="stage" style="--scale:{scale}">
      {#key `${node.id}:${pos.slide}`}
        <div class="stage-slide" in:enter={{ dir, kind: node.attrs.transition }} out:leave={{ dir, kind: node.attrs.transition }}>
          <Slide {node} slide={pos.slide} {layout} />
        </div>
      {/key}

      <nav class="breadcrumb" aria-label="Position">
        {#each trail as crumb, i (crumb.id)}
          {#if i > 0}<span class="sep">›</span>{/if}
          <button class:active={crumb.id === node.id} onclick={() => jump(crumb.id)}>{crumb.title}</button>
        {/each}
        {#if node.slides.length > 1}<span class="subslide">{pos.slide + 1}/{node.slides.length}</span>{/if}
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
    <Overview nodes={deck.nodes} current={pos.id} trail={trail.map((t) => t.id)} onjump={jump} onclose={() => (overview = false)} />
  {/if}

  {#if error}
    <div class="error" role="alert"><strong>Deck-Fehler</strong><pre>{error}</pre></div>
  {/if}
</main>

<script lang="ts">
  import { flushSync, onMount } from 'svelte'
  import { DEFAULT_PRINT, printQuery } from '../core/print.ts'
  import PrintPages from './PrintPages.svelte'
  import NavControls, { type Control, type ControlKey } from './NavControls.svelte'
  import KeyHelp from './KeyHelp.svelte'
  import { Navigator, formatHash, parseHash, stepsOf, type Direction, type Move, type Position } from '../core/navigator.ts'
  import type { Deck, DeckNode } from '../core/types.ts'
  import initial from 'virtual:strata/deck'
  import Slide from './Slide.svelte'
  import NavOverview from './NavOverview.svelte'
  import Search from './Search.svelte'
  import Notes from './Notes.svelte'
  import { enter, leave } from './transitions.ts'
  import { isTrusted, send, type PresenterMessage } from './presenter-link.ts'

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
  const layout = $derived(node ? (node.layout ?? node.attrs.layout ?? deck?.layout ?? 'default') : 'default')
  const stepCount = $derived(pos ? stepsOf(node, pos.slide) : 0)
  let controlsHidden = $state(false)
  let black = $state(false)
  let help = $state(false)
  let dimmed = $state(false)
  let searching = $state(false)
  /** Notizen unten einblenden (N) – zum Üben mit nur einem Bildschirm */
  let notesOpen = $state(false)
  /** Fenster der Presenter-View (S), sonst null */
  let presenter: Window | null = null

  /** Beschriftung eines Ziels: Schritt, Sub-Slide oder Titel des Zielknotens */
  function describe(move: Move | null, key: ControlKey): string {
    if (!move || !pos) return ''
    const target = nav.node(move.pos.id)
    if (!target) return ''
    if (move.pos.id === pos.id) {
      if (move.pos.slide === pos.slide) return `Schritt ${move.pos.step ?? 0} / ${stepsOf(target, move.pos.slide)}`
      return `Folie ${move.pos.slide + 1} / ${target.slides.length}`
    }
    return key === 'up' ? `zurück zu ${target.title}` : target.title
  }

  /** Mögliche Bewegungen von hier aus (nur Vorschau – merkt nichts) */
  const controls = $derived.by((): Record<ControlKey, Control> | null => {
    if (!pos) return null
    const mk = (move: Move | null, key: ControlKey) => ({ move, label: describe(move, key) })
    return {
      up: mk(nav.up(pos), 'up'),
      down: mk(nav.down(pos, true), 'down'),
      left: mk(nav.prev(pos), 'left'),
      right: mk(nav.next(pos), 'right'),
      forward: mk(nav.forward(pos, true), 'forward'),
    }
  })

  function moveBy(key: ControlKey) {
    if (!pos) return
    // down/forward erst jetzt „echt“ ausführen, damit ↑ die Position im Elternknoten kennt
    go(key === 'down' ? nav.down(pos) : key === 'forward' ? nav.forward(pos) : controls?.[key].move ?? null)
  }

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

  const layoutOf = (n: DeckNode) => n.layout ?? n.attrs.layout ?? deck?.layout ?? 'default'

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

  // Druckseiten aller Folien: nach dem Start im Hintergrund vorbereiten (Diagramme brauchen Zeit),
  // spätestens beim Drucken. Nicht in der Editor-Vorschau.
  let printMounted = $state(false)
  $effect(() => {
    if (embedded && pos) window.parent.postMessage({ type: 'strata:position', pos }, location.origin)
  })

  $effect(() => {
    document.title = node && deck ? `${node.title} · ${deck.title}` : (deck?.title ?? 'Strata')
  })

  function openPrintView() {
    window.open(location.pathname + printQuery({}, { autoprint: '1' }), '_blank')
  }

  /** Presenter-View im zweiten Fenster; ein schon offenes Fenster wird wiederverwendet */
  function openPresenter() {
    const win = window.open(location.pathname + '?presenter' + location.hash, 'strata-presenter', 'popup,width=1280,height=800')
    if (win) {
      presenter = win
      win.focus()
    }
  }

  // Stand an die Presenter-View melden
  $effect(() => {
    if (pos) send(presenter, { type: 'strata:presenter-state', pos, black })
  })

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else document.documentElement.requestFullscreen().catch(() => {})
  }

  /** Navigation und Schwarzbild – von der Tastatur und aus der Presenter-View. true = behandelt. */
  function navKey(key: string, shiftKey: boolean): boolean {
    if (!pos) return false
    if (key === 'b' || key === 'B' || key === '.') { black = !black; return true }
    const handlers: Record<string, () => Move | null> = {
      ArrowRight: () => nav.next(pos!),
      // Space und Presenter (PageDown/PageUp): der Linie nach in die Tiefe
      ' ': () => (shiftKey ? nav.backward(pos!) : nav.forward(pos!)),
      PageDown: () => nav.forward(pos!),
      PageUp: () => nav.backward(pos!),
      ArrowLeft: () => nav.prev(pos!),
      ArrowDown: () => nav.down(pos!),
      Enter: () => nav.down(pos!),
      ArrowUp: () => nav.up(pos!),
      Escape: () => nav.up(pos!),
      Home: () => (nav.first ? { pos: nav.first, dir: 'jump' } : null),
    }
    const handler = handlers[key]
    if (!handler) return false
    // Schwarzbild endet mit jeder Bewegung
    black = false
    go(handler())
    return true
  }

  const isSearchKey = (e: KeyboardEvent) =>
    ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey) && !e.altKey) || (e.key === '/' && !e.ctrlKey && !e.metaKey)

  function onkeydown(e: KeyboardEvent) {
    wake()
    // bei offener Übersicht bzw. Suche übernehmen diese die Tasten
    if (overview || searching || !pos) return
    if (help) {
      // Tastenhilfe: jede Taste schließt sie
      help = false
      e.preventDefault()
      return
    }
    if ((e.target as HTMLElement | null)?.closest?.('input, textarea, [contenteditable]')) return
    if (isOverviewKey(e)) {
      overview = true
      e.preventDefault()
      return
    }
    if (isSearchKey(e)) {
      searching = true
      e.preventDefault()
      return
    }
    // P: Druckansicht mit Optionen (Tiefe, Schritte, Handout) in neuem Tab.
    // Ctrl+P bleibt beim Browser: gedruckt werden die unsichtbar vorbereiteten Seiten aller Folien.
    const isPrintKey = (e.key === 'p' || e.key === 'P') && !e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey
    if (isPrintKey) {
      e.preventDefault()
      openPrintView()
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return

    // Presenter-Fernbedienungen: „Play“ sendet F5 bzw. Shift+F5, „Schwarzbild“ sendet B oder „.“
    if (e.key === 'F5' || e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); return }
    if (e.key === 'h' || e.key === 'H') { e.preventDefault(); controlsHidden = !controlsHidden; return }
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); notesOpen = !notesOpen; return }
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); openPresenter(); return }
    if (e.key === '?') { e.preventDefault(); help = true; return }
    if (navKey(e.key, e.shiftKey)) e.preventDefault()
  }

  function onPresenterMessage(msg: PresenterMessage, source: Window) {
    presenter = source
    if (msg.type === 'strata:presenter-hello' && pos) send(presenter, { type: 'strata:presenter-state', pos, black })
    else if (msg.type === 'strata:presenter-key') {
      wake()
      navKey(msg.key, msg.shiftKey)
    } else if (msg.type === 'strata:presenter-goto') {
      black = false
      jump(msg.id, msg.slide)
    }
  }

  // Steuerung nach 3 s ohne Maus/Tasten zurücknehmen, bei Bewegung wieder voll zeigen
  let idleTimer: ReturnType<typeof setTimeout> | undefined
  function wake() {
    dimmed = false
    clearTimeout(idleTimer)
    idleTimer = setTimeout(() => (dimmed = true), 3000)
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

    const idle = embedded ? undefined : setTimeout(() => (printMounted = true), 1500)
    const beforePrint = () => { if (!embedded) flushSync(() => (printMounted = true)) }
    window.addEventListener('beforeprint', beforePrint)

    // Editor → Vorschau: zur Folie unter dem Cursor springen (step 'all' = vollständig aufgedeckt)
    const onMessage = (e: MessageEvent) => {
      if (isTrusted(e, presenter) && e.source) return onPresenterMessage(e.data as PresenterMessage, e.source as Window)
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
      window.removeEventListener('beforeprint', beforePrint)
      clearTimeout(idle)
    }
  })
</script>

<svelte:window {onkeydown} onresize={fit} onpointermove={wake} />

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
      </footer>

      <!-- in der Bühne, im freien Randstreifen unten rechts: überdeckt nie Inhalt, skaliert mit -->
      {#if controls && !controlsHidden}
        {@const p = nav.progress(pos)}
        <NavControls
          {controls}
          progress="{p.index} / {p.total}"
          chapter="Kapitel {topIndex + 1} / {nav.nodes.length}"
          {dimmed}
          onmove={moveBy}
        />
      {/if}
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

  {#if searching && deck}
    <Search nodes={deck.nodes} onjump={(p) => { searching = false; jump(p.id, p.slide) }} onclose={() => (searching = false)} />
  {/if}

  {#if notesOpen && node && pos}
    <aside class="notes-overlay" aria-label="Sprechernotizen">
      <div class="no-head"><strong>Notizen</strong><span>N schließt · S öffnet die Presenter-View</span></div>
      <Notes html={node.slides[pos.slide]?.notes} step={pos.step ?? 0} />
    </aside>
  {/if}

  {#if help}<KeyHelp onclose={() => (help = false)} />{/if}
  {#if black}<button class="blackout" aria-label="Schwarzbild beenden (B)" onclick={() => (black = false)}></button>{/if}

  {#if error}
    <div class="error" role="alert"><strong>Deck-Fehler</strong><pre>{error}</pre></div>
  {/if}
</main>

<!-- außerhalb von .viewport: die Bühne wird beim Drucken ausgeblendet, diese Seiten eingeblendet -->
{#if printMounted && deck}
  <div class="print-root print-slides print-only" aria-hidden="true">
    <PrintPages {deck} options={DEFAULT_PRINT} />
  </div>
{/if}

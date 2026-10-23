<script lang="ts">
  import { flushSync, onMount } from 'svelte'
  import { DEFAULT_PRINT, printQuery } from '../core/print.ts'
  import PrintPages from './PrintPages.svelte'
  import NavControls, { type Control, type ControlKey } from './NavControls.svelte'
  import KeyHelp from './KeyHelp.svelte'
  import { Navigator, formatHash, parseHash, stepsOf, type Direction, type Excursion, type Move, type Position } from '../core/navigator.ts'
  import { PLAN_LABEL, activeStates, type PlanFile } from '../core/plan.ts'
  import type { Deck, DeckNode } from '../core/types.ts'
  import { loadPlanFile } from './plan-store.ts'
  import initial from 'virtual:hashmark/deck'
  import Slide from './Slide.svelte'
  import NavOverview from './NavOverview.svelte'
  import Search from './Search.svelte'
  import Notes from './Notes.svelte'
  import { enter, leave } from './transitions.ts'
  import { openLink, type PresenterMessage } from './presenter-link.ts'
  import type { VideoInfo } from '../core/media.ts'
  import { onVideoChange, skipVideo, toggleVideo, videoInfo } from './video.ts'
  import { escapeZoom, onZoomChange, resetZoom, toggleZoom, zoomInfo, type ZoomInfo } from './zoom.ts'
  import { onDeckUpdate } from './deck-source.ts'
  import { desktopAction, isDesktop } from './desktop.ts'

  type Payload = { deck: Deck } | { error: string }

  const initialDeck = 'deck' in initial ? initial.deck : null
  const initialNav = new Navigator(initialDeck?.nodes ?? [])

  let deck = $state.raw<Deck | null>(initialDeck)
  let error = $state<string | null>('error' in initial ? initial.error : null)
  let nav = $state.raw(initialNav)
  let pos = $state.raw<Position | null>(fromHash(initialNav) ?? initialNav.first)
  let dir = $state<Direction>('jump')
  /** laufende Ausflüge (↓ in Optionales, Sprung in den Anhang); Space führt am Ende zurück */
  let trip = $state.raw<readonly Excursion[]>([])
  let overview = $state(false)
  let scale = $state(1)

  const node = $derived(pos ? nav.node(pos.id) : undefined)
  const trail = $derived(pos ? nav.path(pos.id) : [])
  const planState = $derived(node ? nav.state(node.id) : 'path')
  const tripBack = $derived(trip.length ? nav.node(trip[trip.length - 1].back.id) : undefined)
  const layout = $derived(node ? (node.layout ?? node.attrs.layout ?? deck?.layout ?? 'default') : 'default')
  const stepCount = $derived(pos ? stepsOf(node, pos.slide) : 0)
  let controlsHidden = $state(false)
  let black = $state(false)
  let help = $state(false)
  let dimmed = $state(false)
  /**
   * Mit Presenter-View entfallen die Bedienhilfen auf der Präsentation (Steuerkreuz, Schritte, Details, Plan-Hinweise):
   * Das Publikum braucht sie nicht, der Presenter zeigt sie. Die Presenter-View meldet sich jede Sekunde (hello).
   * `?dual` (Desktop-App) blendet sie schon beim Start aus, bis der Presenter da ist (oder 15 s vergangen sind).
   */
  const expectPresenter = new URLSearchParams(location.search).has('dual')
  let presenterUntil = $state(expectPresenter ? Date.now() + 15000 : 0)
  let tick = $state(Date.now())
  const withPresenter = $derived(tick < presenterUntil)
  let searching = $state(false)
  /** Notizen unten einblenden (N) – zum Üben mit nur einem Bildschirm */
  let notesOpen = $state(false)
  /** Fenster der Presenter-View (S), nur für file:// nötig (sonst BroadcastChannel) */
  let presenter: Window | null = null
  /** Kennung dieser Präsentation – die Presenter-View koppelt sich an genau eine */
  const session = Math.random().toString(36).slice(2, 10)
  const desktop = isDesktop()

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
      up: mk(nav.leave(pos), 'up'),
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
    // Weiterblättern fährt die Kamera zurück; Schritte derselben Folie steuert syncZoom (zoomstep)
    if (!pos || pos.id !== move.pos.id || pos.slide !== move.pos.slide) resetZoom(true)
    dir = move.dir
    pos = move.pos
    // Ausflüge beenden, in denen die neue Position nicht mehr liegt
    nav.sync(move.pos)
    trip = nav.trip
  }

  /** Plan des Vortragenden übernehmen (beim Laden und aus der Presenter-View) */
  function applyPlan(file: PlanFile) {
    nav = nav.with({ states: activeStates(file) })
    trip = nav.trip
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
    // abseits des Pfads wird der Sprung zum Ausflug: Space führt danach zurück
    go({ pos: nav.jumpTo({ id: target.id, slide }, pos).pos, dir: d })
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
    if (embedded && pos) window.parent.postMessage({ type: 'hashmark:position', pos }, location.origin)
  })

  $effect(() => {
    document.title = node && deck ? `${node.title} · ${deck.title}` : (deck?.title ?? 'Hashmark')
  })

  function openPrintView() {
    // Desktop-App: PDF direkt speichern (Dialog der App) statt Druckansicht im Browser
    if (desktop) void desktopAction({ action: 'pdf', query: printQuery({}) })
    else window.open(location.pathname + printQuery({}, { autoprint: '1' }), '_blank')
  }

  /** Presenter-View im zweiten Fenster; ein schon offenes Fenster wird wiederverwendet */
  function openPresenter() {
    if (desktop) {
      void desktopAction({ action: 'presenter', hash: location.hash })
      return
    }
    const win = window.open(location.pathname + '?presenter' + location.hash, 'hashmark-presenter', 'popup,width=1280,height=800')
    if (win) {
      presenter = win
      win.focus()
    }
  }

  // Die Vorschau im Editor nimmt nicht teil, sonst würde sie Tasten des Presenters mit ausführen
  const link = embedded ? null : openLink(() => presenter, (msg, source) => onPresenterMessage(msg, source))

  // Video der aktuellen Folie: Zustand für die Presenter-View (läuft, angehalten, Zeit)
  let video = $state.raw<VideoInfo | null>(null)
  // Bild-Zoom der aktuellen Folie: vergrößerbar und vergrößert, für die Presenter-View
  let zoom = $state.raw<ZoomInfo | null>(null)
  onMount(() => {
    onVideoChange(() => (video = videoInfo()))
    onZoomChange(() => (zoom = zoomInfo()))
    return () => { onVideoChange(null); onZoomChange(null) }
  })

  // Stand an die Presenter-View melden
  $effect(() => {
    if (pos) link?.send({ type: 'hashmark:presenter-state', pos, black, session, trip: [...trip], all: nav.all, video, zoom })
  })

  // Desktop-App: aktuelle Folie melden (für „Präsentieren ab aktueller Folie“)
  let positionTimer: ReturnType<typeof setTimeout> | undefined
  $effect(() => {
    if (!desktop || !pos) return
    const hash = formatHash(pos)
    clearTimeout(positionTimer)
    positionTimer = setTimeout(() => void desktopAction({ action: 'position', hash }), 250)
  })

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else document.documentElement.requestFullscreen().catch(() => {})
  }

  /** Navigation und Schwarzbild – von der Tastatur und aus der Presenter-View. true = behandelt. */
  function navKey(key: string, shiftKey: boolean): boolean {
    if (!pos) return false
    if (key === 'b' || key === 'B' || key === '.') { black = !black; return true }
    // T: Plan ausschalten (Space läuft durch alles) bzw. wieder einschalten
    if (key === 't' || key === 'T') {
      nav = nav.with({ all: !nav.all })
      trip = nav.trip
      return true
    }
    // Z: Kamera fährt aufs Bild (und zurück), Esc fährt zuerst zurück, bevor es im Baum aufsteigt
    if (key === 'z' || key === 'Z') return toggleZoom()
    if (key === 'Escape' && escapeZoom()) return true
    // K: Video der Folie starten, anhalten, fortsetzen. → bei laufendem Video springt ans Ende, erst das nächste → geht weiter.
    if (key === 'k' || key === 'K') return toggleVideo()
    if ((key === 'ArrowRight' || key === 'PageDown' || (key === ' ' && !shiftKey)) && skipVideo()) return true
    const handlers: Record<string, () => Move | null> = {
      ArrowRight: () => nav.next(pos!),
      // Space und Presenter (PageDown/PageUp): dem Vortragsplan nach
      ' ': () => (shiftKey ? nav.backward(pos!) : nav.forward(pos!)),
      PageDown: () => nav.forward(pos!),
      PageUp: () => nav.backward(pos!),
      ArrowLeft: () => nav.prev(pos!),
      ArrowDown: () => nav.down(pos!),
      Enter: () => nav.down(pos!),
      ArrowUp: () => nav.leave(pos!),
      Escape: () => nav.leave(pos!),
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
    // Desktop-App: Ctrl+W beendet die Präsentation (Fenster gehören der App)
    if (desktop && (e.ctrlKey || e.metaKey) && (e.key === 'w' || e.key === 'W')) {
      e.preventDefault()
      void desktopAction({ action: 'close' })
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

  function onPresenterMessage(msg: PresenterMessage, source: Window | null) {
    if (source) presenter = source // file://: Fenster merken, auch nach Neuladen der Präsentation
    // Tasten und Sprünge nur, wenn sie an diese Präsentation gerichtet sind
    if ((msg.type === 'hashmark:presenter-key' || msg.type === 'hashmark:presenter-goto') && msg.target && msg.target !== session) return
    if (msg.type === 'hashmark:presenter-hello') presenterUntil = Date.now() + 3500
    if (msg.type === 'hashmark:presenter-hello' && pos) link?.send({ type: 'hashmark:presenter-state', pos, black, session, trip: [...trip], all: nav.all, video, zoom })
    else if (msg.type === 'hashmark:presenter-plan') applyPlan(msg.plan)
    else if (msg.type === 'hashmark:presenter-key') {
      wake()
      navKey(msg.key, msg.shiftKey)
    } else if (msg.type === 'hashmark:presenter-goto') {
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
    void loadPlanFile().then(applyPlan)
    const ticker = setInterval(() => (tick = Date.now()), 500)
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
      if (e.origin !== location.origin || e.data?.type !== 'hashmark:goto') return
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
    // Vite-HMR bzw. Server-Sent Events in der Desktop-App
    onDeckUpdate((payload: Payload) => {
      if ('error' in payload) {
        error = payload.error
        return
      }
      error = null
      const next = new Navigator(payload.deck.nodes, { states: nav.states, all: nav.all })
      const relocated = pos ? next.relocate(pos, nav) : next.first
      dir = 'jump'
      deck = payload.deck
      nav = next
      pos = relocated
      trip = []
    })
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('message', onMessage)
      link?.close()
      window.removeEventListener('beforeprint', beforePrint)
      clearTimeout(idle)
      clearInterval(ticker)
    }
  })
</script>

<svelte:window {onkeydown} onresize={fit} onpointermove={wake} />

<main class="viewport">
  {#if deck && node && pos}
    <div class="stage" style="--scale:{scale}">
      {#key `${node.id}:${pos.slide}`}
        <div class="stage-slide" in:enter={{ dir, kind: node.attrs.transition }} out:leave={{ dir, kind: node.attrs.transition }}>
          <Slide {node} slide={pos.slide} {layout} step={pos.step ?? 0} media={embedded ? 'still' : 'live'} />
        </div>
      {/key}

      <nav class="breadcrumb" aria-label="Position">
        {#each trail as crumb, i (crumb.id)}
          {#if i > 0}<span class="sep">›</span>{/if}
          <button class:active={crumb.id === node.id} onclick={() => jump(crumb.id)}>{crumb.title}</button>
        {/each}
        {#if withPresenter}
          <!-- Presenter-View verbunden: Rolle, Schritte und Position stehen dort -->
        {:else if nav.all}
          <span class="plan-tag" title="Plan ausgeschaltet: Space läuft durch alles (T)">Plan aus</span>
        {:else if planState !== 'path'}
          <span class="plan-tag {planState}" title="Space überspringt diese Folie; sie ist nur über ↓, Suche oder Übersicht erreichbar">{PLAN_LABEL[planState]}</span>
        {/if}
        {#if !withPresenter}<span class="subslide">
          {#if stepCount}
            <span class="step-dots" title="Schritt {pos.step ?? 0} von {stepCount}">
              {#each { length: stepCount } as _, i (i)}<i class:done={i < (pos.step ?? 0)}></i>{/each}
            </span>
          {/if}
          {#if node.slides.length > 1}{pos.slide + 1}/{node.slides.length}{/if}
        </span>{/if}
      </nav>

      {#if desktop && !embedded && !dimmed}
        <button class="end-show" onclick={() => void desktopAction({ action: 'close' })} title="Präsentation beenden (Strg+W)">✕ Beenden</button>
      {/if}

      <footer class="status">
        {#if node.children.length && !withPresenter}
          <button class="children-hint" onclick={() => go(nav.down(pos!))} title="↓ abtauchen">
            <span class="dots">{#each node.children as c (c.id)}<i class:off={!nav.onPath(c.id)}></i>{/each}</span>
            ↓ {node.children.length} {node.children.length === 1 ? 'Detail' : 'Details'}
          </button>
        {/if}
      </footer>

      {#if tripBack && !withPresenter}
        <div class="trip-bar" role="status">
          <span>↩ Ausflug · zurück zu „{tripBack.title}“</span>
          <span class="trip-hint">Space führt von selbst zurück · Esc bricht ab</span>
        </div>
      {/if}

      <!-- in der Bühne, im freien Randstreifen unten rechts: überdeckt nie Inhalt, skaliert mit -->
      {#if controls && !controlsHidden && !withPresenter}
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
      roleOf={(n) => nav.state(n.id)}
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
    <PrintPages {deck} options={DEFAULT_PRINT} media="off" />
  </div>
{/if}

<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import initial from 'virtual:hashmark/deck'
  import { Navigator, stepsOf, type Excursion, type Position } from '../core/navigator.ts'
  import { PLAN_LABEL, activeStates, emptyPlanFile, summarize, type PlanFile } from '../core/plan.ts'
  import type { Deck, DeckNode } from '../core/types.ts'
  import PlanPanel from './PlanPanel.svelte'
  import { loadPlanFile, savePlanFile } from './plan-store.ts'
  import { formatClock, pace } from '../core/timing.ts'
  import ScaledSlide from './ScaledSlide.svelte'
  import Notes from './Notes.svelte'
  import Search from './Search.svelte'
  import { FORWARDED_KEYS, openLink, usesChannel, type PresenterLink, type PresenterMessage } from './presenter-link.ts'
  import './presenter.css'
  import { onDeckUpdate } from './deck-source.ts'

  // Presenter-View: zweites Fenster (Taste S in der Präsentation). Zeigt aktuelle und nächste Folie,
  // Notizen, Uhr, Timer mit Zeitplan und den Baum mit den Ästen, in die man abtauchen kann.
  // Die Präsentation bleibt die Quelle der Wahrheit: Tasten und Sprünge gehen per postMessage hinüber.

  type Payload = { deck: Deck } | { error: string }

  const initialDeck = 'deck' in initial ? initial.deck : null
  let deck = $state.raw<Deck | null>(initialDeck)
  let nodes = $state.raw<DeckNode[]>(initialDeck?.nodes ?? [])
  /** Fahrpläne; die Presenter-View ist der einzige Ort, an dem sie bearbeitet werden */
  let planFile = $state.raw<PlanFile>(emptyPlanFile())
  let planOpen = $state(false)
  /** aus der Präsentation: Plan ausgeschaltet (T) und laufende Ausflüge */
  let all = $state(false)
  let trip = $state.raw<Excursion[]>([])
  const nav = $derived(new Navigator(nodes, { states: activeStates(planFile), all, trip }))
  const planSum = $derived(summarize(nav.with({ all: false, trip: [] })))
  const tripBack = $derived(trip.length ? nav.node(trip[trip.length - 1].back.id) : undefined)
  let pos = $state.raw<Position | null>(null)
  let black = $state(false)
  let searching = $state(false)
  let lastSeen = $state(0)
  let now = $state(Date.now())

  const audience = window.opener as Window | null
  const connected = $derived(now - lastSeen < 3500)

  const node = $derived(pos ? nav.node(pos.id) : undefined)
  const trail = $derived(pos ? nav.path(pos.id) : [])
  const step = $derived(pos?.step ?? 0)
  const stepCount = $derived(pos ? stepsOf(node, pos.slide) : 0)
  const layoutOf = (n: DeckNode) => n.layout ?? n.attrs.layout ?? deck?.layout ?? 'default'

  /** Als Nächstes = Space (der Linie nach); Vorschau ohne Merken */
  const next = $derived(pos ? nav.forward(pos, true) : null)
  const nextNode = $derived(next ? nav.node(next.pos.id) : undefined)
  const nextLabel = $derived.by(() => {
    if (!next || !nextNode || !pos) return 'Ende'
    if (next.pos.id === pos.id && next.pos.slide === pos.slide) return `Schritt ${next.pos.step ?? 0} / ${stepCount}`
    if (next.pos.id === pos.id) return `Folie ${next.pos.slide + 1} / ${nextNode.slides.length}`
    return `${next.dir === 'down' ? '↓ ' : trip.length && next.dir === 'up' ? '↩ ' : ''}${nextNode.title}`
  })
  const right = $derived(pos ? nav.next(pos) : null)
  const progress = $derived(pos ? nav.progress(pos) : { index: 0, total: 0 })

  // ---------- Timer ----------

  const TIMER_KEY = 'hashmark:presenter-timer'
  const FONT_KEY = 'hashmark:presenter-font'
  interface TimerState { accumulated: number; startedAt: number; running: boolean }

  function loadTimer(): TimerState {
    try {
      const t = JSON.parse(sessionStorage.getItem(TIMER_KEY) ?? 'null')
      if (t && typeof t.accumulated === 'number') return t
    } catch { /* Speicher nicht verfügbar */ }
    return { accumulated: 0, startedAt: 0, running: false }
  }

  let timer = $state<TimerState>(loadTimer())
  const elapsed = $derived((timer.accumulated + (timer.running ? now - timer.startedAt : 0)) / 1000)

  $effect(() => {
    const t = { ...timer }
    try { sessionStorage.setItem(TIMER_KEY, JSON.stringify(t)) } catch { /* egal */ }
  })

  function startTimer() {
    if (!timer.running) timer = { ...timer, startedAt: Date.now(), running: true }
  }
  function pauseTimer() {
    if (timer.running) timer = { accumulated: timer.accumulated + Date.now() - timer.startedAt, startedAt: 0, running: false }
  }
  function resetTimer() {
    timer = { accumulated: 0, startedAt: 0, running: false }
    budgetStart = 0
  }

  /** Zeitplan des ganzen Vortrags (deck.yaml `duration`): Anteil gezeigter Folien vs. verbrauchter Zeit */
  const plan = $derived.by(() => {
    if (!deck?.duration || !progress.total) return null
    const shown = Math.max(0, progress.index - 1) / progress.total
    const diff = elapsed - shown * deck.duration
    return { remaining: deck.duration - elapsed, diff, pace: pace(shown, elapsed, deck.duration) }
  })

  /** Budget des nächsten Knotens mit `{duration=…}` auf dem Pfad (Kapitel oder Abschnitt) */
  const budgetNode = $derived([...trail].reverse().find((n) => n.duration))
  let budgetStart = $state(0)
  let budgetId = ''
  $effect(() => {
    const id = budgetNode?.id ?? ''
    untrack(() => {
      if (id !== budgetId) {
        budgetId = id
        budgetStart = elapsed
      }
    })
  })
  const budgetUsed = $derived(elapsed - budgetStart)

  // ---------- Notizen ----------

  function loadFont() {
    try { return Number(localStorage.getItem(FONT_KEY)) || 22 } catch { return 22 }
  }
  let fontSize = $state(loadFont())
  function zoomNotes(delta: number) {
    fontSize = Math.max(14, Math.min(48, fontSize + delta))
    try { localStorage.setItem(FONT_KEY, String(fontSize)) } catch { /* egal */ }
  }

  // ---------- Verbindung ----------

  let firstKey = ''
  /** Präsentation, an die diese Presenter-View gekoppelt ist (bei mehreren offenen Präsentationen) */
  let target: string | null = null
  let link: PresenterLink | null = null
  /** Verbindung möglich? file:// braucht das öffnende Fenster, http(s) den BroadcastChannel */
  const linkable = usesChannel() || !!audience

  function onState(msg: Extract<PresenterMessage, { type: 'hashmark:presenter-state' }>) {
    // an die erste Präsentation koppeln; ist sie länger weg, an die nächste, die sich meldet
    if (!target || Date.now() - lastSeen > 3500) {
      target = msg.session
      // beim Koppeln den Plan der Präsentation angleichen
      queueMicrotask(sendPlan)
    }
    if (msg.session !== target) return
    lastSeen = Date.now()
    const key = `${msg.pos.id}:${msg.pos.slide}:${msg.pos.step ?? 0}`
    // Timer startet mit der ersten Bewegung nach dem Öffnen
    if (!firstKey) firstKey = key
    else if (key !== firstKey && !timer.running && timer.accumulated === 0) startTimer()
    pos = msg.pos
    black = msg.black
    all = msg.all
    trip = msg.trip
  }

  function sendPlan() {
    // an alle offenen Präsentationen: der Plan gehört zum Deck, nicht zu einer Sitzung
    link?.send({ type: 'hashmark:presenter-plan', plan: planFile })
  }

  /** Fahrplan geändert: speichern und der Präsentation mitteilen */
  function setPlan(file: PlanFile) {
    planFile = file
    savePlanFile(file)
    sendPlan()
  }

  /** Taste T der Präsentation: Plan aus- bzw. einschalten */
  function toggleAll() {
    link?.send({ type: 'hashmark:presenter-key', key: 't', shiftKey: false, target: target ?? undefined })
  }

  function goto(id: string, slide = 0) {
    link?.send({ type: 'hashmark:presenter-goto', id, slide, target: target ?? undefined })
  }

  function onkeydown(e: KeyboardEvent) {
    if (searching || planOpen) return
    if ((e.target as HTMLElement | null)?.closest?.('input, select, textarea')) return
    if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); planOpen = true; return }
    if (((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !e.ctrlKey)) {
      e.preventDefault()
      searching = true
      return
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return
    // Presenter-Fernbedienung „Play“ würde hier sonst neu laden
    if (e.key === 'F5') { e.preventDefault(); return }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomNotes(2); return }
    if (e.key === '-') { e.preventDefault(); zoomNotes(-2); return }
    if (e.key === 't' || e.key === 'T') { e.preventDefault(); if (timer.running) pauseTimer(); else startTimer(); return }
    if (FORWARDED_KEYS.has(e.key)) {
      e.preventDefault()
      link?.send({ type: 'hashmark:presenter-key', key: e.key, shiftKey: e.shiftKey, target: target ?? undefined })
    }
  }

  onMount(() => {
    document.title = `Presenter · ${deck?.title ?? 'Hashmark'}`
    void loadPlanFile().then((file) => { planFile = file; sendPlan() })
    link = openLink(() => audience, (msg) => { if (msg.type === 'hashmark:presenter-state') onState(msg) })
    const hello = () => link?.send({ type: 'hashmark:presenter-hello' })
    hello()
    const heartbeat = setInterval(hello, 1000)
    const tick = setInterval(() => (now = Date.now()), 250)

    // Vite-HMR bzw. Server-Sent Events in der Desktop-App
    onDeckUpdate((payload: Payload) => {
      if ('error' in payload) return
      deck = payload.deck
      nodes = payload.deck.nodes
    })
    return () => {
      link?.close()
      clearInterval(heartbeat)
      clearInterval(tick)
    }
  })

  const clock = $derived(new Date(now).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }))
  const paceText = $derived(
    !plan ? '' : plan.pace === 'on-time' ? 'im Plan' : plan.pace === 'behind' ? `${formatClock(plan.diff)} hinter Plan` : `${formatClock(-plan.diff)} voraus`,
  )
</script>

<svelte:window {onkeydown} />

{#snippet tree(list: DeckNode[])}
  <ul class="pv-tree">
    {#each list as n (n.id)}
      {@const inTrail = trail.includes(n)}
      <li>
        <button class="pv-tree-item" class:current={n.id === pos?.id} class:trail={inTrail && n.id !== pos?.id}
          class:optional={nav.state(n.id) === 'optional'} class:appendix={nav.state(n.id) === 'appendix'}
          style:padding-left="{8 + (n.depth - 1) * 14}px" onclick={() => goto(n.id)}>
          <span class="pv-tree-title">{n.title}</span>
          {#if nav.state(n.id) !== 'path'}<span class="pv-tree-role">{PLAN_LABEL[nav.state(n.id)]}</span>{/if}
          {#if n.duration}<span class="pv-tree-time">{formatClock(n.duration)}</span>{/if}
          {#if n.children.length && !inTrail}<span class="pv-tree-count">↓{n.children.length}</span>{/if}
        </button>
        {#if inTrail && n.children.length}{@render tree(n.children)}{/if}
      </li>
    {/each}
  </ul>
{/snippet}

<div class="presenter">
  <header class="pv-bar">
    <strong class="pv-deck">{deck?.title ?? 'Hashmark'}</strong>
    <span class="pv-conn" class:ok={connected} title={connected ? 'mit der Präsentation verbunden' : 'keine Verbindung'}>
      {connected ? 'verbunden' : linkable ? 'verbinde …' : 'ohne Präsentation – mit S aus der Präsentation öffnen'}
    </span>
    {#if black}<span class="pv-black">Schwarzbild</span>{/if}
    <span class="pv-spacer"></span>
    {#if plan}
      <span class="pv-plan pace-{plan.pace}" title="Zeitplan laut deck.yaml: duration">
        {paceText} · noch {formatClock(Math.max(0, plan.remaining))}
      </span>
    {/if}
    {#if tripBack}<span class="pv-trip" title="Space führt von selbst zurück, Esc bricht ab">↩ Ausflug · zurück zu „{tripBack.title}“</span>{/if}
    {#if all}<span class="pv-trip off">Plan aus (T)</span>{/if}
    <button class="pv-planbtn" onclick={() => (planOpen = true)} title="Vortragsplan bearbeiten (P)">
      Plan <b>{formatClock(planSum.path)}</b>{planFile.active !== 'Standard' ? ' · ' + planFile.active : ''}
    </button>
    <span class="pv-timer" class:running={timer.running}>
      <span class="pv-elapsed">{formatClock(elapsed)}</span>
      <button onclick={() => (timer.running ? pauseTimer() : startTimer())} title="Timer starten/pausieren (T)">{timer.running ? '❚❚' : '▶'}</button>
      <button onclick={resetTimer} title="Timer zurücksetzen">↺</button>
    </span>
    <span class="pv-clock">{clock}</span>
  </header>

  <aside class="pv-side">
    <div class="pv-side-head">Baum</div>
    {#if deck}{@render tree(deck.nodes)}{/if}
  </aside>

  <section class="pv-current">
    <div class="pv-label">
      <span>Aktuell</span>
      {#if node}<span class="pv-crumb">{trail.map((t) => t.title).join(' › ')}</span>{/if}
      <span class="pv-pos">{stepCount ? `Schritt ${step}/${stepCount} · ` : ''}{progress.index} / {progress.total}</span>
    </div>
    {#if node && pos}
      <ScaledSlide {node} slide={pos.slide} {step} layout={layoutOf(node)} />
    {:else}
      <p class="pv-wait">Warte auf die Präsentation …</p>
    {/if}
    <div class="pv-moves">
      {#if node?.children.length}
        <span class="pv-dive"><kbd>↓</kbd> {node.children.length} {node.children.length === 1 ? 'Detail' : 'Details'}:
          {#each node.children as c, i (c.id)}{#if i}, {/if}<button class:off={!nav.onPath(c.id)} onclick={() => goto(c.id)}>{c.title}</button>{/each}
        </span>
      {/if}
      {#if right && right.pos.id !== pos?.id}
        <span class="pv-right"><kbd>→</kbd> {nav.node(right.pos.id)?.title}</span>
      {/if}
      {#if budgetNode?.duration}
        <span class="pv-budget" class:over={budgetUsed > budgetNode.duration} title="Zeit seit Beginn von „{budgetNode.title}“">
          {budgetNode.title}: {formatClock(budgetUsed)} / {formatClock(budgetNode.duration)}
        </span>
      {/if}
    </div>
  </section>

  <section class="pv-next">
    <div class="pv-label"><span>Als Nächstes <kbd>Space</kbd></span><span class="pv-next-title">{nextLabel}</span></div>
    {#if next && nextNode}
      <ScaledSlide node={nextNode} slide={next.pos.slide} step={next.pos.step ?? 0} layout={layoutOf(nextNode)} />
    {:else}
      <p class="pv-wait">Ende des Vortrags</p>
    {/if}
  </section>

  <section class="pv-notes" style:--notes-size="{fontSize}px">
    <div class="pv-label">
      <span>Notizen</span>
      <span class="pv-zoom">
        <button onclick={() => zoomNotes(-2)} title="kleiner (−)">A−</button>
        <button onclick={() => zoomNotes(2)} title="größer (+)">A+</button>
      </span>
    </div>
    <div class="pv-notes-scroll">
      <Notes html={node && pos ? node.slides[pos.slide]?.notes : undefined} {step} />
    </div>
  </section>

  {#if planOpen}
    <PlanPanel {nav} file={planFile} duration={deck?.duration} currentId={pos?.id} planOff={all} onchange={setPlan} ontoggleall={toggleAll}
      onclose={() => (planOpen = false)} />
  {/if}

  {#if searching && deck}
    <Search nodes={deck.nodes} onjump={(p) => { searching = false; goto(p.id, p.slide) }} onclose={() => (searching = false)} />
  {/if}
</div>

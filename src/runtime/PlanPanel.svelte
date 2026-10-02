<script lang="ts">
  import type { Navigator } from '../core/navigator.ts'
  import {
    DEFAULT_PLAN, PLAN_LABEL, PLAN_STATES, activeStates, ownSeconds, presetAll, presetBudget, presetDepth, resetSubtree, setSubtree, summarize,
    type PlanFile, type PlanState, type PlanStates,
  } from '../core/plan.ts'
  import { formatClock } from '../core/timing.ts'
  import type { DeckNode } from '../core/types.ts'

  // Vortragsplan bearbeiten (Presenter-View, Taste P): jeder Knoten ist Pfad, Optional oder Anhang.
  // Space läuft nur den Pfad. Optionales erreicht man per ↓, den Anhang über Suche oder Übersicht.

  let { nav, file, duration, currentId, planOff, onchange, ontoggleall, onclose }: {
    nav: Navigator
    file: PlanFile
    /** geplante Gesamtdauer in Sekunden (deck.yaml), als Vorgabe fürs Zeitbudget */
    duration?: number
    currentId?: string
    /** Plan in der Präsentation ausgeschaltet (T) */
    planOff: boolean
    onchange: (file: PlanFile) => void
    ontoggleall: () => void
    onclose: () => void
  } = $props()

  /** Navigator ohne Ausflüge und ohne T: so sieht der Plan wirklich aus */
  const view = $derived(nav.with({ all: false, trip: [] }))
  const states = $derived(activeStates(file))
  const sum = $derived(summarize(view))
  const entry = $derived(file.plans[file.active])
  const names = $derived(Object.keys(file.plans))

  // Vorgabe nur beim Öffnen: danach gehört das Feld dem Nutzer
  // svelte-ignore state_referenced_locally
  let minutes = $state<string | number>(String(Math.round((entry?.budget ?? duration ?? 30 * 60) / 60)))
  let newName = $state('')

  const budget = $derived(Number(minutes) > 0 ? Number(minutes) * 60 : undefined)
  const over = $derived(budget !== undefined && sum.path > budget)

  function store(next: PlanStates, withBudget?: number) {
    onchange({ ...file, plans: { ...file.plans, [file.active]: { states: next, ...(withBudget ? { budget: withBudget } : {}) } } })
  }

  const nodes = $derived([...view.walk()])
  const minutesOf = (n: DeckNode) => Math.max(1, Math.round(ownSeconds(n) / 60))
  const maxDepth = $derived(Math.max(1, ...nodes.map((n) => n.depth)))

  function addPlan() {
    const name = newName.trim()
    if (!name || file.plans[name]) return
    // neuer Fahrplan beginnt mit einer Kopie des aktuellen
    onchange({ ...file, active: name, plans: { ...file.plans, [name]: { states: { ...states }, ...(entry?.budget ? { budget: entry.budget } : {}) } } })
    newName = ''
  }

  function removePlan() {
    if (file.active === DEFAULT_PLAN) return
    const { [file.active]: _gone, ...rest } = file.plans
    onchange({ active: DEFAULT_PLAN, plans: rest })
  }

  const choose = (n: DeckNode, state: PlanState) => store(setSubtree(view, states, n.id, state), entry?.budget)
  const authorOf = (n: DeckNode) => (n.plan ? PLAN_LABEL[n.plan] : '')

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onclose()
    }
  }
</script>

<svelte:window {onkeydown} />

<div class="pp-backdrop" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose()}>
  <div class="pp" role="dialog" aria-modal="true" aria-label="Vortragsplan">
    <header class="pp-head">
      <strong>Vortragsplan</strong>
      <label class="pp-plan">
        Fahrplan
        <select value={file.active} onchange={(e) => onchange({ ...file, active: e.currentTarget.value })}>
          {#each names as name (name)}<option value={name}>{name}</option>{/each}
        </select>
      </label>
      {#if file.active !== DEFAULT_PLAN}<button onclick={removePlan} title="diesen Fahrplan löschen">Löschen</button>{/if}
      <form class="pp-new" onsubmit={(e) => { e.preventDefault(); addPlan() }}>
        <input type="text" placeholder="neuer Fahrplan …" bind:value={newName} aria-label="Name des neuen Fahrplans" />
        <button type="submit" disabled={!newName.trim() || !!file.plans[newName.trim()]}>Kopie anlegen</button>
      </form>
      <button class="pp-close" onclick={onclose} aria-label="Schließen (Esc)">✕</button>
    </header>

    <div class="pp-presets">
      <span class="pp-label">Vorlagen</span>
      <button onclick={() => store({})} title="Standard des Autors ({'{optional}'}, {'{appendix}'})">Standard</button>
      <button onclick={() => store(presetAll(view))} title="Alles ist Pfad, auch Optionales und Anhang">Alles</button>
      {#each { length: Math.min(maxDepth - 1, 4) } as _, i (i)}
        <button onclick={() => store(presetDepth(view, i + 1))} title="Tiefere Ebenen werden optional">Bis Ebene {i + 1}</button>
      {/each}
      <span class="pp-budget">
        <input type="number" min="1" max="600" bind:value={minutes} aria-label="Zeitbudget in Minuten" /> min
        <button disabled={!budget} onclick={() => budget && store(presetBudget(view, budget), budget)}
          title="Wirft die tiefsten und letzten Knoten aus dem Pfad, bis es ins Budget passt">Zeitbudget</button>
      </span>
    </div>

    <ul class="pp-list">
      {#each nodes as n (n.id)}
        {@const st = view.state(n.id)}
        <li class="pp-row st-{st}" class:current={n.id === currentId}>
          <span class="pp-name" style:padding-left="{(n.depth - 1) * 16}px" title={n.id}>{n.title}</span>
          {#if !(n.id in states) && n.plan}<span class="pp-author" title="Standard des Autors">Autor: {authorOf(n)}</span>{/if}
          <span class="pp-time">{minutesOf(n)} min</span>
          <span class="pp-seg" role="group" aria-label="Rolle von {n.title}">
            {#each PLAN_STATES as s (s)}
              <button class="s-{s}" class:on={st === s} aria-pressed={st === s} onclick={() => choose(n, s)}>{PLAN_LABEL[s]}</button>
            {/each}
          </span>
          <button class="pp-reset" disabled={!(n.id in states)} onclick={() => store(resetSubtree(view, states, n.id), entry?.budget)}
            title="Überschreibung zurücknehmen (Standard des Autors)" aria-label="Zurücksetzen">↺</button>
        </li>
      {/each}
    </ul>

    <footer class="pp-foot">
      <span class="pp-sum" class:over><b>{formatClock(sum.path)}</b> Pfad{budget ? ` von ${formatClock(budget)}` : ''}</span>
      <span>{formatClock(sum.optional)} optional</span>
      <span>{formatClock(sum.appendix)} Anhang</span>
      <span class="pp-note">Schätzung: {'{duration}'} an Blättern, sonst 1 min je Folie</span>
      <button class="pp-all" class:on={planOff} onclick={ontoggleall} title="In der Präsentation: Plan aus, Space läuft durch alles (T)">
        {planOff ? 'Plan ist aus – wieder einschalten' : 'Plan ausschalten (alles zeigen)'}
      </button>
    </footer>
  </div>
</div>

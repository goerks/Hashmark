<script lang="ts">
  import type { DeckNode, PlanState } from '../core/types.ts'
  import { PLAN_LABEL } from '../core/plan.ts'
  import type { Position } from '../core/navigator.ts'
  import Slide from './Slide.svelte'
  import { labelOf } from '../core/numbering.ts'

  let { nodes, current, trail, layoutOf, roleOf = () => 'path', onjump, onclose }: {
    nodes: DeckNode[]
    current: Position
    /** IDs der Vorfahren des aktuellen Knotens */
    trail: string[]
    layoutOf: (node: DeckNode) => string
    /** Rolle im Vortragsplan (Pfad, Optional, Anhang) */
    roleOf?: (node: DeckNode) => PlanState
    onjump: (pos: Position) => void
    onclose: () => void
  } = $props()

  /** Jede Folie (inkl. Sub-Slides) in Tiefensuche; `lane` = Kapitel auf Ebene 1 */
  interface Entry { node: DeckNode; slide: number; lane: number }

  const entries = $derived.by(() => {
    const out: Entry[] = []
    const walk = (list: DeckNode[], lane: number) => {
      for (const node of list) {
        node.slides.forEach((_, slide) => out.push({ node, slide, lane }))
        walk(node.children, lane)
      }
    }
    nodes.forEach((top, lane) => walk([top], lane))
    return out
  })
  const indexOf = $derived(new Map(entries.map((e, i) => [`${e.node.id}:${e.slide}`, i])))

  let selected = $state(0)
  let root: HTMLElement

  $effect.pre(() => {
    selected = indexOf.get(`${current.id}:${current.slide}`) ?? 0
  })

  $effect(() => {
    root.querySelector(`[data-entry="${selected}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })

  function move(key: string): number {
    const cur = entries[selected]
    if (!cur) return selected
    const sameNode = (i: number) => entries[i]?.node === cur.node
    const nodeStart = (i: number) => { while (i > 0 && entries[i - 1].node === entries[i].node) i--; return i }
    const firstOfLane = (lane: number) => entries.findIndex((e) => e.lane === lane)
    switch (key) {
      case 'ArrowRight':
        if (sameNode(selected + 1)) return selected + 1
        return cur.lane < nodes.length - 1 ? firstOfLane(cur.lane + 1) : selected
      case 'ArrowLeft':
        if (cur.slide > 0) return selected - 1
        return cur.lane > 0 ? firstOfLane(cur.lane - 1) : selected
      case 'ArrowDown': {
        // nächster Knoten im selben Kapitel
        let i = selected
        while (sameNode(i + 1)) i++
        return entries[i + 1]?.lane === cur.lane ? i + 1 : selected
      }
      case 'ArrowUp': {
        const start = nodeStart(selected)
        return start > 0 && entries[start - 1].lane === cur.lane ? nodeStart(start - 1) : selected
      }
      case 'Home': return 0
      case 'End': return entries.length - 1
    }
    return selected
  }

  function choose(i: number) {
    const e = entries[i]
    if (e) onjump({ id: e.node.id, slide: e.slide })
  }

  function onkeydown(e: KeyboardEvent) {
    const toggle = (e.key === 'o' || e.key === 'O') && !e.altKey && !e.metaKey
    if (e.key === 'Escape' || toggle) { e.preventDefault(); onclose(); return }
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(selected); return }
    const next = move(e.key)
    if (next !== selected || e.key.startsWith('Arrow')) e.preventDefault()
    selected = next
  }
</script>

<svelte:window {onkeydown} />

{#snippet card(node: DeckNode)}
  {@const role = roleOf(node)}
  <div class="nv-node" data-depth={node.depth} data-role={role}>
    <div class="nv-head" class:trail={trail.includes(node.id)}>
      <button class="nv-title" onclick={() => onjump({ id: node.id, slide: 0 })}>{labelOf(node)}</button>
      {#if role !== 'path'}<span class="nv-role {role}">{PLAN_LABEL[role]}</span>{/if}
      {#if node.slides.length > 1}<span class="nv-meta">{node.slides.length} Folien</span>{/if}
    </div>
    <div class="nv-thumbs">
      {#each node.slides as _, slide (slide)}
        {@const i = indexOf.get(`${node.id}:${slide}`) ?? -1}
        <button
          class="nv-thumb"
          class:current={node.id === current.id && slide === current.slide}
          class:selected={i === selected}
          data-entry={i}
          title={node.slides.length > 1 ? `${node.title} (${slide + 1}/${node.slides.length})` : node.title}
          onclick={() => choose(i)}
          onmouseenter={() => (selected = i)}
        >
          <div class="nv-thumb-stage" inert>
            <Slide {node} {slide} layout={layoutOf(node)} />
          </div>
          {#if node.slides.length > 1}<span class="nv-num">{slide + 1}</span>{/if}
        </button>
      {/each}
    </div>
    {#if node.children.length}
      <div class="nv-children">
        {#each node.children as child (child.id)}{@render card(child)}{/each}
      </div>
    {/if}
  </div>
{/snippet}

<div class="nav-overview" role="dialog" aria-modal="true" aria-label="Navigations-Übersicht" bind:this={root}>
  <header class="nv-bar">
    <strong>Navigations-Übersicht</strong>
    <span class="hint">Klick oder ← → ↑ ↓ + Enter springt · Esc schließt</span>
    <button class="nv-close" onclick={onclose} aria-label="Schließen">✕</button>
  </header>
  <div class="nv-lanes">
    {#each nodes as top, lane (top.id)}
      <section class="nv-lane">
        <div class="nv-lane-num">{lane + 1}</div>
        {@render card(top)}
      </section>
    {/each}
  </div>
</div>

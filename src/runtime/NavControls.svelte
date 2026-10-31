<script module lang="ts">
  import type { Move } from '../core/navigator.ts'

  export type ControlKey = 'up' | 'down' | 'left' | 'right' | 'forward'
  export interface Control { move: Move | null; label: string }
</script>

<script lang="ts">
  // Karte mit Steuerkreuz: zeigt, wohin es von hier aus geht, und ist klickbar.
  // Erscheint bei Mausbewegung oder Taste und zieht sich nach 3 s zurück (awake); Position und Details stehen dauerhaft in der Fußzeile.

  let { controls, awake, onmove }: {
    controls: Record<ControlKey, Control>
    /** Maus oder Tasten waren zuletzt aktiv */
    awake: boolean
    onmove: (key: ControlKey) => void
  } = $props()

  /** überfahrene Richtung → ihr Ziel steht in der Infozeile */
  let hover = $state<ControlKey | null>(null)

  const pad: { key: ControlKey; area: string; keyHint: string; path: string }[] = [
    { key: 'up', area: 'up', keyHint: '↑', path: 'M6 15l6-6 6 6' },
    { key: 'left', area: 'left', keyHint: '←', path: 'M15 6l-6 6 6 6' },
    { key: 'right', area: 'right', keyHint: '→', path: 'M9 6l6 6-6 6' },
    { key: 'down', area: 'down', keyHint: '↓', path: 'M6 9l6 6 6-6' },
  ]
</script>

<nav class="nav-controls" class:gone={!awake} aria-label="Navigation">
  <div class="nc-info">
    {#if hover && hover !== 'forward'}
      <span class="nc-next nc-hover"><kbd>{pad.find((p) => p.key === hover)?.keyHint}</kbd><span class="nc-next-label">{controls[hover].label}</span></span>
    {:else if controls.forward.move}
      <button class="nc-next" onclick={() => onmove('forward')} title="Space / PageDown: der Linie nach weiter">
        <kbd>Space</kbd><span class="nc-next-label">{controls.forward.label}</span>
      </button>
    {:else}
      <span class="nc-next nc-end">Ende</span>
    {/if}
  </div>

  <div class="nc-pad">
    {#each pad as p (p.key)}
      {@const c = controls[p.key]}
      <button
        class="nc-btn nc-{p.area}"
        disabled={!c.move}
        aria-label="{p.keyHint} {c.label || 'nicht möglich'}"
        onclick={() => onmove(p.key)}
        onpointerenter={() => (hover = c.move ? p.key : null)}
        onpointerleave={() => (hover = null)}
        onfocus={() => (hover = c.move ? p.key : null)}
        onblur={() => (hover = null)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={p.path} /></svg>
      </button>
    {/each}
    <span class="nc-center" aria-hidden="true"></span>
  </div>
</nav>

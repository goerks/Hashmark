<script lang="ts">
  import { onMount } from 'svelte'
  import initial from 'virtual:hashmark/deck'
  import { Navigator, parseHash } from '../core/navigator.ts'
  import ScaledSlide from './ScaledSlide.svelte'
  import './reader.css'

  // Einzelkarte (?card#id:folie&step=n): nur eine Folie, ohne Bedienelemente. Für Doku-Seiten, die einzelne Folien einbetten.
  // Die einbettende Seite kann per postMessage `{ type: 'hashmark:card', id?, slide?, step? }` umschalten.

  const deck = 'deck' in initial ? initial.deck : null
  const nav = deck ? new Navigator(deck.nodes) : null

  const fromUrl = () => {
    const pos = parseHash(location.hash)
    const step = new URLSearchParams(location.search).get('step')
    return { id: pos?.id ?? nav?.first?.id ?? '', slide: pos?.slide ?? 0, step: step === null ? Infinity : Number(step) }
  }
  let cur = $state(fromUrl())
  const node = $derived(nav?.node(cur.id))

  onMount(() => {
    document.body.classList.add('card')
    const onHash = () => (cur = { ...cur, ...fromUrl() })
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.type !== 'hashmark:card') return
      cur = { id: e.data.id ?? cur.id, slide: e.data.slide ?? cur.slide, step: e.data.step === undefined ? cur.step : Number(e.data.step) }
    }
    addEventListener('hashchange', onHash)
    addEventListener('message', onMessage)
    return () => { removeEventListener('hashchange', onHash); removeEventListener('message', onMessage) }
  })
</script>

<div class="card-root">
  {#if node && deck}
    <ScaledSlide {node} slide={Math.min(cur.slide, node.slides.length - 1)} step={cur.step} layout={node.layout ?? node.attrs.layout ?? deck.layout ?? 'default'} />
  {/if}
</div>

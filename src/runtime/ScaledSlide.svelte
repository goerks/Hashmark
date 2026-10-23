<script lang="ts">
  import type { DeckNode } from '../core/types.ts'
  import Slide from './Slide.svelte'
  import type { MediaMode } from './video.ts'

  // Folie (1280 × 720) in einen beliebig großen Rahmen einpassen, z. B. in der Presenter-View.

  let { node, slide, step, layout, media = 'off' }: { node: DeckNode; slide: number; step: number; layout: string; media?: MediaMode } = $props()

  let box: HTMLElement
  let scale = $state(0.5)

  $effect(() => {
    const measure = () => (scale = Math.max(0.05, Math.min(box.clientWidth / 1280, box.clientHeight / 720)))
    const ro = new ResizeObserver(measure)
    ro.observe(box)
    measure()
    return () => ro.disconnect()
  })
</script>

<div class="scaled" bind:this={box}>
  <div class="scaled-stage" style="--scale:{scale}" inert>
    <Slide {node} {slide} {step} {layout} {media} />
  </div>
</div>

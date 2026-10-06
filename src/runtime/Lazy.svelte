<script lang="ts">
  import type { Snippet } from 'svelte'

  // Inhalt erst rendern, wenn der Rahmen in die Nähe des Sichtbereichs kommt (Lesemodus: viele Folien, nur wenige sichtbar).

  let { children, margin = 900 }: { children: Snippet; margin?: number } = $props()

  let box: HTMLElement
  let seen = $state(false)

  $effect(() => {
    if (seen) return
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        seen = true
        io.disconnect()
      }
    }, { rootMargin: `${margin}px 0px` })
    io.observe(box)
    return () => io.disconnect()
  })
</script>

<div class="rd-frame" bind:this={box}>
  {#if seen}{@render children()}{/if}
</div>

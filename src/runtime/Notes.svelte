<script lang="ts">
  // Sprechernotizen einer Sub-Slide. `::: notes step=k` ist beim Schritt k hervorgehoben,
  // spätere Schritte sind gedämpft, frühere normal.

  let { html, step }: { html?: string; step: number } = $props()

  let el: HTMLElement

  $effect(() => {
    void html
    for (const note of el.querySelectorAll<HTMLElement>('[data-note-step]')) {
      const k = Number(note.dataset.noteStep)
      note.classList.toggle('note-now', k === step)
      note.classList.toggle('note-later', k > step)
      note.dataset.label = `Schritt ${k}`
    }
  })
</script>

<div class="notes-body" bind:this={el}>
  {#if html}{@html html}{:else}<p class="notes-empty">Keine Notizen zu dieser Folie</p>{/if}
</div>

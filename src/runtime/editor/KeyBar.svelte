<script lang="ts">
  // Schnelltasten über der Bildschirmtastatur (Tablet): Zeichen, die dort mühsam zu tippen sind.
  import { onMount } from 'svelte'
  import type { Editor } from './codemirror.ts'

  let { ed, onblocks }: { ed: Editor; onblocks: () => void } = $props()

  /** Abstand zum unteren Rand des sichtbaren Bereichs (über der Tastatur) */
  let bottom = $state(0)

  onMount(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => { bottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop) }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  })
</script>

<!-- mousedown nicht weitergeben: der Editor soll den Fokus (und die Tastatur) behalten -->
<div class="ed-keybar" style="bottom: {bottom}px" role="toolbar" aria-label="Schnelltasten" onmousedown={(e) => e.preventDefault()}>
  <button class="acc" onclick={onblocks}>+ Baustein</button>
  <button onclick={() => ed.tab()} aria-label="Einrücken">⇥</button>
  <button onclick={() => ed.heading()} aria-label="Überschrift">#</button>
  <button onclick={() => ed.typeText('::: ')}>:::</button>
  <button onclick={() => ed.wrap('{', '}')} aria-label="Geschweifte Klammern">{'{ }'}</button>
  <button onclick={() => ed.wrap('`')} aria-label="Code">`</button>
  <button onclick={() => ed.typeText('- ')} aria-label="Listenpunkt">-</button>
  <button onclick={() => ed.wrap('[', ']')} aria-label="Eckige Klammern">[ ]</button>
  <button onclick={() => ed.wrap('**')} aria-label="Fett"><b>B</b></button>
  <button onclick={() => ed.wrap('*')} aria-label="Kursiv"><i>I</i></button>
  <button onclick={() => ed.undo()} aria-label="Rückgängig">↶</button>
  <button onclick={() => ed.redo()} aria-label="Wiederholen">↷</button>
</div>

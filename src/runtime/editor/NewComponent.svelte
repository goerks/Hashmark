<script lang="ts">
  import { onMount } from 'svelte'
  import { componentNameProblem } from '../../core/component-edit.ts'
  import type { NewComponent } from './api.ts'

  // Dialog „Neue Komponente“: Name, Beschreibung, Attribute und Aufbau. Der Editor legt daraus Vorlage und
  // Gestaltung als Gerüst an und öffnet die Vorlage.

  let { oncreate, onclose }: { oncreate: (input: NewComponent) => Promise<string | null>; onclose: () => void } = $props()

  let name = $state('')
  let description = $state('')
  let attrs = $state('title')
  let children = $state(false)
  let busy = $state(false)
  /** Fehlertext vom Anlegen (z. B. „gibt es schon“) */
  let error = $state('')
  let input: HTMLInputElement

  /** erst Meldungen zeigen, wenn schon etwas im Feld steht */
  const problem = $derived(name ? componentNameProblem(name) : null)
  const attrList = $derived(attrs.split(/[\s,]+/).filter(Boolean))
  const ready = $derived(!!name && !problem && !busy)

  async function submit(e: Event) {
    e.preventDefault()
    if (!ready) return
    busy = true
    error = (await oncreate({ name, description, attrs: attrList, children })) ?? ''
    busy = false
  }

  onMount(() => input.focus())
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="po-backdrop" onclick={(e) => e.target === e.currentTarget && onclose()}>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <form class="po" role="dialog" aria-label="Neue Komponente" onsubmit={submit} onkeydown={(e) => e.key === 'Escape' && onclose()}>
    <header>
      <strong>Neue Komponente</strong>
      <button type="button" class="po-close" onclick={onclose} aria-label="Schließen (Esc)">✕</button>
    </header>
    <p class="po-note">Legt <code>components/{name || 'name'}.html</code> und <code>.css</code> an. In Folien schreibst du dann <code>::: {name || 'name'}</code>.</p>
    <label class="nc-field">
      <span>Name</span>
      <input bind:this={input} bind:value={name} placeholder="merksatz" autocomplete="off" autocapitalize="off" spellcheck="false" aria-invalid={!!problem} />
    </label>
    {#if problem}<p class="po-note warn" role="alert">{problem}</p>{/if}
    <label class="nc-field">
      <span>Beschreibung</span>
      <input bind:value={description} placeholder="Hervorgehobener Satz mit Überschrift" autocomplete="off" />
    </label>
    <label class="nc-field">
      <span>Attribute</span>
      <input bind:value={attrs} placeholder="title, icon" autocomplete="off" autocapitalize="off" spellcheck="false" />
      <small>Das erste ist Pflicht. Mit Komma oder Leerzeichen trennen.</small>
    </label>
    <fieldset>
      <legend>Aufbau</legend>
      <label class="po-radio"><input type="radio" name="aufbau" checked={!children} onchange={() => (children = false)} /> Einfacher Kasten <small>Überschrift und Inhalt</small></label>
      <label class="po-radio"><input type="radio" name="aufbau" checked={children} onchange={() => (children = true)} /> Mit Einträgen <small>Kind-Container wie bei <code>kpis</code></small></label>
    </fieldset>
    {#if error}<p class="po-note warn" role="alert">{error}</p>{/if}
    <div class="nc-actions">
      <button type="button" onclick={onclose}>Abbrechen</button>
      <button type="submit" class="nc-primary" disabled={!ready}>{busy ? 'Legt an …' : 'Anlegen'}</button>
    </div>
  </form>
</div>

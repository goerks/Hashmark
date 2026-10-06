<script lang="ts">
  import { onMount } from 'svelte'
  import { loadPresentOptions, savePresentOptions, type PresentOptions } from '../desktop.ts'

  // Optionen fürs Präsentieren (Desktop-App): Presenter-View ja, nein oder automatisch, dazu der Bildschirm der
  // Präsentation und der des Presenters. Jede Änderung wird sofort gespeichert und gilt ab dem nächsten Start.

  let { onclose }: { onclose: () => void } = $props()

  let opts = $state<PresentOptions | null>(null)
  let failed = $state(false)
  /** Fehlertext der App (gelesen oder gespeichert); leer = alles gut */
  let error = $state('')

  onMount(async () => {
    if (typeof window.hmPresentOptions !== 'function') { failed = true; return }
    const r = await loadPresentOptions()
    opts = r.options ?? null
    error = r.error ?? ''
  })

  /** Auswahl speichern und mit dem Stand der Hülle abgleichen (sie prüft gegen die angeschlossenen Bildschirme) */
  async function change(patch: Partial<Pick<PresentOptions, 'presenter' | 'presentation' | 'presenterScreen'>>) {
    if (!opts) return
    error = (await savePresentOptions({ presenter: opts.presenter, presentation: opts.presentation, presenterScreen: opts.presenterScreen, ...patch })) ?? ''
    const r = await loadPresentOptions()
    opts = r.options ?? opts
    if (r.error && !error) error = r.error
  }

  const PRESENTER = [
    ['auto', 'Automatisch', 'nur mit zweitem Bildschirm'],
    ['on', 'Immer', 'Zeitplan, Notizen, nächste Folie und Vortragsplan'],
    ['off', 'Nie', 'nur die Präsentation'],
  ] as const

  // Kartenansicht: die Bildschirme so angeordnet, wie sie im System liegen
  const MAP_W = 380
  const MAP_H = 150
  const layout = $derived.by(() => {
    const m = opts?.monitors ?? []
    if (!m.length) return { boxes: [] as { s: (typeof m)[number]; left: number; top: number; w: number; h: number }[], w: 0, h: 0 }
    const x0 = Math.min(...m.map((s) => s.x))
    const y0 = Math.min(...m.map((s) => s.y))
    const width = Math.max(...m.map((s) => s.x + s.w)) - x0
    const height = Math.max(...m.map((s) => s.y + s.h)) - y0
    const k = Math.min(MAP_W / width, MAP_H / height)
    const gap = 3
    return {
      boxes: m.map((s) => ({ s, left: (s.x - x0) * k, top: (s.y - y0) * k, w: s.w * k - gap, h: s.h * k - gap })),
      w: width * k,
      h: height * k,
    }
  })

  const presentationScreen = $derived(opts ? (opts.presentation >= 0 ? opts.presentation : opts.effective.presentation) : -1)
  const presenterOn = $derived(opts ? (opts.presenter === 'on' || (opts.presenter === 'auto' && opts.effective.presenter)) : false)
  const presenterScreen = $derived(opts ? (opts.presenterScreen >= 0 ? opts.presenterScreen : opts.effective.presenterScreen) : -1)

  const name = (s: { index: number; w: number; h: number; primary: boolean }) => `Bildschirm ${s.index + 1} (${s.w}×${s.h}${s.primary ? ', Hauptbildschirm' : ''})`

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onclose() }
  }
</script>

<svelte:window {onkeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="po-backdrop" onclick={(e) => e.target === e.currentTarget && onclose()}>
  <div class="po" role="dialog" aria-modal="true" aria-label="Optionen fürs Präsentieren">
    <header>
      <strong>Präsentieren: Optionen</strong>
      <button class="po-close" onclick={onclose} aria-label="Schließen (Esc)">✕</button>
    </header>

    {#if opts}
      <fieldset>
        <legend>Presenter-View</legend>
        {#each PRESENTER as [value, label, detail] (value)}
          <label class="po-radio">
            <input type="radio" name="presenter" {value} checked={opts.presenter === value} onchange={() => change({ presenter: value })} />
            <span><b>{label}</b> <small>{detail}</small></span>
          </label>
        {/each}
        <p class="po-note">
          Mit Presenter-View zeigt die Präsentation keine Bedienhilfen (Steuerkreuz, Schritte, Details). Sie stehen im Presenter.
          Ohne bleibt alles sichtbar.
        </p>
      </fieldset>

      <fieldset>
        <legend>Bildschirme</legend>
        <div class="po-map" style="width:{layout.w}px; height:{layout.h}px" role="img" aria-label="Anordnung der Bildschirme">
          {#each layout.boxes as b (b.s.index)}
            <div class="po-screen" class:show={b.s.index === presentationScreen} class:pres={presenterOn && b.s.index === presenterScreen}
              style="left:{b.left}px; top:{b.top}px; width:{b.w}px; height:{b.h}px">
              <span class="po-num">{b.s.index + 1}</span>
              <span class="po-res">{b.s.w}×{b.s.h}{b.s.primary ? ' · Haupt' : ''}</span>
              <span class="po-roles">
                {#if b.s.index === presentationScreen}<i>Präsentation</i>{/if}
                {#if presenterOn && b.s.index === presenterScreen}<i class="alt">Presenter</i>{/if}
              </span>
            </div>
          {/each}
        </div>

        <label class="po-field">
          Präsentation auf
          <select value={opts.presentation} onchange={(e) => change({ presentation: Number(e.currentTarget.value) })}>
            <option value={-1}>Automatisch (Bildschirm {opts.effective.presentation + 1})</option>
            {#each opts.monitors as s (s.index)}<option value={s.index}>{name(s)}</option>{/each}
          </select>
        </label>
        <label class="po-field" class:off={!presenterOn}>
          Presenter auf
          <select value={opts.presenterScreen} onchange={(e) => change({ presenterScreen: Number(e.currentTarget.value) })}>
            <option value={-1}>Automatisch (Bildschirm {opts.effective.presenterScreen + 1})</option>
            {#each opts.monitors as s (s.index)}<option value={s.index}>{name(s)}</option>{/each}
          </select>
        </label>
        {#if opts.monitors.length < 2}
          <p class="po-note">Nur ein Bildschirm erkannt: Präsentation und Presenter liegen übereinander. Mit zweitem Bildschirm lassen sich beide trennen.</p>
        {:else if presenterOn && presentationScreen === presenterScreen}
          <p class="po-note warn">Präsentation und Presenter liegen auf demselben Bildschirm.</p>
        {/if}
      </fieldset>

      <p class="po-note">Beenden: <kbd>Strg W</kbd>, ✕ oben rechts in der Präsentation oder im Presenter. Die Änderungen gelten ab dem nächsten Start.</p>
      {#if error}
        <p class="po-note warn" role="alert">Speichern fehlgeschlagen: {error}<br>Details: Menü Hilfe › Protokoll öffnen.</p>
      {/if}
    {:else if error}
      <p class="po-note warn" role="alert">Die Optionen konnten nicht gelesen werden: {error}<br>Der Fehler steht im Protokoll (Menü Hilfe › Protokoll öffnen, hashmark.log).</p>
    {:else if failed}
      <p class="po-note warn">Die Optionen sind nur in der Desktop-App verfügbar.</p>
    {:else}
      <p class="po-note">Lade …</p>
    {/if}

    <footer><button class="po-done" onclick={onclose}>Fertig</button></footer>
  </div>
</div>

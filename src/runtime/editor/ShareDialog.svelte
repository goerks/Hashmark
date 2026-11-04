<script lang="ts">
  import { onMount } from 'svelte'
  import type { ShareStatus } from '../../share/client.ts'
  import { WAKING_SLOW_TEXT, WAKING_TEXT, type Activity } from '../../share/reasons.ts'
  import { shareCounts, shareLabel } from './share.ts'

  // Dialog „Teilen“ unter dem Knopf in der Kopfzeile (Variante A der Entwürfe): Links, Zustand, Abgleich.
  // Lokal ist das Original, online eine Kopie im Arbeitsspeicher des Dienstes (kann nach einem Neustart fehlen).

  let { status, busy, error, activity, asleepSince, onaction, onrefresh, onclose }: {
    status: ShareStatus
    busy: string
    error: string
    activity: Activity | null
    asleepSince: number | null
    onaction: (action: 'start' | 'push' | 'pull' | 'stop' | 'config' | 'resolve', body?: Record<string, unknown>) => void
    onrefresh: () => void
    onclose: () => void
  } = $props()

  const c = $derived(shareCounts(status))
  let server = $state('')
  let key = $state('')
  let confirmStop = $state(false)
  let copied = $state('')

  $effect(() => { if (!server) server = status.server })

  // Laufende Zeit für den Zähler beim Warten auf den Dienst
  let now = $state(Date.now())
  onMount(() => { const t = setInterval(() => (now = Date.now()), 1000); return () => clearInterval(t) })

  /** Was gerade geschieht: Aktion mit Verbinden/Wecken, oder der Dienst schläft laut Zustand */
  const live = $derived.by(() => {
    if (busy && activity && (activity.phase === 'connecting' || activity.phase === 'waking' || activity.phase === 'working')) {
      return { phase: activity.phase, label: activity.label, since: activity.since }
    }
    if (status.state === 'asleep') return { phase: 'waking' as const, label: 'Der Dienst schläft und wird gestartet …', since: asleepSince ?? now }
    return null
  })
  const secs = $derived(live ? Math.max(0, Math.round((now - live.since) / 1000)) : 0)

  const SAYS: Record<ShareStatus['state'], string> = {
    none: 'Noch nicht online. Beim Teilen entsteht eine Kopie unter einer eigenen Adresse. Dein Ordner bleibt das Original.',
    sync: 'Lokal und online sind gleich.',
    local: 'Lokal ist neuer als online.',
    remote: 'Online wurde etwas geändert und noch nicht geholt.',
    conflict: 'Dateien wurden lokal und online geändert. Wähle je Datei, welche Fassung bleibt.',
    asleep: 'Der Dienst ist gerade nicht wach. Abgleichen ist erst möglich, wenn er gestartet ist.',
    restarted: 'Der Dienst wurde neu gestartet, die Online-Kopie ist weg. Dein lokales Deck stellt sie unter demselben Link wieder her.',
    unreachable: 'Der Dienst ist nicht erreichbar.',
  }

  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); copied = what } catch { copied = '' }
    setTimeout(() => { if (copied === what) copied = '' }, 1500)
  }

  const MARK: Record<string, string> = { up: '↑', down: '↓', conflict: '!', gone: '○' }
  const WORD: Record<string, string> = { up: 'lokal neuer', down: 'online neuer', conflict: 'Konflikt', gone: 'online fehlt' }
  const entries = $derived(Object.entries(status.files).sort(([a], [b]) => a.localeCompare(b, 'de')))
  const shown = $derived(entries.slice(0, 8))

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onclose() }
  }
</script>

<svelte:window {onkeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="sh-backdrop" onclick={onclose}></div>
<div class="sh" role="dialog" aria-label="Teilen" aria-busy={busy !== ''}>
  <h3>
    <span>{status.shared ? 'Online geteilt' : 'Online teilen'}</span>
    {#if status.shared}<span class="sh-chip" data-tone={shareLabel(status).tone}><i></i>{shareLabel(status).text}</span>{/if}
  </h3>

  {#if status.shared && status.links}
    <div class="sh-link">
      <small>Ansehen</small>
      <code title={status.links.view}>{status.links.view}</code>
      <button onclick={() => copy(status.links!.view, 'view')}>{copied === 'view' ? 'Kopiert' : 'Kopieren'}</button>
    </div>
    <div class="sh-link">
      <small>Bearbeiten</small>
      <code title="Enthält das Bearbeiten-Token, nur an Mitarbeitende weitergeben">{status.links.edit}</code>
      <button onclick={() => copy(status.links!.edit, 'edit')}>{copied === 'edit' ? 'Kopiert' : 'Kopieren'}</button>
    </div>
  {/if}

  {#if live}
    <div class="sh-live" role="status" aria-live="polite">
      <div class="sh-live-head">
        <span class="sh-spin" aria-hidden="true"></span>
        <b>{live.label}</b>
        <span class="sh-time">{secs} s</span>
      </div>
      {#if live.phase === 'connecting'}
        <p class="sh-hint">Hashmark fragt {status.server.replace(/^https?:\/\//, '')} an. Antwortet der Dienst nicht sofort, schläft er vermutlich.</p>
      {:else if live.phase === 'waking'}
        <p class="sh-hint">{WAKING_TEXT}</p>
        {#if secs > 60}<p class="sh-hint sh-warn">{WAKING_SLOW_TEXT}</p>{/if}
      {/if}
    </div>
  {/if}

  <p class="sh-sum" role="status">{status.state === 'unreachable' && status.error ? status.error : SAYS[status.state]}</p>

  {#if shown.length && status.state !== 'asleep'}
    <ul class="sh-files">
      {#each shown as [path, f] (path)}
        <li>
          <span class="fb" data-state={f.state} title={WORD[f.state]}>{MARK[f.state]}</span>
          <span class="sh-name">{path}</span>
          {#if f.state === 'conflict'}
            <span class="sh-acts">
              <button disabled={busy !== ''} onclick={() => onaction('resolve', { path, keep: 'local' })}>Lokal behalten</button>
              <button disabled={busy !== ''} onclick={() => onaction('resolve', { path, keep: 'remote' })}>Online übernehmen</button>
            </span>
          {:else}<small>{WORD[f.state]}{f.deleted ? ' (gelöscht)' : ''}</small>{/if}
        </li>
      {/each}
      {#if entries.length > shown.length}<li class="sh-more">und {entries.length - shown.length} weitere</li>{/if}
    </ul>
  {/if}

  {#if !status.shared && !status.configured}
    <label class="sh-field">Adresse des Dienstes<input bind:value={server} autocomplete="off" spellcheck="false" /></label>
    <label class="sh-field">Dienst-Schlüssel<input bind:value={key} type="password" autocomplete="off" placeholder="vom Betreiber des Dienstes" /></label>
    <div class="sh-row"><button class="sh-prim" disabled={!key.trim() || busy !== ''} onclick={() => onaction('config', { server: server.trim(), key: key.trim() })}>Speichern</button></div>
  {:else}
    <div class="sh-row">
      {#if !status.shared}
        <button class="sh-prim" disabled={busy !== ''} onclick={() => onaction('start')}>{busy === 'start' ? 'Lädt hoch …' : 'Online teilen'}</button>
      {:else if status.state === 'restarted'}
        <button class="sh-prim" disabled={busy !== ''} onclick={() => onaction('start')}>{busy === 'start' ? 'Stellt wieder her …' : 'Online wiederherstellen'}</button>
      {:else if status.state === 'asleep'}
        <button class="sh-prim" disabled>Bitte warten …</button>
      {:else}
        {#if c.down}<button class="sh-prim" disabled={busy !== ''} onclick={() => onaction('pull')}>{busy === 'pull' ? 'Holt …' : `${c.down} Änderung${c.down === 1 ? '' : 'en'} holen`}</button>{/if}
        {#if c.up}<button class={c.down ? '' : 'sh-prim'} disabled={busy !== ''} onclick={() => onaction('push')}>{busy === 'push' ? 'Lädt hoch …' : `${c.up} Datei${c.up === 1 ? '' : 'en'} hochladen`}</button>{/if}
        {#if !c.up && !c.down && !c.conflict}<button disabled={busy !== ''} onclick={onrefresh}>Jetzt prüfen</button>{/if}
      {/if}
    </div>
  {/if}

  {#if error}
    <p class="sh-error" role="alert">{error}</p>
    <div class="sh-row"><button disabled={busy !== ''} onclick={onrefresh}>Erneut versuchen</button></div>
  {/if}
  <p class="sh-hint">Online ist eine Kopie. Das Original bleibt in deinem Ordner.{status.shared ? ' Online geänderte Dateien holst du hier zurück, bevor der Dienst neu startet.' : ''}</p>

  {#if status.shared}
    <div class="sh-row end">
      {#if confirmStop}
        <span class="sh-hint">Online-Kopie und Links löschen?</span>
        <button onclick={() => (confirmStop = false)}>Abbrechen</button>
        <button class="sh-danger" disabled={busy !== ''} onclick={() => { confirmStop = false; onaction('stop') }}>Teilen beenden</button>
      {:else}
        <button class="sh-danger" onclick={() => (confirmStop = true)}>Teilen beenden</button>
      {/if}
    </div>
  {/if}
</div>

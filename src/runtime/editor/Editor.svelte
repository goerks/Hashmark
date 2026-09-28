<script lang="ts">
  import { onMount } from 'svelte'
  import initial from 'virtual:strata/deck'
  import type { Deck, DeckNode } from '../../core/types.ts'
  import { formatHash, type Position } from '../../core/navigator.ts'
  import { lineOfSlide, nodeAtLine } from '../../core/sourcemap.ts'
  import { printQuery } from '../../core/print.ts'
  import { api, relativeTo, type FileEntry } from './api.ts'
  import { createEditor, type Editor } from './codemirror.ts'
  import { SNIPPETS, expand } from './snippets.ts'

  type Payload = { deck: Deck } | { error: string }
  type Status = 'saved' | 'dirty' | 'saving' | 'error'

  const STORAGE_KEY = 'strata-editor'
  const remember = (data: Record<string, unknown>) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { /* privat/blockiert */ }
  }
  const recall = (): { file?: string; line?: number; split?: number } => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
  }

  let deckName = $state('')
  let files = $state<FileEntry[]>([])
  let current = $state<string | null>(null)
  let deck = $state.raw<Deck | null>('deck' in initial ? initial.deck : null)
  let deckError = $state<string | null>('error' in initial ? initial.error : null)
  let status = $state<Status>('saved')
  let message = $state('')
  let follow = $state(true)
  let split = $state(recall().split ?? 50)
  let previewPos = $state.raw<Position | null>(null)
  let dragging = $state(false)

  let editorEl: HTMLElement
  let frame: HTMLIFrameElement
  let imageInput: HTMLInputElement
  let ed: Editor
  let savedText = ''
  let cursorLine = 1
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let syncTimer: ReturnType<typeof setTimeout> | undefined
  let imageMode: 'file' | 'base64' = 'file'
  /** zuletzt an die Vorschau geschickte Position – deren Echo nicht zurück in den Editor spiegeln */
  let requested = ''

  const kindOf = (path: string) => (/\.ya?ml$/i.test(path) ? 'yaml' : 'markdown')
  const keyOf = (id: string, slide: number) => `${id}:${slide}`
  const textFiles = $derived(files.filter((f) => f.kind !== 'image'))

  function flash(text: string) {
    message = text
    setTimeout(() => { if (message === text) message = '' }, 4000)
  }

  // ---------- Dateien ----------

  async function refreshFiles() {
    const r = await api.files()
    deckName = r.deck
    files = r.files
  }

  async function openFile(path: string, opts: { line?: number; select?: boolean } = {}) {
    if (path !== current) {
      await save()
      const text = await api.read(path)
      ed.load(text, kindOf(path))
      savedText = text
      current = path
      status = 'saved'
    }
    if (opts.line) opts.select === false ? ed.scrollToLine(opts.line) : ed.gotoLine(opts.line)
    remember({ file: path, line: opts.line ?? cursorLine, split })
  }

  async function save() {
    clearTimeout(saveTimer)
    if (!current) return
    const text = ed.text()
    if (text === savedText) {
      if (status !== 'error') status = 'saved'
      return
    }
    status = 'saving'
    try {
      await api.write(current, text)
      savedText = text
      status = ed.text() === text ? 'saved' : 'dirty'
    } catch (e) {
      status = 'error'
      flash(`Speichern fehlgeschlagen: ${(e as Error).message}`)
    }
  }

  async function newFile() {
    const name = prompt('Neue Datei (relativ zum Deck), z. B. 05-ausblick.md')
    if (!name) return
    const path = /\.md$/i.test(name) ? name : `${name}.md`
    try {
      const r = await api.create(path)
      await refreshFiles()
      await openFile(r.path, { line: 1 })
      flash(r.mounted ? `${r.path} angelegt und in deck.yaml eingetragen` : `${r.path} angelegt`)
    } catch (e) {
      flash(`Anlegen fehlgeschlagen: ${(e as Error).message}`)
    }
  }

  // ---------- Vorschau-Sync ----------

  function goto(id: string, slide: number) {
    requested = keyOf(id, slide)
    frame?.contentWindow?.postMessage({ type: 'strata:goto', id, slide, step: 'all' }, location.origin)
  }

  function syncPreview() {
    if (!deck || !current) return
    const hit = nodeAtLine(deck.nodes, current, ed.text(), cursorLine)
    if (hit) goto(hit.id, hit.slide)
  }

  /** Vorschau wurde bedient (Pfeiltasten, Übersicht) → Editor scrollt mit, Cursor bleibt */
  async function followPreview(pos: Position) {
    previewPos = pos
    if (!follow || !deck || keyOf(pos.id, pos.slide) === requested) return
    const target = lineOfSlide(deck.nodes, pos.id, pos.slide)
    if (!target) return
    if (target.file !== current) await openFile(target.file)
    const exact = lineOfSlide(deck.nodes, pos.id, pos.slide, ed.text())
    if (exact) ed.scrollToLine(exact.line)
  }

  async function jumpToNode(node: DeckNode) {
    await openFile(node.source.file, { line: node.source.line })
    goto(node.id, 0)
  }

  // ---------- Einfügen ----------

  function insertSnippet(i: number) {
    const { text, cursor } = expand(SNIPPETS[i])
    ed.insert(text, undefined, cursor)
  }

  function pickImage(mode: 'file' | 'base64') {
    imageMode = mode
    imageInput.value = ''
    imageInput.click()
  }

  const altOf = (file: File) => (file.name || 'Bild').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')

  async function insertImages(list: File[], pos?: number, mode: 'file' | 'base64' = 'file') {
    if (!current) return
    for (const file of list) {
      try {
        if (mode === 'base64') {
          const data = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(file)
          })
          const text = ed.text()
          let n = 1
          while (text.includes(`[bild-${n}]:`)) n++
          ed.insert(`![${altOf(file)}][bild-${n}]`, pos)
          ed.append(`${text.endsWith('\n') ? '' : '\n'}\n[bild-${n}]: ${data}\n`)
        } else {
          const { path } = await api.upload(file)
          ed.insert(`![${altOf(file)}](${relativeTo(current, path)})`, pos)
          await refreshFiles()
        }
      } catch (e) {
        flash(`Bild fehlgeschlagen: ${(e as Error).message}`)
      }
    }
  }

  // ---------- Layout ----------

  function startDrag(e: PointerEvent) {
    dragging = true
    const main = (e.currentTarget as HTMLElement).parentElement!
    const rect = main.getBoundingClientRect()
    const side = (main.querySelector('.ed-side') as HTMLElement).offsetWidth
    const move = (ev: PointerEvent) => {
      split = Math.max(20, Math.min(80, ((ev.clientX - rect.left - side) / (rect.width - side)) * 100))
    }
    const up = () => {
      dragging = false
      remember({ file: current, line: cursorLine, split })
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function exportPdf() {
    window.open('./' + printQuery({}, { autoprint: '1' }), '_blank')
  }

  function present() {
    window.open('./' + (previewPos ? formatHash(previewPos) : ''), '_blank')
  }

  const statusText: Record<Status, string> = {
    saved: 'Gespeichert', dirty: 'Ungespeichert', saving: 'Speichert …', error: 'Fehler beim Speichern',
  }

  onMount(() => {
    ed = createEditor(editorEl, {
      onChange() {
        status = 'dirty'
        clearTimeout(saveTimer)
        saveTimer = setTimeout(save, 400)
      },
      onCursor(line) {
        cursorLine = line
        if (!follow) return
        clearTimeout(syncTimer)
        syncTimer = setTimeout(syncPreview, 120)
      },
      onSave: save,
      onImages: (list, pos) => insertImages(list, pos),
    })
    // für Browser-Tests und Debugging
    ;(window as unknown as { __strataEditor: Editor }).__strataEditor = ed

    const onMessage = (e: MessageEvent) => {
      if (e.origin === location.origin && e.data?.type === 'strata:position') followPreview(e.data.pos)
    }
    window.addEventListener('message', onMessage)

    // Deck neu geladen (eigenes Speichern oder externe Änderung)
    import.meta.hot?.on('strata:deck', async (payload: Payload) => {
      if ('error' in payload) {
        deckError = payload.error
        return
      }
      deckError = null
      deck = payload.deck
      if (current && status === 'saved') {
        const text = await api.read(current).catch(() => null)
        if (text !== null && text !== savedText && text !== ed.text()) {
          ed.replace(text)
          savedText = text
          status = 'saved'
        }
      }
      if (follow) setTimeout(syncPreview, 60)
    })

    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (status === 'dirty' || status === 'saving') e.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)

    ;(async () => {
      await refreshFiles()
      const last = recall()
      const first = textFiles.find((f) => f.path === last.file) ?? textFiles.find((f) => f.kind === 'markdown') ?? textFiles[0]
      if (first) await openFile(first.path, { line: first.path === last.file ? last.line : 1 })
    })()

    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener('beforeunload', beforeUnload)
    }
  })
</script>

{#snippet outline(list: DeckNode[])}
  <ul>
    {#each list as node (node.id)}
      <li>
        <button
          class="ol-item"
          class:active={previewPos?.id === node.id}
          class:here={node.source.file === current}
          data-depth={node.depth}
          title="{node.source.file}:{node.source.line}"
          onclick={() => jumpToNode(node)}
        >{node.title}{#if node.slides.length > 1}<span class="ol-meta">{node.slides.length}</span>{/if}</button>
        {#if node.children.length}{@render outline(node.children)}{/if}
      </li>
    {/each}
  </ul>
{/snippet}

<div class="ed-app" class:dragging>
  <header class="ed-bar">
    <strong class="ed-brand">Strata Editor</strong>
    <span class="ed-deck">{deck?.title ?? deckName}</span>
    <div class="ed-tools" role="toolbar" aria-label="Einfügen">
      {#each SNIPPETS as s, i (s.label)}
        <button onclick={() => insertSnippet(i)} title={s.title}>{s.label}</button>
      {/each}
      <span class="sep"></span>
      <button onclick={() => pickImage('file')} title="Bild in den Ordner bilder/ kopieren und verlinken (auch per Drag & Drop oder Einfügen)">Bild</button>
      <button onclick={() => pickImage('base64')} title="Bild als Base64 direkt in die Markdown-Datei einbetten">Bild (Base64)</button>
    </div>
    <label class="ed-follow" title="Vorschau folgt dem Cursor, Editor folgt der Vorschau">
      <input type="checkbox" bind:checked={follow} /> Synchron
    </label>
    <span class="ed-status" data-status={status}>{statusText[status]}</span>
    <button class="ed-pdf" onclick={exportPdf} title="Druckansicht öffnen: drucken oder als PDF speichern">PDF</button>
    <button class="ed-present" onclick={present} title="Präsentation in neuem Tab öffnen">Präsentieren ↗</button>
  </header>

  <div class="ed-main" style="grid-template-columns: 240px {split}fr 6px {100 - split}fr">
    <aside class="ed-side">
      <section>
        <div class="ed-side-head">
          <span>Dateien</span>
          <button onclick={newFile} title="Neue Markdown-Datei anlegen">+ Datei</button>
        </div>
        <ul class="ed-files">
          {#each textFiles as f (f.path)}
            <li>
              <button class:active={f.path === current} data-kind={f.kind} onclick={() => openFile(f.path, { line: 1 })}>{f.path}</button>
            </li>
          {/each}
        </ul>
      </section>
      <section class="ed-outline">
        <div class="ed-side-head"><span>Gliederung</span></div>
        {#if deck}{@render outline(deck.nodes)}{/if}
      </section>
    </aside>

    <section class="ed-editor" bind:this={editorEl} aria-label="Quelltext"></section>

    <div class="ed-divider" role="separator" aria-orientation="vertical" onpointerdown={startDrag}></div>

    <section class="ed-preview" aria-label="Vorschau">
      <iframe bind:this={frame} src="./index.html" title="Vorschau" onload={() => follow && syncPreview()}></iframe>
      {#if deckError}<div class="ed-error"><strong>Deck-Fehler</strong><pre>{deckError}</pre></div>{/if}
    </section>
  </div>

  {#if message}<div class="ed-toast" role="status">{message}</div>{/if}
  <input
    bind:this={imageInput}
    type="file"
    accept="image/*"
    multiple
    hidden
    onchange={() => insertImages([...(imageInput.files ?? [])], undefined, imageMode)}
  />
</div>

<script lang="ts">
  import { onMount } from 'svelte'
  import initial from 'virtual:hashmark/deck'
  import type { Deck, DeckNode } from '../../core/types.ts'
  import { formatHash, type Position } from '../../core/navigator.ts'
  import { lineOfSlide, nodeAtLine, pathToNode } from '../../core/sourcemap.ts'
  import { printQuery } from '../../core/print.ts'
  import { SNIPPETS } from '../../core/snippets.ts'
  import { api, relativeTo, type FileEntry, type NewComponent } from './api.ts'
  import { createEditor, type Editor, type Lang } from './codemirror.ts'
  import { componentKind } from '../../core/component-edit.ts'
  import { readMetaHead } from '../../core/components.ts'
  import type { Problem } from './assist.ts'
  import type { ComponentMeta } from '../../core/components.ts'
  import Palette, { type PaletteItem } from './Palette.svelte'
  import KeyBar from './KeyBar.svelte'
  import NewComponentDialog from './NewComponent.svelte'
  import { desktopAction, hasPresentOptions, isDesktop } from '../desktop.ts'
  import PresentOptions from './PresentOptions.svelte'
  import { onDeckUpdate } from '../deck-source.ts'

  type Payload = { deck: Deck } | { error: string }
  type Status = 'saved' | 'dirty' | 'saving' | 'error'
  type Mode = 'write' | 'split' | 'preview'
  type Found = Problem & { found: string }

  const STORAGE_KEY = 'hashmark-editor'
  const remember = (data: Record<string, unknown>) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...recall(), ...data })) } catch { /* privat/blockiert */ }
  }
  const recall = (): { file?: string; line?: number; split?: number; mode?: Mode; side?: boolean } => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
  }

  const NARROW = '(max-width: 900px)'
  const narrow = () => matchMedia(NARROW).matches
  const coarse = matchMedia('(pointer: coarse)').matches

  let deckName = $state('')
  let files = $state<FileEntry[]>([])
  let current = $state<string | null>(null)
  let deck = $state.raw<Deck | null>('deck' in initial ? initial.deck : null)
  let deckError = $state<string | null>('error' in initial ? initial.error : null)
  let status = $state<Status>('saved')
  let message = $state('')
  let follow = $state(true)
  let split = $state(recall().split ?? 50)
  let mode = $state<Mode>(recall().mode ?? 'split')
  let side = $state(recall().side ?? !narrow())
  let previewPos = $state.raw<Position | null>(null)
  let dragging = $state(false)
  let problems = $state.raw<Found[]>([])
  let problemsOpen = $state(false)
  let palette = $state<{ only: string } | null>(null)
  let newComponentOpen = $state(false)
  /** Optionen fürs Präsentieren (Presenter-View, Bildschirme) – nur im Hauptfenster der Desktop-App */
  let presentOptions = $state(false)
  const canPresentOptions = hasPresentOptions()
  let focused = $state(false)
  let startupError = $state<string | null>(null)

  let editorEl: HTMLElement
  let frame: HTMLIFrameElement
  let imageInput: HTMLInputElement
  let ed: Editor
  let savedText = ''
  /** zuletzt geöffnete Folien-Datei: dorthin kommt das Beispiel einer Komponente */
  let lastSlideFile: string | null = null
  let cursorLine = 1
  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let syncTimer: ReturnType<typeof setTimeout> | undefined
  let imageMode: 'file' | 'base64' = 'file'
  /** Layouts, die das Theme des Decks mitbringt (`.layout-<name>` im CSS der Vorschau) */
  let themeLayouts: string[] = []
  let themeComponents: Record<string, ComponentMeta> = {}
  /** zuletzt an die Vorschau geschickte Position – deren Echo nicht zurück in den Editor spiegeln */
  let requested = ''

  const kindOf = (path: string): Lang => (/\.ya?ml$/i.test(path) ? 'yaml' : /\.html$/i.test(path) ? 'html' : /\.css$/i.test(path) ? 'css' : 'markdown')
  const keyOf = (id: string, slide: number) => `${id}:${slide}`
  const textFiles = $derived(files.filter((f) => f.kind !== 'image'))
  const slideFiles = $derived(textFiles.filter((f) => f.kind === 'markdown' || f.kind === 'yaml'))
  const componentFiles = $derived(textFiles.filter((f) => f.kind === 'template' || f.kind === 'style'))
  const crumbs = $derived(deck && previewPos ? pathToNode(deck.nodes, previewPos.id) : [])
  const columns = $derived(
    `${side ? '240px' : '0px'} ${mode === 'write' ? 'minmax(0, 1fr) 0 0' : mode === 'preview' ? '0 0 minmax(0, 1fr)' : `minmax(0, ${split}fr) 6px minmax(0, ${100 - split}fr)`}`,
  )

  function flash(text: string) {
    message = text
    setTimeout(() => { if (message === text) message = '' }, 4000)
  }

  function setMode(m: Mode) {
    mode = m
    remember({ mode })
    if (m !== 'preview') requestAnimationFrame(() => ed?.view.requestMeasure())
    if (m !== 'write') setTimeout(syncPreview, 60)
  }

  function toggleSide() {
    side = !side
    remember({ side })
  }

  /** auf schmalen Geräten legt sich die Seitenleiste über den Text und schließt nach der Wahl */
  const closeDrawer = () => { if (narrow() && side) side = false }

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
      if (kindOf(path) === 'markdown') lastSlideFile = path
      status = 'saved'
      if (kindOf(path) === 'yaml' || kindOf(path) === 'css') problems = []
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

  /** Gerüst anlegen, Dateiliste auffrischen und die Vorlage öffnen. Gibt eine Fehlermeldung für den Dialog zurück, sonst null. */
  async function createComponent(input: NewComponent): Promise<string | null> {
    try {
      const r = await api.createComponent(input)
      await refreshFiles()
      newComponentOpen = false
      await openFile(r.template, { line: 1 })
      flash(`Komponente „${input.name}“ angelegt. In Folien: ::: ${input.name}`)
      return null
    } catch (e) {
      return (e as Error).message
    }
  }

  /** Beispiel aus dem Kopf der Vorlage als eigene Folie ans Ende der Folien-Datei setzen: die Vorschau zeigt es sofort */
  async function insertExample() {
    const from = current
    const example = readMetaHead(ed.text())?.example
    const name = from?.match(/([^/]+)\.html$/)?.[1]
    if (!from || !name) return
    if (!example) { flash('Im Kopf {{!meta}} fehlt ein Beispiel (example:).'); return }
    const target = lastSlideFile ?? slideFiles.find((f) => f.kind === 'markdown')?.path
    if (!target) { flash('Es gibt keine Folien-Datei für das Beispiel.'); return }
    try {
      await openFile(target)
      ed.append(`\n\n## Beispiel ${name}\n\n${example}`)
      ed.gotoLine(ed.view.state.doc.lines)
      flash(`Beispiel am Ende von ${target} eingefügt, die Vorschau zeigt es.`)
    } catch (e) {
      flash(`Einfügen fehlgeschlagen: ${(e as Error).message}`)
    }
  }

  // ---------- Vorschau-Sync ----------

  function goto(id: string, slide: number) {
    requested = keyOf(id, slide)
    frame?.contentWindow?.postMessage({ type: 'hashmark:goto', id, slide, step: 'all' }, location.origin)
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
    // wer an einer Komponente arbeitet, soll nicht zur Folie springen, wenn die Vorschau nach dem Speichern neu lädt
    if (current && componentKind(current)) return
    const target = lineOfSlide(deck.nodes, pos.id, pos.slide)
    if (!target) return
    try {
      if (target.file !== current) await openFile(target.file)
    } catch (e) {
      startupError = (e as Error).message
      return
    }
    const exact = lineOfSlide(deck.nodes, pos.id, pos.slide, ed.text())
    if (exact) ed.scrollToLine(exact.line)
  }

  async function jumpToNode(node: DeckNode) {
    await openFile(node.source.file, { line: node.source.line })
    goto(node.id, 0)
    closeDrawer()
  }

  /** Theme-Layouts aus dem CSS der Vorschau lesen; der Linter soll sie nicht als unbekannt melden */
  function readThemeLayouts() {
    const names = new Set<string>()
    const walk = (rules: CSSRuleList) => {
      for (const r of rules) {
        if ('selectorText' in r) for (const m of String(r.selectorText).matchAll(/\.layout-([\w-]+)/g)) names.add(m[1])
        if ('cssRules' in r) walk((r as CSSGroupingRule).cssRules)
      }
    }
    try {
      for (const sheet of frame.contentDocument?.styleSheets ?? []) walk(sheet.cssRules)
    } catch { /* anderes Origin */ }
    const next = [...names].sort()
    // eigene Container: das Theme-CSS nennt sie in --hm-components
    let comps: Record<string, ComponentMeta> = {}
    try {
      const doc = frame.contentDocument
      const raw = doc ? getComputedStyle(doc.documentElement).getPropertyValue("--hm-components") : ""
      const encoded = raw.trim().replace(/^["']|["']$/g, "")
      if (encoded) comps = JSON.parse(decodeURIComponent(encoded))
    } catch { /* anderes Origin */ }
    if (next.join() !== themeLayouts.join() || JSON.stringify(comps) !== JSON.stringify(themeComponents)) {
      themeLayouts = next
      themeComponents = comps
      ed?.relint()
    }
  }

  // ---------- Einfügen ----------

  function pickImage(kind: 'file' | 'base64') {
    imageMode = kind
    imageInput.value = ''
    imageInput.click()
  }

  const altOf = (file: File) => (file.name || 'Bild').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')

  async function insertImages(list: File[], pos?: number, kind: 'file' | 'base64' = 'file') {
    if (!current) return
    for (const file of list) {
      try {
        if (kind === 'base64') {
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
    const sideWidth = side ? 240 : 0
    const move = (ev: PointerEvent) => {
      split = Math.max(20, Math.min(80, ((ev.clientX - rect.left - sideWidth) / (rect.width - sideWidth)) * 100))
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

  // Desktop-App: PDF speichern bzw. Präsentation (Vollbild, Presenter) über die App statt neuer Tabs
  const desktop = isDesktop()

  function exportPdf() {
    if (desktop) void desktopAction({ action: 'pdf', query: printQuery({}) })
    else window.open('./' + printQuery({}, { autoprint: '1' }), '_blank')
  }

  // PowerPoint: in der App speichert die Hülle (Dialog), im Browser rendert der Server und liefert die Datei
  let pptxBusy = $state(false)
  async function exportPptx(options: { depth?: number; steps?: boolean; animations?: boolean } = {}) {
    const { animations = true, ...print } = options
    const query = printQuery({ ...print, footer: false }) + (animations ? '' : '&anim=0')
    if (desktop) return void desktopAction({ action: 'pptx', query })
    if (pptxBusy) return
    pptxBusy = true
    flash('PowerPoint wird erstellt … (das dauert etwas)')
    try {
      const blob = await api.pptx(query)
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `${deck?.title || 'praesentation'}.pptx`.replace(/[\\/:*?"<>|]+/g, '-')
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
      flash('PowerPoint-Datei erstellt')
    } catch (e) {
      flash(`PPTX fehlgeschlagen: ${(e as Error).message}`)
    } finally {
      pptxBusy = false
    }
  }

  function present() {
    const hash = previewPos ? formatHash(previewPos) : ''
    if (desktop) void desktopAction({ action: 'present', hash })
    else window.open('./' + hash, '_blank')
  }

  // ---------- Palette und Probleme ----------

  const flatten = (nodes: DeckNode[]): DeckNode[] => nodes.flatMap((n) => [n, ...flatten(n.children)])

  function paletteItems(): PaletteItem[] {
    const items: PaletteItem[] = []
    for (const n of flatten(deck?.nodes ?? [])) {
      items.push({ group: 'Folien', title: `${n.depth === 1 ? '→' : '↓'} ${n.title}`, detail: `${n.source.file}:${n.source.line}`, run: () => jumpToNode(n) })
    }
    items.push(
      { group: 'Aktionen', title: 'Präsentieren', detail: 'Ab der aktuellen Folie', run: present },
      ...(canPresentOptions ? [{ group: 'Aktionen', title: 'Präsentieren: Optionen …', detail: 'Presenter-View und Bildschirme', run: () => { presentOptions = true } }] : []),
      { group: 'Aktionen', title: 'PDF / Druckansicht', run: exportPdf },
      { group: 'Aktionen', title: 'PowerPoint (PPTX) exportieren', detail: 'bearbeitbar, Schritte als Animationen', run: () => exportPptx() },
      { group: 'Aktionen', title: 'PowerPoint (PPTX): nur Hauptpfad', run: () => exportPptx({ depth: 1 }) },
      { group: 'Aktionen', title: 'PowerPoint (PPTX): ohne Animationen', detail: 'Schritte nicht animieren, nur der Endzustand', run: () => exportPptx({ animations: false }) },
      { group: 'Aktionen', title: 'PowerPoint (PPTX): jeder Schritt eine Folie', run: () => exportPptx({ steps: true }) },
      { group: 'Aktionen', title: 'Ansicht: Schreiben', run: () => setMode('write') },
      { group: 'Aktionen', title: 'Ansicht: Geteilt', run: () => setMode('split') },
      { group: 'Aktionen', title: 'Ansicht: Vorschau', run: () => setMode('preview') },
      { group: 'Aktionen', title: side ? 'Seitenleiste ausblenden' : 'Seitenleiste einblenden', run: toggleSide },
      { group: 'Aktionen', title: follow ? 'Synchron ausschalten' : 'Synchron einschalten', detail: 'Vorschau folgt dem Cursor', run: () => { follow = !follow } },
      { group: 'Aktionen', title: 'Neue Datei …', run: newFile },
      { group: 'Aktionen', title: 'Neue Komponente …', detail: 'Vorlage und Gestaltung anlegen', run: () => { newComponentOpen = true } },
    )
    for (const s of SNIPPETS) items.push({ group: 'Bausteine', title: s.label, detail: s.title, run: () => ed.insertSnippet(s.text) })
    items.push(
      { group: 'Bausteine', title: 'Bild einfügen', detail: 'in bilder/ kopieren und verlinken', run: () => pickImage('file') },
      { group: 'Bausteine', title: 'Bild einbetten', detail: 'als Base64 in die Datei', run: () => pickImage('base64') },
    )
    for (const f of textFiles) items.push({ group: 'Dateien', title: f.path, run: () => openFile(f.path, { line: 1 }) })
    return items
  }

  const openPalette = (only = '') => { palette = { only } }
  const closePalette = () => { palette = null; ed?.focus() }

  function onProblems(list: Problem[]) {
    const text = ed?.text() ?? ''
    problems = list.map((p) => ({ ...p, found: text.slice(p.from, p.to) }))
    if (!problems.length) problemsOpen = false
  }

  function fixProblem(p: Found) {
    if (!ed.fix(p, p.found)) flash('Die Stelle hat sich geändert, bitte erneut prüfen.')
  }

  const statusText: Record<Status, string> = {
    saved: 'Gespeichert', dirty: 'Ungespeichert', saving: 'Speichert …', error: 'Fehler beim Speichern',
  }

  onMount(() => {
    // Menü „Präsentieren › Optionen“ der App: Ereignis bzw. Sprung auf #present-options aus einer anderen Ansicht
    const openOptions = () => { if (canPresentOptions) presentOptions = true }
    window.addEventListener('hashmark:present-options', openOptions)
    if (location.hash === '#present-options') {
      history.replaceState(null, '', location.pathname + location.search)
      openOptions()
    }
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
      onProblems,
      layouts: () => themeLayouts,
      components: () => themeComponents,
      onFocus: (f) => { focused = f },
    })
    // für Browser-Tests und Debugging
    ;(window as unknown as { __hashmarkEditor: Editor }).__hashmarkEditor = ed

    const onMessage = (e: MessageEvent) => {
      if (e.origin === location.origin && e.data?.type === 'hashmark:position') followPreview(e.data.pos)
    }
    window.addEventListener('message', onMessage)

    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        palette ? closePalette() : openPalette()
      }
    }
    window.addEventListener('keydown', onKey)

    // Deck neu geladen (eigenes Speichern oder externe Änderung)
    // Vite-HMR bzw. Server-Sent Events in der Desktop-App
    onDeckUpdate(async (payload: Payload) => {
      if ('error' in payload) {
        deckError = payload.error
        return
      }
      deckError = null
      deck = payload.deck
      setTimeout(readThemeLayouts, 400)
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
      try {
        await refreshFiles()
        const last = recall()
        const first = textFiles.find((f) => f.path === last.file) ?? textFiles.find((f) => f.kind === 'markdown') ?? textFiles[0]
        if (first) await openFile(first.path, { line: first.path === last.file ? last.line : 1 })
      } catch (e) {
        startupError = (e as Error).message
      }
    })()

    return () => {
      window.removeEventListener('hashmark:present-options', openOptions)
      window.removeEventListener('message', onMessage)
      window.removeEventListener('keydown', onKey)
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
        ><span class="ol-glyph" aria-hidden="true">{node.depth === 1 ? '→' : '↓'}</span>{#if node.num}<span class="ol-num" title="Kapitelnummer (berechnet, steht nicht im Text)">{node.num}</span>{/if}<span class="ol-title">{node.title}</span>{#if node.slides.length > 1}<span class="ol-meta">{node.slides.length}</span>{/if}</button>
        {#if node.children.length}{@render outline(node.children)}{/if}
      </li>
    {/each}
  </ul>
{/snippet}

<div class="ed-app" class:dragging data-mode={mode} data-side={side ? 'open' : 'closed'}>
  <header class="ed-bar">
    <button class="ed-icon" onclick={toggleSide} aria-label="Seitenleiste ein- oder ausblenden" aria-pressed={side} title="Gliederung und Dateien">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
    </button>
    <nav class="ed-crumbs" aria-label="Position im Baum" title={deck?.title ?? deckName}>
      {#if crumbs.length}
        <i aria-hidden="true">→</i>
        {#each crumbs as n, k (n.id)}{#if k > 0}<i aria-hidden="true">↓</i>{/if}<span>{n.title}</span>{/each}
      {:else}
        <span class="ed-deck">{deck?.title ?? deckName}</span>
      {/if}
    </nav>
    <div class="ed-seg" role="group" aria-label="Ansicht">
      <button aria-pressed={mode === 'write'} onclick={() => setMode('write')}>Schreiben</button>
      <button aria-pressed={mode === 'split'} onclick={() => setMode('split')}>Geteilt</button>
      <button aria-pressed={mode === 'preview'} onclick={() => setMode('preview')}>Vorschau</button>
    </div>
    <label class="ed-follow" title="Vorschau folgt dem Cursor, Editor folgt der Vorschau">
      <input type="checkbox" bind:checked={follow} /> Synchron
    </label>
    <span class="ed-status" data-status={status}><i aria-hidden="true"></i>{statusText[status]}</span>
    <button class="ed-find" onclick={() => openPalette()} title="Folien, Bausteine und Aktionen (Strg+K)">
      <span>Suchen</span><kbd>Strg K</kbd>
    </button>
    <button class="ed-pdf" onclick={exportPdf} title="Druckansicht öffnen: drucken oder als PDF speichern">PDF</button>
    <button class="ed-pdf" onclick={() => exportPptx()} disabled={pptxBusy} title="Als PowerPoint-Datei exportieren (bearbeitbar, Schritte werden zu Animationen)">{pptxBusy ? 'PPTX …' : 'PPTX'}</button>
    <span class="ed-presentgroup">
      <button class="ed-present" onclick={present} title="Präsentation öffnen">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none" /></svg>Präsentieren
      </button>
      {#if canPresentOptions}
        <button class="ed-present-opt" onclick={() => (presentOptions = true)} title="Optionen: Presenter-View und Bildschirme" aria-label="Optionen fürs Präsentieren">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
        </button>
      {/if}
    </span>
  </header>

  <div class="ed-main" style="grid-template-columns: {columns}">
    <aside class="ed-side" aria-label="Dateien und Gliederung">
      <section>
        <div class="ed-side-head">
          <span>Dateien</span>
          <button onclick={newFile} title="Neue Markdown-Datei anlegen">+ Datei</button>
        </div>
        <ul class="ed-files">
          {#each slideFiles as f (f.path)}
            <li>
              <button class:active={f.path === current} data-kind={f.kind} onclick={() => { openFile(f.path, { line: 1 }); closeDrawer() }}>{f.path}</button>
            </li>
          {/each}
        </ul>
        <div class="ed-side-head sub">
          <span>Komponenten</span>
          <button onclick={() => (newComponentOpen = true)} title="Neue Komponente anlegen: Vorlage und Gestaltung">+ Komponente</button>
        </div>
        <ul class="ed-files">
          {#each componentFiles as f (f.path)}
            <li>
              <button class:active={f.path === current} data-kind={f.kind} onclick={() => { openFile(f.path, { line: 1 }); closeDrawer() }}>{f.path}</button>
            </li>
          {:else}
            <li class="ed-none">Noch keine eigenen Komponenten</li>
          {/each}
        </ul>
      </section>
      <section class="ed-outline">
        <div class="ed-side-head"><span>Gliederung</span></div>
        {#if deck}{@render outline(deck.nodes)}{/if}
      </section>
    </aside>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="ed-scrim" onclick={toggleSide}></div>

    <section class="ed-writing">
      {#if startupError}<div class="ed-error ed-nofiles" role="alert"><strong>Editor nicht bereit</strong><pre>{startupError}</pre></div>{/if}
      <div class="ed-editor" bind:this={editorEl} hidden={!!startupError}></div>
      {#if problemsOpen && problems.length}
        <ul class="ed-problems" aria-label="Probleme im Text">
          {#each problems as p (p.from + p.message)}
            <li data-severity={p.severity}>
              <button class="ed-problem" onclick={() => ed.goto(p.from)}>
                <i aria-hidden="true"></i><span>{p.message}</span><small>Zeile {p.line}</small>
              </button>
              {#if p.fix}<button class="ed-fix" onclick={() => fixProblem(p)}>Korrigieren</button>{/if}
            </li>
          {/each}
        </ul>
      {/if}
      <footer class="ed-foot">
        <span class="ed-hints">
          {#if current && kindOf(current) === 'html'}
            <span><kbd>{'{{'}</kbd> Platzhalter</span>
            <span><kbd>Strg Leertaste</kbd> Vorschläge</span>
            <button class="ed-example" onclick={insertExample} title="Beispiel aus dem Kopf als Folie einfügen und in der Vorschau ansehen">Beispiel in Folie ansehen</button>
          {:else if current && kindOf(current) === 'css'}
            <span><kbd>.d-name</kbd> gilt für die Komponente</span>
          {:else}
          <span><kbd>/</kbd> Bausteine</span>
          <span><kbd>:::</kbd> Container</span>
          <span><kbd>{'{'}</kbd> Attribute</span>
          <span><kbd>Strg Leertaste</kbd> Vorschläge</span>
          {/if}
        </span>
        <button
          class="ed-count"
          class:has={problems.length > 0}
          onclick={() => { if (problems.length) problemsOpen = !problemsOpen }}
          aria-expanded={problemsOpen}
          title="Probleme im Text anzeigen"
        >{problems.length ? `⚠ ${problems.length} Hinweis${problems.length > 1 ? 'e' : ''}` : '✓ Keine Hinweise'}</button>
      </footer>
    </section>

    <div class="ed-divider" role="separator" aria-orientation="vertical" onpointerdown={startDrag}></div>

    <section class="ed-preview" aria-label="Vorschau">
      <iframe bind:this={frame} src="./index.html" title="Vorschau" onload={() => { readThemeLayouts(); if (follow) syncPreview() }}></iframe>
      {#if deckError}<div class="ed-error"><strong>Deck-Fehler</strong><pre>{deckError}</pre></div>{/if}
    </section>
  </div>

  {#if coarse && focused && palette === null}<KeyBar {ed} onblocks={() => openPalette('Bausteine')} />{/if}
  {#if presentOptions}<PresentOptions onclose={() => (presentOptions = false)} />{/if}
  {#if newComponentOpen}<NewComponentDialog oncreate={createComponent} onclose={() => (newComponentOpen = false)} />{/if}
  {#if palette}<Palette items={paletteItems()} only={palette.only} onclose={closePalette} />{/if}
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

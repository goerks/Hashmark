<script lang="ts">
  import { untrack } from 'svelte'
  import type { DeckNode } from '../core/types.ts'
  import { renderMermaid } from './mermaid.ts'
  import { MIN_ZOOM, fitSlide } from './fit.ts'
  import { clearLiveRoot, prepareVideos, setLiveRoot, syncVideos, type MediaMode } from './video.ts'
  import { clearZoomRoot, refreshZoom, setZoomRoot, syncZoom, zoomClick } from './zoom.ts'
  import { COMPONENT_EFFECTS, COMPONENT_STAGGER, componentOf, formatCount, parseCount } from './fx.ts'
  import { motionDuration, prefersReducedMotion } from './transitions.ts'

  let { node, slide, layout, step = Infinity, titleTag = 'h1', media = 'off', effects = false, defaultEffect = '' }: {
    node: DeckNode
    slide: number
    layout: string
    /** abgespielte Schritte; Infinity = alles sichtbar (z. B. Miniaturen) */
    step?: number
    /** Element des Titels, z. B. h2 im PDF (Lesezeichen-Hierarchie) oder div für Folgeseiten */
    titleTag?: string
    /** Videos: `live` spielt (nur die laufende Präsentation), `still` zeigt ein Standbild, `off` lädt nichts (Übersicht, Lesemodus) */
    media?: MediaMode
    /** Auftritte der Schritte (`effect=`) zeigen: nur in der laufenden Präsentation, nie in Miniaturen, Druck oder Lesemodus */
    effects?: boolean
    /** Standard-Effekt dieser Folie (`{effect=…}` bzw. deck.yaml `motion: effect:`) */
    defaultEffect?: string
  } = $props()

  let el: HTMLElement
  const html = $derived(node.slides[slide]?.html ?? '')
  const fit = $derived(!!node.attrs.fit && !['false', 'off', 'no'].includes(node.attrs.fit.toLowerCase()))
  // Überlauf-Hinweis nur beim Schreiben (Dev-Server, Editor-Vorschau), nie im Vortrag oder Export
  const showOverflow = import.meta.env.DEV || window.parent !== window
  let overflow = $state(false)
  let zoom = $state(1)
  const showTiles = $derived(layout === 'section' && node.children.length > 0 && !html.includes('data-children'))

  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  const tiles = (children: DeckNode[]) =>
    children
      .map((c) => `<a class="tile" href="#${encodeURI(c.id)}"><span class="tile-title">${escape(c.title)}</span>${
        c.children.length ? `<span class="tile-count">${c.children.length} Details</span>` : ''}</a>`)
      .join('')

  /** Zeichenbare Formen in Zeichnungen (draw.io, Excalidraw, SVG): bekommen `pathLength`, damit sich ihre Linien zeichnen lassen */
  const SHAPES = 'path, line, polyline, polygon, rect, ellipse, circle'
  const counting = new WeakMap<HTMLElement, number>()

  /** Zahl einer Kennzahl in ~0,8 s von 0 hochlaufen lassen; mit `prefers-reduced-motion` bleibt sie stehen */
  function countUp(el: HTMLElement) {
    const target = el.dataset.final ?? el.textContent ?? ''
    el.dataset.final = target
    const c = parseCount(target)
    if (!c || prefersReducedMotion()) return
    const cssSpeed = parseFloat(getComputedStyle(el.closest('.stage') ?? document.documentElement).getPropertyValue('--motion-duration'))
    const ms = (Number.isFinite(cssSpeed) ? cssSpeed : motionDuration()) * 2.1
    cancelAnimationFrame(counting.get(el) ?? 0)
    const t0 = performance.now()
    const tick = (now: number) => {
      const p = (now - t0) / ms
      el.textContent = p >= 1 ? target : formatCount(c, p)
      if (p < 1) counting.set(el, requestAnimationFrame(tick))
    }
    el.textContent = formatCount(c, 0)
    counting.set(el, requestAnimationFrame(tick))
  }

  /** Auftritt eines Schritt-Elements: Container (`effect=…`) vor Folie vor Deck; leer = Standard der Komponente bzw. Zeichnung */
  function effectOf(item: HTMLElement): string {
    const explicit = item.closest<HTMLElement>('[data-effect]')?.dataset.effect ?? defaultEffect
    if (item.closest('svg')) {
      // SVG-Elemente tragen ihre Lage oft als `transform`-Attribut: ein CSS-`transform` würde sie verschieben, darum nur Zeichnen, Abdunkeln oder Einblenden
      if (explicit === 'dim') return 'dim'
      if (explicit === 'fade') return ''
      return item.matches('.node, .cluster, .edgeLabel') ? '' : 'draw'
    }
    if (explicit) return explicit === 'fade' ? '' : explicit
    const comp = componentOf(item)
    return comp ? COMPONENT_EFFECTS[comp] : ''
  }

  /** Element mit `data-step="k"` ist ab Schritt k sichtbar, mit `data-until="m"` nur bis vor Schritt m. */
  function applySteps(root: HTMLElement, current: number) {
    // Abstand zwischen Elementen mit gleicher Schrittnummer bei `stagger` (ms)
    const STAGGER = 80
    const group = new Map<string, number>()
    for (const item of root.querySelectorAll<HTMLElement>('[data-step]')) {
      const from = Number(item.dataset.step)
      const until = item.dataset.until ? Number(item.dataset.until) : Infinity
      const visible = current >= from && (until === Infinity || current < until)
      item.classList.toggle('step-hidden', !visible)
      item.classList.toggle('step-current', visible && from === current && from > 0)
      const fx = effects ? effectOf(item) : ''
      if (fx) item.dataset.fx = fx
      else delete item.dataset.fx
      if (fx === 'draw') for (const s of item.querySelectorAll(SHAPES)) if (!s.hasAttribute('pathLength')) s.setAttribute('pathLength', '1')
      const n = group.get(item.dataset.step!) ?? 0
      group.set(item.dataset.step!, n + 1)
      const staggered = !!item.closest('[data-stagger]') || COMPONENT_STAGGER.includes(componentOf(item) ?? '')
      const wait = effects ? Number(item.closest<HTMLElement>('[data-delay]')?.dataset.delay ?? 0) + (staggered ? n * STAGGER : 0) : 0
      if (wait) item.style.setProperty('--step-delay', `${wait}ms`)
      else item.style.removeProperty('--step-delay')
    }
    // Kennzahlen mit `countup`: die Zahl läuft hoch, sobald die Kachel sichtbar wird (erneut nach dem Verbergen)
    if (effects) {
      for (const kpi of root.querySelectorAll<HTMLElement>('[data-countup] .kpi')) {
        const value = kpi.querySelector<HTMLElement>('.kpi-value')
        if (!value) continue
        const shown = !kpi.classList.contains('step-hidden')
        if (shown && kpi.dataset.counted === undefined) { kpi.dataset.counted = ''; countUp(value) }
        else if (!shown && kpi.dataset.counted !== undefined) { delete kpi.dataset.counted; cancelAnimationFrame(counting.get(value) ?? 0); if (value.dataset.final) value.textContent = value.dataset.final }
      }
    }
    // Code `lines="2-3|5|all"`: Abschnitt k ab Schritt k; danach bleibt der letzte stehen
    for (const pre of root.querySelectorAll<HTMLElement>('pre[data-hl-count]')) {
      const active = Math.min(current, Number(pre.dataset.hlCount) - 1)
      const all = (pre.dataset.hlAll ?? '').includes(` ${active} `)
      pre.classList.toggle('hl-active', !all)
      for (const line of pre.querySelectorAll<HTMLElement>('.line')) {
        line.classList.toggle('hl', !all && (line.dataset.hl ?? '').includes(` ${active} `))
      }
    }
  }

  function measure() {
    const r = fitSlide(el, fit)
    overflow = r.overflow
    zoom = r.zoom
  }

  $effect(() => {
    void html
    void layout
    void fit
    // `::: children` als Kacheln füllen, Diagramme rendern (neue SVGs danach ebenfalls ein-/ausblenden)
    for (const slot of el.querySelectorAll<HTMLElement>('[data-children]')) slot.innerHTML = tiles(node.children)
    untrack(() => { applySteps(el, step); measure() })
    // Diagramme und Schriften ändern die Größe erst nach dem Laden: danach neu messen
    renderMermaid(el).then(() => untrack(() => { applySteps(el, step); measure() }))
    void document.fonts?.ready.then(() => untrack(measure))
  })

  $effect(() => {
    // Mermaid: `data-new` animiert nur in der Präsentation und nicht bei `effect=fade`
    el.toggleAttribute('data-nofx', !effects || defaultEffect === 'fade')
    applySteps(el, step)
  })

  // Videos: nach dem Rendern vorbereiten, in der Präsentation dem Schritt folgen (K, → und Anzeige im Presenter siehe video.ts)
  $effect(() => {
    void html
    untrack(() => prepareVideos(el, media))
  })
  let previousStep: number | null = null
  $effect(() => {
    if (media !== 'live') return
    void html
    const current = step
    untrack(() => {
      setLiveRoot(el)
      setZoomRoot(el)
      refreshZoom()
      syncVideos(el, current, previousStep)
      syncZoom(el, current, previousStep)
      previousStep = current
    })
    return () => { clearLiveRoot(el); clearZoomRoot(el) }
  })
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -- Klick auf ein Bild ist nur eine Abkürzung für die Taste Z (siehe zoom.ts) -->
<section
  class="slide layout-{layout} {node.attrs.class ?? ''}"
  class:has-bg={!!node.attrs.bg}
  data-depth={node.depth}
  style:background={node.attrs.bg}
  style:--bg-dim={node.attrs.bgdim}
  style:--banner-h={node.attrs.bannerh ? (/^[\d.]+$/.test(node.attrs.bannerh) ? node.attrs.bannerh + 'px' : node.attrs.bannerh) : undefined}
  data-fit={zoom < 1 ? zoom : undefined}
  data-overflow={overflow ? '' : undefined}
  onclick={media === 'live' ? zoomClick : undefined}
  bind:this={el}
>
  {#if overflow && showOverflow}
    <span class="overflow-badge" title={fit ? `Der Inhalt passt auch bei ${Math.round(MIN_ZOOM * 100)} % nicht: kürzen oder auf mehrere Folien verteilen` : 'Der Inhalt ist höher oder breiter als die Folie: kürzen, auf mehrere Folien verteilen (---) oder {fit} an die Überschrift setzen'}>Überlauf</span>
  {/if}
  {#if node.attrs.banner}
    <div class="slide-banner" style:background-image={node.attrs.banner} style:background-position={node.attrs.bannerpos}></div>
  {/if}
  {#if layout === 'title' || layout === 'statement'}
    <div class="title-wrap">
      <svelte:element this={titleTag} class="slide-title">{node.title}</svelte:element>
      <div class="content">{@html html}</div>
    </div>
  {:else}
    <header><svelte:element this={titleTag} class="slide-title">{node.title}</svelte:element></header>
    <div class="content">{@html html}</div>
    {#if showTiles}
      <div class="d-children">{@html tiles(node.children)}</div>
    {/if}
  {/if}
  {#if node.footer}
    <footer class="slide-footer">
      <span class="footer-text">{node.footer.text ?? ''}</span>
      <span class="footer-number">{node.footer.number ? node.footer.number.replace('{n}', String((node.slideNo ?? 1) + slide)) : ''}</span>
    </footer>
  {/if}
</section>

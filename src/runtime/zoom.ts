// Bild, Code, Diagramm oder Tabelle in der Präsentation vergrößern: Eine Kamera fährt in die Folie hinein (Z oder Klick), Z, Esc oder
// Klick fährt zurück. + und − fahren tiefer bzw. heraus, Pfeile verschieben den Ausschnitt, Mausrad und Touchpad-Spreizen zoomen am Zeiger. Am Touchscreen: zwei Finger spreizen/zusammenführen, ein Finger verschiebt, Tasten − + × unten links. Die Kamera ist ein `transform` auf der Bühnenfläche der Folie (`.stage-slide`), die Bühne (`.stage`) schneidet ab; Titel und
// Text wandern also mit aus dem Bild, der Zusammenhang bleibt. Nur die laufende Präsentation (`media="live"`) nimmt teil.

/** Zustand für die Presenter-View: gibt es ein Bild zum Vergrößern, und ist es vergrößert? */
export interface ZoomInfo {
  available: boolean
  active: boolean
}

const STAGE = { w: 1280, h: 720 }
/** Rand um das vergrößerte Bild, Anteil der Bühne */
const FIT = { w: 0.94, h: 0.9 }
const MOVE = 'transform 0.9s cubic-bezier(.35,.1,.15,1)'
const NUDGE = 'transform 0.35s cubic-bezier(.35,.1,.15,1)'
/** größte Vergrößerung der Kamera (Bühne = 1) und Schritt von + und − */
const MAX_SCALE = 8
const STEP = 1.5
/** Was sich vergrößern lässt: Bilder nur mit `zoom`, Code, Diagramme und Tabellen immer */
const ZOOMABLE = 'img[data-zoom], .mermaid-block, figure.code-block, table.d-table-el'

let root: HTMLElement | null = null
let active = false
let listener: (() => void) | null = null
let token = 0
/** Kamera: Skalierung und Verschiebung in Bühnenkoordinaten; `base` = Skalierung der ersten Fahrt (Bild füllt die Bühne) */
let view = { s: 1, tx: 0, ty: 0 }
let base = 1
let map: HTMLElement | null = null
let tools: HTMLElement | null = null

const camera = (): HTMLElement | null => root?.parentElement ?? null
const stage = (): HTMLElement | null => camera()?.parentElement ?? null
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const notify = () => listener?.()

/** Ziele der Folie, die gerade zu sehen sind (nicht in einem noch verborgenen Schritt), Bilder zuerst */
function targets(): HTMLElement[] {
  if (!root) return []
  const all = [...root.querySelectorAll<HTMLElement>(ZOOMABLE)].filter((el) => !el.closest('.step-hidden') && el.offsetWidth > 0)
  return [...all.filter((el) => el.tagName === 'IMG'), ...all.filter((el) => el.tagName !== 'IMG')]
}

export function zoomInfo(): ZoomInfo {
  return { available: targets().length > 0, active }
}

/** Ist die Kamera tiefer hineingefahren als auf das Ziel? Dann verschieben die Pfeile den Ausschnitt. */
const deep = () => active && view.s > base * 1.02

/** Wird bei jeder Änderung aufgerufen (neue Folie, vergrößert, zurück) */
export function onZoomChange(fn: (() => void) | null) {
  listener = fn
}

/** Die Folie, in der die Präsentation gerade läuft; eine andere Folie setzt die Kamera zurück. */
export function setZoomRoot(el: HTMLElement | null) {
  if (root === el) return
  resetZoom(true)
  root?.removeEventListener('wheel', onWheel)
  root?.removeEventListener('pointerdown', onPointerDown)
  root?.removeEventListener('pointermove', onPointerMove)
  root?.removeEventListener('pointerup', onPointerEnd)
  root?.removeEventListener('pointercancel', onPointerEnd)
  root?.removeEventListener('gesturestart', blockGesture)
  root = el
  // Mausrad und Spreizen: nicht passiv, sonst lässt sich das Scrollen der Seite nicht verhindern
  root?.addEventListener('wheel', onWheel, { passive: false })
  root?.addEventListener('pointerdown', onPointerDown)
  root?.addEventListener('pointermove', onPointerMove)
  root?.addEventListener('pointerup', onPointerEnd)
  root?.addEventListener('pointercancel', onPointerEnd)
  // Safari am iPhone zoomt sonst die ganze Seite statt der Kamera
  root?.addEventListener('gesturestart', blockGesture)
  pointers.clear()
  // Bilder haben erst nach dem Laden eine Größe: dann erst „vergrößerbar“ melden
  for (const img of el?.querySelectorAll('img[data-zoom]') ?? []) if (!(img as HTMLImageElement).complete) img.addEventListener('load', notify, { once: true })
  notify()
}

/** Nach einem Schritt neu melden: ein Bild kann erst jetzt sichtbar geworden sein */
export function refreshZoom() {
  notify()
}
/** Abmelden, aber nur, wenn die Folie noch die aktuelle ist (beim Übergang steht die neue schon da) */
export function clearZoomRoot(el: HTMLElement) {
  if (root === el) setZoomRoot(null)
}

const clearStyles = (cam: HTMLElement) => {
  cam.style.transition = ''
  cam.style.transform = ''
  cam.style.transformOrigin = ''
  cam.removeAttribute('data-zoomed')
}

const blockGesture = (e: Event) => e.preventDefault()

const clamp = (v: { s: number; tx: number; ty: number }) => {
  const s = Math.min(MAX_SCALE, Math.max(1, v.s))
  return { s, tx: Math.min(0, Math.max(STAGE.w * (1 - s), v.tx)), ty: Math.min(0, Math.max(STAGE.h * (1 - s), v.ty)) }
}

/** Minikarte unten rechts: der sichtbare Ausschnitt der Folie, solange die Kamera tiefer steht als auf dem Ziel */
function drawMap() {
  const st = stage()
  if (!st || !deep()) {
    map?.remove()
    map = null
    return
  }
  if (!map) {
    map = document.createElement('div')
    map.className = 'zoom-map'
    map.setAttribute('aria-hidden', 'true')
    map.append(document.createElement('i'))
    st.append(map)
  }
  const box = map.firstElementChild as HTMLElement
  box.style.left = `${(-view.tx / (view.s * STAGE.w)) * 100}%`
  box.style.top = `${(-view.ty / (view.s * STAGE.h)) * 100}%`
  box.style.width = `${100 / view.s}%`
  box.style.height = `${100 / view.s}%`
}

/** Schaltflächen − + × unten links, solange die Kamera fährt: für Touchscreens ohne Tastatur. Größe unabhängig vom Fensterverhältnis (`--scale` der Bühne). */
function drawTools() {
  const st = stage()
  if (!st || !active) {
    tools?.remove()
    tools = null
    return
  }
  if (tools) return
  tools = document.createElement('div')
  tools.className = 'zoom-tools'
  const add = (label: string, title: string, act: () => void) => {
    const b = document.createElement('button')
    b.type = 'button'
    b.textContent = label
    b.title = title
    b.setAttribute('aria-label', title)
    b.addEventListener('click', (e) => { e.stopPropagation(); act() })
    tools!.append(b)
  }
  add('−', 'Zoom heraus', () => { zoomBy(1 / STEP) })
  add('+', 'Zoom tiefer', () => { zoomBy(STEP) })
  add('×', 'Zoom beenden', () => resetZoom())
  st.append(tools)
}

/** Kamera auf diese Ansicht stellen; `move` = Übergang ('none' ohne Fahrt) */
function setView(v: { s: number; tx: number; ty: number }, move: string) {
  const cam = camera()
  if (!cam) return
  view = v
  token++
  cam.style.transformOrigin = '0 0'
  cam.style.transition = reduced() ? 'none' : move
  cam.style.transform = `translate(${v.tx}px, ${v.ty}px) scale(${v.s})`
  cam.setAttribute('data-zoomed', '')
  active = true
  drawMap()
  drawTools()
  notify()
}

/** Kamera auf das Bild richten, sodass es die Bühne füllt (mit Rand). false = nichts zu tun. */
function zoomTo(img: HTMLElement): boolean {
  const cam = camera()
  const st = stage()
  // während des Übergangs zur Folie stimmen die Maße nicht
  if (!cam || !st || cam.getAnimations().length) return false
  const k = st.getBoundingClientRect().width / STAGE.w
  cam.style.transition = 'none'
  cam.style.transform = 'none'
  const s0 = st.getBoundingClientRect()
  const r = img.getBoundingClientRect()
  const x = (r.left - s0.left) / k
  const y = (r.top - s0.top) / k
  const w = r.width / k
  const h = r.height / k
  const scale = Math.max(1, Math.min((STAGE.w * FIT.w) / w, (STAGE.h * FIT.h) / h))
  const tx = STAGE.w / 2 - (x + w / 2) * scale
  const ty = STAGE.h / 2 - (y + h / 2) * scale
  void cam.offsetWidth // Ausgangszustand festschreiben, dann fahren
  base = scale
  setView({ s: scale, tx, ty }, MOVE)
  return true
}

/** Zurückfahren; `instant` ohne Bewegung (beim Blättern, die Folie verschwindet ohnehin) */
export function resetZoom(instant = false) {
  if (!active) return
  active = false
  drawMap()
  drawTools()
  notify()
  const cam = camera()
  if (!cam) return
  token++
  if (instant || reduced()) return clearStyles(cam)
  const mine = token
  cam.style.transition = MOVE
  cam.style.transform = 'translate(0px, 0px) scale(1)'
  const done = () => { if (token === mine && !active) clearStyles(cam) }
  cam.addEventListener('transitionend', done, { once: true })
  setTimeout(done, 1100)
}

/**
 * Schritt der Folie: `zoomstep=N` am Bild fährt beim Erreichen von Schritt N von selbst hinein, `zoomuntil=M` bei Schritt M wieder heraus
 * (sonst bleibt die Kamera, bis die Folie wechselt). `previous === null`: die Folie wird erst angezeigt, dann bleibt die Kamera normal.
 * Ohne so ein Bild beendet jeder Schritt einen von Hand (Z, Klick) gestarteten Zoom.
 */
export function syncZoom(el: HTMLElement, step: number, previous: number | null) {
  if (previous === null || previous === step) return
  const img = el.querySelector<HTMLImageElement>('img[data-zoomstep]')
  if (!img) return resetZoom()
  const from = Number(img.dataset.zoomstep)
  const until = img.dataset.zoomuntil ? Number(img.dataset.zoomuntil) : Infinity
  const want = step >= from && step < until
  if (!want) return resetZoom()
  if (active) return
  // erst nach dem Aufdecken des Schritts messen
  requestAnimationFrame(() => { if (root === el && !active) zoomTo(img) })
}

/** Z: aufs Bild fahren bzw. zurück. false = die Folie hat kein Bild zum Vergrößern. */
export function toggleZoom(): boolean {
  if (active) {
    resetZoom()
    return true
  }
  const target = targets()[0]
  return target ? (zoomTo(target), true) : false
}

/** + und −: eine Stufe tiefer bzw. heraus; ohne Zoom fährt + wie Z aufs erste Ziel. false = nichts zu tun. */
export function zoomBy(factor: number, focus?: { x: number; y: number }, instant = false): boolean {
  if (!active) return factor > 1 ? toggleZoom() : false
  const fx = focus?.x ?? STAGE.w / 2
  const fy = focus?.y ?? STAGE.h / 2
  const s = Math.min(MAX_SCALE, view.s * factor)
  // unter die Bühnengröße geht es nicht: das ist der Weg zurück
  if (s < 1.02) {
    resetZoom(instant)
    return true
  }
  // der Punkt unter dem Fokus bleibt stehen
  const px = (fx - view.tx) / view.s
  const py = (fy - view.ty) / view.s
  setView(clamp({ s, tx: fx - px * s, ty: fy - py * s }), instant ? 'none' : NUDGE)
  return true
}

/** Pfeile verschieben den Ausschnitt, solange die Kamera tiefer steht als auf dem Ziel. true = behandelt. */
export function panZoom(key: string): boolean {
  if (!deep()) return false
  const dir: Record<string, [number, number]> = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
  const d = dir[key]
  if (!d) return false
  setView(clamp({ s: view.s, tx: view.tx + d[0] * STAGE.w * 0.3, ty: view.ty + d[1] * STAGE.h * 0.3 }), NUDGE)
  return true
}

/** Fingerbewegungen: zwei Finger zoomen und verschieben, ein Finger (oder die Maus mit gedrückter Taste) verschiebt die Kamera */
const pointers = new Map<number, { x: number; y: number }>()
/** Eine Geste hat sich bewegt: der Klick, der danach noch kommt, soll nichts auslösen */
let gesture = false
let travelled = 0
/** Wischen im normalen Bild: links/rechts blättern, solange die Kamera nicht fährt (Telefon ohne Tastatur) */
let swipe: ((dir: 'left' | 'right') => void) | null = null
let swipeFrom: { x: number; y: number; t: number } | null = null
let multi = false

export function onSwipe(fn: ((dir: 'left' | 'right') => void) | null) {
  swipe = fn
}

function stagePoint(x: number, y: number) {
  const r = stage()!.getBoundingClientRect()
  const k = r.width / STAGE.w
  return { x: (x - r.left) / k, y: (y - r.top) / k, k }
}

/** Aus der Normalansicht heraus an Ort und Stelle beginnen (kein Ziel nötig). false = gerade nicht möglich. */
function beginFree(): boolean {
  const cam = camera()
  if (!cam || cam.getAnimations().length) return false
  cam.style.transition = 'none'
  base = 1
  view = { s: 1, tx: 0, ty: 0 }
  active = true
  return true
}

/** Der Punkt unter `from` wandert nach `to`, dabei ändert sich die Größe um `factor` */
function applyGesture(factor: number, from: { x: number; y: number }, to: { x: number; y: number }) {
  const s = Math.min(MAX_SCALE, view.s * factor)
  if (s < 1.02) return resetZoom(true)
  const px = (from.x - view.tx) / view.s
  const py = (from.y - view.ty) / view.s
  setView(clamp({ s, tx: to.x - px * s, ty: to.y - py * s }), 'none')
}

function onPointerDown(e: PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 1) {
    gesture = false
    travelled = 0
    multi = false
    swipeFrom = e.pointerType === 'touch' ? { x: e.clientX, y: e.clientY, t: Date.now() } : null
  } else {
    gesture = true
    multi = true
  }
}

function onPointerMove(e: PointerEvent) {
  const prev = pointers.get(e.pointerId)
  if (!prev || !stage()) return
  const cur = { x: e.clientX, y: e.clientY }
  pointers.set(e.pointerId, cur)
  if (pointers.size === 2) {
    const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)![1]
    const d0 = Math.hypot(prev.x - other.x, prev.y - other.y)
    const d1 = Math.hypot(cur.x - other.x, cur.y - other.y)
    if (d0 < 1) return
    if (!active && !beginFree()) return
    const m0 = stagePoint((prev.x + other.x) / 2, (prev.y + other.y) / 2)
    const m1 = stagePoint((cur.x + other.x) / 2, (cur.y + other.y) / 2)
    applyGesture(d1 / d0, m0, m1)
  } else if (pointers.size === 1 && active) {
    travelled += Math.hypot(cur.x - prev.x, cur.y - prev.y)
    if (travelled < 8 && !gesture) return
    gesture = true
    const k = stagePoint(0, 0).k
    setView(clamp({ s: view.s, tx: view.tx + (cur.x - prev.x) / k, ty: view.ty + (cur.y - prev.y) / k }), 'none')
  }
}

function onPointerEnd(e: PointerEvent) {
  const from = swipeFrom
  const alone = pointers.size === 1
  pointers.delete(e.pointerId)
  if (!alone || multi || !from || active || e.type !== 'pointerup') return
  const dx = e.clientX - from.x
  const dy = e.clientY - from.y
  // ein schneller, überwiegend waagerechter Wisch von mindestens 50 Bildschirm-Pixeln
  if (Math.abs(dx) >= 50 && Math.abs(dx) > 2 * Math.abs(dy) && Date.now() - from.t < 800) {
    gesture = true // der Klick danach ist kein Tippen
    swipe?.(dx < 0 ? 'left' : 'right')
  }
  swipeFrom = null
}

/** Mausrad zoomt am Zeiger, sobald die Kamera fährt; Strg + Rad (Touchpad-Spreizen) startet sie auch. */
function onWheel(e: WheelEvent) {
  const st = stage()
  const cam = camera()
  if (!st || !cam || (!active && !e.ctrlKey)) return
  e.preventDefault()
  const r = st.getBoundingClientRect()
  const k = r.width / STAGE.w
  if (!active) {
    if (cam.getAnimations().length) return
    // aus der Normalansicht heraus am Zeiger beginnen
    cam.style.transition = 'none'
    base = 1
    view = { s: 1, tx: 0, ty: 0 }
    active = true
  }
  zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k }, true)
}

/** Esc: zuerst zurückfahren, erst danach steigt Esc im Baum auf. true = behandelt. */
export function escapeZoom(): boolean {
  if (!active) return false
  resetZoom()
  return true
}

/** Klick auf ein vergrößerbares Bild fährt hinein, jeder Klick im vergrößerten Zustand zurück */
export function zoomClick(e: MouseEvent) {
  if (gesture) { gesture = false; return }
  if (active) return resetZoom()
  const target = (e.target as Element | null)?.closest?.(ZOOMABLE) as HTMLElement | null
  if (target && root?.contains(target) && !target.closest('.step-hidden')) zoomTo(target)
}

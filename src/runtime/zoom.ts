// Bild in der Präsentation vergrößern: Eine Kamera fährt in die Folie hinein (Z oder Klick auf das Bild), Z, Esc oder Klick fährt
// zurück. Die Kamera ist ein `transform` auf der Bühnenfläche der Folie (`.stage-slide`), die Bühne (`.stage`) schneidet ab; Titel und
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

let root: HTMLElement | null = null
let active = false
let listener: (() => void) | null = null
let token = 0

const camera = (): HTMLElement | null => root?.parentElement ?? null
const stage = (): HTMLElement | null => camera()?.parentElement ?? null
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const notify = () => listener?.()

/** Bilder der Folie, die sich vergrößern lassen und gerade zu sehen sind (nicht in einem noch verborgenen Schritt) */
function images(): HTMLImageElement[] {
  if (!root) return []
  return [...root.querySelectorAll<HTMLImageElement>('img[data-zoom]')].filter((img) => !img.closest('.step-hidden') && img.offsetWidth > 0)
}

export function zoomInfo(): ZoomInfo {
  return { available: images().length > 0, active }
}

/** Wird bei jeder Änderung aufgerufen (neue Folie, vergrößert, zurück) */
export function onZoomChange(fn: (() => void) | null) {
  listener = fn
}

/** Die Folie, in der die Präsentation gerade läuft; eine andere Folie setzt die Kamera zurück. */
export function setZoomRoot(el: HTMLElement | null) {
  if (root === el) return
  resetZoom(true)
  root = el
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

/** Kamera auf das Bild richten, sodass es die Bühne füllt (mit Rand). false = nichts zu tun. */
function zoomTo(img: HTMLImageElement): boolean {
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
  token++
  cam.style.transformOrigin = '0 0'
  cam.style.transition = reduced() ? 'none' : MOVE
  cam.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`
  cam.setAttribute('data-zoomed', '')
  active = true
  notify()
  return true
}

/** Zurückfahren; `instant` ohne Bewegung (beim Blättern, die Folie verschwindet ohnehin) */
export function resetZoom(instant = false) {
  if (!active) return
  active = false
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

/** Z: aufs Bild fahren bzw. zurück. false = die Folie hat kein Bild zum Vergrößern. */
export function toggleZoom(): boolean {
  if (active) {
    resetZoom()
    return true
  }
  const img = images()[0]
  return img ? (zoomTo(img), true) : false
}

/** Esc: zuerst zurückfahren, erst danach steigt Esc im Baum auf. true = behandelt. */
export function escapeZoom(): boolean {
  if (!active) return false
  resetZoom()
  return true
}

/** Klick auf ein vergrößerbares Bild fährt hinein, jeder Klick im vergrößerten Zustand zurück */
export function zoomClick(e: MouseEvent) {
  if (active) return resetZoom()
  const img = (e.target as Element | null)?.closest?.('img[data-zoom]') as HTMLImageElement | null
  if (img && root?.contains(img) && !img.closest('.step-hidden')) zoomTo(img)
}

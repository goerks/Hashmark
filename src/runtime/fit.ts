// Überlauf erkennen und optional per Auto-Fit verkleinern (`## Titel {fit}`).
// Die Folie ist fest 1280×720 (skaliert per transform), daher zählen Layout-Maße ohne Skalierung.

export const MIN_ZOOM = 0.7
const STEP = 0.05

/** Läuft etwas über den Rand der Folie, des Inhalts oder eines Codeblocks hinaus? (1 px Toleranz wegen Rundung) */
export function overflows(slide: HTMLElement): boolean {
  const clipped = (e: HTMLElement) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1
  if (slide.clientHeight === 0) return false // ausgeblendet: nichts zu messen
  if (clipped(slide)) return true
  return [...slide.querySelectorAll<HTMLElement>('.content, pre')].some(clipped)
}

export interface FitResult {
  /** passt der Inhalt nicht (mehr) auf die Folie? */
  overflow: boolean
  /** angewandter Verkleinerungsfaktor (1 = unverändert) */
  zoom: number
}

/**
 * Misst die Folie. Mit `fit` wird der Inhalt schrittweise bis `MIN_ZOOM` verkleinert, bis er passt.
 * Schritte, die noch ausgeblendet sind, belegen ihren Platz (visibility), die Messung gilt also für die volle Folie.
 */
export function fitSlide(slide: HTMLElement, fit: boolean): FitResult {
  const content = slide.querySelector<HTMLElement>('.content')
  if (content) content.style.zoom = ''
  let zoom = 1
  let overflow = overflows(slide)
  while (fit && overflow && content && zoom > MIN_ZOOM + 1e-9) {
    zoom = Math.round((zoom - STEP) * 100) / 100
    content.style.zoom = String(zoom)
    overflow = overflows(slide)
  }
  return { overflow, zoom }
}

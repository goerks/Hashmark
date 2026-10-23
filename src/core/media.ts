// Video in Folien: Erkennung, Zeitangaben und die Attribute von `![Demo](demo.mp4){play=1 start=5s end=50s}`.
// Zeitangaben mit Doppelpunkt (`0:05`) lassen sich in den Attributen eines Bildes nicht schreiben: Markdown zerreißt den Text an `:05`
// (wie bei `ratio=16:9`). Deshalb Sekunden (`5`, `12.5`) oder Einheiten (`5s`, `1m30s`); `parseClock` kennt die Schreibweise mit Doppelpunkt für andere Stellen.
// Rein (Node und Browser), ohne Abhängigkeiten; render.ts setzt die Eigenschaften am Bild-Knoten.

/** Videoformate, die Browser und WebView ohne Zusatz abspielen (MP4 mit H.264/AAC, WebM) */
export const VIDEO_MIME: Record<string, string> = {
  '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.ogv': 'video/ogg',
}

/** Größtes Video, das eingebettet wird (außerhalb des Decks bzw. mit `embedMedia: true`); größere bleiben Dateien */
export const MAX_EMBED_BYTES = 25 * 1024 * 1024

/** Endet der Pfad (bzw. die URL ohne Anfrage und Anker) auf ein Videoformat? */
export const isVideoUrl = (url: string): boolean => /\.(mp4|m4v|webm|ogv)([?#].*)?$/i.test(url)

/** Anzeigename für Meldungen: „Video“ oder „Bild“ */
export const mediaName = (url: string): string => (isVideoUrl(url) ? 'Video' : 'Bild')

/**
 * Zeitangabe in Sekunden: `12`, `12.5`, `0:05`, `1:02:03`, `45s`, `1m30s`. Sonst undefined.
 * Mit Doppelpunkt gilt Minuten:Sekunden, bei drei Teilen Stunden:Minuten:Sekunden.
 */
export function parseClock(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const v = value.trim().toLowerCase()
  if (/^\d+(\.\d+)?s?$/.test(v)) return Number(v.replace('s', ''))
  const parts = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/)
  if (parts && v !== '' && (parts[1] || parts[2] || parts[3])) return Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0)
  if (/^\d+(:\d{1,2}(\.\d+)?){1,2}$/.test(v)) {
    const nums = v.split(':').map(Number)
    return nums.length === 3 ? nums[0] * 3600 + nums[1] * 60 + nums[2] : nums[0] * 60 + nums[1]
  }
  return undefined
}

/** Attribute, die nur für Videos gelten (zusätzlich zu den Bild-Attributen) */
export const VIDEO_ATTRS = ['play', 'start', 'end', 'controls', 'loop', 'muted', 'poster']

const OFF = ['false', 'off', 'no', '0']
const flag = (v: string | undefined) => v !== undefined && !OFF.includes(v.toLowerCase())

export interface VideoProps {
  /** Eigenschaften für das `<video>`-Element (hast-Namen) */
  props: Record<string, unknown>
  /** Startzeit in Sekunden, wird als `#t=` an die Adresse gehängt (zeigt das Standbild an dieser Stelle) */
  start?: number
}

/**
 * Attribute eines Videos → Eigenschaften des `<video>`-Elements.
 * - `play=N`: ab Schritt N startet das Video (Standard 1; `play=0`: sofort beim Anzeigen der Folie).
 *   Mit `controls` (Abspielleiste des Browsers) ist das Video kein Schritt, außer `play` steht ausdrücklich da.
 * - `start`/`end`: Ausschnitt, z. B. `5s` bis `50s` oder `1m5s` bis `1m30s`. `loop`, `muted`: wie bei HTML.
 * - `poster=bild.png`: Standbild vor dem Start (sonst das erste Bild des Ausschnitts).
 */
export function videoProps(attrs: Record<string, string>, alt: string, warn: (msg: string) => void, poster?: string): VideoProps {
  const props: Record<string, unknown> = { preload: 'metadata', playsInline: true, alt: undefined }
  if (alt) props.ariaLabel = alt
  const controls = flag(attrs.controls)
  if (controls) props.controls = true
  if (flag(attrs.loop)) props.loop = true
  if (flag(attrs.muted)) props.muted = true
  if (poster) props.poster = poster

  const start = parseClock(attrs.start)
  const end = parseClock(attrs.end)
  if (attrs.start !== undefined && start === undefined) warn(`Video: start="${attrs.start}" ist ungültig (z. B. 12, 12.5, 5s oder 1m30s)`)
  if (attrs.end !== undefined && end === undefined) warn(`Video: end="${attrs.end}" ist ungültig (z. B. 12, 12.5, 50s oder 1m30s)`)
  if (start !== undefined && end !== undefined && end <= start) warn(`Video: end="${attrs.end}" liegt nicht nach start="${attrs.start}"`)
  if (start !== undefined) props.dataStart = String(start)
  if (end !== undefined) props.dataEnd = String(end)

  let play: number | undefined = controls ? undefined : 1
  if (attrs.play !== undefined) {
    if (/^\d+$/.test(attrs.play)) play = Number(attrs.play)
    else warn(`Video: play="${attrs.play}" ist ungültig (Schrittnummer, 0 = sofort)`)
  }
  if (play !== undefined) props.dataPlay = String(play)
  return { props, start }
}

/** Zustand des Videos der aktuellen Folie, die Präsentation meldet ihn an die Presenter-View */
export interface VideoInfo {
  state: 'idle' | 'playing' | 'paused' | 'ended'
  /** gespielte Sekunden seit dem Start des Ausschnitts */
  time: number
  /** Länge des Ausschnitts in Sekunden (0, solange unbekannt) */
  duration: number
}

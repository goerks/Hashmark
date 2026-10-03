// Eingebaute Icons für `::: card icon=…` (24 × 24, Linienstil, eigene Zeichnungen – keine Fremdlizenz, offline).

const I: Record<string, string> = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.9 3.1-6 7-6s7 2.1 7 6"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.8 0 5 1.6 5 4.5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  check: '<path d="M4.5 12.5l4.5 4.5L19.5 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  alert: '<path d="M12 3L2 20h20z"/><path d="M12 10v5M12 17.6v.4"/>',
  star: '<path d="M12 2.5l2.9 6.4 7 .7-5.3 4.7 1.6 6.9L12 17.5l-6.2 3.7 1.6-6.9L2.1 9.6l7-.7z"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v15H6a2 2 0 00-2 2z"/><path d="M4 20a2 2 0 002 1h13v-3"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  cloud: '<path d="M7 18a5 5 0 11.8-9.9A6 6 0 0119.5 11 3.5 3.5 0 0118 18z"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5M3 16.5l9 5 9-5"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6L20 19M8.6 16.4L20 5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
  bank: '<path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 21h18"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/>',
  code: '<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
  chart: '<path d="M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-8"/>',
  arrow: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 8l3.5 2.5-1.3 4h-4.4l-1.3-4zM12 3v5M15.5 10.5L20 9M14.2 14.5l3 3.5M9.8 14.5l-3 3.5M8.5 10.5L4 9"/>',
  sitemap: '<rect x="9" y="3" width="6" height="4" rx="1"/><rect x="2" y="17" width="6" height="4" rx="1"/><rect x="9" y="17" width="6" height="4" rx="1"/><rect x="16" y="17" width="6" height="4" rx="1"/><path d="M12 7v5M5 17v-5h14v5M12 12v5"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  coffee: '<path d="M5 8h12v6a5 5 0 01-5 5h-2a5 5 0 01-5-5z"/><path d="M17 10h2a2 2 0 010 4h-2M8 3v2M12 3v2"/>',
  rocket: '<path d="M12 2c4 2.5 5.5 7 4.5 12h-9C6.5 9 8 4.5 12 2z"/><circle cx="12" cy="9" r="1.6"/><path d="M7.5 14l-3 4 4-1M16.5 14l3 4-4-1M10 17.5L12 22l2-4.5"/>',
  puzzle: '<path d="M4 8h4a2 2 0 114 0h4v4a2 2 0 110 4v4H4v-4a2 2 0 100-4z"/>',
  heart: '<path d="M12 20S3.5 14.5 3.5 8.8A4.3 4.3 0 0112 7a4.3 4.3 0 018.5 1.8C20.5 14.5 12 20 12 20z"/>',
}

/** Inline-SVG zu einem Icon-Namen, sonst `undefined` (dann zählt der Wert als Text bzw. Emoji). */
export function iconSvg(name: string): string | undefined {
  const body = I[name.toLowerCase()]
  return body ? `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>` : undefined
}

export const ICON_NAMES = Object.keys(I)

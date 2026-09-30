// Erzeugt das Programm-Icon (drei gestapelte Schichten wie im Strata-Logo) als PNG und ICO,
// ohne Grafikbibliothek: Pixel mit 4-fach-Supersampling berechnen, PNG per zlib, ICO mit PNG-Einträgen.
// Aufruf: node scripts/make-icon.ts  →  src-tauri/icons/icon.png, src-tauri/icons/icon.ico

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

type RGBA = [number, number, number, number]
const hex = (h: string): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255]

/** Formen in Einheiten eines 240er-Rasters (wie das SVG-Logo) */
const SHAPES: { x: number; y: number; w: number; h: number; r: number; color: RGBA }[] = [
  { x: 8, y: 8, w: 224, h: 224, r: 48, color: hex('#0d1117') },
  { x: 36, y: 150, w: 168, h: 44, r: 12, color: hex('#2563eb') },
  { x: 60, y: 98, w: 120, h: 44, r: 12, color: hex('#60a5fa') },
  { x: 84, y: 46, w: 72, h: 44, r: 12, color: hex('#bfdbfe') },
]

function inside(px: number, py: number, s: (typeof SHAPES)[number]): boolean {
  if (px < s.x || py < s.y || px > s.x + s.w || py > s.y + s.h) return false
  const cx = Math.min(Math.max(px, s.x + s.r), s.x + s.w - s.r)
  const cy = Math.min(Math.max(py, s.y + s.r), s.y + s.h - s.r)
  return (px - cx) ** 2 + (py - cy) ** 2 <= s.r ** 2
}

function render(size: number): Buffer {
  const SS = 4
  const px = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const acc = [0, 0, 0, 0]
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = ((x + (sx + 0.5) / SS) / size) * 240
          const v = ((y + (sy + 0.5) / SS) / size) * 240
          let c: RGBA = [0, 0, 0, 0]
          for (const s of SHAPES) if (inside(u, v, s)) c = s.color
          // vormultipliziert mitteln, damit Kanten nicht dunkel werden
          acc[0] += c[0] * c[3]; acc[1] += c[1] * c[3]; acc[2] += c[2] * c[3]; acc[3] += c[3]
        }
      }
      const i = (y * size + x) * 4
      const a = acc[3] / (SS * SS)
      px[i] = acc[3] ? Math.round(acc[0] / acc[3]) : 0
      px[i + 1] = acc[3] ? Math.round(acc[1] / acc[3]) : 0
      px[i + 2] = acc[3] ? Math.round(acc[2] / acc[3]) : 0
      px[i + 3] = Math.round(a)
    }
  }
  return px
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function png(size: number): Buffer {
  const pixels = render(size)
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
    return Buffer.concat([len, td, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8 Bit, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ])
}

/** ICO mit PNG-Einträgen (ab Windows Vista unterstützt) */
function ico(sizes: number[]): Buffer {
  const images = sizes.map(png)
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4)
  let offset = 6 + 16 * sizes.length
  const entries = sizes.map((s, i) => {
    const e = Buffer.alloc(16)
    e[0] = s >= 256 ? 0 : s; e[1] = s >= 256 ? 0 : s
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6)
    e.writeUInt32LE(images[i].length, 8); e.writeUInt32LE(offset, 12)
    offset += images[i].length
    return e
  })
  return Buffer.concat([header, ...entries, ...images])
}

const dir = path.join(import.meta.dirname, '../src-tauri/icons')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'icon.png'), png(256))
fs.writeFileSync(path.join(dir, 'icon.ico'), ico([16, 24, 32, 48, 64, 128, 256]))
console.log('Icon geschrieben: src-tauri/icons/icon.png, icon.ico')

// Erzeugt alle Icons aus dem Hashmark-Logo, ohne Grafikbibliothek (PNG lesen/schreiben per zlib, Skalieren per Flächenmittel).
//
// Aufruf:
//   node scripts/make-icon.ts [logo.png]
//     Mit Datei: Logo zuschneiden (transparenten Rand weg), auf 512 px skalieren und als assets/hashmark.png ablegen.
//     Immer:     aus assets/hashmark.png src-tauri/icons/icon.png (256 px) und icon.ico (16–256 px) schreiben
//                und das Favicon (64 px, als Data-URI) in die HTML-Seiten eintragen.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const ROOT = path.join(import.meta.dirname, '..')
const MASTER = path.join(ROOT, 'assets/hashmark.png')
const MASTER_SIZE = 512
const FAVICON_PAGES = ['src/runtime/index.html', 'src/runtime/editor.html', 'src/desktop/ui/index.html']

interface Image { w: number; h: number; px: Buffer } // RGBA, nicht vormultipliziert

// ---------- PNG lesen ----------

function decodePng(buf: Buffer): Image {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Keine PNG-Datei')
  let w = 0, h = 0
  const idat: Buffer[] = []
  for (let p = 8; p < buf.length;) {
    const len = buf.readUInt32BE(p)
    const type = buf.toString('ascii', p + 4, p + 8)
    const data = buf.subarray(p + 8, p + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4)
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error('Nur PNG mit 8 Bit RGBA ohne Interlace wird gelesen')
    } else if (type === 'IDAT') idat.push(data)
    p += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = w * 4
  const px = Buffer.alloc(h * stride)
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? px[y * stride + x - 4] : 0
      const b = y > 0 ? px[(y - 1) * stride + x] : 0
      const c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0
      let v = line[x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      px[y * stride + x] = v & 0xff
    }
  }
  return { w, h, px }
}

// ---------- Bearbeiten ----------

/** Quadrat um alles, was nicht (fast) transparent ist */
function cropToContent(img: Image): Image {
  let x0 = img.w, y0 = img.h, x1 = -1, y1 = -1
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (img.px[(y * img.w + x) * 4 + 3] > 8) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
      }
    }
  }
  if (x1 < 0) throw new Error('Das Bild ist vollständig transparent')
  const side = Math.max(x1 - x0 + 1, y1 - y0 + 1)
  const sx = Math.round((x0 + x1 + 1 - side) / 2)
  const sy = Math.round((y0 + y1 + 1 - side) / 2)
  const px = Buffer.alloc(side * side * 4)
  for (let y = 0; y < side; y++) {
    for (let x = 0; x < side; x++) {
      const X = sx + x, Y = sy + y
      if (X < 0 || Y < 0 || X >= img.w || Y >= img.h) continue
      img.px.copy(px, (y * side + x) * 4, (Y * img.w + X) * 4, (Y * img.w + X) * 4 + 4)
    }
  }
  return { w: side, h: side, px }
}

/** Verkleinern über das Flächenmittel, vormultipliziert, damit Kanten nicht dunkel werden */
function resize(img: Image, size: number): Image {
  if (img.w === size && img.h === size) return img
  const out = Buffer.alloc(size * size * 4)
  const k = img.w / size
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0, wsum = 0
      const xa = x * k, xb = (x + 1) * k, ya = y * k, yb = (y + 1) * k
      for (let sy = Math.floor(ya); sy < Math.min(img.h, Math.ceil(yb)); sy++) {
        const wy = Math.min(sy + 1, yb) - Math.max(sy, ya)
        for (let sx = Math.floor(xa); sx < Math.min(img.w, Math.ceil(xb)); sx++) {
          const w = wy * (Math.min(sx + 1, xb) - Math.max(sx, xa))
          const i = (sy * img.w + sx) * 4
          const al = img.px[i + 3] * w
          r += img.px[i] * al; g += img.px[i + 1] * al; b += img.px[i + 2] * al
          a += al; wsum += w
        }
      }
      const o = (y * size + x) * 4
      if (a > 0) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a) }
      out[o + 3] = Math.round(a / wsum)
    }
  }
  return { w: size, h: size, px: out }
}

// ---------- PNG und ICO schreiben ----------

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

function encodePng(img: Image): Buffer {
  const raw = Buffer.alloc(img.h * (img.w * 4 + 1))
  for (let y = 0; y < img.h; y++) img.px.copy(raw, y * (img.w * 4 + 1) + 1, y * img.w * 4, (y + 1) * img.w * 4)
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
    return Buffer.concat([len, td, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(img.w, 0); ihdr.writeUInt32BE(img.h, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8 Bit, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ])
}

/** ICO mit PNG-Einträgen (ab Windows Vista unterstützt) */
function encodeIco(images: Image[]): Buffer {
  const pngs = images.map(encodePng)
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4)
  let offset = 6 + 16 * images.length
  const entries = images.map((img, i) => {
    const e = Buffer.alloc(16)
    e[0] = img.w >= 256 ? 0 : img.w; e[1] = img.h >= 256 ? 0 : img.h
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6)
    e.writeUInt32LE(pngs[i].length, 8); e.writeUInt32LE(offset, 12)
    offset += pngs[i].length
    return e
  })
  return Buffer.concat([header, ...entries, ...pngs])
}

// ---------- Ablauf ----------

const source = process.argv[2]
if (source) {
  const master = resize(cropToContent(decodePng(fs.readFileSync(source))), MASTER_SIZE)
  fs.mkdirSync(path.dirname(MASTER), { recursive: true })
  fs.writeFileSync(MASTER, encodePng(master))
  console.log(`Logo zugeschnitten: ${path.relative(ROOT, MASTER)} (${MASTER_SIZE} px)`)
}

const master = decodePng(fs.readFileSync(MASTER))
const icons = path.join(ROOT, 'src-tauri/icons')
fs.mkdirSync(icons, { recursive: true })
fs.writeFileSync(path.join(icons, 'icon.png'), encodePng(resize(master, 256)))
fs.writeFileSync(path.join(icons, 'icon.ico'), encodeIco([16, 24, 32, 48, 64, 128, 256].map((s) => resize(master, s))))
console.log('Programm-Icon: src-tauri/icons/icon.png, icon.ico')

// Favicon als Data-URI: funktioniert in der App, im Dev-Server, im Build und im Single-File-Export ohne weitere Datei
const link = `<link rel="icon" type="image/png" href="data:image/png;base64,${encodePng(resize(master, 64)).toString('base64')}" />`
for (const page of FAVICON_PAGES) {
  const file = path.join(ROOT, page)
  let html = fs.readFileSync(file, 'utf8')
  html = /<link rel="icon"[^>]*>/.test(html)
    ? html.replace(/<link rel="icon"[^>]*>/, () => link)
    : html.replace('</title>', () => `</title>\n    ${link}`)
  fs.writeFileSync(file, html)
}
console.log(`Favicon eingetragen: ${FAVICON_PAGES.join(', ')}`)

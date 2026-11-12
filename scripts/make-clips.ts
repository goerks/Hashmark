// Anleitungs-Clips aufnehmen: node scripts/make-clips.ts [--out <ordner>] [--cache <ordner>] [--only <name>] [--hash]
//
// Spielt das Drehbuch (scripts/docs-clips.ts) in der echten App ab (Edge/Chrome headless, CDP-Bildschirmaufnahme), blendet
// Tastenkappe und Einblendung ein und wandelt die Bilder mit ffmpeg in <name>.webm, <name>.mp4 und ein Standbild <name>.jpg um.
// Nichts davon gehört ins Repository (Binärdateien); die Pipeline legt die Clips beim Bau der Doku an (HASHMARK_CLIPS).
//
// Nur bei Änderung: Der Fingerabdruck eines Clips besteht aus Drehbuch, Aufnahme-Skript, Demo-Deck und dem Quelltext der App
// (src/). Liegt im Zwischenspeicher (--cache, Standard <out>/.cache) schon ein Clip mit diesem Fingerabdruck, wird er kopiert
// statt neu aufgenommen. `--hash` gibt nur die Fingerabdrücke aus (Schlüssel für actions/cache).

import { execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { config } from '../src/cli/config.ts'
import { serveBuild, withPage, type Cdp } from '../src/cli/pdf.ts'
import { CLIPS, type Clip } from './docs-clips.ts'

const root = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const opt = (name: string) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1] }
const outDir = path.resolve(root, opt('--out') ?? 'export/clips')
const cacheDir = path.resolve(root, opt('--cache') ?? path.join(outDir, '.cache'))
const only = opt('--only')
const FORMATS = ['webm', 'mp4', 'jpg'] as const
const FPS = 25

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** alle Dateien unter einem Ordner (sortiert), ohne node_modules und Build-Ergebnisse */
function filesUnder(dir: string): string[] {
  const out: string[] = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...filesUnder(p))
    else out.push(p)
  }
  return out
}

/** Fingerabdruck eines Clips: Drehbuch-Eintrag, Aufnahme-Skript, Demo-Deck und Quelltext der App (Kurzform, 12 Zeichen) */
export function fingerprint(clip: Clip): string {
  const h = crypto.createHash('sha256')
  h.update(JSON.stringify(clip))
  const files = [path.join(root, 'scripts/make-clips.ts'), ...filesUnder(path.join(root, 'examples', clip.deck)), ...filesUnder(path.join(root, 'src'))]
  for (const f of files) {
    h.update(path.relative(root, f).replace(/\\/g, '/'))
    h.update(fs.readFileSync(f))
  }
  return h.digest('hex').slice(0, 12)
}

/** Overlay in die Seite setzen: Tastenkappe oben rechts, Einblendung unten. Nur Anzeige, die App bleibt unberührt. */
const OVERLAY = `(() => {
  const css = document.createElement('style')
  css.textContent = \`
    #hm-clip-cap { position: fixed; left: 50%; bottom: 7%; transform: translateX(-50%); z-index: 99999; max-width: 88%;
      background: rgba(8, 12, 15, .82); color: #fff; padding: .45em 1em; border-radius: .5em; font: 600 clamp(16px, 2.6vw, 26px)/1.3 system-ui, sans-serif;
      opacity: 0; transition: opacity .25s; pointer-events: none; text-align: center }
    #hm-clip-cap.on { opacity: 1 }
    #hm-clip-key { position: fixed; right: 4%; top: 6%; z-index: 99999; min-width: 2.2em; padding: .3em .6em; text-align: center;
      background: #f2f4f5; color: #10181d; border-radius: .35em; border-bottom: .18em solid #9aa7ad; font: 700 clamp(18px, 3vw, 30px)/1.2 system-ui, sans-serif;
      opacity: 0; transform: translateY(-6px); transition: opacity .15s, transform .15s; pointer-events: none }
    #hm-clip-key.on { opacity: 1; transform: none }\`
  document.head.append(css)
  const cap = Object.assign(document.createElement('div'), { id: 'hm-clip-cap' })
  const key = Object.assign(document.createElement('div'), { id: 'hm-clip-key' })
  document.body.append(cap, key)
  window.__clip = {
    say(t) { cap.classList.toggle('on', !!t); if (t) cap.textContent = t },
    key(k) { key.textContent = k; key.classList.add('on'); setTimeout(() => key.classList.remove('on'), 650) },
  }
})()`

const KEYCAP: Record<string, string> = { ArrowRight: '→', ArrowLeft: '←', ArrowDown: '↓', ArrowUp: '↑', ' ': 'Leertaste', Enter: '⏎' }

interface Frame { file: string; t: number }

/** Drehbuch abspielen und dabei mit Page.startScreencast aufnehmen; liefert die Bilder mit Zeitstempel (Sekunden) */
async function record(cdp: Cdp, clip: Clip, framesDir: string): Promise<Frame[]> {
  const frames: Frame[] = []
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: clip.width, height: clip.height, deviceScaleFactor: 1, mobile: false })
  await cdp.send('Runtime.evaluate', { expression: OVERLAY })
  const key = (k: string) => `document.body.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)}, bubbles: true }))`

  const pending: Promise<void>[] = []
  cdp.on('Page.screencastFrame', (p: { data: string; metadata: { timestamp: number }; sessionId: number }) => {
    const file = path.join(framesDir, `f${String(frames.length).padStart(5, '0')}.jpg`)
    frames.push({ file, t: p.metadata.timestamp })
    pending.push(fsp.writeFile(file, Buffer.from(p.data, 'base64')))
    cdp.send('Page.screencastFrameAck', { sessionId: p.sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: clip.width, maxHeight: clip.height, everyNthFrame: 1 })
  await sleep(400)
  for (const s of clip.steps) {
    if (s.say !== undefined) await cdp.send('Runtime.evaluate', { expression: `window.__clip.say(${JSON.stringify(s.say)})` })
    if (s.key) {
      await cdp.send('Runtime.evaluate', { expression: `window.__clip.key(${JSON.stringify(KEYCAP[s.key] ?? s.key)})` })
      await sleep(250)
      await cdp.send('Runtime.evaluate', { expression: key(s.key) })
    }
    await sleep(s.wait)
  }
  await cdp.send('Runtime.evaluate', { expression: 'window.__clip.say("")' })
  await sleep(500)
  await cdp.send('Page.stopScreencast')
  await Promise.all(pending)
  return frames
}

/** Bilder mit Zeitstempeln zu WebM, MP4 und Standbild; die Concat-Liste gibt jedem Bild seine echte Dauer */
function encode(frames: Frame[], clip: Clip, tmp: string, out: string) {
  if (frames.length < 2) throw new Error(`Clip ${clip.name}: zu wenige Bilder aufgenommen (${frames.length})`)
  const list = frames.map((f, i) => {
    const next = frames[i + 1]
    const dur = next ? Math.max(next.t - f.t, 0.001) : 0.5
    return `file '${f.file.replace(/\\/g, '/')}'\nduration ${dur.toFixed(4)}`
  })
  list.push(`file '${frames[frames.length - 1].file.replace(/\\/g, '/')}'`)
  const listFile = path.join(tmp, 'frames.txt')
  fs.writeFileSync(listFile, list.join('\n'))
  const base = ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-r', String(FPS), '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2']
  execFileSync('ffmpeg', [...base, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '36', '-row-mt', '1', '-an', path.join(out, `${clip.name}.webm`)])
  execFileSync('ffmpeg', [...base, '-c:v', 'libx264', '-crf', '26', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', path.join(out, `${clip.name}.mp4`)])
  // Standbild: eine Sekunde vor dem Ende, wenn alles sichtbar ist
  fs.copyFileSync(frames[Math.max(0, Math.floor(frames.length * 0.15))].file, path.join(out, `${clip.name}.jpg`))
}

async function make(clip: Clip) {
  const hash = fingerprint(clip)
  const cached = FORMATS.every((f) => fs.existsSync(path.join(cacheDir, `${clip.name}-${hash}.${f}`)))
  await fsp.mkdir(outDir, { recursive: true })
  if (cached) {
    for (const f of FORMATS) fs.copyFileSync(path.join(cacheDir, `${clip.name}-${hash}.${f}`), path.join(outDir, `${clip.name}.${f}`))
    console.log(`  ${clip.name}: unverändert (${hash}), aus dem Zwischenspeicher`)
    return
  }
  const started = Date.now()
  const tmp = await fsp.mkdtemp(path.join(os.tmpdir(), 'hashmark-clip-'))
  const framesDir = path.join(tmp, 'frames')
  await fsp.mkdir(framesDir)
  const served = await serveBuild(config(path.join(root, 'examples', clip.deck)))
  try {
    const frames = await withPage(`${served.url}?clip`, process.env.HASHMARK_BROWSER, (cdp) => record(cdp, clip, framesDir), {
      ready: 'document.querySelector("#app")?.children.length > 0',
      notReady: 'Präsentation wurde nicht fertig.',
    })
    encode(frames, clip, tmp, outDir)
  } finally {
    await served.close()
    await fsp.rm(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }).catch(() => {})
  }
  await fsp.mkdir(cacheDir, { recursive: true })
  for (const f of FORMATS) fs.copyFileSync(path.join(outDir, `${clip.name}.${f}`), path.join(cacheDir, `${clip.name}-${hash}.${f}`))
  const kb = (f: string) => (fs.statSync(path.join(outDir, `${clip.name}.${f}`)).size / 1024).toFixed(0)
  console.log(`  ${clip.name}: neu aufgenommen (${hash}) in ${((Date.now() - started) / 1000).toFixed(0)} s · webm ${kb('webm')} KB · mp4 ${kb('mp4')} KB · jpg ${kb('jpg')} KB`)
}

if (import.meta.main) {
  const wanted = CLIPS.filter((c) => !only || c.name === only)
  if (args.includes('--hash')) {
    for (const c of wanted) console.log(`${c.name}-${fingerprint(c)}`)
  } else {
    console.log('Clips aufnehmen …')
    for (const c of wanted) await make(c)
    console.log(`Clips: ${path.relative(root, outDir)}`)
  }
}

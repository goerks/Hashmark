// Video in Folien: Schreibweise, Zeitangaben, Dateien, Teilabrufe, Einzel-HTML-Export.

import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'
import { MAX_EMBED_BYTES, isVideoUrl, parseClock, videoProps } from '../src/core/media.ts'
import { loadDeck } from '../src/core/deck.ts'
import { exportSingleFile, mediaSink } from '../src/cli/export.ts'
import { config } from '../src/cli/config.ts'
import { parseRange, serveFile } from '../src/vite/serve-file.ts'

async function tempDeck(files: Record<string, string | Buffer>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashmark-media-'))
  for (const [name, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(dir, name)), { recursive: true })
    await fs.writeFile(path.join(dir, name), content)
  }
  return dir
}

const BYTES = Buffer.from('0123456789abcdefghij')

const render = async (md: string, files: Record<string, string | Buffer> = {}, manifest = '') => {
  const dir = await tempDeck({ 'deck.yaml': manifest, 'a.md': md, 'demo.webm': BYTES, 'poster.png': 'x', ...files })
  const result = await loadDeck(dir)
  const slide = result.deck.nodes[0].slides[0]
  return { ...result, dir, html: slide.html, slide }
}

describe('Zeitangaben', () => {
  it('liest Sekunden, Minuten:Sekunden, Stunden und Einheiten', () => {
    expect(parseClock('12')).toBe(12)
    expect(parseClock('12.5')).toBe(12.5)
    expect(parseClock('0:05')).toBe(5)
    expect(parseClock('1:30')).toBe(90)
    expect(parseClock('1:02:03')).toBe(3723)
    expect(parseClock('45s')).toBe(45)
    expect(parseClock('1m30s')).toBe(90)
    expect(parseClock('2m')).toBe(120)
    expect(parseClock(undefined)).toBeUndefined()
    for (const bad of ['', 'abc', '1:2:3:4', '-5', '1::2']) expect(parseClock(bad)).toBeUndefined()
  })
  it('erkennt Videodateien an der Endung, auch mit Anker', () => {
    expect(isVideoUrl('demo.mp4')).toBe(true)
    expect(isVideoUrl('a/b/Demo.WEBM')).toBe(true)
    expect(isVideoUrl('deck-assets/demo.m4v#t=5')).toBe(true)
    expect(isVideoUrl('bild.png')).toBe(false)
    expect(isVideoUrl('video.mp4.txt')).toBe(false)
  })
})

describe('Video-Eigenschaften', () => {
  it('Standard: ein Schritt, der das Video startet', () => {
    const warnings: string[] = []
    const { props, start } = videoProps({}, 'Demo', (m) => warnings.push(m))
    expect(props).toMatchObject({ preload: 'metadata', playsInline: true, ariaLabel: 'Demo', dataPlay: '1' })
    expect(props.controls).toBeUndefined()
    expect(start).toBeUndefined()
    expect(warnings).toEqual([])
  })
  it('mit controls ist es kein Schritt, mit ausdrücklichem play schon', () => {
    expect(videoProps({ controls: 'true' }, '', () => {}).props.dataPlay).toBeUndefined()
    expect(videoProps({ controls: 'true', play: '2' }, '', () => {}).props).toMatchObject({ controls: true, dataPlay: '2' })
    expect(videoProps({ play: '0' }, '', () => {}).props.dataPlay).toBe('0')
  })
  it('meldet ungültige Angaben', () => {
    const w: string[] = []
    videoProps({ start: 'bald', end: '0:03', play: 'x' }, '', (m) => w.push(m))
    videoProps({ start: '0:10', end: '0:05' }, '', (m) => w.push(m))
    expect(w).toHaveLength(3)
    expect(w[0]).toContain('start="bald"')
    expect(w[1]).toContain('play="x"')
    expect(w[2]).toContain('liegt nicht nach')
  })
})

describe('Video im Deck', () => {
  it('rendert <video> mit Ausschnitt, Schritt und Standbild', async () => {
    const { html, slide, assets, warnings } = await render('# V\n\n![Demo](demo.webm){play=2 start=0:05 end=0:50 muted loop poster=poster.png width=60%}')
    expect(html).toContain('<video')
    expect(html).not.toContain('<img')
    expect(html).toContain('class="hm-video"')
    expect(html).toContain('src="deck-assets/demo.webm#t=5"')
    expect(html).toContain('poster="deck-assets/poster.png"')
    expect(html).toContain('data-play="2"')
    expect(html).toContain('data-start="5"')
    expect(html).toContain('data-end="50"')
    expect(html).toContain('aria-label="Demo"')
    expect(html).toMatch(/<video[^>]*\smuted/)
    expect(html).toMatch(/<video[^>]*\sloop/)
    expect(html).toContain('playsinline')
    expect(html).toContain('width:60%')
    expect(html).not.toMatch(/alt=/)
    expect(slide.steps).toHaveLength(2)
    expect(assets.map((a) => path.basename(a)).sort()).toEqual(['demo.webm', 'poster.png'])
    expect(warnings).toEqual([])
  })
  it('ohne Attribute: ein Schritt und Standbild am ersten Bild', async () => {
    const { html, slide } = await render('# V\n\n![](demo.webm)')
    expect(html).toContain('src="deck-assets/demo.webm#t=0.001"')
    expect(html).toContain('data-play="1"')
    expect(slide.steps).toHaveLength(1)
  })
  it('mit controls ohne Schritt', async () => {
    const { html, slide } = await render('# V\n\n![](demo.webm){controls}')
    expect(html).toMatch(/<video[^>]*\scontrols/)
    expect(html).not.toContain('data-play')
    expect(slide.steps).toHaveLength(0)
  })
  it('play=0 startet sofort und zählt keinen Schritt', async () => {
    const { html, slide } = await render('# V\n\n![](demo.webm){play=0}')
    expect(html).toContain('data-play="0"')
    expect(slide.steps).toHaveLength(0)
  })
  it('zählt den Schritt des Videos mit den Schritten der Liste zusammen', async () => {
    const { slide } = await render('# V\n\n::: steps\n- a\n- b\n:::\n\n![](demo.webm){play=3}')
    expect(slide.steps).toHaveLength(3)
  })
  it('bettet Videos nicht wegen embedImages ein', async () => {
    const { html, assets } = await render('# V\n\n![](demo.webm)\n\n![](poster.png)', {}, 'embedImages: true\n')
    expect(html).toContain('src="deck-assets/demo.webm#t=0.001"')
    expect(html).toContain('src="data:image/png;base64,')
    expect(assets.map((a) => path.basename(a))).toEqual(['demo.webm'])
  })
  it('meldet ein fehlendes Video als Video, nicht als Bild', async () => {
    const { warnings } = await render('# V\n\n![](fehlt.mp4)\n\n![](fehlt.png)')
    expect(warnings.some((w) => w.startsWith('Video nicht gefunden: fehlt.mp4'))).toBe(true)
    expect(warnings.some((w) => w.startsWith('Bild nicht gefunden: fehlt.png'))).toBe(true)
  })
  it('meldet unbekannte Attribute, Video-Attribute an Bildern und Videos aus dem Netz', async () => {
    const { warnings } = await render('# V\n\n![](demo.webm){tempo=2}\n\n![](poster.png){play=1}\n\n![](https://example.com/x.mp4)')
    expect(warnings.some((w) => w.includes('Video-Attribut „tempo“ ist unbekannt'))).toBe(true)
    expect(warnings.some((w) => w.includes('Bild-Attribut „play“ ist unbekannt'))).toBe(true)
    expect(warnings.some((w) => w.includes('liegt im Netz und läuft offline nicht'))).toBe(true)
  })
  it('bettet ein kleines Video außerhalb des Decks ein, ein großes nicht', async () => {
    const parent = await tempDeck({ 'klein.webm': BYTES })
    await fs.writeFile(path.join(parent, 'gross.webm'), '')
    await fs.truncate(path.join(parent, 'gross.webm'), MAX_EMBED_BYTES + 1)
    const deck = path.join(parent, 'deck')
    await fs.mkdir(deck)
    await fs.writeFile(path.join(deck, 'a.md'), '# V\n\n![](../klein.webm)\n\n![](../gross.webm)')
    const { deck: d, warnings, assets } = await loadDeck(deck)
    const html = d.nodes[0].slides[0].html
    expect(html).toContain('src="data:video/webm;base64,')
    expect(html).toContain('src="../gross.webm#t=0.001"')
    expect(warnings.some((w) => w.includes('außerhalb des Decks und ist größer als 25 MB'))).toBe(true)
    expect(assets).toEqual([])
  })
  it('merkt sich embedMedia aus der deck.yaml', async () => {
    expect((await render('# V', {}, 'embedMedia: true\n')).embedMedia).toBe(true)
    expect((await render('# V')).embedMedia).toBe(false)
  })
})

describe('Beispiel-Deck', () => {
  it('hat eine Folie „Video“ mit Standbild, Ausschnitt und Abspielleiste ohne Hinweise', async () => {
    const { deck, warnings, assets } = await loadDeck(path.resolve('examples/hashmark-demo'))
    expect(warnings.filter((w) => /video|medien/i.test(w))).toEqual([])
    const video = deck.nodes.find((n) => n.id === 'video')!
    expect(video).toBeDefined()
    expect(video.slides[0].html).toContain('src="deck-assets/medien/demo.webm#t=0.001"')
    expect(video.slides[0].steps).toHaveLength(1)
    expect(video.children.map((c) => c.title)).toEqual(['Ausschnitt und Schleife', 'Mit Abspielleiste'])
    expect(video.children[0].slides[0].html).toContain('src="deck-assets/medien/demo.webm#t=1.4"')
    expect(assets.some((a) => a.endsWith(path.join('medien', 'demo.webm')))).toBe(true)
  })
})

describe('Teilabrufe', () => {
  it('liest Bereiche wie ein Browser sie schickt', () => {
    expect(parseRange('bytes=0-4', 20)).toEqual({ start: 0, end: 4 })
    expect(parseRange('bytes=5-', 20)).toEqual({ start: 5, end: 19 })
    expect(parseRange('bytes=-5', 20)).toEqual({ start: 15, end: 19 })
    expect(parseRange('bytes=10-99', 20)).toEqual({ start: 10, end: 19 })
    expect(parseRange('bytes=20-30', 20)).toBe('unsatisfiable')
    expect(parseRange('bytes=-0', 20)).toBe('unsatisfiable')
    for (const ignored of [undefined, '', 'bytes=', 'bytes=0-1,3-4', 'items=0-1', 'bytes=9-3']) expect(parseRange(ignored, 20)).toBeNull()
  })

  async function withServer(run: (url: string) => Promise<void>) {
    const dir = await tempDeck({ 'clip.webm': BYTES })
    const server = http.createServer((req, res) => serveFile(req, res, path.join(dir, req.url === '/fehlt' ? 'fehlt.webm' : 'clip.webm'), { type: 'video/webm' }))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }

  it('liefert die ganze Datei, einen Teil, die Kopfzeilen und 416', async () => {
    await withServer(async (url) => {
      const full = await fetch(url + '/clip')
      expect(full.status).toBe(200)
      expect(full.headers.get('accept-ranges')).toBe('bytes')
      expect(full.headers.get('content-type')).toBe('video/webm')
      expect(await full.text()).toBe(BYTES.toString())

      const part = await fetch(url + '/clip', { headers: { Range: 'bytes=2-5' } })
      expect(part.status).toBe(206)
      expect(part.headers.get('content-range')).toBe('bytes 2-5/20')
      expect(part.headers.get('content-length')).toBe('4')
      expect(await part.text()).toBe('2345')

      const tail = await fetch(url + '/clip', { headers: { Range: 'bytes=-3' } })
      expect(await tail.text()).toBe('hij')

      const head = await fetch(url + '/clip', { method: 'HEAD' })
      expect(head.status).toBe(200)
      expect(head.headers.get('content-length')).toBe('20')

      const beyond = await fetch(url + '/clip', { headers: { Range: 'bytes=50-60' } })
      expect(beyond.status).toBe(416)
      expect(beyond.headers.get('content-range')).toBe('bytes */20')

      expect((await fetch(url + '/fehlt')).status).toBe(404)
    })
  })
})

describe('Einzel-HTML-Export', () => {
  const exportDeck = async (manifest: string) => {
    const dir = await tempDeck({ 'deck.yaml': manifest, 'a.md': '# V\n\n![Demo](demo.webm)\n\n![](bild.png)', 'demo.webm': BYTES, 'bild.png': 'x' })
    const out = path.join(await fs.mkdtemp(path.join(os.tmpdir(), 'hashmark-out-')), 'vortrag.html')
    const media = mediaSink(out)
    await exportSingleFile(config(dir, { logLevel: 'error' }, { inlineAssets: true, media }, { cacheDir: path.join(os.tmpdir(), 'hashmark-media-vite') }), out, media)
    return { out, html: await fs.readFile(out, 'utf8'), media }
  }

  it('legt Videos in einen Ordner neben die Datei und bettet Bilder ein', async () => {
    const { out, html, media } = await exportDeck('')
    expect(media.dir).toBe('vortrag-medien')
    expect([...media.files.values()]).toEqual(['demo.webm'])
    expect(await fs.readFile(path.join(path.dirname(out), 'vortrag-medien', 'demo.webm'))).toEqual(BYTES)
    expect(html).toContain('vortrag-medien/demo.webm#t=0.001')
    expect(html).not.toContain('data:video/webm')
    expect(html).toContain('data:image/png;base64,')
  }, 180_000)

  it('bettet Videos mit embedMedia: true ein', async () => {
    const { out, html, media } = await exportDeck('embedMedia: true\n')
    expect(html).toContain('data:video/webm;base64,')
    expect(html).not.toContain('vortrag-medien')
    expect(media.files.size).toBe(0)
    await expect(fs.stat(path.join(path.dirname(out), 'vortrag-medien'))).rejects.toThrow()
  }, 180_000)
})

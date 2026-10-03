import { describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { loadDeck } from '../src/core/deck.ts'
import { iconSvg } from '../src/core/icons.ts'
import { svgIdSteps } from '../src/core/svg-steps.ts'
import { qrSvg } from '../src/core/render.ts'
import { CONTAINER_INFO } from '../src/core/vocab.ts'

async function tempDeck(files: Record<string, string>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hashmark-g-'))
  for (const [name, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(dir, name)), { recursive: true })
    await fs.writeFile(path.join(dir, name), content)
  }
  return dir
}

const html = async (md: string, manifest = '') => {
  const dir = await tempDeck({ 'deck.yaml': manifest, 'a.md': md })
  const { deck, warnings } = await loadDeck(dir)
  return { deck, warnings, html: deck.nodes[0].slides.map((s) => s.html).join('\n') }
}

describe('Beschriftungen in Figuren', () => {
  it('platziert Sprechblase, Rahmen und Pin in Prozent und schaltet sie per step', async () => {
    const { html: h, deck } = await html([
      '# F', '', '::: figure', '![x](https://example.com/x.png)', '',
      '::: bubble at="60,20" w=30 tail=left step=2', 'Hallo', ':::', '',
      '::: frame at="10,15" size="30,25" label="Fokus" step=1', ':::', '',
      '::: pin at="50,50"', '1', ':::', ':::',
    ].join('\n'))
    expect(h).toContain('class="d-figure"')
    expect(h).toMatch(/class="d-bubble tail-left"[^>]*style="left:60%;top:20%;width:30%"/)
    expect(h).toContain('data-step="2"')
    expect(h).toMatch(/class="d-frame"[^>]*style="left:10%;top:15%;width:30%;height:25%"/)
    expect(h).toContain('<span class="frame-label">Fokus</span>')
    expect(h).toContain('class="d-pin"')
    expect(deck.nodes[0].slides[0].steps.length).toBe(2)
  })
})

describe('Karten', () => {
  it('rendert Icon, Titel und Inhalt und zählt Schritte', async () => {
    const { html: h } = await html([
      '# K', '', '::: cards cols=3 steps', '::: card icon=user title="Rolle"', 'Text', ':::', '::: card icon=🪁 title="Drache"', 'Mehr', ':::', ':::',
    ].join('\n'))
    expect(h).toContain('grid-template-columns:repeat(3,minmax(0,1fr))')
    expect(h).toContain('<svg class="icon"')
    expect(h).toContain('<div class="card-icon">🪁</div>')
    expect(h).toContain('<div class="card-title">Rolle</div>')
    expect(h).toContain('data-step="1"')
    expect(h).toContain('data-step="2"')
  })
  it('kennt Icons, sonst undefined', () => {
    expect(iconSvg('star')).toContain('<path')
    expect(iconSvg('gibtsnicht')).toBeUndefined()
  })
})

describe('Tabellen mit Optionen', () => {
  const table = '| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |'
  it('setzt Spaltenbreiten, Zeilen-Schritte und Hervorhebung', async () => {
    const { html: h } = await html(`# T\n\n::: table widths="2:1:1" steps=rows hl="r2c3,c1"\n${table}\n:::`)
    expect(h).toContain('table-layout:fixed')
    expect(h).toContain('width:50.00%')
    expect(h).toMatch(/<tr data-step="1">/)
    expect(h).toMatch(/<tr data-step="2">/)
    expect(h.match(/hl-cell/g)?.length).toBe(4) // c1: Kopf + 2 Zeilen, dazu r2c3
  })
  it('Spalten als Schritte', async () => {
    const { html: h } = await html(`# T\n\n::: table steps=cols\n${table}\n:::`)
    expect(h).toContain('data-step="2"')
    expect(h).not.toMatch(/<tr data-step/)
  })
})

describe('Schritte auf beliebigen Blöcken', () => {
  it('::: reveal step=2 und Bild-Attribute', async () => {
    const { html: h, deck } = await html('# S\n\n::: reveal step=3\nSpäter\n:::\n\n![](https://example.com/a.png){step=2 fit=cover pos="50% 20%" ratio=16/9}')
    expect(h).toMatch(/<div class="d-reveal" data-step="3">/)
    expect(h).toMatch(/<img [^>]*data-step="2"/)
    expect(h).toContain('object-fit:cover;object-position:50% 20%;aspect-ratio:16/9')
    expect(deck.nodes[0].slides[0].steps.length).toBe(3)
  })
})

describe('QR und SVG-Schritte', () => {
  it('erzeugt ein Inline-SVG', async () => {
    expect(qrSvg('https://example.com')).toMatch(/^<svg class="qr-svg" viewBox="-2 -2 \d+ \d+"/)
    const { html: h } = await html('# Q\n\n```qr {size=180 label="acme"}\nhttps://example.com\n```')
    expect(h).toContain('class="qr-block" style="width:180px"')
    expect(h).toContain('<figcaption>acme</figcaption>')
  })
  it('liest id="step-N" aus beliebigen SVGs', async () => {
    const r = svgIdSteps('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script><g id="step-1"><rect/></g><g id="step_2-name"/><g id="rest"/></svg>')
    expect(r.count).toBe(2)
    expect(r.svg).toContain('<g id="step-1" data-step="1">')
    expect(r.svg).toContain('data-step="2"/>')
    expect(r.svg).not.toContain('script')
  })
  it('bindet SVG mit steps=ids inline ein', async () => {
    const dir = await tempDeck({
      'a.md': '# D\n\n![](d.svg){steps=ids}',
      'd.svg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g id="step-1"><rect width="5" height="5"/></g><g id="step-2"/></svg>',
    })
    const { deck } = await loadDeck(dir)
    const h = deck.nodes[0].slides[0].html
    expect(h).toContain('class="svg-block"')
    expect(h).toContain('data-step="2"')
  })
})

describe('Banner, Fußzeile und Folienzahl', () => {
  it('nummeriert in Baumreihenfolge und baut die Fußzeile', async () => {
    const dir = await tempDeck({
      'deck.yaml': 'footer: Acme Academy\nslideNumber: "Seite {n} / {total}"\n',
      'a.md': '# A\n---\nzwei\n## A1\n# B {footer=off}\n# C {banner=b.svg bannerh=200}',
      'b.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    })
    const { deck } = await loadDeck(dir)
    const [a, b, c] = deck.nodes
    expect(a.slideNo).toBe(1)
    expect(a.children[0].slideNo).toBe(3)
    expect(b.slideNo).toBe(4)
    expect(c.slideNo).toBe(5)
    expect(a.footer).toEqual({ text: 'Acme Academy', number: 'Seite {n} / 5' })
    expect(b.footer).toBeUndefined()
    expect(c.attrs.banner).toMatch(/^url\("deck-assets\/b\.svg"\)$/)
  })
  it('ohne Konfiguration keine Fußzeile', async () => {
    const { deck } = await html('# A')
    expect(deck.nodes[0].footer).toBeUndefined()
  })
})

describe('Hinweise bei ungültigen Angaben', () => {
  const warn = async (md: string, manifest = '') => (await html(md, manifest)).warnings
  const has = (list: string[], part: string) => expect(list.some((w) => w.includes(part)), `${part} in ${JSON.stringify(list)}`).toBe(true)

  it('Position, Größe, Tail und unbekannte Attribute', async () => {
    const w = await warn(['# W', '', '::: bubble at="85" w=x tail=sideways stp=1', 'x', ':::', '', '::: frame size="a"', ':::'].join('\n'))
    has(w, '::: bubble: at="85" ist ungültig')
    has(w, '::: bubble: w="x" ist ungültig')
    has(w, '::: bubble: tail="sideways" ist ungültig')
    has(w, 'Attribut „stp“ ist unbekannt (meintest du „step“?)')
    has(w, '::: frame: size="a" ist ungültig')
    expect(w.every((m) => m.endsWith('(a.md)'))).toBe(true)
  })
  it('Icons, Karten, reveal und Schrittnummern', async () => {
    const w = await warn(['# W', '', '::: cards', '::: card icon=usr title="A"', 'x', ':::', ':::', '', '::: reveal', 'x', ':::', '', '::: col step=zwei', 'x', ':::'].join('\n'))
    has(w, 'Icon „usr“ gibt es nicht (meintest du „user“?)')
    has(w, '::: reveal braucht step=')
    has(w, 'step="zwei" ist ungültig')
  })
  it('Tabelle: ohne Tabelle, Breiten, Hervorhebung, steps', async () => {
    const t = '| A | B |\n| --- | --- |\n| 1 | 2 |'
    has(await warn('# W\n\n::: table\nText\n:::'), 'enthält keine Markdown-Tabelle')
    const w = await warn(`# W\n\n::: table widths="1:2:3" steps=zeilen hl="r9,x1,c5"\n${t}\n:::`)
    has(w, 'widths nennt 3 Spalten, die Tabelle hat 2')
    has(w, 'steps="zeilen" ist ungültig')
    has(w, 'hl „r9“ liegt außerhalb')
    has(w, 'hl „x1“ ist ungültig')
    has(w, 'hl „c5“ liegt außerhalb')
  })
  it('Bild, Mermaid, QR', async () => {
    const w = await warn([
      '# W', '', '![](https://example.com/a.png){fit=zoom step=x farbe=rot}', '', '![](https://example.com/b.png){ratio=16:9}', '',
      '```mermaid {height=viel look=comic}', 'flowchart LR', '  A --> B', '```', '', '```qr {size=gross}', '```',
    ].join('\n'))
    has(w, 'Bild: fit="zoom" ist ungültig')
    has(w, 'Bild: step="x" ist ungültig')
    has(w, 'Bild-Attribut „farbe“ ist unbekannt')
    has(w, 'Bild-Attribute nicht lesbar')
    has(w, 'Mermaid: height="viel" ist ungültig')
    has(w, 'Mermaid: look="comic" ist ungültig')
    has(w, 'QR-Code: size="gross" ist ungültig')
    has(w, 'QR-Code: der Block ist leer')
  })
  it('Banner und Folienzahl', async () => {
    const w = await warn('# A {layout=banner bannerh=hoch}\n# B {bannerpos="0 0"}', 'slideNumber: "Seite"\nfooter: [1]\n')
    has(w, 'Layout banner ohne banner=')
    has(w, 'Ungültige Bandhöhe bannerh="hoch"')
    has(w, 'bannerh/bannerpos ohne banner=')
    has(w, 'slideNumber "Seite" enthält kein {n}')
    has(w, 'footer muss ein Text sein')
  })
  it('gültige Angaben bleiben ohne Hinweis', async () => {
    const w = await warn('# G\n\n::: figure\n![](https://example.com/a.png){fit=cover ratio=16/9}\n\n::: bubble at="10,10" w=20 tail=down step=1\nx\n:::\n:::')
    expect(w).toEqual([])
  })
})

describe('Bausteine', () => {
  it('Vorlagen aller Container laden ohne Hinweise', async () => {
    for (const [name, info] of Object.entries(CONTAINER_INFO)) {
      const { warnings, html: h } = await html(`# X\n\n${info.text.replace('§', '')}`)
      expect(warnings.filter((w) => !w.startsWith('Bild nicht gefunden')), name).toEqual([])
      expect(h, name).not.toContain(':::')
    }
  })
})

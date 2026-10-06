import { mount } from 'svelte'
import './base.css'
import './katex.css'
import 'virtual:hashmark/theme.css'
import './print.css'
import { parsePrintOptions } from '../core/print.ts'

const target = document.getElementById('app')!
const params = new URLSearchParams(location.search)

// ?print → Druckansicht (PDF), ?presenter → Presenter-View (zweites Fenster), ?reader → Lesemodus (Handbuch),
// ?card → eine einzelne Folie zum Einbetten, sonst Präsentation
if (params.has('reader')) {
  const { default: ReaderView } = await import('./ReaderView.svelte')
  mount(ReaderView, { target })
} else if (params.has('card')) {
  const { default: CardView } = await import('./CardView.svelte')
  mount(CardView, { target })
} else if (params.has('print')) {
  const { default: PrintView } = await import('./PrintView.svelte')
  mount(PrintView, { target, props: { options: parsePrintOptions(params), autoprint: params.has('autoprint') } })
} else if (params.has('presenter')) {
  const { default: PresenterView } = await import('./PresenterView.svelte')
  mount(PresenterView, { target })
} else {
  const { default: App } = await import('./App.svelte')
  mount(App, { target })
  // nur im Dev-Server: Beispiel-Decks umschalten (beim Build entfällt der Zweig)
  if (import.meta.env.DEV && window.top === window) void import('./example-switcher.ts').then((m) => m.mountExampleSwitcher())
}

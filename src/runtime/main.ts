import { mount } from 'svelte'
import './base.css'
import 'virtual:strata/theme.css'
import { parsePrintOptions } from '../core/print.ts'

const target = document.getElementById('app')!
const params = new URLSearchParams(location.search)

// ?print → Druckansicht (PDF), sonst Präsentation
if (params.has('print')) {
  await import('./print.css')
  const { default: PrintView } = await import('./PrintView.svelte')
  mount(PrintView, { target, props: { options: parsePrintOptions(params), autoprint: params.has('autoprint') } })
} else {
  const { default: App } = await import('./App.svelte')
  mount(App, { target })
}

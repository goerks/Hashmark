// Dev-Komfort (`make dev` ohne DECK=): Auswahl der Beispiel-Decks oben links. Nur im Dev-Server aktiv;
// überall sonst antwortet /__hashmark/examples nicht als JSON, dann bleibt die Seite unverändert.

interface ExampleList { current?: string; examples: { name: string; title: string }[] }

export async function mountExampleSwitcher(): Promise<void> {
  let data: ExampleList
  try {
    const res = await fetch('./__hashmark/examples')
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return
    data = await res.json()
  } catch { return }
  if (!data.examples?.length) return

  const select = document.createElement('select')
  select.className = 'example-switcher'
  select.title = 'Beispiel-Deck wählen (nur Dev-Server)'
  for (const e of data.examples) select.add(new Option(`${e.name} – ${e.title}`, e.name, false, e.name === data.current))
  select.onchange = async () => {
    select.disabled = true
    try {
      await fetch('./__hashmark/examples', { method: 'POST', body: JSON.stringify({ name: select.value }) })
      history.replaceState(null, '', location.pathname + location.search)
      location.reload()
    } catch { select.disabled = false }
  }
  // Pfeiltasten gehören der Präsentation, nicht der Auswahl
  select.onkeydown = (e) => { if (e.key === 'Escape') select.blur() }
  document.body.append(select)
}

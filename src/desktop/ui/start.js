// Startseite der Desktop-App. Spricht nur über die App-Befehle: Tauri-invoke (src-tauri) bzw. fetch an den lokalen
// Server der Go-Hülle (desktop-go/api.go; der Header X-Hashmark-App schützt vor fremden Seiten).

const invoke = (cmd, args) => window.__TAURI__
  ? window.__TAURI__.core.invoke(cmd, args)
  : fetch(`api/${cmd}`, { method: 'POST', headers: { 'X-Hashmark-App': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(args ?? {}) })
      .then(async (r) => { if (!r.ok) throw new Error(await r.text()); return r.json() })
const $ = (id) => document.getElementById(id)

/** Befehl ausführen und währenddessen den Status zeigen (Deck öffnen dauert beim ersten Mal einige Sekunden) */
async function run(label, cmd, args) {
  const status = $('status')
  status.hidden = false
  status.classList.remove('error')
  status.textContent = label
  try {
    await invoke(cmd, args)
    status.hidden = true
  } catch (e) {
    status.classList.add('error')
    status.textContent = String(e)
  }
}

/** Knopf für ein Deck: Name fett, darunter `detail` (Pfad bzw. Titel) */
function deckButton({ dir, name }, detail) {
  const open = document.createElement('button')
  open.className = 'deck'
  open.title = dir
  const n = document.createElement('strong')
  n.textContent = name
  const p = document.createElement('span')
  p.textContent = detail
  open.append(n, p)
  open.onclick = () => run(`Öffne ${name} …`, 'open_deck', { dir })
  return open
}

async function renderExamples(attempt = 0) {
  let items
  try {
    items = await invoke('examples')
  } catch {
    if (attempt < 20) setTimeout(() => renderExamples(attempt + 1), 500)
    return
  }
  $('examples').replaceChildren(...items.map((ex) => {
    const li = document.createElement('li')
    li.append(deckButton(ex, ex.title))
    return li
  }))
}

async function renderRecent(attempt = 0) {
  const list = $('recent')
  let items
  try {
    items = await invoke('recent')
  } catch {
    // Sidecar startet noch – kurz warten und erneut fragen, bis dahin nichts anzeigen
    if (attempt < 20) setTimeout(() => renderRecent(attempt + 1), 500)
    return
  }
  list.replaceChildren()
  $('empty').hidden = items.length > 0
  for (const { dir, name } of items) {
    const li = document.createElement('li')
    const open = deckButton({ dir, name }, dir)
    const forget = document.createElement('button')
    forget.className = 'forget'
    forget.title = 'Aus der Liste entfernen'
    forget.textContent = '✕'
    forget.onclick = async () => { await invoke('forget', { dir }); renderRecent() }
    li.append(open, forget)
    list.append(li)
  }
}

$('open').onclick = () => run('Deck wird geöffnet …', 'open_deck', { dir: null })
$('create').onclick = () => run('Neues Deck …', 'new_deck')

renderRecent()
renderExamples()

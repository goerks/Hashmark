// Startseite der Desktop-App (Tauri). Spricht nur über die App-Befehle (src-tauri/src/main.rs).

const invoke = (cmd, args) => window.__TAURI__.core.invoke(cmd, args)
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
    const open = document.createElement('button')
    open.className = 'deck'
    open.title = dir
    const n = document.createElement('strong')
    n.textContent = name
    const p = document.createElement('span')
    p.textContent = dir
    open.append(n, p)
    open.onclick = () => run(`Öffne ${name} …`, 'open_deck', { dir })
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
$('example').onclick = () => run('Öffne das Beispiel-Deck …', 'open_example')

renderRecent()

// `hashmark share | push | pull | resolve | unshare`: Deck online teilen und abgleichen (siehe src/share/client.ts)

import path from 'node:path'
import * as share from '../share/client.ts'

const LABEL: Record<share.FileState, string> = { up: 'lokal neuer ↑', down: 'online neuer ↓', conflict: 'Konflikt !', gone: 'online fehlt ○' }

const SAYS: Record<share.ShareState, string> = {
  none: 'nicht geteilt',
  sync: 'synchron',
  local: 'lokale Änderungen, noch nicht hochgeladen (hashmark push)',
  remote: 'Online-Änderungen, noch nicht geholt (hashmark pull)',
  conflict: 'Konflikt: Datei wurde lokal und online geändert (hashmark resolve <datei> --keep local|online)',
  asleep: 'Dienst schläft und startet gerade, bitte kurz warten',
  restarted: 'Online-Kopie fehlt (Dienst neu gestartet): hashmark share stellt sie unter demselben Link wieder her',
  unreachable: 'Dienst nicht erreichbar',
}

function print(s: share.ShareStatus) {
  console.log(`[hashmark] Dienst:    ${s.server}`)
  if (!s.shared) return console.log('[hashmark] Nicht geteilt. Mit „hashmark share“ online teilen.')
  console.log(`[hashmark] Zustand:   ${SAYS[s.state]}${s.error && s.state === 'unreachable' ? ` (${s.error})` : ''}`)
  for (const [p, f] of Object.entries(s.files)) console.log(`             ${LABEL[f.state].padEnd(16)} ${p}${f.deleted ? ' (gelöscht)' : ''}`)
  if (s.links) {
    console.log(`[hashmark] Ansehen:    ${s.links.view}`)
    console.log(`[hashmark] Bearbeiten: ${s.links.edit}`)
  }
}

export interface ShareOptions { server?: string; key?: string; keep?: string; status?: boolean }

export async function runShare(action: 'share' | 'push' | 'pull' | 'resolve' | 'unshare', deck: string, opts: ShareOptions, file?: string): Promise<number> {
  const dir = path.resolve(deck)
  try {
    if (opts.server !== undefined || opts.key !== undefined) share.setServer(opts.server, opts.key)
    switch (action) {
      case 'share': {
        if (opts.status) { print(await share.status(dir)); return 0 }
        const before = await share.status(dir)
        if (before.shared && before.state !== 'restarted') { print(before); return 0 }
        console.log('[hashmark] Lade hoch … (der erste Aufruf kann bis zu einer Minute dauern, wenn der Dienst schläft)')
        await share.start(dir)
        print(await share.status(dir))
        return 0
      }
      case 'push': {
        const r = await share.push(dir)
        console.log(`[hashmark] ${r.pushed.length} Datei(en) hochgeladen${r.skipped.length ? `, ${r.skipped.length} übersprungen (Konflikt oder online neuer)` : ''}`)
        print(await share.status(dir))
        return r.skipped.length ? 1 : 0
      }
      case 'pull': {
        const r = await share.pull(dir)
        console.log(`[hashmark] ${r.pulled.length} Datei(en) geholt${r.skipped.length ? `, ${r.skipped.length} übersprungen (Konflikt oder lokal neuer)` : ''}`)
        print(await share.status(dir))
        return r.skipped.length ? 1 : 0
      }
      case 'resolve': {
        if (!file || (opts.keep !== 'local' && opts.keep !== 'online')) { console.error('[hashmark] Aufruf: hashmark resolve <datei> --keep local|online'); return 2 }
        await share.resolve(dir, file.replace(/\\/g, '/'), opts.keep === 'online' ? 'remote' : 'local')
        print(await share.status(dir))
        return 0
      }
      case 'unshare':
        await share.stop(dir)
        console.log('[hashmark] Teilen beendet, die Online-Kopie ist gelöscht.')
        return 0
    }
  } catch (e) {
    console.error(`[hashmark] ${(e as Error).message}`)
    return 1
  }
}

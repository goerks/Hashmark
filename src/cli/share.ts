// `hashmark share | push | pull | resolve | unshare`: Deck online teilen und abgleichen (siehe src/share/client.ts)

import path from 'node:path'
import * as share from '../share/client.ts'
import { WAKING_TEXT } from '../share/reasons.ts'

const LABEL: Record<share.FileState, string> = { up: 'lokal neuer ↑', down: 'online neuer ↓', conflict: 'Konflikt !', gone: 'online fehlt ○' }

const SAYS: Record<share.ShareState, string> = {
  none: 'nicht geteilt',
  sync: 'synchron',
  local: 'lokale Änderungen, noch nicht hochgeladen (hashmark push)',
  remote: 'Online-Änderungen, noch nicht geholt (hashmark pull)',
  conflict: 'Konflikt: Datei wurde lokal und online geändert (hashmark resolve <datei> --keep local|online)',
  asleep: 'Dienst schläft (Render Free) und startet beim nächsten Aufruf, das dauert bis zu einer Minute',
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

/** Zeigt in der Befehlszeile, was gerade geschieht (Verbinden, Dienst wecken, Hochladen), mit vergangener Zeit */
function showProgress(): () => void {
  let last = ''
  let tick: NodeJS.Timeout | undefined
  const line = (a: ReturnType<typeof share.getActivity>) => {
    const secs = Math.round((Date.now() - a.since) / 1000)
    if (a.phase === 'waking') console.log(`[hashmark] ${a.label} (${secs} s)`)
  }
  const off = share.onActivity((a) => {
    if (a.phase === last || a.phase === 'idle') { last = a.phase; return }
    last = a.phase
    clearInterval(tick)
    if (a.phase === 'connecting' || a.phase === 'working') console.log(`[hashmark] ${a.label}`)
    if (a.phase === 'waking') {
      line(a)
      console.log(`[hashmark] ${WAKING_TEXT}`)
      // alle 10 Sekunden ein Lebenszeichen, damit man sieht, dass es weitergeht
      tick = setInterval(() => line(share.getActivity()), 10_000)
    }
  })
  return () => { off(); clearInterval(tick) }
}

export interface ShareOptions { server?: string; key?: string; keep?: string; status?: boolean }

export async function runShare(action: 'share' | 'push' | 'pull' | 'resolve' | 'unshare', deck: string, opts: ShareOptions, file?: string): Promise<number> {
  const dir = path.resolve(deck)
  const stopProgress = showProgress()
  try {
    if (opts.server !== undefined || opts.key !== undefined) share.setServer(opts.server, opts.key)
    switch (action) {
      case 'share': {
        if (opts.status) { print(await share.status(dir)); return 0 }
        let before = await share.status(dir)
        // der Dienst schläft: wecken und warten (zeigt den Fortschritt), dann den echten Zustand lesen
        if (before.shared && before.state === 'asleep') { await share.ensureAwake(before.server); before = await share.status(dir) }
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
  } finally {
    stopProgress()
  }
}

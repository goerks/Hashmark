// Warum geht es gerade nicht? Verständliche Gründe für Verbindungsprobleme mit dem Webdienst (Editor und Befehlszeile).
// Wichtigster Fall auf Render Free: Der Dienst schläft und startet erst beim ersten Aufruf. Das ist kein Fehler.

export type Reason = 'dns' | 'refused' | 'tls' | 'wrong' | 'timeout' | 'unsupported' | 'denied' | 'server'

/** Was gerade passiert (für Anzeige im Editor und in der Befehlszeile) */
export interface Activity {
  phase: 'idle' | 'connecting' | 'waking' | 'working' | 'failed'
  /** seit wann (ms), für die Anzeige der vergangenen Sekunden */
  since: number
  /** kurze Zeile: was gerade geschieht */
  label: string
  /** Fehlergrund, nur bei `failed` */
  reason?: Reason
  /** vollständige Erklärung, nur bei `failed` */
  message?: string
}

export const IDLE: Activity = { phase: 'idle', since: 0, label: '' }

/** Erklärung zum schlafenden Dienst, wird neben dem Zähler gezeigt */
export const WAKING_TEXT =
  'Der kostenlose Render-Tarif beendet den Dienst nach 15 Minuten ohne Zugriff und startet ihn erst beim nächsten Aufruf neu. Das dauert meist 30 bis 60 Sekunden. Deine lokale Arbeit ist davon nicht betroffen.'

export const WAKING_SLOW_TEXT = 'Das dauert länger als üblich. Hashmark versucht es weiter, bis der Dienst antwortet oder die Zeit (etwa 100 Sekunden) abgelaufen ist.'

const TITLE: Record<Reason, string> = {
  dns: 'Adresse nicht gefunden',
  refused: 'Verbindung abgelehnt',
  tls: 'Zertifikat nicht vertrauenswürdig',
  wrong: 'Kein Hashmark-Dienst',
  timeout: 'Dienst startet nicht',
  unsupported: 'Teilen ist am Dienst ausgeschaltet',
  denied: 'Zugang abgelehnt',
  server: 'Fehler im Dienst',
}

/** Titel und Hinweis in einem Satz, `detail` ist je nach Grund die Wartezeit oder der Text des Dienstes */
export function explain(reason: Reason, host: string, detail = ''): string {
  const hint: Record<Reason, string> = {
    dns: `„${host}“ lässt sich nicht auflösen. Adresse des Dienstes und Internetverbindung prüfen.`,
    refused: `Unter „${host}“ nimmt niemand Verbindungen an. Läuft der Dienst, stimmen Adresse und Port?`,
    tls: `Die verschlüsselte Verbindung zu „${host}“ ist gescheitert (oft ein Firmen-Proxy oder eine falsche Adresse).`,
    wrong: `Unter „${host}“ antwortet etwas anderes als der Hashmark-Webdienst. Adresse prüfen.`,
    timeout: `„${host}“ hat ${detail || 'in der erlaubten Zeit'} nicht geantwortet. Render konnte den Dienst vermutlich nicht starten oder er ist abgestürzt: im Render-Dashboard Ereignisse und Logs prüfen.`,
    unsupported: `Der Dienst „${host}“ läuft, nimmt aber keine Präsentationen an. Der Betreiber muss SESSIONS=1 und SHARE_KEY setzen.`,
    denied: 'Der Dienst-Schlüssel oder das Token passt nicht. Schlüssel beim Betreiber erfragen.',
    server: detail || 'Der Dienst meldet einen Fehler.',
  }
  return `${TITLE[reason]}. ${hint[reason]}`
}

export const titleOf = (reason: Reason): string => TITLE[reason]

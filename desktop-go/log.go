package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime/debug"
	"sync"
	"time"
)

// Diagnose: Die EXE ist eine GUI-Anwendung ohne Konsole, ein Absturz bliebe sonst spurlos.
// hashmark.log im Datenordner sammelt Panics, Beenden von Fenster-Prozessen (mit Exit-Code), Sidecar-Ende
// und JS-Fehler der Fenster. Die Datei wird angehängt und ab 512 KB nach hashmark.log.1 verschoben.

var logMu sync.Mutex

const logLimit = 512 << 10

// logLine hängt eine Zeile mit Zeit und Prozess-Kennung an hashmark.log (Fehler dabei werden ignoriert)
func logLine(format string, args ...any) {
	logMu.Lock()
	defer logMu.Unlock()
	dir := dataDir()
	_ = os.MkdirAll(dir, 0o755)
	file := filepath.Join(dir, "hashmark.log")
	if st, err := os.Stat(file); err == nil && st.Size() > logLimit {
		_ = os.Rename(file, file+".1")
	}
	f, err := os.OpenFile(file, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "%s [%d] %s\n", time.Now().Format("2006-01-02 15:04:05.000"), os.Getpid(), fmt.Sprintf(format, args...))
}

// recoverLog fängt eine Panik ab, schreibt sie samt Stack ins Log und beendet den Prozess wie sonst auch (Exit-Code 2)
func recoverLog(where string) {
	if r := recover(); r != nil {
		logLine("PANIK in %s: %v\n%s", where, r, debug.Stack())
		os.Exit(2)
	}
}

// safeGo startet eine Goroutine, deren Panik im Log landet
func safeGo(where string, f func()) {
	go func() {
		defer recoverLog(where)
		f()
	}()
}

// errorsJS meldet JS-Fehler eines Fensters ans Log (`hmLog` ist gebunden). Läuft in jeder Seite, auch in Kindfenstern.
const errorsJS = `(() => {
  if (window.top !== window || !window.hmLog) return
  const send = (kind, msg) => { try { window.hmLog(kind + ' ' + location.pathname + location.search + location.hash + ': ' + msg) } catch {} }
  addEventListener('error', (e) => send('JS-Fehler', (e.message || '') + ' @ ' + (e.filename || '') + ':' + (e.lineno || 0)))
  addEventListener('unhandledrejection', (e) => send('Promise-Fehler', String((e.reason && (e.reason.stack || e.reason.message)) || e.reason)))
})()`

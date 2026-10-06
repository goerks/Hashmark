package main

// Abstürze nachvollziehbar machen. Die EXE ist eine GUI-Anwendung ohne Konsole: was Go bei einem Absturz nach stderr
// schreibt (Panik in einer Goroutine ohne recover, fatale Laufzeitfehler, Ausnahmen in nativem Code), ginge sonst verloren.
//
//   - initCrashLog: der Absturz-Stack wird zusätzlich in crash.log geschrieben (alle Prozesse der EXE hängen an dieselbe Datei an).
//   - takeCrashReport: beim nächsten Start (bzw. wenn ein Kindfenster mit Fehler endet) wird die Datei gelesen, die erste
//     Fehlerzeile als Meldung gezeigt und die Datei als crash-<Zeit>.log aufgehoben.
//   - callGuard: Bindungen, die die Seiten aufrufen, fangen Panics ab und melden sie der Seite als Fehlertext, statt den Prozess zu beenden.
//
// Anlass: go-webview (v0.0.0-20250327) stürzt bei gebundenen Funktionen mit Fehler-Rückgabe immer ab, auch bei `nil`
// („interface conversion: interface is nil, not error“ in einer eigenen Goroutine). Gebunden werden deshalb nur Funktionen
// ohne `error`; Fehler gehen als JSON `{"error": "…"}` an die Seite.

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime/debug"
	"sort"
	"strings"
	"time"
)

func crashFile() string { return filepath.Join(dataDir(), "crash.log") }

// initCrashLog leitet Absturz-Stacks in crash.log um (angehängt). Fehler dabei sind nicht kritisch.
func initCrashLog() {
	_ = os.MkdirAll(dataDir(), 0o755)
	f, err := os.OpenFile(crashFile(), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		logLine("crash.log nicht beschreibbar: %v", err)
		return
	}
	debug.SetTraceback("all") // alle Goroutinen, nicht nur die abstürzende
	if err := debug.SetCrashOutput(f, debug.CrashOptions{}); err != nil {
		logLine("crash.log nicht aktiv: %v", err)
	}
}

// firstErrorLine sucht die Zeile, die den Absturz benennt (panic:, fatal error:, Exception …), sonst die erste nicht leere
func firstErrorLine(text string) string {
	first := ""
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if first == "" {
			first = line
		}
		for _, p := range []string{"panic:", "fatal error:", "Exception ", "unexpected fault", "runtime:"} {
			if strings.HasPrefix(line, p) {
				return line
			}
		}
	}
	return first
}

// takeCrashReport: gab es seit dem letzten Abholen einen Absturz? Dann die erste Fehlerzeile, die Zeit und der Pfad der
// aufgehobenen Datei (crash-<Zeit>.log). Die Datei wird dabei verschoben, eine Meldung erscheint also nur einmal.
func takeCrashReport() (summary string, when time.Time, kept string) {
	file := crashFile()
	st, err := os.Stat(file)
	if err != nil || st.Size() == 0 {
		return "", time.Time{}, ""
	}
	b, err := os.ReadFile(file)
	if err != nil {
		return "", time.Time{}, ""
	}
	summary = firstErrorLine(string(b))
	when = st.ModTime()
	kept = filepath.Join(dataDir(), "crash-"+when.Format("20060102-150405")+".log")
	if err := os.Rename(file, kept); err != nil {
		kept = file // lässt sich nicht verschieben: so lassen, die Meldung kann dann wiederkehren
	}
	logLine("Absturz erkannt (%s): %s – Stack in %s", when.Format("2006-01-02 15:04:05"), summary, kept)
	pruneCrashLogs(5)
	return summary, when, kept
}

// pruneCrashLogs behält die neuesten n aufgehobenen Absturzprotokolle
func pruneCrashLogs(n int) {
	files, _ := filepath.Glob(filepath.Join(dataDir(), "crash-*.log"))
	sort.Strings(files) // der Name enthält die Zeit: älteste zuerst
	for len(files) > n {
		_ = os.Remove(files[0])
		files = files[1:]
	}
}

// crashMessage: Text für den Dialog „Hashmark ist abgestürzt“
func crashMessage(summary string, when time.Time, kept string) string {
	return fmt.Sprintf("Hashmark ist unerwartet beendet worden (%s).\n\nFehler:\n%s\n\nDer vollständige Stack steht in:\n%s\n\nBitte diese Datei mitschicken, wenn du den Fehler meldest.",
		when.Format("02.01.2006 15:04:05"), summary, kept)
}

// errorJSON: Fehlertext für die Seite (Bindungen geben nur Strings zurück, siehe oben)
func errorJSON(msg string) string {
	b, _ := json.Marshal(map[string]string{"error": msg})
	return string(b)
}

// callGuard führt die Funktion einer Bindung aus: Fehler und Panics landen mit Stack in hashmark.log, die Seite bekommt
// `{"error": "…"}` und der Prozess läuft weiter. Ohne Fehler kommt das Ergebnis unverändert zurück.
func callGuard(name string, f func() (string, error)) (out string) {
	start := time.Now()
	defer func() {
		if r := recover(); r != nil {
			logLine("PANIK in Bindung %s: %v\n%s", name, r, debug.Stack())
			out = errorJSON(fmt.Sprintf("Interner Fehler in %s: %v (Stack in hashmark.log)", name, r))
		}
	}()
	res, err := f()
	if err != nil {
		logLine("Fehler in Bindung %s nach %s: %v", name, time.Since(start).Round(time.Millisecond), err)
		return errorJSON(err.Error())
	}
	return res
}

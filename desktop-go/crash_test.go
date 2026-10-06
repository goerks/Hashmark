package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFirstErrorLine(t *testing.T) {
	trace := "\n\ngoroutine 5 [running]:\nmain.x()\n\npanic: interface conversion: interface is nil, not error\n\ngoroutine 39 [running]:\n"
	if got := firstErrorLine("goroutine 1 [running]:\n" + trace); got != "panic: interface conversion: interface is nil, not error" {
		t.Fatalf("Fehlerzeile: %q", got)
	}
	if got := firstErrorLine("fatal error: all goroutines are asleep"); !strings.HasPrefix(got, "fatal error:") {
		t.Fatalf("fatal error: %q", got)
	}
	if got := firstErrorLine("\n  \nirgendetwas\nzweite"); got != "irgendetwas" {
		t.Fatalf("erste nicht leere Zeile: %q", got)
	}
}

func TestCallGuard(t *testing.T) {
	t.Setenv("APPDATA", t.TempDir())
	t.Setenv("XDG_CONFIG_HOME", t.TempDir())
	t.Setenv("HOME", t.TempDir())

	if got := callGuard("ok", func() (string, error) { return `{"a":1}`, nil }); got != `{"a":1}` {
		t.Fatalf("Ergebnis unverändert: %q", got)
	}
	var m map[string]string
	if err := json.Unmarshal([]byte(callGuard("fehler", func() (string, error) { return "", errors.New("kaputt") })), &m); err != nil || m["error"] != "kaputt" {
		t.Fatalf("Fehler als JSON: %v %v", m, err)
	}
	var p map[string]string
	out := callGuard("panik", func() (string, error) {
		var e error
		_ = e.(interface{ Foo() }) // Panik wie in go-webview: Typzusicherung auf nil
		return "", nil
	})
	if err := json.Unmarshal([]byte(out), &p); err != nil || !strings.Contains(p["error"], "Interner Fehler in panik") {
		t.Fatalf("Panik als Fehlertext: %q", out)
	}
}

func TestTakeCrashReportMovesFileOnce(t *testing.T) {
	appdata := t.TempDir()
	t.Setenv("APPDATA", appdata)
	t.Setenv("XDG_CONFIG_HOME", appdata)
	t.Setenv("HOME", appdata)
	if err := os.MkdirAll(dataDir(), 0o755); err != nil {
		t.Fatal(err)
	}
	if s, _, _ := takeCrashReport(); s != "" {
		t.Fatalf("ohne Datei keine Meldung, war %q", s)
	}
	if err := os.WriteFile(crashFile(), []byte("panic: etwas ist schiefgegangen\n\ngoroutine 1 [running]:\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	summary, _, kept := takeCrashReport()
	if summary != "panic: etwas ist schiefgegangen" || !strings.HasPrefix(filepath.Base(kept), "crash-") {
		t.Fatalf("Meldung: %q, aufgehoben als %q", summary, kept)
	}
	if _, err := os.Stat(crashFile()); err == nil {
		t.Fatal("crash.log muss verschoben sein")
	}
	if s, _, _ := takeCrashReport(); s != "" {
		t.Fatalf("die Meldung erscheint nur einmal, war %q", s)
	}
}

package main

import (
	"os"
	"path/filepath"
	"testing"
)

var one = []monitor{{X: 0, Y: 0, W: 1920, H: 1080, Index: 0, Primary: true}}
var two = []monitor{
	{X: 0, Y: 0, W: 1920, H: 1080, Index: 0, Primary: true},
	{X: 1920, Y: 0, W: 2560, H: 1440, Index: 1},
}
var three = []monitor{
	{X: -1920, Y: 0, W: 1920, H: 1080, Index: 0},
	{X: 0, Y: 0, W: 1920, H: 1080, Index: 1, Primary: true},
	{X: 1920, Y: 0, W: 1280, H: 720, Index: 2},
}

func TestUsePresenter(t *testing.T) {
	cases := []struct {
		mode string
		all  []monitor
		want bool
	}{
		{"auto", one, false}, {"auto", two, true}, {"on", one, true}, {"off", two, false}, {"quatsch", two, true},
	}
	for _, c := range cases {
		if got := (presentSettings{Presenter: c.mode}).usePresenter(c.all); got != c.want {
			t.Errorf("%s mit %d Bildschirmen: %v, erwartet %v", c.mode, len(c.all), got, c.want)
		}
	}
}

func TestPickScreens(t *testing.T) {
	auto := defaultPresentSettings()
	if p, r := pickScreens(two, auto); p.Index != 1 || r.Index != 0 {
		t.Errorf("automatisch mit zwei Bildschirmen: Präsentation %d, Presenter %d", p.Index, r.Index)
	}
	if p, r := pickScreens(one, auto); p.Index != 0 || r.Index != 0 {
		t.Errorf("ein Bildschirm: %d/%d", p.Index, r.Index)
	}
	// Hauptbildschirm ist nicht der erste in der Liste: Presenter dorthin, Präsentation auf den ersten Zusatzbildschirm
	if p, r := pickScreens(three, auto); p.Index != 0 || r.Index != 1 {
		t.Errorf("drei Bildschirme: %d/%d", p.Index, r.Index)
	}
	// Präsentation ausdrücklich auf dem Hauptbildschirm: der Presenter weicht aus
	if p, r := pickScreens(two, presentSettings{Presenter: "auto", Presentation: 0, PresenterScreen: -1}); p.Index != 0 || r.Index != 1 {
		t.Errorf("Präsentation auf dem Hauptbildschirm: %d/%d", p.Index, r.Index)
	}
	// beides ausdrücklich
	if p, r := pickScreens(three, presentSettings{Presenter: "on", Presentation: 2, PresenterScreen: 0}); p.Index != 2 || r.Index != 0 {
		t.Errorf("ausdrückliche Wahl: %d/%d", p.Index, r.Index)
	}
	if p, r := pickScreens(nil, auto); p.W != 0 || r.W != 0 {
		t.Errorf("ohne Bildschirme muss leer bleiben")
	}
}

func TestNormalizedAndFile(t *testing.T) {
	s := presentSettings{Presenter: "quatsch", Presentation: 5, PresenterScreen: -3}.normalized(two)
	if s != defaultPresentSettings() {
		t.Errorf("Unbrauchbares wird nicht zur Vorgabe: %+v", s)
	}
	if got := (presentSettings{Presenter: "on", Presentation: 1, PresenterScreen: 0}).normalized(two); got.Presentation != 1 || got.PresenterScreen != 0 || got.Presenter != "on" {
		t.Errorf("Gültiges wurde verändert: %+v", got)
	}
	dir := t.TempDir()
	if loadPresentSettings(dir) != defaultPresentSettings() {
		t.Errorf("ohne Datei gilt die Vorgabe")
	}
	want := presentSettings{Presenter: "off", Presentation: 1, PresenterScreen: 0}
	if err := savePresentSettings(dir, want); err != nil {
		t.Fatal(err)
	}
	if got := loadPresentSettings(dir); got != want {
		t.Errorf("Roundtrip: %+v", got)
	}
	_ = os.WriteFile(filepath.Join(dir, "present.json"), []byte("kaputt"), 0o644)
	if loadPresentSettings(dir) != defaultPresentSettings() {
		t.Errorf("kaputte Datei: Vorgabe erwartet")
	}
}

func TestSummary(t *testing.T) {
	got := defaultPresentSettings().summary(two)
	want := "Presenter-View: automatisch · Präsentation: Bildschirm 2 · Presenter: Bildschirm 1"
	if got != want {
		t.Errorf("%q", got)
	}
	if got := (presentSettings{Presenter: "off", Presentation: -1, PresenterScreen: -1}).summary(two); got != "Presenter-View: aus · Präsentation: Bildschirm 2" {
		t.Errorf("%q", got)
	}
}

package main

// Einstellungen fürs Präsentieren: Presenter-View ja, nein oder automatisch, dazu der Bildschirm der
// Präsentation und der des Presenters. Als JSON im Datenordner; die Editor-Seite fragt und setzt sie über
// die Bindungen hmPresentOptions / hmSetPresentOptions (siehe app.go).

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type presentSettings struct {
	// Presenter: "auto" (nur mit zweitem Bildschirm), "on" oder "off"
	Presenter string `json:"presenter"`
	// Bildschirme als Position in der Liste des Systems (monitor.Index), -1 = automatisch
	Presentation    int `json:"presentation"`
	PresenterScreen int `json:"presenterScreen"`
}

func defaultPresentSettings() presentSettings {
	return presentSettings{Presenter: "auto", Presentation: -1, PresenterScreen: -1}
}

// normalized ersetzt Unbrauchbares durch die Vorgabe (kaputte Datei, Bildschirm nicht mehr angeschlossen)
func (s presentSettings) normalized(all []monitor) presentSettings {
	if s.Presenter != "on" && s.Presenter != "off" {
		s.Presenter = "auto"
	}
	if s.Presentation < 0 || s.Presentation >= len(all) {
		s.Presentation = -1
	}
	if s.PresenterScreen < 0 || s.PresenterScreen >= len(all) {
		s.PresenterScreen = -1
	}
	return s
}

func presentFile(dir string) string { return filepath.Join(dir, "present.json") }

func loadPresentSettings(dir string) presentSettings {
	s := defaultPresentSettings()
	if b, err := os.ReadFile(presentFile(dir)); err == nil {
		if json.Unmarshal(b, &s) != nil {
			return defaultPresentSettings() // kaputte Datei: Vorgaben
		}
	}
	return s
}

func savePresentSettings(dir string, s presentSettings) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	b, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(presentFile(dir), b, 0o644)
}

// usePresenter: öffnet „Präsentieren“ die Presenter-View mit? Automatisch nur, wenn ein zweiter Bildschirm da ist.
func (s presentSettings) usePresenter(all []monitor) bool {
	switch s.Presenter {
	case "on":
		return true
	case "off":
		return false
	}
	for _, m := range all {
		if !m.Primary {
			return true
		}
	}
	return false
}

// pickScreens wählt die Bildschirme. Vorgabe: Präsentation auf dem ersten Zusatzbildschirm (sonst dem Hauptbildschirm),
// Presenter auf dem Hauptbildschirm, bei Kollision auf einem anderen als die Präsentation.
func pickScreens(all []monitor, s presentSettings) (presentation, presenter monitor) {
	if len(all) == 0 {
		return monitor{}, monitor{}
	}
	primary := all[0]
	for _, m := range all {
		if m.Primary {
			primary = m
			break
		}
	}
	external := primary
	for _, m := range all {
		if !m.Primary {
			external = m
			break
		}
	}
	valid := func(i int) bool { return i >= 0 && i < len(all) }
	presentation = external
	if valid(s.Presentation) {
		presentation = all[s.Presentation]
	}
	presenter = primary
	if valid(s.PresenterScreen) {
		presenter = all[s.PresenterScreen]
	} else if presenter.Index == presentation.Index {
		for _, m := range all {
			if m.Index != presentation.Index {
				presenter = m
				break
			}
		}
	}
	return presentation, presenter
}

// summary: eine Zeile für das Menü „Präsentieren“
func (s presentSettings) summary(all []monitor) string {
	presentation, presenter := pickScreens(all, s)
	mode := map[string]string{"auto": "automatisch", "on": "ein", "off": "aus"}[s.Presenter]
	line := fmt.Sprintf("Presenter-View: %s · Präsentation: Bildschirm %d", mode, presentation.Index+1)
	if s.usePresenter(all) {
		line += fmt.Sprintf(" · Presenter: Bildschirm %d", presenter.Index+1)
	}
	return line
}

// optionsJSON: Stand und Bildschirme für die Editor-Seite
func (s presentSettings) optionsJSON(all []monitor) (string, error) {
	type screen struct {
		Index   int  `json:"index"`
		X       int  `json:"x"`
		Y       int  `json:"y"`
		W       int  `json:"w"`
		H       int  `json:"h"`
		Primary bool `json:"primary"`
	}
	screens := make([]screen, 0, len(all))
	for _, m := range all {
		screens = append(screens, screen{m.Index, m.X, m.Y, m.W, m.H, m.Primary})
	}
	presentation, presenter := pickScreens(all, s)
	b, err := json.Marshal(map[string]any{
		"presenter":       s.Presenter,
		"presentation":    s.Presentation,
		"presenterScreen": s.PresenterScreen,
		"monitors":        screens,
		// wirksame Wahl, wenn „automatisch“ eingestellt ist
		"effective": map[string]any{"presenter": s.usePresenter(all), "presentation": presentation.Index, "presenterScreen": presenter.Index},
	})
	return string(b), err
}

package main

// Anwendungslogik des Hauptprozesses: Decks öffnen, Fenster, Export, Menü.
// Entspricht src-tauri/src/main.rs; die eigentliche Arbeit macht der Node-Sidecar.

import (
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"

	"github.com/abemedia/go-webview"
	"github.com/ncruces/zenity"
)

type deck struct{ url, dir, name string }

type app struct {
	sc       *sidecar
	root     string
	data     string
	self     string
	startURL string
	v        webview.WebView
	hwnd     uintptr

	mu       sync.Mutex
	deck     *deck
	recent   []string
	children map[string]*exec.Cmd // "presentation", "presenter"
}

const (
	titlePresenter    = "Hashmark – Presenter"
	titlePresentation = "Hashmark – Präsentation"
)

func headless() bool { return os.Getenv("HASHMARK_HEADLESS") == "1" }

// ui führt f im UI-Thread aus
func (a *app) ui(f func()) { a.v.Dispatch(f) }

func (a *app) navigate(url string) { a.ui(func() { a.v.Navigate(url) }) }
func (a *app) setTitle(t string)   { a.ui(func() { a.v.SetTitle(t) }) }

func (a *app) call(cmd string, args map[string]any) (any, error) { return a.sc.call(cmd, args) }

func (a *app) currentDeck() *deck {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.deck
}

func (a *app) showError(title string, err error) {
	_ = zenity.Error(err.Error(), zenity.Title(title), zenity.ErrorIcon)
}

// report zeigt Fehler als Dialog
func (a *app) report(title string, err error) {
	if err != nil {
		a.showError(title, err)
	}
}

func str(m any, key string) string {
	if mm, ok := m.(map[string]any); ok {
		s, _ := mm[key].(string)
		return s
	}
	return ""
}

// ---------- Decks ----------

func (a *app) pickFolder(title string) (string, error) {
	dir, err := zenity.SelectFile(zenity.Directory(), zenity.Title(title))
	if errors.Is(err, zenity.ErrCanceled) {
		return "", nil
	}
	return dir, err
}

func (a *app) openDeckAt(dir string) error {
	if dir == "" {
		var err error
		if dir, err = a.pickFolder("Deck öffnen"); err != nil || dir == "" {
			return err
		}
	}
	is, err := a.call("isDeck", map[string]any{"dir": dir})
	if err != nil {
		return err
	}
	if b, _ := is.(bool); !b {
		err := zenity.Question(fmt.Sprintf("In diesem Ordner liegt kein Deck:\n%s\n\nEin Deck braucht eine deck.yaml oder mindestens eine .md-Datei.", dir),
			zenity.Title("Kein Deck"), zenity.OKLabel("Neues Deck anlegen"), zenity.CancelLabel("Abbrechen"))
		if err != nil {
			return nil
		}
		if _, err := a.call("scaffold", map[string]any{"dir": dir}); err != nil {
			return err
		}
	}
	a.closePresentation()
	res, err := a.call("open", map[string]any{"dir": dir})
	if err != nil {
		return err
	}
	d := &deck{url: str(res, "url"), dir: str(res, "dir"), name: str(res, "name")}
	if d.dir == "" {
		d.dir = dir
	}
	if d.name == "" {
		d.name = "Deck"
	}
	a.mu.Lock()
	a.deck = d
	a.mu.Unlock()
	a.navigate(d.url + "editor.html")
	a.setTitle("Hashmark – " + d.name)
	a.refreshMenu()
	return nil
}

func (a *app) createDeck() error {
	dir, err := a.pickFolder("Neues Deck – leeren Ordner wählen oder anlegen")
	if err != nil || dir == "" {
		return err
	}
	if _, err := a.call("scaffold", map[string]any{"dir": dir}); err != nil {
		return fmt.Errorf("%w\nBitte einen leeren Ordner wählen.", err)
	}
	return a.openDeckAt(dir)
}

func (a *app) closeDeck() {
	a.closePresentation()
	_, _ = a.call("close", nil)
	a.mu.Lock()
	a.deck = nil
	a.mu.Unlock()
	a.navigate(a.startURL)
	a.setTitle("Hashmark")
	a.refreshMenu()
}

// ---------- Präsentieren ----------

// spawn startet ein Fenster als eigener Prozess dieser EXE (die Webview kennt nur ein Fenster je Prozess)
func (a *app) spawn(label, url, title, mode string) error {
	cmd := exec.Command(a.self, "--window", url, "--title", title, "--mode", mode)
	if err := cmd.Start(); err != nil {
		return err
	}
	a.mu.Lock()
	a.children[label] = cmd
	a.mu.Unlock()
	go func() {
		_ = cmd.Wait()
		a.mu.Lock()
		if a.children[label] == cmd {
			delete(a.children, label)
		}
		a.mu.Unlock()
		// Präsentation zu → Presenter-View ebenfalls
		if label == "presentation" {
			a.kill("presenter")
		}
	}()
	return nil
}

func (a *app) kill(label string) {
	a.mu.Lock()
	cmd := a.children[label]
	delete(a.children, label)
	a.mu.Unlock()
	if cmd != nil && cmd.Process != nil {
		_ = cmd.Process.Kill()
	}
}

func (a *app) closePresentation() {
	a.kill("presentation")
	a.kill("presenter")
}

func hasExternal() bool {
	for _, m := range monitors() {
		if !m.Primary {
			return true
		}
	}
	return false
}

// present: Präsentation im Vollbild – mit zweitem Bildschirm dort, und die Presenter-View auf dem Hauptbildschirm
func (a *app) present(hash *string) error {
	d := a.currentDeck()
	if d == nil {
		return nil
	}
	h := ""
	if hash != nil {
		h = *hash
	} else {
		p, err := a.call("position", nil)
		if err != nil {
			return err
		}
		h, _ = p.(string)
	}
	a.closePresentation()
	if err := a.spawn("presentation", d.url+h, titlePresentation, "presentation"); err != nil {
		return err
	}
	if hasExternal() {
		return a.openPresenter(h)
	}
	return nil
}

// openPresenter: Presenter-View (Taste S bzw. automatisch mit zweitem Bildschirm) auf dem Hauptbildschirm
func (a *app) openPresenter(hash string) error {
	d := a.currentDeck()
	if d == nil {
		return nil
	}
	a.mu.Lock()
	_, running := a.children["presenter"]
	a.mu.Unlock()
	if running {
		focusWindow(titlePresenter)
		return nil
	}
	return a.spawn("presenter", d.url+"?presenter"+hash, titlePresenter, "presenter")
}

// ---------- Export ----------

func (a *app) savePath(title, name, filterName, pattern string) (string, error) {
	opts := []zenity.Option{zenity.Title(title), zenity.ConfirmOverwrite(), zenity.FileFilters{{Name: filterName, Patterns: []string{pattern}, CaseFold: true}}}
	if docs := documentsDir(); docs != "" {
		name = filepath.Join(docs, name)
	}
	opts = append(opts, zenity.Filename(name))
	out, err := zenity.SelectFileSave(opts...)
	if errors.Is(err, zenity.ErrCanceled) {
		return "", nil
	}
	return out, err
}

func (a *app) exportPDF(query, suffix string) error {
	d := a.currentDeck()
	if d == nil {
		return nil
	}
	out, err := a.savePath("PDF speichern", d.name+suffix+".pdf", "PDF", "*.pdf")
	if err != nil || out == "" {
		return err
	}
	var res any
	if err := a.withBusy("PDF wird erstellt", func() (e error) {
		res, e = a.call("pdf", map[string]any{"query": query, "out": out})
		return
	}); err != nil {
		return err
	}
	pages := 0
	if m, ok := res.(map[string]any); ok {
		if p, ok := m["pages"].(float64); ok {
			pages = int(p)
		}
	}
	a.done(fmt.Sprintf("PDF erstellt: %d Seiten", pages), out)
	return nil
}

func (a *app) exportHTML() error {
	d := a.currentDeck()
	if d == nil {
		return nil
	}
	out, err := a.savePath("Als eine HTML-Datei exportieren", d.name+".html", "HTML", "*.html")
	if err != nil || out == "" {
		return err
	}
	if err := a.withBusy("HTML-Export", func() error { _, e := a.call("html", map[string]any{"out": out}); return e }); err != nil {
		return err
	}
	a.done("HTML-Datei erstellt – läuft offline per Doppelklick, auch mit Presenter-View (S).", out)
	return nil
}

// withBusy ergänzt während langer Aufgaben den Fenstertitel
func (a *app) withBusy(label string, task func() error) error {
	title := "Hashmark"
	if d := a.currentDeck(); d != nil {
		title += " – " + d.name
	}
	a.setTitle(title + " – " + label + " …")
	defer a.setTitle(title)
	return task()
}

func (a *app) done(message, file string) {
	err := zenity.Question(message+"\n\n"+file, zenity.Title("Hashmark"), zenity.OKLabel("Öffnen"), zenity.CancelLabel("OK"), zenity.InfoIcon)
	if err == nil {
		_ = openPath(file)
	}
}

// ---------- Aktionen aus den Seiten ----------

func (a *app) onAction(msg map[string]any) {
	var err error
	switch str(msg, "action") {
	case "present":
		h := str(msg, "hash")
		err = a.present(&h)
	case "presenter":
		err = a.openPresenter(str(msg, "hash"))
	case "pdf":
		q := str(msg, "query")
		suffix := ""
		if strings.Contains(q, "notes=1") {
			suffix = "-handout"
		}
		err = a.exportPDF(q, suffix)
	case "close":
		a.closePresentation()
	}
	a.report("Hashmark", err)
}

// ---------- Menü ----------

type menuItem struct {
	ID      string
	Label   string
	Accel   string
	Enabled bool
	Sep     bool
	Sub     []menuItem
}

func (a *app) menu() []menuItem {
	has := a.currentDeck() != nil
	a.mu.Lock()
	recent := append([]string(nil), a.recent...)
	a.mu.Unlock()
	it := func(id, label, accel string, enabled bool) menuItem { return menuItem{ID: id, Label: label, Accel: accel, Enabled: enabled} }
	sep := menuItem{Sep: true}

	rec := []menuItem{}
	if len(recent) == 0 {
		rec = append(rec, it("recent-none", "(leer)", "", false))
	}
	for i, dir := range recent {
		rec = append(rec, it(fmt.Sprintf("recent:%d", i), filepath.Base(dir)+"   "+dir, "", true))
	}
	return []menuItem{
		{Label: "Datei", Sub: []menuItem{
			it("open", "Deck öffnen …", "Strg+O", true),
			it("new", "Neues Deck …", "Strg+N", true),
			{Label: "Zuletzt geöffnet", Sub: rec},
			it("example", "Beispiel-Deck öffnen", "", true),
			sep,
			it("export-html", "Als HTML-Datei exportieren …", "Strg+Umschalt+E", has),
			it("pdf-all", "PDF – alle Folien …", "Strg+Umschalt+P", has),
			it("pdf-main", "PDF – nur Hauptpfad …", "", has),
			it("pdf-steps", "PDF – jeder Schritt eine Seite …", "", has),
			it("pdf-handout", "Handout mit Notizen (A4) …", "", has),
			sep,
			it("reveal", "Deck-Ordner im Explorer zeigen", "", has),
			it("close-deck", "Deck schließen", "", has),
			sep,
			it("quit", "Beenden", "Alt+F4", true),
		}},
		{Label: "Ansicht", Sub: []menuItem{
			it("view-editor", "Editor", "Strg+1", has),
			it("view-present", "Präsentation im Fenster", "Strg+2", has),
			sep,
			it("reload", "Neu laden", "Strg+R", true),
			it("fullscreen", "Vollbild", "F11", true),
			it("devtools-hint", "Entwicklertools: F12", "", false),
		}},
		{Label: "Präsentieren", Sub: []menuItem{
			it("present", "Ab aktueller Folie", "F5", has),
			it("present-start", "Von vorne", "Umschalt+F5", has),
			it("present-stop", "Präsentation beenden", "", has),
			sep,
			it("hint1", "Mit Beamer: Folien im Vollbild dort, Presenter-View hier", "", false),
			it("hint2", "In der Präsentation: S Presenter · N Notizen · Ctrl+K Suche · Ctrl+W beenden", "", false),
		}},
		{Label: "Hilfe", Sub: []menuItem{
			it("readme", "Anleitung (README)", "", true),
			it("data-dir", "Datenordner öffnen (Einstellungen, Logs)", "", true),
			sep,
			it("about", "Hashmark 0.1.0 · Go "+goVersion, "", false),
		}},
	}
}

// refreshMenu holt „Zuletzt geöffnet“ vom Sidecar und setzt das Menü neu (nicht im UI-Thread aufrufen)
func (a *app) refreshMenu() {
	if v, err := a.call("recent", nil); err == nil {
		var dirs []string
		if arr, ok := v.([]any); ok {
			for _, r := range arr {
				if d := str(r, "dir"); d != "" {
					dirs = append(dirs, d)
				}
			}
		}
		a.mu.Lock()
		a.recent = dirs
		a.mu.Unlock()
	}
	items := a.menu()
	a.ui(func() { setMenu(a.hwnd, items, func(id string) { go a.onMenu(id) }) })
}

func (a *app) onMenu(id string) {
	var err error
	switch {
	case id == "open":
		err = a.openDeckAt("")
	case id == "new":
		err = a.createDeck()
	case id == "example":
		var d any
		if d, err = a.call("example", nil); err == nil {
			s, _ := d.(string)
			err = a.openDeckAt(s)
		}
	case strings.HasPrefix(id, "recent:"):
		var i int
		fmt.Sscanf(id, "recent:%d", &i)
		a.mu.Lock()
		dir := ""
		if i >= 0 && i < len(a.recent) {
			dir = a.recent[i]
		}
		a.mu.Unlock()
		if dir != "" {
			err = a.openDeckAt(dir)
		}
	case id == "export-html":
		err = a.exportHTML()
	case id == "pdf-all":
		err = a.exportPDF("?print", "")
	case id == "pdf-main":
		err = a.exportPDF("?print&depth=1", "-hauptpfad")
	case id == "pdf-steps":
		err = a.exportPDF("?print&steps=1", "-schritte")
	case id == "pdf-handout":
		err = a.exportPDF("?print&notes=1", "-handout")
	case id == "reveal":
		if d := a.currentDeck(); d != nil {
			err = openPath(d.dir)
		}
	case id == "close-deck":
		a.closeDeck()
	case id == "quit":
		a.ui(func() { a.v.Terminate() })
	case id == "view-editor" || id == "view-present":
		d := a.currentDeck()
		if d == nil {
			return
		}
		if id == "view-editor" {
			a.navigate(d.url + "editor.html")
		} else {
			var p any
			if p, err = a.call("position", nil); err == nil {
				s, _ := p.(string)
				a.navigate(d.url + s)
			}
		}
	case id == "reload":
		a.ui(func() { a.v.Eval("location.reload()") })
	case id == "fullscreen":
		a.ui(func() { toggleFullscreen(a.hwnd) })
	case id == "present":
		err = a.present(nil)
	case id == "present-start":
		empty := ""
		err = a.present(&empty)
	case id == "present-stop":
		a.closePresentation()
	case id == "readme":
		err = openPath(filepath.Join(a.root, "README.md"))
	case id == "data-dir":
		err = openPath(a.data)
	}
	a.report("Hashmark", err)
}

// Tastenkürzel (WebView2 schluckt Tasten, native Beschleuniger greifen nicht): JS in jeder Seite des Hauptfensters
const shortcutsJS = `(() => {
  if (window.top !== window) return
  const map = { 'ctrl+o': 'open', 'ctrl+n': 'new', 'ctrl+shift+e': 'export-html', 'ctrl+shift+p': 'pdf-all',
    'ctrl+1': 'view-editor', 'ctrl+2': 'view-present', 'ctrl+r': 'reload', 'f11': 'fullscreen', 'f5': 'present', 'shift+f5': 'present-start' }
  addEventListener('keydown', (e) => {
    if (e.altKey) return
    const id = map[(e.ctrlKey ? 'ctrl+' : '') + (e.shiftKey ? 'shift+' : '') + e.key.toLowerCase()]
    if (id) { e.preventDefault(); window.hmMenu(id) }
  }, true)
})()`


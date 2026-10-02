// Hashmark Desktop (Go, ohne CGO): Fenster, Menü, Dialoge, Bildschirmwahl.
// Die eigentliche Arbeit (Markdown lesen, Editor-Server, PDF/HTML-Export, zuletzt geöffnet) erledigt der
// Node-Sidecar src/desktop/sidecar.ts – über stdin/stdout, eine Zeile JSON je Nachricht.
//
// Hauptprozess = Hauptfenster (Startseite, Editor) + Sidecar. Präsentation und Presenter-View sind eigene
// Prozesse dieser EXE (`--window URL --mode …`), weil die Webview-Bibliothek nur ein Fenster je Prozess kennt.
package main

import (
	"embed"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/abemedia/go-webview"
	_ "github.com/abemedia/go-webview/embedded" // native Webview-Bibliothek einbetten
	"github.com/ncruces/zenity"
)

//go:embed icon.ico
var iconFS embed.FS

// version wird beim Bauen gesetzt: -ldflags "-X main.version=<letzter Tag>.<Hash>" (make, .gitlab-ci.yml)
var version = "dev"

var goVersion = strings.TrimPrefix(runtime.Version(), "go")

func exists(p string) bool { _, err := os.Stat(p); return err == nil }

// longPath löst Kurznamen (`C:\Users\MICHAE~1\…`) auf: Vite verweigert Dateien, wenn Freigabe und Anfrage verschieden geschrieben sind
func longPath(p string) string {
	if r, err := filepath.EvalSymlinks(p); err == nil {
		return r
	}
	return p
}

// locate findet Node und die App-Wurzel: gepackt `<exe>/node/node(.exe)` + `<exe>/app`, sonst das Repository
func locate() (node, root string) {
	exe, _ := os.Executable()
	exeDir := longPath(filepath.Dir(exe))
	name := "node"
	if runtime.GOOS == "windows" {
		name = "node.exe"
	}
	if exists(filepath.Join(exeDir, "app/src/desktop/sidecar.ts")) {
		return filepath.Join(exeDir, "node", name), filepath.Join(exeDir, "app")
	}
	starts := []string{os.Getenv("HASHMARK_ROOT"), exeDir}
	if wd, err := os.Getwd(); err == nil {
		starts = append(starts, wd)
	}
	for _, s := range starts {
		for d := s; s != "" && d != filepath.Dir(d); d = filepath.Dir(d) {
			if exists(filepath.Join(d, "src/desktop/sidecar.ts")) {
				root = longPath(d)
				node = filepath.Join(root, "vendor/node", name)
				if !exists(node) {
					if p, err := exec.LookPath("node"); err == nil {
						node = p
					}
				}
				return node, root
			}
		}
	}
	return "", ""
}

// dataDir: wie bei der Tauri-Version (`app.hashmark.desktop`), damit Einstellungen und „zuletzt geöffnet“ erhalten bleiben
func dataDir() string {
	base, err := os.UserConfigDir()
	if err != nil {
		base = os.TempDir()
	}
	return filepath.Join(base, "app.hashmark.desktop")
}

func writeIcon(dir string) string {
	p := filepath.Join(dir, "icon.ico")
	if b, err := iconFS.ReadFile("icon.ico"); err == nil {
		_ = os.MkdirAll(dir, 0o755)
		_ = os.WriteFile(p, b, 0o644)
	}
	return p
}

// runChild: Präsentation (Vollbild) bzw. Presenter-View (maximiert). `screen` ist der gewählte Bildschirm
// (Index in der Liste des Systems); -1 = automatisch (Präsentation auf dem Zusatzbildschirm, Presenter auf dem Hauptbildschirm).
func runChild(url, title, mode string, screen int) {
	v := webview.New(false)
	defer v.Destroy()
	v.SetTitle(title)
	v.SetSize(1400, 900, webview.HintNone)
	hwnd := uintptr(v.Window())
	setIcon(hwnd, writeIcon(dataDir()))
	// Fenstergeometrie: unter Windows sofort, sonst erst in der laufenden Ereignisschleife (macOS/GTK)
	geometry := func() {
		all := monitors()
		// ohne ausdrückliche Wahl: wie die automatische Auswahl der Hülle
		presentation, presenter := pickScreens(all, defaultPresentSettings())
		if screen >= 0 && screen < len(all) {
			presentation, presenter = all[screen], all[screen]
		}
		switch {
		case headless():
			hideWindow(hwnd)
		case mode == "presentation" && presentation.W > 0:
			setFullscreen(hwnd, presentation)
		case mode == "presenter" && presenter.W > 0:
			maximizeOn(hwnd, presenter)
		}
	}
	if runtime.GOOS == "windows" {
		geometry()
	} else {
		v.Dispatch(geometry)
	}
	_ = v.Bind("hmOpen", openExternal)
	v.Init(externalLinksJS)
	v.Navigate(url)
	v.Run()
}

func main() {
	win := flag.String("window", "", "nur ein Fenster mit dieser URL öffnen (Kindprozess)")
	title := flag.String("title", "Hashmark", "Fenstertitel (mit --window)")
	mode := flag.String("mode", "presentation", "presentation | presenter (mit --window)")
	screen := flag.Int("screen", -1, "Bildschirm für das Fenster (Position in der Liste des Systems, -1 = automatisch; mit --window)")
	showVersion := flag.Bool("version", false, "Version ausgeben und beenden")
	selftest := flag.Bool("selftest", false, "Sidecar starten, Beispiel-Deck öffnen, URL ausgeben, beenden")
	flag.Parse()
	if *showVersion {
		attachConsole() // die GUI-EXE hat unter Windows keine Konsole
		fmt.Println("Hashmark " + version)
		return
	}
	if *win != "" {
		runChild(*win, *title, *mode, *screen)
		return
	}

	node, root := locate()
	if node == "" || root == "" {
		_ = zenity.Error("Hashmark findet Node und die Programmdateien nicht.", zenity.Title("Hashmark"))
		os.Exit(1)
	}
	data := dataDir()
	sc, err := startSidecar(node, root, data)
	if err != nil {
		_ = zenity.Error(err.Error(), zenity.Title("Hashmark"))
		os.Exit(1)
	}
	defer sc.stop()
	self, _ := os.Executable()
	a := &app{sc: sc, root: root, data: data, self: self, children: map[string]*exec.Cmd{}, settings: loadPresentSettings(data)}
	defer a.closePresentation()

	if *selftest {
		for ev := range sc.events {
			if ev["event"] == "ready" {
				break
			}
		}
		d, err := a.call("example", nil)
		if err == nil {
			s, _ := d.(string)
			var res any
			if res, err = a.call("open", map[string]any{"dir": s}); err == nil {
				fmt.Println("Deck:", str(res, "url"))
			}
		}
		if err != nil {
			fmt.Println("Fehler:", err)
			os.Exit(1)
		}
		return
	}

	if a.startURL, err = a.serveStart(); err != nil {
		_ = zenity.Error(err.Error(), zenity.Title("Hashmark"))
		os.Exit(1)
	}

	v := webview.New(true) // true: F12 öffnet die Entwicklertools
	defer v.Destroy()
	a.v = v
	a.hwnd = uintptr(v.Window())
	v.SetTitle("Hashmark")
	v.SetSize(1440, 900, webview.HintNone)
	setIcon(a.hwnd, writeIcon(data))
	_ = v.Bind("hmMenu", func(id string) { go a.onMenu(id) })
	v.Init(shortcutsJS)
	_ = v.Bind("hmOpen", openExternal)
	// Optionen fürs Präsentieren: die Editor-Seite fragt Stand und Bildschirme ab und setzt sie
	_ = v.Bind("hmPresentOptions", a.presentOptions)
	_ = v.Bind("hmSetPresentOptions", a.setPresentOptions)
	v.Init(externalLinksJS)
	if headless() {
		hideWindow(a.hwnd)
	}
	v.Navigate(a.startURL)

	// Ereignisse des Sidecars: ready → Menü, action → Aktionen aus den Seiten
	go func() {
		for ev := range sc.events {
			switch ev["event"] {
			case "ready":
				go a.refreshMenu()
			case "action":
				go a.onAction(ev)
			}
		}
	}()
	a.ui(func() { setMenu(a.hwnd, a.menu(), func(id string) { go a.onMenu(id) }) })

	// Deck-Ordner aus der Kommandozeile: `hashmark.exe <ordner>`
	for _, arg := range flag.Args() {
		if st, err := os.Stat(arg); err == nil && st.IsDir() {
			go func() { a.report("Deck öffnen", a.openDeckAt(arg)) }()
			break
		}
	}
	v.Run()
}

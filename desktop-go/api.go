package main

// Startseite (src/desktop/ui) und ihre Befehle. Die Seite kommt von einem eigenen lokalen Server; ihre Befehle
// laufen per fetch('api/<befehl>') mit Header X-Hashmark-App. Der Header löst bei fremden Seiten einen
// CORS-Preflight aus, den dieser Server nicht beantwortet – nur die Startseite selbst kann also Befehle senden.

import (
	"encoding/json"
	"net"
	"net/http"
	"path/filepath"
	"strings"
)

func (a *app) serveStart() (string, error) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", err
	}
	mux := http.NewServeMux()
	mux.Handle("/", http.FileServer(http.Dir(filepath.Join(a.root, "src/desktop/ui"))))
	mux.HandleFunc("/api/", a.handleAPI)
	go http.Serve(ln, hostGuard(mux))
	return "http://" + ln.Addr().String() + "/", nil
}

// hostGuard: nur Anfragen an 127.0.0.1 (Schutz vor DNS-Rebinding)
func hostGuard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.Host, "127.0.0.1:") {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (a *app) handleAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost || r.Header.Get("X-Hashmark-App") != "1" {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	var args map[string]any
	_ = json.NewDecoder(r.Body).Decode(&args)
	var res any
	var err error
	switch strings.TrimPrefix(r.URL.Path, "/api/") {
	case "recent":
		res, err = a.call("recent", nil)
	case "examples":
		res, err = a.call("examples", nil)
	case "open_deck":
		dir, _ := args["dir"].(string)
		err = a.openDeckAt(dir)
	case "new_deck":
		err = a.createDeck()
	case "open_example":
		var d any
		if d, err = a.call("example", nil); err == nil {
			s, _ := d.(string)
			err = a.openDeckAt(s)
		}
	case "forget":
		dir, _ := args["dir"].(string)
		_, err = a.call("forget", map[string]any{"dir": dir})
		if err == nil {
			a.refreshMenu()
		}
	default:
		http.NotFound(w, r)
		return
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}

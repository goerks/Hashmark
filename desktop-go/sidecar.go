package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// Der Node-Sidecar (src/desktop/sidecar.ts) spricht über stdin/stdout, eine Zeile JSON je Nachricht.
// Antworten tragen die `id` der Anfrage, Ereignisse (Aktionen aus den Seiten, `ready`) haben keine.
const prefix = "@@hashmark "

type sidecar struct {
	cmd     *exec.Cmd
	enc     *json.Encoder
	mu      sync.Mutex
	pending map[uint64]chan map[string]any
	next    atomic.Uint64
	events  chan map[string]any
}

// call sendet einen Befehl und wartet auf die Antwort (blockierend – nie im UI-Thread aufrufen)
func (s *sidecar) call(cmd string, args map[string]any) (any, error) {
	id := s.next.Add(1)
	ch := make(chan map[string]any, 1)
	msg := map[string]any{"id": id, "cmd": cmd}
	for k, v := range args {
		msg[k] = v
	}
	s.mu.Lock()
	s.pending[id] = ch
	err := s.enc.Encode(msg) // Encode hängt \n an
	s.mu.Unlock()
	if err != nil {
		return nil, fmt.Errorf("Sidecar nicht erreichbar: %w", err)
	}
	select {
	case m, ok := <-ch:
		if !ok {
			return nil, fmt.Errorf("Der Node-Sidecar wurde beendet (siehe sidecar.log im Datenordner).")
		}
		if ok, _ := m["ok"].(bool); ok {
			return m["result"], nil
		}
		if e, _ := m["error"].(string); e != "" {
			return nil, fmt.Errorf("%s", e)
		}
		return nil, fmt.Errorf("unbekannter Fehler")
	case <-time.After(10 * time.Minute):
		return nil, fmt.Errorf("Der Node-Sidecar antwortet nicht (siehe sidecar.log im Datenordner).")
	}
}

// Gepackt liegt ein Bündel (wenige Dateien, startet auch auf frisch kopierten Dateien schnell), in der Entwicklung die Quelle.
func sidecarScript(root string) string {
	bundle := filepath.Join(root, "src/desktop/sidecar.bundle.mjs")
	if _, err := os.Stat(bundle); err == nil && os.Getenv("HASHMARK_SIDECAR_SOURCE") == "" {
		return bundle
	}
	return filepath.Join(root, "src/desktop/sidecar.ts")
}

func startSidecar(node, root, data string) (*sidecar, error) {
	if err := os.MkdirAll(data, 0o755); err != nil {
		return nil, err
	}
	// das vorige Log bleibt als sidecar.log.1 erhalten (nach einem Absturz startet man neu und überschriebe sonst die Spur)
	_ = os.Rename(filepath.Join(data, "sidecar.log"), filepath.Join(data, "sidecar.log.1"))
	logf, err := os.Create(filepath.Join(data, "sidecar.log"))
	if err != nil {
		return nil, err
	}
	cmd := exec.Command(node, "--disable-warning=ExperimentalWarning", sidecarScript(root), "--data="+data)
	cmd.Dir = root
	cmd.Stderr = logf
	// V8-Bytecode-Cache: der Sidecar startet ab dem zweiten Mal schneller
	cmd.Env = append(os.Environ(), "NODE_COMPILE_CACHE="+filepath.Join(data, "node-cache"))
	hideConsole(cmd)
	in, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	out, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("Node startet nicht (%s): %w", node, err)
	}
	s := &sidecar{cmd: cmd, enc: json.NewEncoder(in), pending: map[uint64]chan map[string]any{}, events: make(chan map[string]any, 64)}
	go func() {
		sc := bufio.NewScanner(out)
		sc.Buffer(make([]byte, 1<<20), 1<<26)
		for sc.Scan() {
			text, ok := strings.CutPrefix(sc.Text(), prefix)
			if !ok {
				continue
			}
			var m map[string]any
			if json.Unmarshal([]byte(text), &m) != nil {
				continue
			}
			if id, ok := m["id"].(float64); ok {
				s.mu.Lock()
				ch := s.pending[uint64(id)]
				delete(s.pending, uint64(id))
				s.mu.Unlock()
				if ch != nil {
					ch <- m
				}
			} else {
				s.events <- m
			}
		}
		// Sidecar beendet: Wartende freigeben
		logLine("Sidecar beendet: %v", cmd.Wait())
		s.mu.Lock()
		for id, ch := range s.pending {
			close(ch)
			delete(s.pending, id)
		}
		s.mu.Unlock()
		close(s.events)
	}()
	return s, nil
}

func (s *sidecar) stop() {
	if s.cmd.Process != nil {
		_ = s.cmd.Process.Kill()
	}
}

//go:build !windows

package main

// Linux/macOS: noch nicht umgesetzt (Menü, Monitorwahl, Vollbild); Platzhalter, damit alles baut.

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

func hideConsole(c *exec.Cmd) {}

type monitor struct {
	X, Y, W, H int
	Primary    bool
}

func monitors() []monitor                          { return nil }
func setFullscreen(hwnd uintptr, m monitor)        {}
func toggleFullscreen(hwnd uintptr)                {}
func maximizeOn(hwnd uintptr, m monitor)           {}
func hideWindow(hwnd uintptr)                      {}
func focusWindow(title string) bool                { return false }
func setIcon(hwnd uintptr, icoPath string)         {}
func setMenu(hwnd uintptr, items []menuItem, onCommand func(id string)) {}

func documentsDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, "Documents")
}

func openPath(p string) error {
	if runtime.GOOS == "darwin" {
		return exec.Command("open", p).Start()
	}
	return exec.Command("xdg-open", p).Start()
}

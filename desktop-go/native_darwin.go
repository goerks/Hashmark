//go:build darwin

package main

// macOS-Teil der Hülle: Menü, Vollbild/Monitorwahl, Symbol über die Objective-C-Laufzeit (purego, ohne CGO).
// NICHT GETESTET (nur kompiliert). Fehlt ein Symbol, schaltet sich alles ab: kein Menü, kein Vollbild.
// Annahme: go-webview liefert für Window() den NSWindow-Zeiger, und AppKit ist durch die Webview schon geladen.

import (
	"runtime"
	"strings"
	"sync"
	"syscall"
	"unsafe"

	"github.com/ebitengine/purego"
)

type nsRect struct{ X, Y, W, H float64 }

var objc struct {
	getClass      func(name string) uintptr
	selector      func(name string) uintptr
	m0            func(self, sel uintptr) uintptr
	m1            func(self, sel, a uintptr) uintptr
	m3            func(self, sel, a, b, c uintptr) uintptr
	mRect         func(self, sel uintptr) nsRect
	mSetFrame     func(self, sel uintptr, r nsRect, display uintptr)
	allocClass    func(super uintptr, name string, extra uintptr) uintptr
	registerClass func(cls uintptr)
	addMethod     func(cls, sel, imp uintptr, types string) uintptr
}

var (
	objcOnce sync.Once
	objcOK   bool
	selMu    sync.Mutex
	selCache = map[string]uintptr{}
)

func loadObjC() bool {
	objcOnce.Do(func() {
		defer func() {
			if recover() != nil {
				objcOK = false
			}
		}()
		lib, err := purego.Dlopen("/usr/lib/libobjc.A.dylib", purego.RTLD_NOW|purego.RTLD_GLOBAL)
		if err != nil {
			return
		}
		purego.RegisterLibFunc(&objc.getClass, lib, "objc_getClass")
		purego.RegisterLibFunc(&objc.selector, lib, "sel_registerName")
		purego.RegisterLibFunc(&objc.m0, lib, "objc_msgSend")
		purego.RegisterLibFunc(&objc.m1, lib, "objc_msgSend")
		purego.RegisterLibFunc(&objc.m3, lib, "objc_msgSend")
		purego.RegisterLibFunc(&objc.mSetFrame, lib, "objc_msgSend")
		// Struktur-Rückgabe: auf Intel (amd64) über objc_msgSend_stret, auf Apple Silicon über objc_msgSend
		ret := "objc_msgSend"
		if runtime.GOARCH == "amd64" {
			ret = "objc_msgSend_stret"
		}
		purego.RegisterLibFunc(&objc.mRect, lib, ret)
		purego.RegisterLibFunc(&objc.allocClass, lib, "objc_allocateClassPair")
		purego.RegisterLibFunc(&objc.registerClass, lib, "objc_registerClassPair")
		purego.RegisterLibFunc(&objc.addMethod, lib, "class_addMethod")
		objcOK = true
	})
	return objcOK
}

func sel(name string) uintptr {
	selMu.Lock()
	defer selMu.Unlock()
	if s, ok := selCache[name]; ok {
		return s
	}
	s := objc.selector(name)
	selCache[name] = s
	return s
}

func class(name string) uintptr { return objc.getClass(name) }

func nsstr(s string) uintptr {
	b, _ := syscall.BytePtrFromString(s)
	r := objc.m1(class("NSString"), sel("stringWithUTF8String:"), uintptr(unsafe.Pointer(b)))
	runtime.KeepAlive(b)
	return r
}

func alloc(cls string) uintptr { return objc.m0(class(cls), sel("alloc")) }

func boolean(b bool) uintptr {
	if b {
		return 1
	}
	return 0
}

// ---------- Menü ----------

var (
	menuMu      sync.Mutex
	menuCommand func(id string)
	menuIDs     map[uintptr]string
	menuTarget  uintptr
)

// target: Objekt einer eigenen Klasse, dessen Methode hashmarkMenu: die Menüeinträge aufrufen (Tag = Index in menuIDs)
func target() uintptr {
	if menuTarget != 0 {
		return menuTarget
	}
	cls := objc.allocClass(class("NSObject"), "HashmarkMenuTarget", 0)
	imp := purego.NewCallback(func(self, cmd, sender uintptr) uintptr {
		tag := objc.m0(sender, sel("tag"))
		menuMu.Lock()
		id, cb := menuIDs[tag], menuCommand
		menuMu.Unlock()
		if cb != nil && id != "" {
			cb(id)
		}
		return 0
	})
	objc.addMethod(cls, sel("hashmarkMenu:"), imp, "v@:@")
	objc.registerClass(cls)
	menuTarget = objc.m0(objc.m0(cls, sel("alloc")), sel("init"))
	return menuTarget
}

// accelKey: aus „Strg+Umschalt+E“ wird (e, Umschalt); nur Strg+Buchstabe/Ziffer wird zu Cmd+Taste
func accelKey(accel string) (key string, shift bool) {
	parts := strings.Split(accel, "+")
	last := parts[len(parts)-1]
	if len(parts) < 2 || len(last) != 1 || parts[0] != "Strg" {
		return "", false
	}
	return strings.ToLower(last), len(parts) == 3 && parts[1] == "Umschalt"
}

func newMenu(title string) uintptr {
	return objc.m1(alloc("NSMenu"), sel("initWithTitle:"), nsstr(title))
}

func newItem(title string, action uintptr, key string) uintptr {
	return objc.m3(alloc("NSMenuItem"), sel("initWithTitle:action:keyEquivalent:"), nsstr(title), action, nsstr(key))
}

func fillMenu(menu uintptr, items []menuItem, ids map[uintptr]string, next *uintptr) {
	for _, it := range items {
		switch {
		case it.Sep:
			objc.m1(menu, sel("addItem:"), objc.m0(class("NSMenuItem"), sel("separatorItem")))
		case it.Sub != nil:
			mi := newItem(it.Label, 0, "")
			sub := newMenu(it.Label)
			fillMenu(sub, it.Sub, ids, next)
			objc.m1(mi, sel("setSubmenu:"), sub)
			objc.m1(menu, sel("addItem:"), mi)
		case it.ID == "quit":
			// „Beenden“ steht auf dem Mac im Programmmenü
		default:
			key, shift := accelKey(it.Accel)
			mi := newItem(it.Label, sel("hashmarkMenu:"), key)
			if key != "" {
				mask := uintptr(1 << 20) // NSEventModifierFlagCommand
				if shift {
					mask |= 1 << 17 // NSEventModifierFlagShift
				}
				objc.m1(mi, sel("setKeyEquivalentModifierMask:"), mask)
			}
			objc.m1(mi, sel("setTarget:"), target())
			*next++
			ids[*next] = it.ID
			objc.m1(mi, sel("setTag:"), *next)
			objc.m1(mi, sel("setEnabled:"), boolean(it.Enabled))
			objc.m1(menu, sel("addItem:"), mi)
		}
	}
}

// setMenu ersetzt die Menüleiste (nur im UI-Thread aufrufen). Das erste Menü ist auf dem Mac das Programmmenü.
func setMenu(hwnd uintptr, items []menuItem, onCommand func(id string)) {
	if !loadObjC() {
		return
	}
	ids := map[uintptr]string{}
	var next uintptr
	menuMu.Lock()
	menuIDs, menuCommand = ids, onCommand
	menuMu.Unlock()

	bar := newMenu("")
	appItem := newItem("", 0, "")
	appMenu := newMenu("Hashmark")
	quit := newItem("Hashmark beenden", sel("hashmarkMenu:"), "q")
	objc.m1(quit, sel("setTarget:"), target())
	next++
	ids[next] = "quit"
	objc.m1(quit, sel("setTag:"), next)
	objc.m1(appMenu, sel("addItem:"), quit)
	objc.m1(appItem, sel("setSubmenu:"), appMenu)
	objc.m1(bar, sel("addItem:"), appItem)

	for _, it := range items {
		if it.Sub == nil {
			continue
		}
		mi := newItem(it.Label, 0, "")
		sub := newMenu(it.Label)
		fillMenu(sub, it.Sub, ids, &next)
		objc.m1(mi, sel("setSubmenu:"), sub)
		objc.m1(bar, sel("addItem:"), mi)
	}
	app := objc.m0(class("NSApplication"), sel("sharedApplication"))
	objc.m1(app, sel("setMainMenu:"), bar)
}

// ---------- Monitore, Vollbild ----------

// monitors: Cocoa-Koordinaten (Ursprung unten links); der erste Bildschirm hat die Menüleiste
func monitors() []monitor {
	if !loadObjC() {
		return nil
	}
	screens := objc.m0(class("NSScreen"), sel("screens"))
	n := int(objc.m0(screens, sel("count")))
	var out []monitor
	for i := 0; i < n; i++ {
		s := objc.m1(screens, sel("objectAtIndex:"), uintptr(i))
		r := objc.mRect(s, sel("frame"))
		out = append(out, monitor{X: int(r.X), Y: int(r.Y), W: int(r.W), H: int(r.H), Index: i, Primary: i == 0})
	}
	return out
}

// setFullscreen: Fenster auf den Bildschirm legen und in den Vollbildmodus von macOS schalten (der gilt für den Bildschirm des Fensters)
func setFullscreen(hwnd uintptr, m monitor) {
	if !loadObjC() || hwnd == 0 {
		return
	}
	objc.mSetFrame(hwnd, sel("setFrame:display:"), nsRect{float64(m.X), float64(m.Y), float64(m.W), float64(m.H)}, 1)
	objc.m1(hwnd, sel("makeKeyAndOrderFront:"), 0)
	objc.m1(hwnd, sel("toggleFullScreen:"), 0)
}

func toggleFullscreen(hwnd uintptr) {
	if loadObjC() && hwnd != 0 {
		objc.m1(hwnd, sel("toggleFullScreen:"), 0)
	}
}

func maximizeOn(hwnd uintptr, m monitor) {
	if !loadObjC() || hwnd == 0 {
		return
	}
	objc.mSetFrame(hwnd, sel("setFrame:display:"), nsRect{float64(m.X), float64(m.Y), float64(m.W), float64(m.H)}, 1)
	objc.m1(hwnd, sel("zoom:"), 0)
}

func hideWindow(hwnd uintptr) {
	if loadObjC() && hwnd != 0 {
		objc.m1(hwnd, sel("orderOut:"), 0)
	}
}

// focusWindow: Fenster anderer Prozesse lassen sich nicht per Titel nach vorn holen
func focusWindow(title string) bool { return false }

func setIcon(hwnd uintptr, icoPath string) {
	if !loadObjC() {
		return
	}
	img := objc.m1(alloc("NSImage"), sel("initWithContentsOfFile:"), nsstr(icoPath))
	if img != 0 {
		app := objc.m0(class("NSApplication"), sel("sharedApplication"))
		objc.m1(app, sel("setApplicationIconImage:"), img)
	}
}

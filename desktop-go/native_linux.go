//go:build linux

package main

// Linux-Teil der Hülle: Menüleiste, Vollbild/Monitorwahl, Symbol über GTK 3 (dlopen per purego, ohne CGO).
// NICHT GETESTET (nur kompiliert). Fehlt GTK oder ein Symbol, schaltet sich alles ab: kein Menü, kein Vollbild.

import (
	"sync"
	"unsafe"

	"github.com/ebitengine/purego"
)

var gtk struct {
	menuBarNew                func() uintptr
	menuNew                   func() uintptr
	menuItemNewWithLabel      func(label string) uintptr
	menuItemSetSubmenu        func(item, sub uintptr)
	menuShellAppend           func(shell, item uintptr)
	separatorMenuItemNew      func() uintptr
	widgetSetSensitive        func(w uintptr, sensitive int32)
	widgetShowAll             func(w uintptr)
	widgetHide                func(w uintptr)
	widgetDestroy             func(w uintptr)
	signalConnectData         func(inst uintptr, signal string, cb, data, destroy uintptr, flags int32) uint64
	binGetChild               func(w uintptr) uintptr
	containerAdd              func(c, w uintptr)
	containerRemove           func(c, w uintptr)
	boxNew                    func(orientation, spacing int32) uintptr
	boxPackStart              func(box, child uintptr, expand, fill int32, padding uint32)
	boxReorderChild           func(box, child uintptr, pos int32)
	objectRef                 func(o uintptr) uintptr
	objectUnref               func(o uintptr)
	windowFullscreen          func(w uintptr)
	windowUnfullscreen        func(w uintptr)
	windowFullscreenOnMonitor func(w, screen uintptr, monitor int32)
	windowGetScreen           func(w uintptr) uintptr
	windowMaximize            func(w uintptr)
	windowMove                func(w uintptr, x, y int32)
	windowSetIconFromFile     func(w uintptr, file string, gerror uintptr) int32
	displayGetDefault         func() uintptr
	displayGetNMonitors       func(d uintptr) int32
	displayGetMonitor         func(d uintptr, n int32) uintptr
	monitorGetGeometry        func(m uintptr, rect unsafe.Pointer)
	monitorIsPrimary          func(m uintptr) int32
}

var (
	gtkOnce sync.Once
	gtkOK   bool
)

// loadGTK bindet die GTK-Funktionen; bei jedem Fehler (Bibliothek oder Symbol fehlt) bleibt die Hülle ohne Menü
func loadGTK() (ok bool) {
	gtkOnce.Do(func() {
		defer func() {
			if recover() != nil {
				gtkOK = false
			}
		}()
		g, err := purego.Dlopen("libgtk-3.so.0", purego.RTLD_NOW|purego.RTLD_GLOBAL)
		if err != nil {
			return
		}
		gd, err := purego.Dlopen("libgdk-3.so.0", purego.RTLD_NOW|purego.RTLD_GLOBAL)
		if err != nil {
			return
		}
		go_, err := purego.Dlopen("libgobject-2.0.so.0", purego.RTLD_NOW|purego.RTLD_GLOBAL)
		if err != nil {
			return
		}
		reg := func(f any, lib uintptr, name string) { purego.RegisterLibFunc(f, lib, name) }
		reg(&gtk.menuBarNew, g, "gtk_menu_bar_new")
		reg(&gtk.menuNew, g, "gtk_menu_new")
		reg(&gtk.menuItemNewWithLabel, g, "gtk_menu_item_new_with_label")
		reg(&gtk.menuItemSetSubmenu, g, "gtk_menu_item_set_submenu")
		reg(&gtk.menuShellAppend, g, "gtk_menu_shell_append")
		reg(&gtk.separatorMenuItemNew, g, "gtk_separator_menu_item_new")
		reg(&gtk.widgetSetSensitive, g, "gtk_widget_set_sensitive")
		reg(&gtk.widgetShowAll, g, "gtk_widget_show_all")
		reg(&gtk.widgetHide, g, "gtk_widget_hide")
		reg(&gtk.widgetDestroy, g, "gtk_widget_destroy")
		reg(&gtk.signalConnectData, go_, "g_signal_connect_data")
		reg(&gtk.binGetChild, g, "gtk_bin_get_child")
		reg(&gtk.containerAdd, g, "gtk_container_add")
		reg(&gtk.containerRemove, g, "gtk_container_remove")
		reg(&gtk.boxNew, g, "gtk_box_new")
		reg(&gtk.boxPackStart, g, "gtk_box_pack_start")
		reg(&gtk.boxReorderChild, g, "gtk_box_reorder_child")
		reg(&gtk.objectRef, go_, "g_object_ref")
		reg(&gtk.objectUnref, go_, "g_object_unref")
		reg(&gtk.windowFullscreen, g, "gtk_window_fullscreen")
		reg(&gtk.windowUnfullscreen, g, "gtk_window_unfullscreen")
		reg(&gtk.windowFullscreenOnMonitor, g, "gtk_window_fullscreen_on_monitor")
		reg(&gtk.windowGetScreen, g, "gtk_window_get_screen")
		reg(&gtk.windowMaximize, g, "gtk_window_maximize")
		reg(&gtk.windowMove, g, "gtk_window_move")
		reg(&gtk.windowSetIconFromFile, g, "gtk_window_set_icon_from_file")
		reg(&gtk.displayGetDefault, gd, "gdk_display_get_default")
		reg(&gtk.displayGetNMonitors, gd, "gdk_display_get_n_monitors")
		reg(&gtk.displayGetMonitor, gd, "gdk_display_get_monitor")
		reg(&gtk.monitorGetGeometry, gd, "gdk_monitor_get_geometry")
		reg(&gtk.monitorIsPrimary, gd, "gdk_monitor_is_primary")
		gtkOK = true
	})
	return gtkOK
}

// ---------- Menü ----------

var (
	menuMu      sync.Mutex
	menuCommand func(id string)
	menuIDs     map[uintptr]string
	menuBox     uintptr // senkrechte Box im Fenster: Menüleiste, darunter die Webview
	menuBar     uintptr
	activateCb  = purego.NewCallback(func(item, data uintptr) {
		menuMu.Lock()
		id, cb := menuIDs[data], menuCommand
		menuMu.Unlock()
		if cb != nil && id != "" {
			cb(id)
		}
	})
)

func appendItems(shell uintptr, items []menuItem, ids map[uintptr]string, next *uintptr) {
	for _, it := range items {
		switch {
		case it.Sep:
			gtk.menuShellAppend(shell, gtk.separatorMenuItemNew())
		case it.Sub != nil:
			mi := gtk.menuItemNewWithLabel(it.Label)
			sub := gtk.menuNew()
			appendItems(sub, it.Sub, ids, next)
			gtk.menuItemSetSubmenu(mi, sub)
			gtk.menuShellAppend(shell, mi)
		default:
			label := it.Label
			if it.Accel != "" {
				label += "    " + it.Accel
			}
			mi := gtk.menuItemNewWithLabel(label)
			if !it.Enabled {
				gtk.widgetSetSensitive(mi, 0)
			}
			*next++
			ids[*next] = it.ID
			gtk.signalConnectData(mi, "activate", activateCb, *next, 0, 0)
			gtk.menuShellAppend(shell, mi)
		}
	}
}

// setMenu ersetzt die Menüleiste (nur im UI-Thread aufrufen). Die Webview sitzt direkt im Fenster; beim ersten
// Aufruf wandert sie in eine senkrechte Box unter die Menüleiste.
func setMenu(hwnd uintptr, items []menuItem, onCommand func(id string)) {
	if !loadGTK() || hwnd == 0 {
		return
	}
	ids := map[uintptr]string{}
	var next uintptr
	bar := gtk.menuBarNew()
	appendItems(bar, items, ids, &next)
	menuMu.Lock()
	menuIDs, menuCommand = ids, onCommand
	menuMu.Unlock()

	if menuBox == 0 {
		child := gtk.binGetChild(hwnd)
		if child == 0 {
			return
		}
		gtk.objectRef(child)
		gtk.containerRemove(hwnd, child)
		menuBox = gtk.boxNew(1, 0) // GTK_ORIENTATION_VERTICAL
		gtk.boxPackStart(menuBox, child, 1, 1, 0)
		gtk.containerAdd(hwnd, menuBox)
		gtk.objectUnref(child)
	} else if menuBar != 0 {
		gtk.widgetDestroy(menuBar)
	}
	menuBar = bar
	gtk.boxPackStart(menuBox, bar, 0, 0, 0)
	gtk.boxReorderChild(menuBox, bar, 0)
	gtk.widgetShowAll(menuBox)
}

// ---------- Monitore, Vollbild ----------

func monitors() []monitor {
	if !loadGTK() {
		return nil
	}
	d := gtk.displayGetDefault()
	if d == 0 {
		return nil
	}
	var out []monitor
	for i := int32(0); i < gtk.displayGetNMonitors(d); i++ {
		m := gtk.displayGetMonitor(d, i)
		var r [4]int32 // GdkRectangle: x, y, width, height
		gtk.monitorGetGeometry(m, unsafe.Pointer(&r))
		out = append(out, monitor{X: int(r[0]), Y: int(r[1]), W: int(r[2]), H: int(r[3]), Index: int(i), Primary: gtk.monitorIsPrimary(m) != 0})
	}
	return out
}

var (
	fsMu sync.Mutex
	fsOn = map[uintptr]bool{}
)

func setFullscreen(hwnd uintptr, m monitor) {
	if !loadGTK() || hwnd == 0 {
		return
	}
	fsMu.Lock()
	fsOn[hwnd] = true
	fsMu.Unlock()
	if screen := gtk.windowGetScreen(hwnd); screen != 0 {
		gtk.windowFullscreenOnMonitor(hwnd, screen, int32(m.Index))
		return
	}
	gtk.windowFullscreen(hwnd)
}

func toggleFullscreen(hwnd uintptr) {
	if !loadGTK() || hwnd == 0 {
		return
	}
	fsMu.Lock()
	on := fsOn[hwnd]
	fsOn[hwnd] = !on
	fsMu.Unlock()
	if on {
		gtk.windowUnfullscreen(hwnd)
	} else {
		gtk.windowFullscreen(hwnd)
	}
}

func maximizeOn(hwnd uintptr, m monitor) {
	if !loadGTK() || hwnd == 0 {
		return
	}
	gtk.windowMove(hwnd, int32(m.X+40), int32(m.Y+40))
	gtk.windowMaximize(hwnd)
}

func hideWindow(hwnd uintptr) {
	if loadGTK() && hwnd != 0 {
		gtk.widgetHide(hwnd)
	}
}

// focusWindow: Fenster anderer Prozesse lassen sich unter GTK nicht per Titel nach vorn holen
func focusWindow(title string) bool { return false }

func setIcon(hwnd uintptr, icoPath string) {
	if loadGTK() && hwnd != 0 {
		gtk.windowSetIconFromFile(hwnd, icoPath, 0)
	}
}

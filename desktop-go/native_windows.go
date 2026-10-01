package main

// Windows-Teil der Hülle: Menü, Vollbild/Monitorwahl, Symbol – direkt über user32, ohne CGO.

import (
	"os/exec"
	"sync"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	user32                = windows.NewLazySystemDLL("user32.dll")
	pCreateMenu           = user32.NewProc("CreateMenu")
	pCreatePopupMenu      = user32.NewProc("CreatePopupMenu")
	pAppendMenuW          = user32.NewProc("AppendMenuW")
	pSetMenu              = user32.NewProc("SetMenu")
	pGetMenu              = user32.NewProc("GetMenu")
	pDestroyMenu          = user32.NewProc("DestroyMenu")
	pDrawMenuBar          = user32.NewProc("DrawMenuBar")
	pSetWindowLongPtrW    = user32.NewProc("SetWindowLongPtrW")
	pGetWindowLongPtrW    = user32.NewProc("GetWindowLongPtrW")
	pCallWindowProcW      = user32.NewProc("CallWindowProcW")
	pEnumDisplayMonitors  = user32.NewProc("EnumDisplayMonitors")
	pGetMonitorInfoW      = user32.NewProc("GetMonitorInfoW")
	pSetWindowPos         = user32.NewProc("SetWindowPos")
	pGetWindowRect        = user32.NewProc("GetWindowRect")
	pShowWindow           = user32.NewProc("ShowWindow")
	pFindWindowW          = user32.NewProc("FindWindowW")
	pSetForegroundWindow  = user32.NewProc("SetForegroundWindow")
	pSendMessageW         = user32.NewProc("SendMessageW")
	pLoadImageW           = user32.NewProc("LoadImageW")
	pSetDpiAwarenessCtx   = user32.NewProc("SetProcessDpiAwarenessContext")
)

const (
	mfString    = 0x0
	mfGrayed    = 0x1
	mfPopup     = 0x10
	mfSeparator = 0x800

	wmCommand = 0x0111
	wmSetIcon = 0x0080

	gwlpWndProc = ^uintptr(3) // -4
	gwlStyle    = ^uintptr(15) // -16

	wsCaption    = 0x00C00000
	wsThickFrame = 0x00040000

	swHide     = 0
	swMaximize = 3
	swRestore  = 9

	swpNoZOrder     = 0x0004
	swpFrameChanged = 0x0020
	swpShowWindow   = 0x0040
)

func init() {
	// per-monitor DPI v2: Monitor-Rechtecke und Fenstergrößen stimmen dann mit den echten Pixeln überein
	_, _, _ = pSetDpiAwarenessCtx.Call(^uintptr(3)) // DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = -4
}

func hideConsole(c *exec.Cmd) {
	c.SysProcAttr = &syscall.SysProcAttr{HideWindow: true, CreationFlags: 0x08000000} // CREATE_NO_WINDOW
}

// ---------- Menü ----------

var (
	menuMu      sync.Mutex
	menuCommand func(id string)
	menuIDs     map[uint32]string
	oldProc     uintptr
	procHooked  bool
	wndProcCb   = syscall.NewCallback(wndProc)
)

func wndProc(hwnd, msg, wparam, lparam uintptr) uintptr {
	if msg == wmCommand && lparam == 0 { // lparam 0 = Menü (nicht Steuerelement)
		menuMu.Lock()
		id, ok := menuIDs[uint32(wparam&0xFFFF)]
		cb := menuCommand
		menuMu.Unlock()
		if ok && cb != nil {
			cb(id)
			return 0
		}
	}
	r, _, _ := pCallWindowProcW.Call(oldProc, hwnd, msg, wparam, lparam)
	return r
}

func utf16(s string) *uint16 { p, _ := windows.UTF16PtrFromString(s); return p }

func buildMenu(items []menuItem, ids map[uint32]string, next *uint32) uintptr {
	m, _, _ := pCreateMenu.Call()
	fill(m, items, ids, next)
	return m
}

func fill(m uintptr, items []menuItem, ids map[uint32]string, next *uint32) {
	for _, it := range items {
		switch {
		case it.Sep:
			_, _, _ = pAppendMenuW.Call(m, mfSeparator, 0, 0)
		case it.Sub != nil:
			sub, _, _ := pCreatePopupMenu.Call()
			fill(sub, it.Sub, ids, next)
			_, _, _ = pAppendMenuW.Call(m, mfPopup, sub, uintptr(unsafe.Pointer(utf16(it.Label))))
		default:
			*next++
			ids[*next] = it.ID
			flags := uintptr(mfString)
			if !it.Enabled {
				flags |= mfGrayed
			}
			label := it.Label
			if it.Accel != "" {
				label += "\t" + it.Accel
			}
			_, _, _ = pAppendMenuW.Call(m, flags, uintptr(*next), uintptr(unsafe.Pointer(utf16(label))))
		}
	}
}

// setMenu ersetzt die Menüleiste (nur im UI-Thread aufrufen)
func setMenu(hwnd uintptr, items []menuItem, onCommand func(id string)) {
	ids := map[uint32]string{}
	var next uint32 = 100
	m := buildMenu(items, ids, &next)
	menuMu.Lock()
	menuIDs, menuCommand = ids, onCommand
	menuMu.Unlock()
	if !procHooked {
		oldProc, _, _ = pSetWindowLongPtrW.Call(hwnd, gwlpWndProc, wndProcCb)
		procHooked = true
	}
	old, _, _ := pGetMenu.Call(hwnd)
	_, _, _ = pSetMenu.Call(hwnd, m)
	if old != 0 {
		_, _, _ = pDestroyMenu.Call(old)
	}
	_, _, _ = pDrawMenuBar.Call(hwnd)
}

// ---------- Monitore, Vollbild ----------

type monitor struct {
	X, Y, W, H int
	Primary    bool
}

type monitorInfo struct {
	Size    uint32
	Monitor [4]int32
	Work    [4]int32
	Flags   uint32
}

func monitors() []monitor {
	var out []monitor
	cb := syscall.NewCallback(func(h, hdc, rc, lp uintptr) uintptr {
		mi := monitorInfo{Size: uint32(unsafe.Sizeof(monitorInfo{}))}
		if r, _, _ := pGetMonitorInfoW.Call(h, uintptr(unsafe.Pointer(&mi))); r != 0 {
			out = append(out, monitor{X: int(mi.Monitor[0]), Y: int(mi.Monitor[1]), W: int(mi.Monitor[2] - mi.Monitor[0]), H: int(mi.Monitor[3] - mi.Monitor[1]), Primary: mi.Flags&1 != 0})
		}
		return 1
	})
	_, _, _ = pEnumDisplayMonitors.Call(0, 0, cb, 0)
	return out
}

type saved struct {
	style uintptr
	rect  [4]int32
}

var (
	fsMu    sync.Mutex
	fsSaved = map[uintptr]saved{}
)

// setFullscreen: rahmenlos auf dem Monitor
func setFullscreen(hwnd uintptr, m monitor) {
	style, _, _ := pGetWindowLongPtrW.Call(hwnd, gwlStyle)
	var rc [4]int32
	_, _, _ = pGetWindowRect.Call(hwnd, uintptr(unsafe.Pointer(&rc)))
	fsMu.Lock()
	fsSaved[hwnd] = saved{style, rc}
	fsMu.Unlock()
	_, _, _ = pSetWindowLongPtrW.Call(hwnd, gwlStyle, style&^(wsCaption|wsThickFrame))
	_, _, _ = pSetWindowPos.Call(hwnd, 0, uintptr(m.X), uintptr(m.Y), uintptr(m.W), uintptr(m.H), swpNoZOrder|swpFrameChanged|swpShowWindow)
}

// toggleFullscreen: Vollbild auf dem Monitor, auf dem das Fenster liegt (F11)
func toggleFullscreen(hwnd uintptr) {
	fsMu.Lock()
	s, on := fsSaved[hwnd]
	delete(fsSaved, hwnd)
	fsMu.Unlock()
	if on {
		_, _, _ = pSetWindowLongPtrW.Call(hwnd, gwlStyle, s.style)
		_, _, _ = pSetWindowPos.Call(hwnd, 0, uintptr(s.rect[0]), uintptr(s.rect[1]), uintptr(s.rect[2]-s.rect[0]), uintptr(s.rect[3]-s.rect[1]), swpNoZOrder|swpFrameChanged|swpShowWindow)
		return
	}
	var rc [4]int32
	_, _, _ = pGetWindowRect.Call(hwnd, uintptr(unsafe.Pointer(&rc)))
	cx, cy := int(rc[0]+rc[2])/2, int(rc[1]+rc[3])/2
	target := monitor{}
	for _, m := range monitors() {
		if target.W == 0 || (cx >= m.X && cx < m.X+m.W && cy >= m.Y && cy < m.Y+m.H) {
			target = m
		}
	}
	setFullscreen(hwnd, target)
}

// maximizeOn: Fenster auf dem Monitor maximieren
func maximizeOn(hwnd uintptr, m monitor) {
	_, _, _ = pSetWindowPos.Call(hwnd, 0, uintptr(m.X+40), uintptr(m.Y+40), 800, 600, swpNoZOrder)
	_, _, _ = pShowWindow.Call(hwnd, swMaximize)
}

func hideWindow(hwnd uintptr) { _, _, _ = pShowWindow.Call(hwnd, swHide) }

// focusWindow holt ein Fenster (eines anderen Prozesses der App) per Titel nach vorn
func focusWindow(title string) bool {
	h, _, _ := pFindWindowW.Call(0, uintptr(unsafe.Pointer(utf16(title))))
	if h == 0 {
		return false
	}
	_, _, _ = pShowWindow.Call(h, swRestore)
	_, _, _ = pSetForegroundWindow.Call(h)
	return true
}

// setIcon: .ico-Datei als Fenstersymbol
func setIcon(hwnd uintptr, icoPath string) {
	const imageIcon, lrLoadFromFile, lrDefaultSize = 1, 0x10, 0x40
	h, _, _ := pLoadImageW.Call(0, uintptr(unsafe.Pointer(utf16(icoPath))), imageIcon, 0, 0, lrLoadFromFile|lrDefaultSize)
	if h != 0 {
		_, _, _ = pSendMessageW.Call(hwnd, wmSetIcon, 1, h) // ICON_BIG
		_, _, _ = pSendMessageW.Call(hwnd, wmSetIcon, 0, h) // ICON_SMALL
	}
}

// ---------- Ordner, Öffnen ----------

func documentsDir() string {
	p, err := windows.KnownFolderPath(windows.FOLDERID_Documents, 0)
	if err != nil {
		return ""
	}
	return p
}

func openPath(p string) error {
	return exec.Command("rundll32", "url.dll,FileProtocolHandler", p).Start()
}

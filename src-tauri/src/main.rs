// Hashmark Desktop (Tauri): Fenster, Menü, Dialoge, Bildschirmwahl.
// Die eigentliche Arbeit (Markdown lesen, Editor-Server, PDF/HTML-Export, zuletzt geöffnet) erledigt der
// Node-Sidecar src/desktop/sidecar.ts – über stdin/stdout, eine Zeile JSON je Nachricht.
// Die Seiten vom lokalen Server (http://127.0.0.1) haben keinen Zugriff auf Tauri; sie melden Aktionen
// (Präsentieren, Presenter, PDF) per HTTP an den Sidecar, der sie als Ereignis hierher weiterreicht.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::webview::NewWindowResponse;
use tauri::{AppHandle, Manager, RunEvent, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent, Wry};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind, MessageDialogResult};
use tauri_plugin_opener::OpenerExt;

const PREFIX: &str = "@@hashmark ";

/// Tests ohne sichtbare Fenster: `HASHMARK_HEADLESS=1` – alle Fenster bleiben unsichtbar, die Seiten laufen trotzdem
fn headless() -> bool {
    std::env::var("HASHMARK_HEADLESS").is_ok_and(|v| v == "1")
}

// ---------- Sidecar ----------

struct Sidecar {
    stdin: Mutex<ChildStdin>,
    child: Mutex<Child>,
    pending: Mutex<HashMap<u64, mpsc::Sender<Value>>>,
    next: AtomicU64,
}

impl Sidecar {
    /// Befehl senden und auf die Antwort warten (blockierend – nie im Haupt-Thread aufrufen)
    fn call(&self, cmd: &str, mut args: Value) -> Result<Value, String> {
        let id = self.next.fetch_add(1, Ordering::SeqCst);
        let (tx, rx) = mpsc::channel();
        self.pending.lock().unwrap().insert(id, tx);
        args["id"] = json!(id);
        args["cmd"] = json!(cmd);
        {
            let mut w = self.stdin.lock().unwrap();
            writeln!(w, "{args}").and_then(|_| w.flush()).map_err(|e| format!("Sidecar nicht erreichbar: {e}"))?;
        }
        let msg = rx
            .recv_timeout(Duration::from_secs(600))
            .map_err(|_| "Der Node-Sidecar antwortet nicht (siehe sidecar.log im Datenordner).".to_string())?;
        if msg["ok"].as_bool() == Some(true) {
            Ok(msg["result"].clone())
        } else {
            Err(msg["error"].as_str().unwrap_or("unbekannter Fehler").to_string())
        }
    }
}

#[derive(Clone)]
struct Deck {
    url: String,
    dir: String,
    name: String,
}

struct AppState {
    sidecar: Sidecar,
    deck: Mutex<Option<Deck>>,
    /// zuletzt geöffnete Decks – Index = Menü-Id `recent:<i>`
    recent: Mutex<Vec<String>>,
    root: PathBuf,
    start_url: Mutex<Option<Url>>,
}

/// Echter, langer Pfad ohne 8.3-Kurznamen (`C:\Users\MICHAE~1\…`). Wird Hashmark über einen Kurznamen gestartet,
/// sähe Vite sonst zwei verschiedene Pfade für dieselben Dateien und verweigerte sie (z. B. `/@vite/client` → 404).
fn long_path(p: PathBuf) -> PathBuf {
    let Ok(c) = std::fs::canonicalize(&p) else { return p };
    let s = c.to_string_lossy().to_string();
    // canonicalize liefert unter Windows `\\?\C:\…` bzw. `\\?\UNC\server\…` – Node und Vite wollen die normale Form
    if let Some(rest) = s.strip_prefix(r"\\?\UNC\") {
        PathBuf::from(format!(r"\\{rest}"))
    } else {
        PathBuf::from(s.strip_prefix(r"\\?\").unwrap_or(&s))
    }
}

/// Node und App-Wurzel finden: gepackt `<exe>/node/node.exe` + `<exe>/app`, sonst das Repository.
fn locate() -> (PathBuf, PathBuf) {
    let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(Path::to_path_buf)).map(long_path).unwrap_or_default();
    if exe_dir.join("app/src/desktop/sidecar.ts").exists() {
        return (exe_dir.join("node/node.exe"), exe_dir.join("app"));
    }
    let root = long_path(PathBuf::from(env!("CARGO_MANIFEST_DIR")).parent().map(Path::to_path_buf).unwrap_or_default());
    (root.join("vendor/node/node.exe"), root)
}

/// Gepackt liegt ein Bündel (wenige Dateien, startet auch auf frisch kopierten Dateien schnell), in der Entwicklung die Quelle.
fn sidecar_script(root: &Path) -> PathBuf {
    let bundle = root.join("src/desktop/sidecar.bundle.mjs");
    if bundle.exists() && std::env::var("HASHMARK_SIDECAR_SOURCE").is_err() {
        bundle
    } else {
        root.join("src/desktop/sidecar.ts")
    }
}

fn spawn_sidecar(data: &Path, node: &Path, root: &Path) -> Result<(Sidecar, ChildStdout), String> {
    std::fs::create_dir_all(data).map_err(|e| e.to_string())?;
    let log = File::create(data.join("sidecar.log")).map_err(|e| e.to_string())?;
    let mut cmd = Command::new(node);
    cmd.arg("--disable-warning=ExperimentalWarning")
        .arg(sidecar_script(root))
        .arg(format!("--data={}", data.display()))
        .current_dir(root)
        // V8-Bytecode-Cache: der Sidecar startet ab dem zweiten Mal schneller
        .env("NODE_COMPILE_CACHE", data.join("node-cache"))
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::from(log));
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW: kein Konsolenfenster
    }
    let mut child = cmd.spawn().map_err(|e| format!("Node startet nicht ({}): {e}", node.display()))?;
    let stdin = child.stdin.take().ok_or("kein stdin")?;
    let stdout = child.stdout.take().ok_or("kein stdout")?;
    let sidecar = Sidecar { stdin: Mutex::new(stdin), child: Mutex::new(child), pending: Mutex::new(HashMap::new()), next: AtomicU64::new(1) };
    Ok((sidecar, stdout))
}

/// Antworten den Wartenden zustellen, Ereignisse (Aktionen aus den Seiten) ausführen
fn read_sidecar(app: AppHandle, stdout: ChildStdout) {
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let Some(text) = line.strip_prefix(PREFIX) else { continue };
            let Ok(msg) = serde_json::from_str::<Value>(text) else { continue };
            if let Some(id) = msg.get("id").and_then(Value::as_u64) {
                if let Some(tx) = app.state::<AppState>().sidecar.pending.lock().unwrap().remove(&id) {
                    let _ = tx.send(msg);
                }
            } else if msg.get("event").and_then(Value::as_str) == Some("action") {
                let app = app.clone();
                thread::spawn(move || on_action(&app, &msg));
            } else if msg.get("event").and_then(Value::as_str) == Some("ready") {
                let app = app.clone();
                thread::spawn(move || refresh_menu(&app));
            }
        }
        // Sidecar beendet: Wartende freigeben (ihre Kanäle schließen sich)
        app.state::<AppState>().sidecar.pending.lock().unwrap().clear();
    });
}

fn call(app: &AppHandle, cmd: &str, args: Value) -> Result<Value, String> {
    app.state::<AppState>().sidecar.call(cmd, args)
}

fn current_deck(app: &AppHandle) -> Option<Deck> {
    app.state::<AppState>().deck.lock().unwrap().clone()
}

// ---------- Hilfen ----------

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

fn show_error(app: &AppHandle, title: &str, message: &str) {
    app.dialog().message(message).title(title).kind(MessageDialogKind::Error).blocking_show();
}

fn report(app: &AppHandle, title: &str, r: Result<(), String>) {
    if let Err(e) = r {
        show_error(app, title, &e);
    }
}

fn clicked(r: &MessageDialogResult, label: &str) -> bool {
    matches!(r, MessageDialogResult::Ok | MessageDialogResult::Yes) || matches!(r, MessageDialogResult::Custom(s) if s == label)
}

/// `window.open` aus den Seiten: nie neue Fenster; fremde Links im Standardbrowser
fn deny_new_window(app: AppHandle) -> impl Fn(Url, tauri::webview::NewWindowFeatures) -> NewWindowResponse<Wry> + Send + 'static {
    move |url, _| {
        let local = matches!(url.host_str(), Some("127.0.0.1") | Some("localhost") | Some("tauri.localhost"));
        if !local && matches!(url.scheme(), "http" | "https" | "mailto") {
            let _ = app.opener().open_url(url.as_str(), None::<&str>);
        }
        NewWindowResponse::Deny
    }
}

fn picked_path(p: Option<tauri_plugin_dialog::FilePath>) -> Option<String> {
    p.and_then(|p| p.into_path().ok()).map(|p| p.display().to_string())
}

// ---------- Decks ----------

fn open_deck_at(app: &AppHandle, dir: Option<String>) -> Result<(), String> {
    let dir = match dir {
        Some(d) => d,
        None => match picked_path(app.dialog().file().set_title("Deck öffnen").blocking_pick_folder()) {
            Some(d) => d,
            None => return Ok(()),
        },
    };
    let is_deck = call(app, "isDeck", json!({ "dir": dir }))?.as_bool().unwrap_or(false);
    if !is_deck {
        const CREATE: &str = "Neues Deck anlegen";
        let r = app
            .dialog()
            .message(format!("In diesem Ordner liegt kein Deck:\n{dir}\n\nEin Deck braucht eine deck.yaml oder mindestens eine .md-Datei."))
            .title("Kein Deck")
            .buttons(MessageDialogButtons::OkCancelCustom(CREATE.into(), "Abbrechen".into()))
            .blocking_show_with_result();
        if !clicked(&r, CREATE) {
            return Ok(());
        }
        call(app, "scaffold", json!({ "dir": dir }))?;
    }
    close_presentation(app);
    let res = call(app, "open", json!({ "dir": dir }))?;
    let deck = Deck {
        url: res["url"].as_str().unwrap_or_default().to_string(),
        dir: res["dir"].as_str().unwrap_or(&dir).to_string(),
        name: res["name"].as_str().unwrap_or("Deck").to_string(),
    };
    *app.state::<AppState>().deck.lock().unwrap() = Some(deck.clone());
    if let Some(w) = main_window(app) {
        let url = Url::parse(&format!("{}editor.html", deck.url)).map_err(|e| e.to_string())?;
        w.navigate(url).map_err(|e| e.to_string())?;
        let _ = w.set_title(&format!("Hashmark – {}", deck.name));
    }
    refresh_menu(app);
    Ok(())
}

fn create_deck(app: &AppHandle) -> Result<(), String> {
    let Some(dir) = picked_path(app.dialog().file().set_title("Neues Deck – leeren Ordner wählen oder anlegen").blocking_pick_folder()) else {
        return Ok(());
    };
    call(app, "scaffold", json!({ "dir": dir })).map_err(|e| format!("{e}\nBitte einen leeren Ordner wählen."))?;
    open_deck_at(app, Some(dir))
}

fn close_deck(app: &AppHandle) {
    close_presentation(app);
    let _ = call(app, "close", json!({}));
    *app.state::<AppState>().deck.lock().unwrap() = None;
    let start = app.state::<AppState>().start_url.lock().unwrap().clone();
    if let (Some(w), Some(url)) = (main_window(app), start) {
        let _ = w.navigate(url);
        let _ = w.set_title("Hashmark");
    }
    refresh_menu(app);
}

// ---------- Präsentieren ----------

fn close_presentation(app: &AppHandle) {
    for label in ["presentation", "presenter"] {
        if let Some(w) = app.get_webview_window(label) {
            let _ = w.destroy();
        }
    }
}

/// Präsentation im Vollbild – mit zweitem Bildschirm dort, und die Presenter-View auf dem Hauptbildschirm
fn present(app: &AppHandle, hash: Option<String>) -> Result<(), String> {
    let Some(deck) = current_deck(app) else { return Ok(()) };
    let hash = match hash {
        Some(h) => h,
        None => call(app, "position", json!({}))?.as_str().unwrap_or_default().to_string(),
    };
    close_presentation(app);
    let main = main_window(app).ok_or("kein Hauptfenster")?;
    let monitors = main.available_monitors().map_err(|e| e.to_string())?;
    let primary = main.primary_monitor().map_err(|e| e.to_string())?;
    let primary_pos = primary.as_ref().map(|m| *m.position());
    let external = monitors.iter().find(|m| Some(*m.position()) != primary_pos).cloned();
    let target = external.clone().or(primary).ok_or("kein Bildschirm gefunden")?;

    let url = Url::parse(&format!("{}{}", deck.url, hash)).map_err(|e| e.to_string())?;
    let win = WebviewWindowBuilder::new(app, "presentation", WebviewUrl::External(url))
        .title("Hashmark – Präsentation")
        .visible(false)
        .on_new_window(deny_new_window(app.clone()))
        .build()
        .map_err(|e| e.to_string())?;
    if !headless() {
        let _ = win.set_position(*target.position());
        let _ = win.set_size(*target.size());
        let _ = win.set_fullscreen(true);
        let _ = win.show();
        let _ = win.set_focus();
    }
    // Präsentation zu → Presenter-View ebenfalls
    let handle = app.clone();
    win.on_window_event(move |e| {
        if matches!(e, WindowEvent::Destroyed) {
            if let Some(p) = handle.get_webview_window("presenter") {
                let _ = p.destroy();
            }
        }
    });
    if external.is_some() {
        open_presenter(app, &hash)?;
    }
    Ok(())
}

/// Presenter-View (Taste S bzw. automatisch mit zweitem Bildschirm) auf dem Hauptbildschirm
fn open_presenter(app: &AppHandle, hash: &str) -> Result<(), String> {
    let Some(deck) = current_deck(app) else { return Ok(()) };
    if let Some(w) = app.get_webview_window("presenter") {
        let _ = w.set_focus();
        return Ok(());
    }
    let url = Url::parse(&format!("{}?presenter{}", deck.url, hash)).map_err(|e| e.to_string())?;
    let win = WebviewWindowBuilder::new(app, "presenter", WebviewUrl::External(url))
        .title("Hashmark – Presenter")
        .inner_size(1400.0, 900.0)
        .visible(false)
        .on_new_window(deny_new_window(app.clone()))
        .build()
        .map_err(|e| e.to_string())?;
    if !headless() {
        if let Ok(Some(primary)) = win.primary_monitor() {
            let _ = win.set_position(*primary.position());
        }
        let _ = win.maximize();
        let _ = win.show();
        let _ = win.set_focus();
    }
    Ok(())
}

// ---------- Export ----------

fn export_pdf(app: &AppHandle, query: &str, suffix: &str) -> Result<(), String> {
    let Some(deck) = current_deck(app) else { return Ok(()) };
    let mut dialog = app.dialog().file().set_title("PDF speichern").add_filter("PDF", &["pdf"]).set_file_name(format!("{}{}.pdf", deck.name, suffix));
    if let Ok(docs) = app.path().document_dir() {
        dialog = dialog.set_directory(docs);
    }
    let Some(out) = picked_path(dialog.blocking_save_file()) else { return Ok(()) };
    let res = with_busy(app, "PDF wird erstellt", || call(app, "pdf", json!({ "query": query, "out": out })))?;
    done(app, &format!("PDF erstellt: {} Seiten", res["pages"].as_u64().unwrap_or(0)), &out);
    Ok(())
}

fn export_html(app: &AppHandle) -> Result<(), String> {
    let Some(deck) = current_deck(app) else { return Ok(()) };
    let mut dialog = app.dialog().file().set_title("Als eine HTML-Datei exportieren").add_filter("HTML", &["html"]).set_file_name(format!("{}.html", deck.name));
    if let Ok(docs) = app.path().document_dir() {
        dialog = dialog.set_directory(docs);
    }
    let Some(out) = picked_path(dialog.blocking_save_file()) else { return Ok(()) };
    with_busy(app, "HTML-Export", || call(app, "html", json!({ "out": out })))?;
    done(app, "HTML-Datei erstellt – läuft offline per Doppelklick, auch mit Presenter-View (S).", &out);
    Ok(())
}

/// Während langer Aufgaben den Fenstertitel ergänzen
fn with_busy<T>(app: &AppHandle, label: &str, task: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
    let main = main_window(app);
    let title = main.as_ref().and_then(|w| w.title().ok()).unwrap_or_else(|| "Hashmark".into());
    if let Some(w) = &main {
        let _ = w.set_title(&format!("{title} – {label} …"));
    }
    let r = task();
    if let Some(w) = &main {
        let _ = w.set_title(&title);
    }
    r
}

fn done(app: &AppHandle, message: &str, file: &str) {
    const OPEN: &str = "Öffnen";
    let r = app
        .dialog()
        .message(format!("{message}\n\n{file}"))
        .title("Hashmark")
        .buttons(MessageDialogButtons::OkCancelCustom(OPEN.into(), "OK".into()))
        .blocking_show_with_result();
    if clicked(&r, OPEN) {
        let _ = app.opener().open_path(file, None::<&str>);
    }
}

// ---------- Aktionen aus den Seiten ----------

fn on_action(app: &AppHandle, msg: &Value) {
    let s = |k: &str| msg.get(k).and_then(Value::as_str).unwrap_or_default().to_string();
    let r = match s("action").as_str() {
        "present" => present(app, Some(s("hash"))),
        "presenter" => open_presenter(app, &s("hash")),
        "pdf" => {
            let query = s("query");
            let suffix = if query.contains("notes=1") { "-handout" } else { "" };
            export_pdf(app, &query, suffix)
        }
        "close" => {
            close_presentation(app);
            Ok(())
        }
        _ => Ok(()),
    };
    report(app, "Hashmark", r);
}

// ---------- Menü ----------

fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let has = current_deck(app).is_some();
    let recent = app.state::<AppState>().recent.lock().unwrap().clone();
    let item = |id: &str, label: &str, accel: Option<&str>, enabled: bool| {
        let mut b = MenuItemBuilder::with_id(id, label).enabled(enabled);
        if let Some(a) = accel {
            b = b.accelerator(a);
        }
        b.build(app)
    };

    let mut recent_menu = SubmenuBuilder::new(app, "Zuletzt geöffnet");
    if recent.is_empty() {
        recent_menu = recent_menu.item(&item("recent-none", "(leer)", None, false)?);
    }
    for (i, dir) in recent.iter().enumerate() {
        let name = Path::new(dir).file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
        recent_menu = recent_menu.item(&item(&format!("recent:{i}"), &format!("{name}   {dir}"), None, true)?);
    }

    let file = SubmenuBuilder::new(app, "Datei")
        .item(&item("open", "Deck öffnen …", Some("CmdOrCtrl+O"), true)?)
        .item(&item("new", "Neues Deck …", Some("CmdOrCtrl+N"), true)?)
        .item(&recent_menu.build()?)
        .item(&item("example", "Beispiel-Deck öffnen", None, true)?)
        .separator()
        .item(&item("export-html", "Als HTML-Datei exportieren …", Some("CmdOrCtrl+Shift+E"), has)?)
        .item(&item("pdf-all", "PDF – alle Folien …", Some("CmdOrCtrl+Shift+P"), has)?)
        .item(&item("pdf-main", "PDF – nur Hauptpfad …", None, has)?)
        .item(&item("pdf-steps", "PDF – jeder Schritt eine Seite …", None, has)?)
        .item(&item("pdf-handout", "Handout mit Notizen (A4) …", None, has)?)
        .separator()
        .item(&item("reveal", "Deck-Ordner im Explorer zeigen", None, has)?)
        .item(&item("close-deck", "Deck schließen", None, has)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some("Beenden"))?)
        .build()?;
    let view = SubmenuBuilder::new(app, "Ansicht")
        .item(&item("view-editor", "Editor", Some("CmdOrCtrl+1"), has)?)
        .item(&item("view-present", "Präsentation im Fenster", Some("CmdOrCtrl+2"), has)?)
        .separator()
        .item(&item("reload", "Neu laden", Some("CmdOrCtrl+R"), true)?)
        .item(&item("devtools", "Entwicklertools", Some("CmdOrCtrl+Shift+I"), true)?)
        .item(&item("fullscreen", "Vollbild", Some("F11"), true)?)
        .build()?;
    let show = SubmenuBuilder::new(app, "Präsentieren")
        .item(&item("present", "Ab aktueller Folie", Some("F5"), has)?)
        .item(&item("present-start", "Von vorne", Some("Shift+F5"), has)?)
        .item(&item("present-stop", "Präsentation beenden", None, has)?)
        .separator()
        .item(&item("hint1", "Mit Beamer: Folien im Vollbild dort, Presenter-View hier", None, false)?)
        .item(&item("hint2", "In der Präsentation: S Presenter · N Notizen · Ctrl+K Suche · Ctrl+W beenden", None, false)?)
        .build()?;
    let help = SubmenuBuilder::new(app, "Hilfe")
        .item(&item("readme", "Anleitung (README)", None, true)?)
        .item(&item("data-dir", "Datenordner öffnen (Einstellungen, Logs)", None, true)?)
        .separator()
        .item(&item("about", &format!("Hashmark {} · Tauri {}", app.package_info().version, tauri::VERSION), None, false)?)
        .build()?;
    MenuBuilder::new(app).items(&[&file, &view, &show, &help]).build()
}

/// Liste „Zuletzt geöffnet“ vom Sidecar holen und das Menü neu setzen (nicht im Haupt-Thread aufrufen)
fn refresh_menu(app: &AppHandle) {
    if let Ok(v) = call(app, "recent", json!({})) {
        let dirs = v.as_array().map(|a| a.iter().filter_map(|r| r["dir"].as_str().map(String::from)).collect()).unwrap_or_default();
        *app.state::<AppState>().recent.lock().unwrap() = dirs;
    }
    if let (Some(w), Ok(menu)) = (main_window(app), build_menu(app)) {
        let _ = w.set_menu(menu);
    }
}

fn on_menu(app: &AppHandle, id: &str) {
    let r = match id {
        "open" => open_deck_at(app, None),
        "new" => create_deck(app),
        "example" => call(app, "example", json!({})).and_then(|d| open_deck_at(app, d.as_str().map(String::from))),
        r if r.starts_with("recent:") => {
            let i: usize = r["recent:".len()..].parse().unwrap_or(usize::MAX);
            let dir = app.state::<AppState>().recent.lock().unwrap().get(i).cloned();
            open_deck_at(app, dir)
        }
        "export-html" => export_html(app),
        "pdf-all" => export_pdf(app, "?print", ""),
        "pdf-main" => export_pdf(app, "?print&depth=1", "-hauptpfad"),
        "pdf-steps" => export_pdf(app, "?print&steps=1", "-schritte"),
        "pdf-handout" => export_pdf(app, "?print&notes=1", "-handout"),
        "reveal" => current_deck(app).map_or(Ok(()), |d| app.opener().open_path(d.dir, None::<&str>).map_err(|e| e.to_string())),
        "close-deck" => {
            close_deck(app);
            Ok(())
        }
        "view-editor" | "view-present" => (|| {
            let (Some(deck), Some(w)) = (current_deck(app), main_window(app)) else { return Ok(()) };
            let target = if id == "view-editor" {
                format!("{}editor.html", deck.url)
            } else {
                let hash = call(app, "position", json!({}))?.as_str().unwrap_or_default().to_string();
                format!("{}{}", deck.url, hash)
            };
            w.navigate(Url::parse(&target).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
        })(),
        "reload" => main_window(app).map_or(Ok(()), |w| w.eval("location.reload()").map_err(|e| e.to_string())),
        "devtools" => {
            if let Some(w) = main_window(app) {
                w.open_devtools();
            }
            Ok(())
        }
        "fullscreen" => main_window(app).map_or(Ok(()), |w| {
            let full = w.is_fullscreen().unwrap_or(false);
            w.set_fullscreen(!full).map_err(|e| e.to_string())
        }),
        "present" => present(app, None),
        "present-start" => present(app, Some(String::new())),
        "present-stop" => {
            close_presentation(app);
            Ok(())
        }
        "readme" => {
            let readme = app.state::<AppState>().root.join("README.md");
            app.opener().open_path(readme.display().to_string(), None::<&str>).map_err(|e| e.to_string())
        }
        "data-dir" => app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())
            .and_then(|d| app.opener().open_path(d.display().to_string(), None::<&str>).map_err(|e| e.to_string())),
        _ => Ok(()),
    };
    report(app, "Hashmark", r);
}

// ---------- Befehle für die Startseite ----------

#[tauri::command(async)]
fn recent(app: AppHandle) -> Result<Value, String> {
    call(&app, "recent", json!({}))
}

#[tauri::command(async)]
fn open_deck(app: AppHandle, dir: Option<String>) -> Result<(), String> {
    open_deck_at(&app, dir)
}

#[tauri::command(async)]
fn new_deck(app: AppHandle) -> Result<(), String> {
    create_deck(&app)
}

#[tauri::command(async)]
fn examples(app: AppHandle) -> Result<Value, String> {
    call(&app, "examples", json!({}))
}

#[tauri::command(async)]
fn open_example(app: AppHandle) -> Result<(), String> {
    let dir = call(&app, "example", json!({}))?;
    open_deck_at(&app, dir.as_str().map(String::from))
}

#[tauri::command(async)]
fn forget(app: AppHandle, dir: String) -> Result<(), String> {
    call(&app, "forget", json!({ "dir": dir }))?;
    refresh_menu(&app);
    Ok(())
}

// ---------- Start ----------

fn main() {
    let (node, root) = locate();
    // Deck-Ordner aus der Kommandozeile: `hashmark.exe <ordner>`
    let deck_arg = std::env::args().skip(1).find(|a| !a.starts_with("--") && Path::new(a).is_dir());

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![recent, open_deck, new_deck, open_example, examples, forget])
        .setup(move |app| {
            let handle = app.handle().clone();
            let data = app.path().app_data_dir()?;
            let (sidecar, stdout) = spawn_sidecar(&data, &node, &root).map_err(|e| -> Box<dyn std::error::Error> { e.into() })?;
            app.manage(AppState {
                sidecar,
                deck: Mutex::new(None),
                recent: Mutex::new(Vec::new()),
                root: root.clone(),
                start_url: Mutex::new(None),
            });
            read_sidecar(handle.clone(), stdout);

            let menu = build_menu(&handle)?;
            // Drag & Drop bleibt beim WebView, damit Bilder im Editor per Drag & Drop eingefügt werden können
            let main = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Hashmark")
                .inner_size(1440.0, 900.0)
                .visible(!headless())
                .menu(menu)
                .disable_drag_drop_handler()
                .on_new_window(deny_new_window(handle.clone()))
                .build()?;
            *app.state::<AppState>().start_url.lock().unwrap() = main.url().ok();
            app.on_menu_event(|app, event| {
                let app = app.clone();
                let id = event.id().0.clone();
                thread::spawn(move || on_menu(&app, &id));
            });
            if let Some(dir) = deck_arg.clone() {
                thread::spawn(move || {
                    let r = open_deck_at(&handle, Some(dir));
                    report(&handle, "Deck öffnen", r);
                });
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Hashmark konnte nicht starten");

    app.run(|app, event| {
        if let RunEvent::Exit = event {
            if let Some(state) = app.try_state::<AppState>() {
                let _ = state.sidecar.child.lock().unwrap().kill();
            }
        }
    });
}

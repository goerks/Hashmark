// CodeMirror 6: Markdown/YAML, Speichern mit Ctrl+S, Bilder per Drag & Drop oder Einfügen.

import { EditorView, basicSetup } from 'codemirror'
import { EditorState, type Extension } from '@codemirror/state'
import { keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { yaml } from '@codemirror/lang-yaml'

export interface EditorHooks {
  onChange: (text: string) => void
  /** Cursorzeile (1-basiert) hat sich geändert */
  onCursor: (line: number) => void
  onSave: () => void
  /** Bilder wurden abgelegt/eingefügt; `pos` = Einfügeposition im Dokument */
  onImages: (files: File[], pos: number) => void
}

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: '15px' },
  '.cm-scroller': { fontFamily: 'var(--ed-font-code)', lineHeight: '1.6' },
  '.cm-content': { padding: '12px 0' },
  '.cm-gutters': { background: 'var(--ed-surface)', borderRight: '1px solid var(--ed-border)', color: 'var(--ed-muted)' },
  '.cm-activeLineGutter': { background: 'var(--ed-surface-2)' },
})

const images = (list: FileList | undefined | null) => [...(list ?? [])].filter((f) => f.type.startsWith('image/'))

export function createEditor(parent: HTMLElement, hooks: EditorHooks) {
  const extensions = (lang: 'markdown' | 'yaml'): Extension[] => [
    basicSetup,
    keymap.of([indentWithTab, { key: 'Mod-s', preventDefault: true, run: () => { hooks.onSave(); return true } }]),
    lang === 'yaml' ? yaml() : markdown(),
    EditorView.lineWrapping,
    theme,
    EditorView.updateListener.of((u) => {
      if (u.docChanged) hooks.onChange(u.state.doc.toString())
      if (u.selectionSet || u.docChanged) hooks.onCursor(u.state.doc.lineAt(u.state.selection.main.head).number)
    }),
    EditorView.domEventHandlers({
      drop(e, view) {
        const files = images(e.dataTransfer?.files)
        if (!files.length) return false
        e.preventDefault()
        hooks.onImages(files, view.posAtCoords({ x: e.clientX, y: e.clientY }) ?? view.state.selection.main.head)
        return true
      },
      paste(e, view) {
        const files = images(e.clipboardData?.files)
        if (!files.length) return false
        e.preventDefault()
        hooks.onImages(files, view.state.selection.main.head)
        return true
      },
    }),
  ]

  const view = new EditorView({ parent, state: EditorState.create({ doc: '', extensions: extensions('markdown') }) })

  const scrollTo = (line: number, select: boolean) => {
    const l = view.state.doc.line(Math.max(1, Math.min(line, view.state.doc.lines)))
    view.dispatch({
      ...(select ? { selection: { anchor: l.from } } : {}),
      effects: EditorView.scrollIntoView(l.from, { y: 'start', yMargin: 48 }),
    })
  }

  return {
    view,
    text: () => view.state.doc.toString(),
    /** Neue Datei laden (eigener Undo-Verlauf, keine Change-Events) */
    load(text: string, lang: 'markdown' | 'yaml') {
      view.setState(EditorState.create({ doc: text, extensions: extensions(lang) }))
    },
    /** Inhalt extern geändert: ersetzen, Cursor möglichst behalten */
    replace(text: string) {
      const head = Math.min(view.state.selection.main.head, text.length)
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection: { anchor: head } })
    },
    /** Text einfügen; `cursor` = Cursor-Offset innerhalb des eingefügten Texts */
    insert(text: string, pos = view.state.selection.main.head, cursor = text.length) {
      view.dispatch({ changes: { from: pos, insert: text }, selection: { anchor: pos + cursor }, scrollIntoView: true })
      view.focus()
    },
    append(text: string) {
      view.dispatch({ changes: { from: view.state.doc.length, insert: text } })
    },
    /** Cursor setzen und hinscrollen (löst onCursor aus) */
    gotoLine(line: number) {
      scrollTo(line, true)
      view.focus()
    },
    /** nur hinscrollen, Cursor bleibt (für „Editor folgt Vorschau“) */
    scrollToLine: (line: number) => scrollTo(line, false),
  }
}

export type Editor = ReturnType<typeof createEditor>

// CodeMirror 6: Markdown/YAML, Highlighting der Strata-Syntax, Vorschläge, Linter, Formatleiste,
// Speichern mit Ctrl+S, Bilder per Drag & Drop oder Einfügen.

import { EditorState, type Extension } from '@codemirror/state'
import {
  EditorView, drawSelection, dropCursor, highlightActiveLine, keymap,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentMore, indentWithTab, redo, undo } from '@codemirror/commands'
import { bracketMatching, indentOnInput, LanguageDescription } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { javascript } from '@codemirror/lang-javascript'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { yaml } from '@codemirror/lang-yaml'
import { expand } from '../../core/snippets.ts'
import { completion, formatBubble, formatKeymap, lint, link, relint, toggleHeading, wrap, type Problem } from './assist.ts'
import { strataSyntax } from './strata-lang.ts'

export interface EditorHooks {
  onChange: (text: string) => void
  /** Cursorzeile (1-basiert) hat sich geändert */
  onCursor: (line: number) => void
  onSave: () => void
  /** Bilder wurden abgelegt/eingefügt; `pos` = Einfügeposition im Dokument */
  onImages: (files: File[], pos: number) => void
  /** Ergebnis des Linters (nach jeder Änderung) */
  onProblems: (list: Problem[]) => void
  /** zusätzliche Layouts aus dem Theme des Decks */
  layouts: () => string[]
  /** Fokus hat sich geändert (für die Tastaturleiste) */
  onFocus: (focused: boolean) => void
}

const theme = EditorView.theme({
  '&': { height: '100%', fontSize: 'var(--ed-fs)', backgroundColor: 'var(--ed-bg)', color: 'var(--ed-fg)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--ed-font-code)', lineHeight: 'var(--ed-lh)', overflow: 'auto' },
  '.cm-content': { padding: '16px 0 40vh', caretColor: 'var(--ed-fg)' },
  '.cm-line': { padding: '0 var(--ed-pad-x)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ed-fg)', borderLeftWidth: '2px' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--ed-fg) 4.5%, transparent)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--ed-accent) 28%, transparent) !important',
  },
  '.cm-selectionMatch': { backgroundColor: 'color-mix(in srgb, var(--ed-accent) 16%, transparent)' },
  '.cm-matchingBracket': { backgroundColor: 'color-mix(in srgb, var(--ed-accent) 24%, transparent)', outline: 'none' },
  '.cm-gutters': { background: 'var(--ed-surface)', borderRight: '1px solid var(--ed-border)', color: 'var(--ed-muted)' },
})

const images = (list: FileList | undefined | null) => [...(list ?? [])].filter((f) => f.type.startsWith('image/'))

/** Code in ```-Blöcken des Markdown-Texts */
const codeLanguages = [
  LanguageDescription.of({ name: 'TypeScript', alias: ['ts', 'tsx', 'typescript'], load: async () => javascript({ typescript: true, jsx: true }) }),
  LanguageDescription.of({ name: 'JavaScript', alias: ['js', 'jsx', 'mjs', 'javascript', 'json'], load: async () => javascript({ jsx: true }) }),
  LanguageDescription.of({ name: 'CSS', alias: ['css'], load: async () => css() }),
  LanguageDescription.of({ name: 'HTML', alias: ['html'], load: async () => html() }),
  LanguageDescription.of({ name: 'YAML', alias: ['yaml', 'yml'], load: async () => yaml() }),
]

export function createEditor(parent: HTMLElement, hooks: EditorHooks) {
  const extensions = (lang: 'markdown' | 'yaml'): Extension[] => [
    history(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    highlightActiveLine(),
    highlightSelectionMatches(),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ autocorrect: 'off', 'aria-label': 'Quelltext' }),
    EditorState.languageData.of(() => [{ closeBrackets: { brackets: ['(', '[', '{', '`', '"'] } }]),
    lang === 'yaml' ? yaml() : [markdown({ base: markdownLanguage, codeLanguages }), strataSyntax, completion(hooks.layouts), lint(hooks.layouts, hooks.onProblems), formatBubble, formatKeymap],
    keymap.of([
      indentWithTab,
      { key: 'Mod-s', preventDefault: true, run: () => { hooks.onSave(); return true } },
      ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...completionKeymap,
    ]),
    theme,
    EditorView.updateListener.of((u) => {
      if (u.docChanged) hooks.onChange(u.state.doc.toString())
      if (u.selectionSet || u.docChanged) hooks.onCursor(u.state.doc.lineAt(u.state.selection.main.head).number)
      if (u.focusChanged) hooks.onFocus(u.view.hasFocus)
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
    /** Baustein mit `§` als Cursormarke; steht auf einer eigenen Zeile (leere Zeile wird ersetzt, sonst hinter die Zeile) */
    insertSnippet(raw: string) {
      const { text, cursor, select } = expand(raw)
      const lead = text.replace(/^\n+/, '')
      const offset = Math.max(0, cursor - (text.length - lead.length))
      const doc = view.state.doc
      const line = doc.lineAt(view.state.selection.main.head)
      const empty = line.text.trim() === ''
      const prevBlank = line.number === 1 || doc.line(line.number - 1).text.trim() === ''
      const pre = empty ? (prevBlank ? '' : '\n') : '\n\n'
      const from = empty ? line.from : line.to
      view.dispatch({
        changes: { from, to: line.to, insert: pre + lead },
        selection: { anchor: from + pre.length + offset, head: from + pre.length + offset + select },
        scrollIntoView: true,
      })
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
    focus: () => view.focus(),
    hasFocus: () => view.hasFocus,
    /** Tastaturleiste */
    typeText(text: string, cursor = text.length) {
      const r = view.state.selection.main
      view.dispatch({ changes: { from: r.from, to: r.to, insert: text }, selection: { anchor: r.from + cursor }, userEvent: 'input', scrollIntoView: true })
      view.focus()
    },
    tab: () => { indentMore(view); view.focus() },
    wrap: (open: string, close?: string) => wrap(view, open, close),
    link: () => link(view),
    heading: () => toggleHeading(view),
    undo: () => { view.focus(); return undo(view) },
    redo: () => { view.focus(); return redo(view) },
    /** Linter neu anstoßen (z. B. nachdem das Theme geladen wurde) */
    relint: () => relint(view),
    /** Schnellkorrektur; nur wenn an der Stelle noch das steht, was der Linter meinte */
    fix(p: Problem, found: string) {
      if (p.fix === undefined || view.state.sliceDoc(p.from, p.to) !== found) return false
      view.dispatch({ changes: { from: p.from, to: p.to, insert: p.fix } })
      return true
    },
    goto(pos: number) {
      view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: 'center' }) })
      view.focus()
    },
  }
}

export type Editor = ReturnType<typeof createEditor>

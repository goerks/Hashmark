import { mount } from 'svelte'
import './editor.css'
import Editor from './Editor.svelte'

mount(Editor, { target: document.getElementById('editor')! })

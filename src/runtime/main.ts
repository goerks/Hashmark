import { mount } from 'svelte'
import './base.css'
import 'virtual:strata/theme.css'
import App from './App.svelte'

mount(App, { target: document.getElementById('app')! })

/// <reference types="vite/client" />

declare module 'virtual:hashmark/deck' {
  import type { Deck } from '../core/types.ts'
  const payload: { deck: Deck } | { error: string }
  export default payload
}
declare module 'virtual:hashmark/theme.css'

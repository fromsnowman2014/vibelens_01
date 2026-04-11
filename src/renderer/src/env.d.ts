/// <reference types="vite/client" />

import type { VibeLensAPI } from '../../preload'

declare global {
  interface Window {
    vibelens: VibeLensAPI
  }
}

export {}

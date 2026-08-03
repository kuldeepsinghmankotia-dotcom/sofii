import type { SofiiElectronAPI } from './api'

declare global {
  interface Window {
    electron: SofiiElectronAPI
  }
}

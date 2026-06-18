import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  /** User's selected mode (persisted) */
  mode: ThemeMode
  /** Effective dark state — true if currently rendering in dark */
  dark: boolean
  setMode: (mode: ThemeMode) => void
  /** Legacy: switches between light and dark explicitly */
  toggle: () => void
}

const STORAGE_KEY = 'visor360-theme-mode'
const LEGACY_KEY = 'visor360-theme'

const getSystemDark = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

const getStoredMode = (): ThemeMode => {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  // Migrate from legacy boolean key
  const legacy = localStorage.getItem(LEGACY_KEY)
  if (legacy === 'dark') return 'dark'
  if (legacy === 'light') return 'light'
  // Default: tema escuro (identidade CCI) pra quem nunca escolheu.
  return 'dark'
}

const computeDark = (mode: ThemeMode): boolean => {
  if (mode === 'system') return getSystemDark()
  return mode === 'dark'
}

const applyDark = (dark: boolean) => {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', dark)
  }
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const mode = getStoredMode()
  const dark = computeDark(mode)
  applyDark(dark)

  // React to system preference changes when mode === 'system'
  if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (get().mode === 'system') {
        applyDark(e.matches)
        set({ dark: e.matches })
      }
    })
  }

  return {
    mode,
    dark,
    setMode: (mode) =>
      set(() => {
        localStorage.setItem(STORAGE_KEY, mode)
        const dark = computeDark(mode)
        applyDark(dark)
        return { mode, dark }
      }),
    toggle: () =>
      set((state) => {
        const next = !state.dark
        const mode: ThemeMode = next ? 'dark' : 'light'
        localStorage.setItem(STORAGE_KEY, mode)
        applyDark(next)
        return { mode, dark: next }
      }),
  }
})

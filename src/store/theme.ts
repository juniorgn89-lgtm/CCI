import { create } from 'zustand'

interface ThemeState {
  dark: boolean
  toggle: () => void
}

const getInitialTheme = (): boolean => {
  if (typeof window === 'undefined') return false
  const stored = localStorage.getItem('ccisga-theme')
  if (stored) return stored === 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export const useThemeStore = create<ThemeState>((set) => {
  const dark = getInitialTheme()
  if (dark) document.documentElement.classList.add('dark')

  return {
    dark,
    toggle: () =>
      set((state) => {
        const next = !state.dark
        document.documentElement.classList.toggle('dark', next)
        localStorage.setItem('ccisga-theme', next ? 'dark' : 'light')
        return { dark: next }
      }),
  }
})

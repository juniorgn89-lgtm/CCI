import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/** Bottom-nav padrão (paths): Central · Vendas · Caixas · Inteligência. */
export const DEFAULT_BAR = ['/dashboard', '/comercial/vendas', '/caixas-turnos', '/inteligencia']

interface MobileBarState {
  /** Até 4 paths fixados na bottom-nav. */
  bar: string[]
  /** Define a barra (limita a 4). */
  setBar: (paths: string[]) => void
  /** Liga/desliga um módulo na barra (respeitando o teto de 4). */
  toggle: (path: string) => void
  /** Restaura o padrão. */
  reset: () => void
}

export const useMobileBar = create<MobileBarState>()(
  persist(
    (set, get) => ({
      bar: DEFAULT_BAR,
      setBar: (paths) => set({ bar: paths.slice(0, 4) }),
      toggle: (path) => {
        const bar = get().bar
        if (bar.includes(path)) set({ bar: bar.filter((p) => p !== path) })
        else if (bar.length < 4) set({ bar: [...bar, path] })
      },
      reset: () => set({ bar: DEFAULT_BAR }),
    }),
    {
      name: 'visor360.bar',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

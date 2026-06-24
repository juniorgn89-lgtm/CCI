import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/** Bottom-nav padrão (paths): Central · Bombas · Caixas · Inteligência.
 *  (Vendas saiu — virou abas da Central.) */
export const DEFAULT_BAR = ['/dashboard', '/bombas', '/caixas-turnos', '/inteligencia']

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
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // v1: /comercial/vendas saiu (virou abas da Central). Remove o path morto
      // das barras já persistidas; se esvaziar, volta ao padrão.
      migrate: (persisted) => {
        const state = persisted as MobileBarState | undefined
        const bar = (state?.bar ?? DEFAULT_BAR).filter((p) => p !== '/comercial/vendas')
        return { ...(state ?? {}), bar: bar.length > 0 ? bar : DEFAULT_BAR } as MobileBarState
      },
    },
  ),
)

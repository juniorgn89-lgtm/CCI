import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/**
 * Flag global do módulo Comercial. Estado ÚNICO compartilhado por todas as abas
 * (Oportunidades, Projeção de LB, Margem por posto, Concorrência) — ligou numa,
 * reflete em todas. NÃO são 4 toggles independentes.
 *
 * `usarPrecoPraca`: quando ligado, as análises da rede usam o preço de PRAÇA
 * (concorrência, dado manual da aba 4) como referência em vez da média interna
 * da rede. Default OFF — a praça depende de cadastro manual que pode estar vazio.
 */
interface ComercialFlagsState {
  usarPrecoPraca: boolean
  setUsarPrecoPraca: (v: boolean) => void
  toggleUsarPrecoPraca: () => void
}

export const useComercialFlags = create<ComercialFlagsState>()(
  persist(
    (set) => ({
      usarPrecoPraca: false,
      setUsarPrecoPraca: (usarPrecoPraca) => set({ usarPrecoPraca }),
      toggleUsarPrecoPraca: () => set((s) => ({ usarPrecoPraca: !s.usarPrecoPraca })),
    }),
    {
      name: 'visor360-comercial-flags',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)

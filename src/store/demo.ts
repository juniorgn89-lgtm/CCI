import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface DemoState {
  ativo: boolean
  set: (v: boolean) => void
  toggle: () => void
}

/**
 * Modo Demonstração: mascara o nome da rede e dos postos (e CNPJ/endereço) no
 * app inteiro, pra apresentar o sistema a um prospect com dados reais sem expor
 * QUAL cliente é. Só quem tem `profiles.pode_demonstrar` (ou master) vê o botão.
 *
 * Persiste em sessionStorage de propósito: um F5 no meio da demo NÃO vaza os
 * nomes reais; fechar a aba encerra a demo sozinho.
 */
export const useDemoStore = create<DemoState>()(
  persist(
    (set) => ({
      ativo: false,
      set: (ativo) => set({ ativo }),
      toggle: () => set((s) => ({ ativo: !s.ativo })),
    }),
    { name: 'visor360-demo', storage: createJSONStorage(() => sessionStorage) },
  ),
)

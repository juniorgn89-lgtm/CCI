import { create } from 'zustand'

interface FocusModeState {
  active: boolean
  toggle: () => void
  set: (v: boolean) => void
}

/**
 * Modo Foco: esconde a sidebar pra dar largura máxima ao conteúdo da página
 * (filtros + dados). Pensado pra leitura/análise. Pode ser ativado por página
 * via um botão no header da página e desativado via ESC ou o mesmo botão.
 */
export const useFocusMode = create<FocusModeState>((set) => ({
  active: false,
  toggle: () => set((s) => ({ active: !s.active })),
  set: (v) => set({ active: v }),
}))

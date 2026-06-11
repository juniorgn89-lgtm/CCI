import { create } from 'zustand'

/**
 * Estado de UI da TopBar compartilhado entre os filtros e o layout:
 *  - `filterDirty`: há alteração de período NÃO aplicada (Visualizar disponível).
 *    O AppLayout embaça o conteúdo e dá ênfase no botão Visualizar.
 *  - `liveLock`: a tela atual é "ao vivo" (ex.: aba Ao Vivo Rede), onde os
 *    filtros de período/escopo/comparativo não fazem sentido → ficam desabilitados.
 */
interface TopbarUiState {
  filterDirty: boolean
  liveLock: boolean
  setFilterDirty: (v: boolean) => void
  setLiveLock: (v: boolean) => void
}

export const useTopbarUi = create<TopbarUiState>((set) => ({
  filterDirty: false,
  liveLock: false,
  setFilterDirty: (filterDirty) => set({ filterDirty }),
  setLiveLock: (liveLock) => set({ liveLock }),
}))

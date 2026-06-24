import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type ComparisonMode = 'prevMonth' | 'prevYear'

/**
 * Critério de data dos abastecimentos na Produtividade — espelha o filtro
 * Abast./Fiscal/Movimento do relatório de Abastecimento do webPosto:
 *  - ABAST: data/hora do abastecimento (quando o frentista de fato abasteceu)
 *  - FISCAL: data fiscal (turno/caixa fiscalizado) — é o que a apuração usa
 *  - MOVIMENTO: data de movimento do caixa
 * Default FISCAL → consistente com apuração/Central/Dashboard e usa o cache.
 */
export type AbastDateMode = 'ABAST' | 'FISCAL' | 'MOVIMENTO'

interface FilterState {
  empresaCodigos: number[]
  dataInicial: string
  dataFinal: string
  /**
   * Modo de comparação dos KPIs: contra o mês anterior ou contra o mesmo
   * período do ano anterior. Default 'prevYear' mantém comportamento legado
   * da Central da Rede ("vs ano anterior"). Persistido pra que o usuário
   * mantenha sua preferência entre sessões.
   */
  comparisonMode: ComparisonMode
  /** Critério de data dos abastecimentos (Produtividade). Ver AbastDateMode. */
  abastDateMode: AbastDateMode
  setEmpresas: (codigos: number[]) => void
  setPeriodo: (dataInicial: string, dataFinal: string) => void
  setComparisonMode: (mode: ComparisonMode) => void
  setAbastDateMode: (mode: AbastDateMode) => void
}

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * Período padrão = "apurado": 1º do mês corrente → ONTEM (só dias já fechados,
 * dado confiável que bate no cache). É recalculado a CADA abertura do sistema —
 * as datas não são persistidas (ver `partialize`/`merge`) — então o usuário
 * sempre cai no apurado até ontem ao abrir.
 *
 * O "completo" (incluir o dia corrente, que ainda está sincronizando no posto)
 * deixou de ser um botão: passa a ser implícito, acontecendo quando o usuário
 * move a data final para HOJE ou adiante no seletor de período.
 */
const defaultPeriodo = (): { dataInicial: string; dataFinal: string } => {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const firstDay = `${y}-${pad(m + 1)}-01`
  // Dia 1: ainda não há dia apurado no mês → o range degenera no próprio 1º.
  const dataFinal = now.getDate() <= 1 ? firstDay : fmt(new Date(y, m, now.getDate() - 1))
  return { dataInicial: firstDay, dataFinal }
}

export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      empresaCodigos: [],
      ...defaultPeriodo(),
      comparisonMode: 'prevYear',
      abastDateMode: 'FISCAL',

      setEmpresas: (codigos) => {
        set({ empresaCodigos: codigos })
      },

      setPeriodo: (dataInicial, dataFinal) => {
        set({ dataInicial, dataFinal })
      },

      setComparisonMode: (comparisonMode) => {
        set({ comparisonMode })
      },

      setAbastDateMode: (abastDateMode) => {
        set({ abastDateMode })
      },
    }),
    {
      name: 'visor360-filters',
      storage: createJSONStorage(() => localStorage),
      // As datas ficam FORA da persistência: cada abertura do sistema recomeça
      // no "apurado até ontem". Só posto/comparativo/critério-de-data persistem.
      partialize: (s) => ({
        empresaCodigos: s.empresaCodigos,
        comparisonMode: s.comparisonMode,
        abastDateMode: s.abastDateMode,
      }),
      // Mesmo que um storage legado ainda guarde datas, força o apurado no boot.
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as Partial<FilterState>),
        ...defaultPeriodo(),
      }),
    },
  ),
)

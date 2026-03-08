import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaResumo, fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchAbastecimentos, fetchLmc } from '@/api/endpoints/combustiveis'
import { fetchProdutoEstoque, fetchEstoquePeriodo } from '@/api/endpoints/estoques'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'

/**
 * Prefetches data for ALL modules when empresaCodigo or period changes.
 * This way, when the user navigates to another module, it's already loaded.
 */
const useModulePrefetch = () => {
  const queryClient = useQueryClient()
  const { empresaCodigo, dataInicial, dataFinal } = useFilterStore()

  useEffect(() => {
    if (!empresaCodigo) return

    // Helper: 3 months before a date (for LMC lookback)
    const threeMonthsBefore = (dateStr: string): string => {
      const d = new Date(dateStr)
      d.setMonth(d.getMonth() - 3)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    const lmcDataInicial = threeMonthsBefore(dataInicial)

    // --- Dashboard: VENDA_RESUMO ---
    queryClient.prefetchQuery({
      queryKey: ['vendaResumo', empresaCodigo, dataInicial, dataFinal],
      queryFn: () =>
        fetchVendaResumo({
          empresaCodigo: [empresaCodigo],
          dataInicial,
          dataFinal,
        }),
    })

    // --- Combustíveis + Dashboard: ABASTECIMENTO ---
    queryClient.prefetchQuery({
      queryKey: ['abastecimentos', dataInicial, dataFinal],
      queryFn: () =>
        fetchAllPages(
          (p) => fetchAbastecimentos({ dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
          1000, 50
        ),
    })

    // --- Combustíveis + Dashboard: LMC ---
    queryClient.prefetchQuery({
      queryKey: ['lmc', lmcDataInicial, dataFinal],
      queryFn: () =>
        fetchAllPages(
          (p) => fetchLmc({
            empresaCodigo: [empresaCodigo],
            dataInicial: lmcDataInicial, dataFinal,
            ultimoCodigo: p.ultimoCodigo, limite: p.limite,
          }),
          1000, 50
        ),
    })

    // --- Produtos: VENDA_ITEM ---
    queryClient.prefetchQuery({
      queryKey: ['vendaItens', empresaCodigo, dataInicial, dataFinal],
      queryFn: () =>
        fetchVendaItens({
          empresaCodigo,
          dataInicial,
          dataFinal,
          usaProdutoLmc: false,
        }),
    })

    // --- Estoques: PRODUTO_ESTOQUE ---
    queryClient.prefetchQuery({
      queryKey: ['produtoEstoque', empresaCodigo],
      queryFn: () => fetchProdutoEstoque({ empresaCodigo }),
    })

    // --- Estoques: ESTOQUE_PERIODO ---
    queryClient.prefetchQuery({
      queryKey: ['estoquePeriodo', empresaCodigo, dataFinal],
      queryFn: () => fetchEstoquePeriodo({ dataFinal, empresaCodigo }),
    })
  }, [queryClient, empresaCodigo, dataInicial, dataFinal])
}

export default useModulePrefetch

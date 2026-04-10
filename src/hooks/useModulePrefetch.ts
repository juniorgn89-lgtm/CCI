import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaResumo, fetchVendaItens, fetchVendaFormasPagamento } from '@/api/endpoints/vendas'
import { fetchAbastecimentos, fetchLmc, fetchBombas, fetchBicos } from '@/api/endpoints/combustiveis'
import { fetchProdutoEstoque, fetchEstoquePeriodo } from '@/api/endpoints/estoques'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchFuncionarios, fetchPlacares } from '@/api/endpoints/funcionarios'
import { fetchTitulosReceber, fetchTitulosPagar, fetchMovimentosConta, fetchDre, fetchCaixas } from '@/api/endpoints/financeiro'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'

/**
 * Prefetches data for ALL modules when empresaCodigos or period changes.
 * This way, when the user navigates to another module, it's already loaded.
 */
const useModulePrefetch = () => {
  const queryClient = useQueryClient()
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()

  const empresaCodigo = empresaCodigos[0] ?? null

  useEffect(() => {
    if (!empresaCodigo) return

    // Helper: previous month range
    const getPrevMonth = (dateStr: string) => {
      const d = new Date(dateStr)
      d.setMonth(d.getMonth() - 1)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const last = new Date(y, d.getMonth() + 1, 0).getDate()
      return { dataInicial: `${y}-${m}-01`, dataFinal: `${y}-${m}-${String(last).padStart(2, '0')}` }
    }

    // Helper: previous year same period
    const getPrevYear = (di: string, df: string) => {
      const d1 = new Date(di)
      const d2 = new Date(df)
      d1.setFullYear(d1.getFullYear() - 1)
      d2.setFullYear(d2.getFullYear() - 1)
      const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return { dataInicial: fmt(d1), dataFinal: fmt(d2) }
    }

    // Helper: 3 months before
    const threeMonthsBefore = (dateStr: string): string => {
      const d = new Date(dateStr)
      d.setMonth(d.getMonth() - 3)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    // Helper: 12 months before
    const twelveMonthsBefore = (dateStr: string): string => {
      const d = new Date(dateStr)
      d.setMonth(d.getMonth() - 12)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    }

    // Helper: 6 months before
    const sixMonthsBefore = (dateStr: string): string => {
      const d = new Date(dateStr)
      d.setMonth(d.getMonth() - 6)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    const prevMonth = getPrevMonth(dataInicial)
    const prevYear = getPrevYear(dataInicial, dataFinal)
    const lmcDataInicial = threeMonthsBefore(dataInicial)
    const evolution12m = twelveMonthsBefore(dataInicial)
    const sixM = sixMonthsBefore(dataFinal)

    // ─── Dashboard ───
    queryClient.prefetchQuery({
      queryKey: ['vendaResumo', empresaCodigos, dataInicial, dataFinal],
      queryFn: () => fetchVendaResumo({ empresaCodigo: empresaCodigos, dataInicial, dataFinal }),
    })
    queryClient.prefetchQuery({
      queryKey: ['vendaResumoPrevMonth', empresaCodigos, prevMonth.dataInicial, prevMonth.dataFinal],
      queryFn: () => fetchVendaResumo({ empresaCodigo: empresaCodigos, dataInicial: prevMonth.dataInicial, dataFinal: prevMonth.dataFinal }),
    })
    queryClient.prefetchQuery({
      queryKey: ['vendaResumoPrevYear', empresaCodigos, prevYear.dataInicial, prevYear.dataFinal],
      queryFn: () => fetchVendaResumo({ empresaCodigo: empresaCodigos, dataInicial: prevYear.dataInicial, dataFinal: prevYear.dataFinal }),
    })

    // ─── Combustíveis + Dashboard: Abastecimentos ───
    queryClient.prefetchQuery({
      queryKey: ['abastecimentos', dataInicial, dataFinal],
      queryFn: () => fetchAllPages((p) => fetchAbastecimentos({ dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    })
    queryClient.prefetchQuery({
      queryKey: ['abastecimentos', prevMonth.dataInicial, prevMonth.dataFinal],
      queryFn: () => fetchAllPages((p) => fetchAbastecimentos({ dataInicial: prevMonth.dataInicial, dataFinal: prevMonth.dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    })
    queryClient.prefetchQuery({
      queryKey: ['abastecimentos', prevYear.dataInicial, prevYear.dataFinal],
      queryFn: () => fetchAllPages((p) => fetchAbastecimentos({ dataInicial: prevYear.dataInicial, dataFinal: prevYear.dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    })
    queryClient.prefetchQuery({
      queryKey: ['abastecimentos', evolution12m, dataFinal],
      queryFn: () => fetchAllPages((p) => fetchAbastecimentos({ dataInicial: evolution12m, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    })

    // ─── Operação: abastecimentosAll (same data, different key) ───
    queryClient.prefetchQuery({
      queryKey: ['abastecimentosAll', dataInicial, dataFinal],
      queryFn: () => fetchAllPages((p) => fetchAbastecimentos({ dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    })

    // ─── LMC ───
    queryClient.prefetchQuery({
      queryKey: ['lmc', lmcDataInicial, dataFinal],
      queryFn: () => fetchAllPages((p) => fetchLmc({ empresaCodigo: empresaCodigos, dataInicial: lmcDataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    })

    // ─── Produtos / Conveniências: vendaItens ───
    queryClient.prefetchQuery({
      queryKey: ['vendaItens', empresaCodigo, dataInicial, dataFinal],
      queryFn: () => fetchVendaItens({ empresaCodigo, dataInicial, dataFinal, usaProdutoLmc: false }),
    })
    queryClient.prefetchQuery({
      queryKey: ['vendaItens', empresaCodigo, prevMonth.dataInicial, prevMonth.dataFinal],
      queryFn: () => fetchVendaItens({ empresaCodigo, dataInicial: prevMonth.dataInicial, dataFinal: prevMonth.dataFinal, usaProdutoLmc: false }),
    })

    // ─── Conveniências: vendaItensAll (paginated) ───
    queryClient.prefetchQuery({
      queryKey: ['vendaItensAll', empresaCodigo, dataInicial, dataFinal],
      queryFn: () => fetchAllPages((p) => fetchVendaItens({ empresaCodigo, dataInicial, dataFinal, usaProdutoLmc: false, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    })
    queryClient.prefetchQuery({
      queryKey: ['vendaItensAll', empresaCodigo, prevMonth.dataInicial, prevMonth.dataFinal],
      queryFn: () => fetchAllPages((p) => fetchVendaItens({ empresaCodigo, dataInicial: prevMonth.dataInicial, dataFinal: prevMonth.dataFinal, usaProdutoLmc: false, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    })

    // ─── Dashboard: vendaItensNonFuel ───
    queryClient.prefetchQuery({
      queryKey: ['vendaItensNonFuel', empresaCodigo, dataInicial, dataFinal],
      queryFn: () => fetchAllPages((p) => fetchVendaItens({ empresaCodigo, usaProdutoLmc: false, dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 20),
    })

    // ─── produtos-all (used by Operação, Conveniências, Produtos) ───
    queryClient.prefetchQuery({
      queryKey: ['produtos-all'],
      queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    })

    // ─── Estoques ───
    queryClient.prefetchQuery({
      queryKey: ['produtoEstoque', empresaCodigo],
      queryFn: () => fetchProdutoEstoque({ empresaCodigo }),
    })
    queryClient.prefetchQuery({
      queryKey: ['estoquePeriodo', empresaCodigo, dataFinal],
      queryFn: () => fetchEstoquePeriodo({ dataFinal, empresaCodigo }),
    })
    queryClient.prefetchQuery({
      queryKey: ['produtoEstoqueAll', empresaCodigo],
      queryFn: () => fetchAllPages((p) => fetchProdutoEstoque({ empresaCodigo: empresaCodigo!, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 20),
    })
    queryClient.prefetchQuery({
      queryKey: ['estoquePeriodoAll', empresaCodigo, dataFinal],
      queryFn: () => fetchAllPages((p) => fetchEstoquePeriodo({ dataFinal, empresaCodigo: empresaCodigo ?? undefined, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 20),
    })
    queryClient.prefetchQuery({
      queryKey: ['vendaItens6m', empresaCodigo, sixM, dataFinal],
      queryFn: () => fetchAllPages((p) => fetchVendaItens({ empresaCodigo: empresaCodigo!, dataInicial: sixM, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 20),
    })

    // ─── Operação: empresa-specific refs ───
    queryClient.prefetchQuery({
      queryKey: ['funcionarios', empresaCodigo],
      queryFn: () => fetchFuncionarios({ empresaCodigo: empresaCodigo!, limite: 1000 }),
    })
    queryClient.prefetchQuery({
      queryKey: ['bombas', empresaCodigo],
      queryFn: () => fetchBombas({ empresaCodigo: empresaCodigo! }),
    })
    queryClient.prefetchQuery({
      queryKey: ['bicos', empresaCodigo],
      queryFn: () => fetchBicos({ empresaCodigo: empresaCodigo!, limite: 1000 }),
    })
    queryClient.prefetchQuery({
      queryKey: ['caixas', empresaCodigo, dataInicial, dataFinal],
      queryFn: () => fetchCaixas({ empresaCodigo: empresaCodigo!, dataInicial, dataFinal, limite: 1000 }),
    })
    queryClient.prefetchQuery({
      queryKey: ['vendaFormasPgto', empresaCodigo, dataInicial, dataFinal],
      queryFn: () => fetchVendaFormasPagamento({ empresaCodigo: empresaCodigo!, dataInicial, dataFinal, limite: 1000 }),
    })
    queryClient.prefetchQuery({
      queryKey: ['placares', empresaCodigo, dataInicial, dataFinal],
      queryFn: () => fetchPlacares({ empresaCodigo: empresaCodigo ?? undefined, dataInicial, dataFinal }),
    })

    // ─── Financeiro ───
    queryClient.prefetchQuery({
      queryKey: ['titulosReceber', empresaCodigo, dataInicial, dataFinal],
      queryFn: () => fetchTitulosReceber({ empresaCodigo: empresaCodigo ?? undefined, dataInicial, dataFinal }),
    })
    queryClient.prefetchQuery({
      queryKey: ['titulosPagar', empresaCodigo, dataInicial, dataFinal],
      queryFn: () => fetchTitulosPagar({ empresaCodigo: empresaCodigo ?? undefined, dataInicial, dataFinal }),
    })
    queryClient.prefetchQuery({
      queryKey: ['movimentosConta', empresaCodigo, dataInicial, dataFinal],
      queryFn: () => fetchMovimentosConta({ empresaCodigo: empresaCodigo ?? undefined, dataInicial, dataFinal }),
    })
    queryClient.prefetchQuery({
      queryKey: ['dre', empresaCodigo, dataInicial, dataFinal],
      queryFn: () => fetchDre({ dataInicial, dataFinal, filiais: empresaCodigos.length > 0 ? empresaCodigos : undefined }),
    })
  }, [queryClient, empresaCodigos, empresaCodigo, dataInicial, dataFinal])
}

export default useModulePrefetch

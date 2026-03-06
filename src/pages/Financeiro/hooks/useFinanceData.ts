import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchTitulosReceber, fetchTitulosPagar, fetchMovimentosConta, fetchDre } from '@/api/endpoints/financeiro'
import { formatCurrency } from '@/lib/formatters'

const useFinanceData = () => {
  const { empresaCodigo, dataInicial, dataFinal } = useFilterStore()

  const filterParams = {
    empresaCodigo: empresaCodigo ?? undefined,
    dataInicial,
    dataFinal,
  }

  const {
    data: receberResponse,
    isLoading: isLoadingReceber,
  } = useQuery({
    queryKey: ['titulosReceber', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchTitulosReceber(filterParams),
  })

  const {
    data: pagarResponse,
    isLoading: isLoadingPagar,
  } = useQuery({
    queryKey: ['titulosPagar', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchTitulosPagar(filterParams),
  })

  const {
    data: movimentosResponse,
    isLoading: isLoadingMovimentos,
  } = useQuery({
    queryKey: ['movimentosConta', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchMovimentosConta(filterParams),
  })

  const {
    data: dreData,
    isLoading: isLoadingDre,
  } = useQuery({
    queryKey: ['dre', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchDre({
      dataInicial,
      dataFinal,
      filiais: empresaCodigo ? [empresaCodigo] : undefined,
    }),
  })

  const titulosReceber = receberResponse?.resultados ?? []
  const titulosPagar = pagarResponse?.resultados ?? []
  const movimentos = movimentosResponse?.resultados ?? []

  const isLoading = isLoadingReceber || isLoadingPagar || isLoadingMovimentos || isLoadingDre

  const computed = useMemo(() => {
    const totalReceber = titulosReceber
      .filter((t) => t.pendente)
      .reduce((acc, t) => acc + t.valor, 0)

    const totalPagar = titulosPagar
      .filter((t) => t.situacao !== 'PAGO')
      .reduce((acc, t) => acc + t.valor - t.valorPago, 0)

    const saldoLiquido = totalReceber - totalPagar

    const hoje = new Date().toISOString().split('T')[0]
    const inadimplencia = titulosReceber
      .filter((t) => t.pendente && t.dataVencimento < hoje)
      .reduce((acc, t) => acc + t.valor, 0)

    const kpis = {
      totalReceber: { value: formatCurrency(totalReceber) },
      totalPagar: { value: formatCurrency(totalPagar) },
      saldoLiquido: { value: formatCurrency(saldoLiquido) },
      inadimplencia: { value: formatCurrency(inadimplencia) },
    }

    // Receivables table data
    const receivablesData = titulosReceber.map((t) => ({
      ...t,
      situacaoLabel: t.pendente ? 'Aberto' : 'Pago',
    }))

    // Payables table data
    const payablesData = titulosPagar.map((t) => ({
      ...t,
      situacaoLabel: t.situacao === 'PAGO' ? 'Pago' : t.situacao === 'CANCELADO' ? 'Cancelado' : 'Aberto',
    }))

    // Cash flow chart data - group movements by day
    const byDay = new Map<string, { entradas: number; saidas: number }>()
    for (const m of movimentos) {
      const day = m.dataMovimento.split('T')[0]
      const prev = byDay.get(day) ?? { entradas: 0, saidas: 0 }
      if (m.tipo === 'CREDITO' || m.valor > 0) {
        prev.entradas += Math.abs(m.valor)
      } else {
        prev.saidas += Math.abs(m.valor)
      }
      byDay.set(day, prev)
    }

    const cashFlowData = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, values]) => ({
        data,
        entradas: values.entradas,
        saidas: values.saidas,
        saldo: values.entradas - values.saidas,
      }))

    return { kpis, receivablesData, payablesData, cashFlowData, dreData }
  }, [titulosReceber, titulosPagar, movimentos, dreData])

  return {
    ...computed,
    isLoading,
  }
}

export default useFinanceData

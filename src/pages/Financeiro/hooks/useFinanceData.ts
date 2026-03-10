import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchTitulosReceber, fetchTitulosPagar, fetchMovimentosConta, fetchDre } from '@/api/endpoints/financeiro'

export interface FinanceKpiData {
  totalReceber: number
  totalPagar: number
  saldoLiquido: number
  inadimplencia: number
  inadimplenciaPercent: number
  totalVencidosReceber: number
  totalVencidosPagar: number
  countReceber: number
  countPagar: number
  countVencidosReceber: number
  countVencidosPagar: number
}

export interface ReceivableRow {
  codigo: number
  empresaCodigo: number
  tituloCodigo: number
  clienteCodigo: number
  nomeCliente: string
  cpfCnpjCliente: string
  dataMovimento: string
  dataVencimento: string
  valor: number
  pendente: boolean
  tipo: string
  documento: string
  situacaoLabel: string
  statusTag: 'vencido' | 'a-vencer' | 'pago'
  diasAtraso: number
  [key: string]: unknown
}

export interface PayableRow {
  codigo: number
  empresaCodigo: number
  tituloPagarCodigo: number
  fornecedorCodigo: number
  nomeFornecedor: string
  cpfCnpjFornecedor: string
  dataMovimento: string
  vencimento: string
  valor: number
  valorPago: number
  situacao: string
  tipo: string
  descricao: string
  parcela: number
  quantidadeParcelas: number
  situacaoLabel: string
  statusTag: 'vencido' | 'a-vencer' | 'pago' | 'cancelado'
  diasAtraso: number
  saldoRestante: number
  [key: string]: unknown
}

export interface CashFlowRow {
  data: string
  entradas: number
  saidas: number
  saldo: number
  saldoAcumulado: number
}

const useFinanceData = () => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0

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
    enabled: hasEmpresa,
  })

  const {
    data: pagarResponse,
    isLoading: isLoadingPagar,
  } = useQuery({
    queryKey: ['titulosPagar', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchTitulosPagar(filterParams),
    enabled: hasEmpresa,
  })

  const {
    data: movimentosResponse,
    isLoading: isLoadingMovimentos,
  } = useQuery({
    queryKey: ['movimentosConta', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchMovimentosConta(filterParams),
    enabled: hasEmpresa,
  })

  const {
    data: dreData,
    isLoading: isLoadingDre,
  } = useQuery({
    queryKey: ['dre', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchDre({
      dataInicial,
      dataFinal,
      filiais: empresaCodigos.length > 0 ? empresaCodigos : undefined,
    }),
    enabled: hasEmpresa,
  })

  const titulosReceber = receberResponse?.resultados ?? []
  const titulosPagar = pagarResponse?.resultados ?? []
  const movimentos = movimentosResponse?.resultados ?? []

  const isLoading = isLoadingReceber || isLoadingPagar || isLoadingMovimentos || isLoadingDre

  const computed = useMemo(() => {
    const hoje = new Date().toISOString().split('T')[0]

    // --- KPI computations ---
    const pendentesReceber = titulosReceber.filter((t) => t.pendente)
    const totalReceber = pendentesReceber.reduce((acc, t) => acc + t.valor, 0)

    const pendentesPagar = titulosPagar.filter((t) => t.situacao !== 'PAGO' && t.situacao !== 'CANCELADO')
    const totalPagar = pendentesPagar.reduce((acc, t) => acc + t.valor - t.valorPago, 0)

    const saldoLiquido = totalReceber - totalPagar

    const vencidosReceber = pendentesReceber.filter((t) => t.dataVencimento < hoje)
    const inadimplencia = vencidosReceber.reduce((acc, t) => acc + t.valor, 0)
    const inadimplenciaPercent = totalReceber > 0 ? (inadimplencia / totalReceber) * 100 : 0

    const vencidosPagar = pendentesPagar.filter((t) => t.vencimento < hoje)
    const totalVencidosPagar = vencidosPagar.reduce((acc, t) => acc + t.valor - t.valorPago, 0)

    const kpis: FinanceKpiData = {
      totalReceber,
      totalPagar,
      saldoLiquido,
      inadimplencia,
      inadimplenciaPercent,
      totalVencidosReceber: inadimplencia,
      totalVencidosPagar,
      countReceber: pendentesReceber.length,
      countPagar: pendentesPagar.length,
      countVencidosReceber: vencidosReceber.length,
      countVencidosPagar: vencidosPagar.length,
    }

    // --- Receivables table ---
    const receivablesData: ReceivableRow[] = titulosReceber.map((t) => {
      const isOverdue = t.pendente && t.dataVencimento < hoje
      const diasAtraso = isOverdue
        ? Math.floor((new Date(hoje).getTime() - new Date(t.dataVencimento).getTime()) / (1000 * 60 * 60 * 24))
        : 0

      let statusTag: ReceivableRow['statusTag'] = 'pago'
      if (t.pendente) {
        statusTag = isOverdue ? 'vencido' : 'a-vencer'
      }

      return {
        ...t,
        situacaoLabel: t.pendente ? (isOverdue ? 'Vencido' : 'A Vencer') : 'Pago',
        statusTag,
        diasAtraso,
      }
    })

    // --- Payables table ---
    const payablesData: PayableRow[] = titulosPagar.map((t) => {
      const isPending = t.situacao !== 'PAGO' && t.situacao !== 'CANCELADO'
      const isOverdue = isPending && t.vencimento < hoje
      const diasAtraso = isOverdue
        ? Math.floor((new Date(hoje).getTime() - new Date(t.vencimento).getTime()) / (1000 * 60 * 60 * 24))
        : 0

      let statusTag: PayableRow['statusTag'] = 'pago'
      if (t.situacao === 'CANCELADO') {
        statusTag = 'cancelado'
      } else if (isPending) {
        statusTag = isOverdue ? 'vencido' : 'a-vencer'
      }

      return {
        ...t,
        situacaoLabel: t.situacao === 'PAGO' ? 'Pago' : t.situacao === 'CANCELADO' ? 'Cancelado' : isOverdue ? 'Vencido' : 'A Vencer',
        statusTag,
        diasAtraso,
        saldoRestante: t.valor - t.valorPago,
      }
    })

    // --- Cash flow chart data ---
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

    let saldoAcumulado = 0
    const cashFlowData: CashFlowRow[] = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([data, values]) => {
        saldoAcumulado += values.entradas - values.saidas
        return {
          data,
          entradas: values.entradas,
          saidas: values.saidas,
          saldo: values.entradas - values.saidas,
          saldoAcumulado,
        }
      })

    return { kpis, receivablesData, payablesData, cashFlowData, dreData }
  }, [titulosReceber, titulosPagar, movimentos, dreData])

  return {
    ...computed,
    isLoading,
    hasEmpresa,
  }
}

export default useFinanceData

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchTitulosReceber, fetchTitulosPagar, fetchMovimentosConta } from '@/api/endpoints/financeiro'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { MovimentoConta } from '@/api/types/financeiro'

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

export interface CashFlowTotals {
  entradas: number
  saidas: number
  saldo: number
}

/**
 * Classifica um movimento de conta como entrada ou saída.
 *
 * A API Quality `/MOVIMENTO_CONTA` retorna o campo `tipo` em formato variável
 * (CREDITO/DEBITO, C/D, ou ENTRADA/SAIDA, dependendo do cliente). O `valor`
 * costuma vir sempre positivo, com o sinal lógico embutido em `tipo`.
 *
 * Estratégia (mais robusta que a versão anterior, que confiava em `valor > 0`
 * como fallback e classificava tudo como entrada):
 *   1. Olha a primeira letra de `tipo` (case-insensitive): C → crédito, D → débito.
 *   2. Se `tipo` for desconhecido, usa o sinal de `valor` como fallback.
 */
const classifyMovimento = (m: MovimentoConta): 'entrada' | 'saida' => {
  const tipo = (m.tipo ?? '').toUpperCase().trim()
  if (tipo.startsWith('C') || tipo === 'ENTRADA') return 'entrada'
  if (tipo.startsWith('D') || tipo === 'SAIDA' || tipo === 'SAÍDA') return 'saida'
  return m.valor >= 0 ? 'entrada' : 'saida'
}

/**
 * Subtrai N dias de uma data yyyy-MM-dd e devolve outra data yyyy-MM-dd.
 * Usado para calcular o período de comparação dos KPIs do fluxo de caixa.
 */
const offsetDateByDays = (dateStr: string, days: number): string => {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const daysBetween = (start: string, end: string): number => {
  const ms = new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1)
}

const sumMovimentos = (data: MovimentoConta[]): CashFlowTotals => {
  let entradas = 0
  let saidas = 0
  for (const m of data) {
    const cls = classifyMovimento(m)
    if (cls === 'entrada') entradas += Math.abs(m.valor)
    else saidas += Math.abs(m.valor)
  }
  return { entradas, saidas, saldo: entradas - saidas }
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

  // Período de comparação: mesmo número de dias do período atual, deslocado pra trás.
  const diasNoPeriodo = daysBetween(dataInicial, dataFinal)
  const prevDataFinal = offsetDateByDays(dataInicial, 1)
  const prevDataInicial = offsetDateByDays(prevDataFinal, diasNoPeriodo - 1)

  // Todas as queries paginadas via `fetchAllPages` — Quality API tem cap default
  // baixo (~100/1000); sem paginação postos com volume médio perdiam a maior
  // parte do período no fluxo de caixa (só os primeiros N movimentos voltavam).
  const {
    data: titulosReceber = [],
    isLoading: isLoadingReceber,
  } = useQuery({
    queryKey: ['titulosReceber', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchTitulosReceber({ ...filterParams, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
    enabled: hasEmpresa,
  })

  const {
    data: titulosPagar = [],
    isLoading: isLoadingPagar,
  } = useQuery({
    queryKey: ['titulosPagar', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchTitulosPagar({ ...filterParams, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
    enabled: hasEmpresa,
  })

  const {
    data: movimentos = [],
    isLoading: isLoadingMovimentos,
  } = useQuery({
    queryKey: ['movimentosConta', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchMovimentosConta({ ...filterParams, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
    enabled: hasEmpresa,
  })

  // Período anterior — só pros KPIs comparativos, paginado igual.
  const { data: movimentosPrev = [] } = useQuery({
    queryKey: ['movimentosConta', empresaCodigo, prevDataInicial, prevDataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchMovimentosConta({
        empresaCodigo: empresaCodigo ?? undefined,
        dataInicial: prevDataInicial,
        dataFinal: prevDataFinal,
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 20,
    ),
    enabled: hasEmpresa,
  })

  const isLoading = isLoadingReceber || isLoadingPagar || isLoadingMovimentos

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
      const cls = classifyMovimento(m)
      if (cls === 'entrada') prev.entradas += Math.abs(m.valor)
      else prev.saidas += Math.abs(m.valor)
      byDay.set(day, prev)
    }

    // Enumera TODOS os dias do período (dataInicial → dataFinal) e preenche
    // dias sem movimento com 0/0. Sem isso o chart só mostra dias que tiveram
    // transação, dando a impressão de período curto.
    const allDays: string[] = []
    if (dataInicial && dataFinal) {
      const addDays = (yyyymmdd: string, n: number): string => {
        const [y, m, d] = yyyymmdd.split('-').map(Number)
        const date = new Date(y, m - 1, d + n)
        const yy = date.getFullYear()
        const mm = String(date.getMonth() + 1).padStart(2, '0')
        const dd = String(date.getDate()).padStart(2, '0')
        return `${yy}-${mm}-${dd}`
      }
      let cursor = dataInicial
      // Safety cap: 3 anos pra evitar loop infinito em range malformado
      for (let i = 0; i < 1100 && cursor <= dataFinal; i++) {
        allDays.push(cursor)
        cursor = addDays(cursor, 1)
      }
    }

    // Reduce em vez de mutar `let saldoAcumulado` (regra de pureza).
    const cashFlowData: CashFlowRow[] = allDays.reduce<{ rows: CashFlowRow[]; acum: number }>(
      (acc, data) => {
        const values = byDay.get(data) ?? { entradas: 0, saidas: 0 }
        const acum = acc.acum + values.entradas - values.saidas
        acc.rows.push({
          data,
          entradas: values.entradas,
          saidas: values.saidas,
          saldo: values.entradas - values.saidas,
          saldoAcumulado: acum,
        })
        return { rows: acc.rows, acum }
      },
      { rows: [], acum: 0 },
    ).rows

    // --- Comparativo período anterior (totais do fluxo) ---
    const cashFlowTotals: CashFlowTotals = {
      entradas: cashFlowData.reduce((acc, r) => acc + r.entradas, 0),
      saidas: cashFlowData.reduce((acc, r) => acc + r.saidas, 0),
      saldo: 0,
    }
    cashFlowTotals.saldo = cashFlowTotals.entradas - cashFlowTotals.saidas

    const cashFlowPrevTotals = sumMovimentos(movimentosPrev)

    return {
      kpis,
      receivablesData,
      payablesData,
      cashFlowData,
      cashFlowTotals,
      cashFlowPrevTotals,
      cashFlowPrevPeriod: { dataInicial: prevDataInicial, dataFinal: prevDataFinal },
      diasNoPeriodo,
    }
  }, [titulosReceber, titulosPagar, movimentos, movimentosPrev, prevDataInicial, prevDataFinal, diasNoPeriodo])

  return {
    ...computed,
    isLoading,
    hasEmpresa,
  }
}

export default useFinanceData

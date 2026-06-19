import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendasFuncionarioCache } from '@/api/supabase/apuracao'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { offsetPeriod, todayLocal } from '@/lib/period'

export interface VendedorRow {
  funcionarioCodigo: number
  nome: string
  ativo: boolean
  faturamento: number
  custo: number
  lucroBruto: number
  margemPct: number
  /** Itens vendidos (Σ quantidade). */
  itens: number
  /** Cupons (vendaCodigo distinto por dia, somados). */
  cupons: number
  /** Ticket médio = faturamento ÷ cupons. */
  ticketMedio: number
}

export interface VendedoresData {
  rows: VendedorRow[]
  /** Mesmas linhas, mas do período de comparação (mês/ano anterior). */
  rowsPrev: VendedorRow[]
  totalFaturamento: number
  totalLucro: number
  totalCupons: number
  totalItens: number
  isLoading: boolean
  hasEmpresa: boolean
}

type CacheRow = Awaited<ReturnType<typeof fetchVendasFuncionarioCache>>[number]
type Meta = Map<number, { nome?: string; ativo?: boolean }>

/** Agrega o cache de venda por funcionário (setor conveniência) em VendedorRow[]. */
const aggregate = (cacheRows: CacheRow[], meta: Meta): VendedorRow[] => {
  const m = new Map<number, VendedorRow>()
  for (const r of cacheRows) {
    if (r.setor !== 'conveniencia') continue
    const f = meta.get(r.funcionario_codigo)
    const cur = m.get(r.funcionario_codigo) ?? {
      funcionarioCodigo: r.funcionario_codigo,
      nome: f?.nome ?? `Funcionário ${r.funcionario_codigo}`,
      ativo: f?.ativo ?? true,
      faturamento: 0, custo: 0, lucroBruto: 0, margemPct: 0, itens: 0, cupons: 0, ticketMedio: 0,
    }
    cur.faturamento += r.faturamento
    cur.custo += r.custo
    cur.itens += r.quantidade
    cur.cupons += r.cupons
    m.set(r.funcionario_codigo, cur)
  }
  return [...m.values()]
    .map((v) => ({
      ...v,
      lucroBruto: v.faturamento - v.custo,
      margemPct: v.faturamento > 0 ? ((v.faturamento - v.custo) / v.faturamento) * 100 : 0,
      ticketMedio: v.cupons > 0 ? v.faturamento / v.cupons : 0,
    }))
    .sort((a, b) => b.faturamento - a.faturamento)
}

/**
 * Produtividade dos VENDEDORES da conveniência — lê o cache
 * `apuracao_vendas_funcionario` (setor conveniência) e cruza com `/FUNCIONARIO`
 * pro nome. Mesmo período/postos do filtro global. Ticket médio = fat ÷ cupons
 *. Só vendas autorizadas (já filtrado na apuração).
 */
const useVendedoresConveniencia = (): VendedoresData => {
  const { empresaCodigos, dataInicial, dataFinal, comparisonMode } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0

  // Período de comparação (mês/ano ant.), com "mesmos dias decorridos".
  const cmpOffset = comparisonMode === 'prevYear' ? 12 : 1
  const fimEf = dataFinal && dataFinal > todayLocal() ? todayLocal() : dataFinal
  const prevInicial = dataInicial ? offsetPeriod(dataInicial, cmpOffset) : ''
  const prevFinal = fimEf ? offsetPeriod(fimEf, cmpOffset) : ''

  const { data: cacheRows = [], isLoading } = useQuery({
    queryKey: ['vendas-funcionario', empresaCodigos.join(','), dataInicial, dataFinal],
    queryFn: () => fetchVendasFuncionarioCache({ empresaCodigos, dataInicial, dataFinal }),
    enabled: hasEmpresa,
    staleTime: 5 * 60 * 1000,
  })

  const { data: cacheRowsPrev = [] } = useQuery({
    queryKey: ['vendas-funcionario', empresaCodigos.join(','), prevInicial, prevFinal],
    queryFn: () => fetchVendasFuncionarioCache({ empresaCodigos, dataInicial: prevInicial, dataFinal: prevFinal }),
    enabled: hasEmpresa && !!prevInicial && !!prevFinal,
    staleTime: 5 * 60 * 1000,
  })

  const { data: funcionarios = [] } = useQuery({
    queryKey: ['funcionarios-multi', empresaCodigos.join(',')],
    queryFn: async () => {
      const lists = await Promise.all(
        empresaCodigos.map((ec) => fetchFuncionarios({ empresaCodigo: ec, limite: 1000 })),
      )
      return lists.flatMap((l) => l.resultados)
    },
    enabled: hasEmpresa,
    staleTime: 10 * 60 * 1000,
  })

  return useMemo(() => {
    const meta: Meta = new Map(funcionarios.map((f) => [f.funcionarioCodigo, f]))
    const rows = aggregate(cacheRows, meta)
    const rowsPrev = aggregate(cacheRowsPrev, meta)

    return {
      rows,
      rowsPrev,
      totalFaturamento: rows.reduce((s, r) => s + r.faturamento, 0),
      totalLucro: rows.reduce((s, r) => s + r.lucroBruto, 0),
      totalCupons: rows.reduce((s, r) => s + r.cupons, 0),
      totalItens: rows.reduce((s, r) => s + r.itens, 0),
      isLoading,
      hasEmpresa,
    }
  }, [cacheRows, cacheRowsPrev, funcionarios, isLoading, hasEmpresa])
}

export default useVendedoresConveniencia

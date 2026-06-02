import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendasFuncionarioCache } from '@/api/supabase/apuracao'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'

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
  totalFaturamento: number
  totalLucro: number
  totalCupons: number
  totalItens: number
  isLoading: boolean
  hasEmpresa: boolean
}

/**
 * Produtividade dos VENDEDORES da conveniência — lê o cache
 * `apuracao_vendas_funcionario` (setor conveniência) e cruza com `/FUNCIONARIO`
 * pro nome. Mesmo período/postos do filtro global. Ticket médio = fat ÷ cupons
 * (igual ao BI). Só vendas autorizadas (já filtrado na apuração).
 */
const useVendedoresConveniencia = (): VendedoresData => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0

  const { data: cacheRows = [], isLoading } = useQuery({
    queryKey: ['vendas-funcionario', empresaCodigos.join(','), dataInicial, dataFinal],
    queryFn: () => fetchVendasFuncionarioCache({ empresaCodigos, dataInicial, dataFinal }),
    enabled: hasEmpresa,
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
    const meta = new Map(funcionarios.map((f) => [f.funcionarioCodigo, f]))
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
    const rows = [...m.values()]
      .map((v) => ({
        ...v,
        lucroBruto: v.faturamento - v.custo,
        margemPct: v.faturamento > 0 ? ((v.faturamento - v.custo) / v.faturamento) * 100 : 0,
        ticketMedio: v.cupons > 0 ? v.faturamento / v.cupons : 0,
      }))
      .sort((a, b) => b.faturamento - a.faturamento)

    return {
      rows,
      totalFaturamento: rows.reduce((s, r) => s + r.faturamento, 0),
      totalLucro: rows.reduce((s, r) => s + r.lucroBruto, 0),
      totalCupons: rows.reduce((s, r) => s + r.cupons, 0),
      totalItens: rows.reduce((s, r) => s + r.itens, 0),
      isLoading,
      hasEmpresa,
    }
  }, [cacheRows, funcionarios, isLoading, hasEmpresa])
}

export default useVendedoresConveniencia

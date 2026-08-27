import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchVendasFuncionarioCache } from '@/api/supabase/apuracao'
import { todayLocal } from '@/lib/period'

/**
 * Série de 12 meses por funcionário — faturamento mensal de um `setor` (default
 * 'automotivos', a Pista; 'conveniencia' pra Loja), do cache
 * `apuracao_vendas_funcionario`. Só depende de o cache estar apurado nos meses;
 * onde não estiver, o mês vem 0 (honesto). Buscado sob demanda, separado do hook
 * do período. A query é a MESMA pros dois setores (a busca traz todos os setores
 * do posto) — só o filtro no memo muda, então Pista e Loja compartilham o cache.
 */

export interface MesValor {
  /** yyyy-MM */
  ym: string
  /** rótulo curto (jan, fev, …) */
  label: string
  valor: number
}

const MES_LABEL = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const useAutomotivos12m = (
  postoCodigo?: number | null,
  setor: 'automotivos' | 'conveniencia' = 'automotivos',
): { byFunc: Map<number, MesValor[]>; isLoading: boolean } => {
  // Últimos 12 meses (mês corrente + 11 anteriores).
  const { ini, fim, meses } = useMemo(() => {
    const today = todayLocal()
    const [y, m] = today.split('-').map(Number)
    const ms: { ym: string; label: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1)
      ms.push({ ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MES_LABEL[d.getMonth()] })
    }
    return { ini: `${ms[0].ym}-01`, fim: today, meses: ms }
  }, [])

  const empresaCodigos = postoCodigo != null ? [postoCodigo] : []
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['vendas-funcionario-12m', empresaCodigos.join(','), ini, fim],
    queryFn: () => fetchVendasFuncionarioCache({ empresaCodigos, dataInicial: ini, dataFinal: fim }),
    enabled: empresaCodigos.length > 0,
    staleTime: 30 * 60 * 1000,
  })

  const byFunc = useMemo(() => {
    // funcionário → (yyyy-MM → faturamento) só do setor pedido.
    const acc = new Map<number, Map<string, number>>()
    for (const r of rows) {
      if (r.setor !== setor) continue
      const ym = (r.data ?? '').slice(0, 7)
      let m = acc.get(r.funcionario_codigo)
      if (!m) { m = new Map(); acc.set(r.funcionario_codigo, m) }
      m.set(ym, (m.get(ym) ?? 0) + r.faturamento)
    }
    const out = new Map<number, MesValor[]>()
    for (const [cod, m] of acc) {
      out.set(cod, meses.map((mm) => ({ ym: mm.ym, label: mm.label, valor: m.get(mm.ym) ?? 0 })))
    }
    return out
  }, [rows, meses, setor])

  return { byFunc, isLoading }
}

export default useAutomotivos12m

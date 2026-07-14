import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { useRedeVendasCache } from '@/pages/Operacao/hooks/useRedeVendasCache'
import { todayLocal } from '@/lib/period'
import { fimDoMesIso, weekdayIndices, diasOperacaoProxy, projecaoSazonal, type ProjecaoAvancadaResult } from '@/lib/projection'

/**
 * PILOTO da projeção SAZONAL (Fase 2 — só combustível, atrás de flag). Busca 6
 * meses de histórico diário do cache (rede-wide no escopo), calcula o índice de
 * dia-da-semana por métrica e devolve a projeção sazonal pra comparar com a
 * atual (projecaoAvancada). Rede-wide na v1; per-posto fica pro rollout.
 * Ver docs/SPEC-projecao-sazonal.md.
 */

export interface FuelDailyPoint { data: string; litros: number; faturamento: number; lucroBruto: number }

const ONE: Record<number, number> = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 }
const monthsBackFirst = (iso: string, n: number): string => {
  const [y, m] = iso.split('-').map(Number)
  const d = new Date(y, m - 1 - n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const prevDay = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d - 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export interface ProjecaoSazonalPiloto {
  isLoading: boolean
  /** dias_operação (proxy 1ª venda no cache) e ramo escolhido. */
  diasOperacao: number
  linear: boolean
  histDias: number
  indices: { faturamento: Record<number, number>; litros: Record<number, number>; lucro: Record<number, number> }
  sazonal: { faturamento: ProjecaoAvancadaResult; litros: ProjecaoAvancadaResult; lucro: ProjecaoAvancadaResult }
}

const useProjecaoSazonalPiloto = (dailyData: FuelDailyPoint[]): ProjecaoSazonalPiloto => {
  const { empresaCodigos, dataInicial } = useFilterStore()
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas(), staleTime: 10 * 60 * 1000 })
  const permitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const permittedCodes = useMemo(() => new Set(permitidas.map((e) => e.codigo)), [permitidas])

  const monthStart = `${(dataInicial || todayLocal()).slice(0, 7)}-01`
  const histIni = monthsBackFirst(monthStart, 6)
  const histEnd = prevDay(monthStart)
  const { data: histRows = [], isLoading } = useRedeVendasCache(histIni, histEnd)

  return useMemo(() => {
    const matchEmpresa = (code: number) => (empresaCodigos.length === 0 ? permittedCodes.has(code) : empresaCodigos.includes(code))
    const byDay = new Map<string, { fat: number; lit: number; luc: number }>()
    let firstData = ''
    for (const r of histRows) {
      if (r.setor !== 'combustivel' || !matchEmpresa(r.empresa_codigo) || r.quantidade <= 0) continue
      const e = byDay.get(r.data) ?? { fat: 0, lit: 0, luc: 0 }
      e.fat += r.total_venda; e.lit += r.quantidade; e.luc += r.total_venda - r.total_custo
      byDay.set(r.data, e)
      if (!firstData || r.data < firstData) firstData = r.data
    }
    const serie = (k: 'fat' | 'lit' | 'luc') =>
      [...byDay.entries()].map(([data, v]) => ({ data, value: v[k] })).sort((a, b) => a.data.localeCompare(b.data))
    const idxFat = weekdayIndices(serie('fat'))
    const idxLit = weekdayIndices(serie('lit'))
    const idxLuc = weekdayIndices(serie('luc'))

    const today = todayLocal()
    const diasOperacao = diasOperacaoProxy(firstData || null, today)
    const linear = diasOperacao < 90
    const monthEnd = fimDoMesIso(dataInicial || today)
    const proj = (key: 'faturamento' | 'litros' | 'lucroBruto', idx: Record<number, number>) =>
      projecaoSazonal({
        dailySeries: dailyData.map((d) => ({ data: d.data, value: d[key] })),
        today,
        dataFinal: monthEnd,
        indices: linear ? ONE : idx,
      })

    return {
      isLoading,
      diasOperacao,
      linear,
      histDias: byDay.size,
      indices: { faturamento: idxFat, litros: idxLit, lucro: idxLuc },
      sazonal: {
        faturamento: proj('faturamento', idxFat),
        litros: proj('litros', idxLit),
        lucro: proj('lucroBruto', idxLuc),
      },
    }
  }, [histRows, isLoading, empresaCodigos, permittedCodes, dailyData, dataInicial])
}

export default useProjecaoSazonalPiloto

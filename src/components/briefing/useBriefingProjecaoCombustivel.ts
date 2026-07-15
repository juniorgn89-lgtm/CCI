import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { useRedeVendasCache } from '@/pages/Operacao/hooks/useRedeVendasCache'
import { todayLocal } from '@/lib/period'
import useProjecaoSazonalPiloto, { type FuelDailyPoint } from '@/pages/Comercial/Vendas/useProjecaoSazonalPiloto'
import type { Confiabilidade } from '@/lib/projection'

/**
 * Projeção SAZONAL do combustível pro fim do MÊS CORRENTE, pro briefing. Monta a
 * série diária do mês (dia 1 → ontem, postos permitidos) do MESMO cache que a
 * Central e as abas usam (`apuracao_vendas` via `useRedeVendasCache`) — NÃO o
 * `apuracao_diaria`, cujo lucro/custo do combustível diverge. Reusa
 * `useProjecaoSazonalPiloto` (mesmo motor), read-only. "Heads-up" de fechamento.
 */

const pad = (n: number) => String(n).padStart(2, '0')
const isoMinusDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d - n)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

export interface BriefingProjecao {
  isLoading: boolean
  hasData: boolean
  litrosProj: number
  lucroProj: number
  /** Lucro bruto por litro projetado (R$/L). */
  rbLitro: number
  confiabilidade: Confiabilidade
  /** Litros do MÊS ANTERIOR completo (base do "vs mês ant."). */
  cmpAnterior: number
  cmpLabel: string
  diasRestantes: number
  /** Δ% projeção vs mês anterior completo. */
  deltaVsMesAnt: number | null
}

const useBriefingProjecaoCombustivel = (enabled: boolean): BriefingProjecao => {
  const hoje = todayLocal()
  const [y, m] = hoje.split('-').map(Number)
  const dia1 = `${y}-${pad(m)}-01`
  const ontem = isoMinusDays(hoje, 1)
  const fim = ontem >= dia1 ? ontem : dia1

  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000, enabled })
  const permitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const permittedCodes = useMemo(() => new Set(permitidas.map((e) => e.codigo)), [permitidas])

  // Mesma fonte da Central/abas (apuracao_vendas). Rede-wide; filtra permitidos.
  const { data: curRows = [], isLoading } = useRedeVendasCache(dia1, fim, { enabled })

  const dailyData = useMemo<FuelDailyPoint[]>(() => {
    const byDay = new Map<string, { litros: number; fat: number; luc: number }>()
    for (const r of curRows) {
      if (r.setor !== 'combustivel' || !permittedCodes.has(r.empresa_codigo) || r.quantidade <= 0) continue
      const e = byDay.get(r.data) ?? { litros: 0, fat: 0, luc: 0 }
      e.litros += r.quantidade; e.fat += r.total_venda; e.luc += r.total_venda - r.total_custo
      byDay.set(r.data, e)
    }
    return [...byDay.entries()]
      .map(([data, v]) => ({ data, litros: v.litros, faturamento: v.fat, lucroBruto: v.luc }))
      .sort((a, b) => a.data.localeCompare(b.data))
  }, [curRows, permittedCodes])

  const piloto = useProjecaoSazonalPiloto(dailyData, enabled, 'combustivel')

  return useMemo(() => {
    const litrosProj = piloto.sazonal.litros.esperado
    const lucroProj = piloto.sazonal.lucro.esperado
    const cmp = piloto.cmpAnterior.litros
    return {
      isLoading: isLoading || piloto.isLoading,
      hasData: dailyData.length > 0 && litrosProj > 0,
      litrosProj,
      lucroProj,
      rbLitro: litrosProj > 0 ? lucroProj / litrosProj : 0,
      confiabilidade: piloto.sazonal.litros.confiabilidade,
      cmpAnterior: cmp,
      cmpLabel: piloto.cmpLabel,
      diasRestantes: piloto.sazonal.litros.diasRestantes,
      deltaVsMesAnt: cmp > 0 ? ((litrosProj - cmp) / cmp) * 100 : null,
    }
  }, [piloto, isLoading, dailyData.length])
}

export default useBriefingProjecaoCombustivel

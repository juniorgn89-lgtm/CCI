import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchApuracaoDiaria } from '@/api/supabase/apuracao'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { projecaoAvancada, fimDoMesIso, type Confiabilidade } from '@/lib/projection'
import { todayLocal } from '@/lib/period'

/**
 * Projeção de LB (combustível) da rede — série diária de fato (cache
 * apuracao_diaria, fuel_lucro_bruto somado por dia) + projeção do mês.
 *
 * FATO: série diária, L.B./litro, evolução por dia-da-semana.
 * ESTIMATIVA (rotulada na UI): a projeção de fechamento do mês (esperado) — o
 * dia corrente parcial NÃO entra no realizado; é projetado.
 */

export interface DiaLB { data: string; lb: number; litros: number }
export interface PostoDiaLB { data: string; empresaCodigo: number; lb: number }

export interface ProjecaoLBData {
  isLoading: boolean
  hasRede: boolean
  mesIni: string
  monthEnd: string
  diasNoMes: number
  diasFechados: number
  /** LB acumulado dos dias fechados (até ontem) — FATO. */
  realizadoLB: number
  /** Projeção de fechamento do mês (esperado) — ESTIMATIVA. */
  projetadoLB: number
  /** realizado ÷ projetado (0..1). */
  pctRealizado: number
  /** L.B. por litro da rede (dias fechados) — FATO. */
  lbPorLitro: number
  confiabilidadePct: number
  confiabilidade: Confiabilidade
  /** Este mês, dias fechados, ordenado. */
  dailyCurr: DiaLB[]
  /** Mês anterior, dias fechados (pra comparar mesmo-dia-da-semana). */
  dailyPrev: DiaLB[]
  /** Este mês, LB por posto/dia (pra "quem puxou"). */
  perPosto: PostoDiaLB[]
  empresaNome: Map<number, string>
}

const monthBounds = (iso: string) => {
  const [y, m] = iso.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return { ini: `${y}-${pad(m)}-01`, fim: `${y}-${pad(m)}-${pad(last)}`, diasNoMes: last }
}
const prevMonthBounds = (iso: string) => {
  const [y, m] = iso.split('-').map(Number)
  const py = m === 1 ? y - 1 : y
  const pm = m === 1 ? 12 : m - 1
  const last = new Date(py, pm, 0).getDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return { ini: `${py}-${pad(pm)}-01`, fim: `${py}-${pad(pm)}-${pad(last)}` }
}

const sumByDay = (rows: { data: string; fuel_lucro_bruto: number; fuel_litros: number }[]): DiaLB[] => {
  const m = new Map<string, DiaLB>()
  for (const r of rows) {
    const cur = m.get(r.data) ?? { data: r.data, lb: 0, litros: 0 }
    cur.lb += r.fuel_lucro_bruto
    cur.litros += r.fuel_litros
    m.set(r.data, cur)
  }
  return [...m.values()].sort((a, b) => a.data.localeCompare(b.data))
}

const useProjecaoLB = (): ProjecaoLBData => {
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const { ini: mesIni, fim: mesFimCal, diasNoMes } = useMemo(() => monthBounds(dataFinal), [dataFinal])
  const monthEnd = useMemo(() => fimDoMesIso(dataFinal), [dataFinal])
  const prev = useMemo(() => prevMonthBounds(dataFinal), [dataFinal])
  const fimBusca = dataFinal < mesFimCal ? dataFinal : mesFimCal

  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 30 * 60 * 1000,
  })
  const permitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  // Respeita profiles.empresa_codigos (restrição do usuário) — não basta o RLS,
  // que libera a rede inteira. Mesmo padrão da aba Margem.
  const codes = useMemo(() => permitidas.map((e) => e.codigo), [permitidas])
  const codesKey = codes.join(',')

  const { data: currRows = [], isLoading: l1 } = useQuery({
    queryKey: ['comercial-projlb-curr', codesKey, mesIni, fimBusca],
    queryFn: () => fetchApuracaoDiaria({ empresaCodigos: codes, dataInicial: mesIni, dataFinal: fimBusca }),
    enabled: codes.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  })
  const { data: prevRows = [] } = useQuery({
    queryKey: ['comercial-projlb-prev', codesKey, prev.ini, prev.fim],
    queryFn: () => fetchApuracaoDiaria({ empresaCodigos: codes, dataInicial: prev.ini, dataFinal: prev.fim }),
    enabled: codes.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 30 * 60 * 1000,
  })

  return useMemo(() => {
    const today = todayLocal()
    const dailyCurr = sumByDay(currRows)
    const dailyPrev = sumByDay(prevRows)
    const perPosto: PostoDiaLB[] = currRows.map((r) => ({
      data: r.data, empresaCodigo: r.empresa_codigo, lb: r.fuel_lucro_bruto,
    }))
    const empresaNome = new Map<number, string>()
    for (const e of permitidas) empresaNome.set(e.codigo, e.fantasia || e.razao || `Posto ${e.codigo}`)

    const proj = projecaoAvancada({
      dailySeries: dailyCurr.map((d) => ({ data: d.data, value: d.lb })),
      today,
      dataFinal: monthEnd,
    })
    const fechados = dailyCurr.filter((d) => d.data < today)
    const litrosFechados = fechados.reduce((s, d) => s + d.litros, 0)
    const lbFechados = fechados.reduce((s, d) => s + d.lb, 0)
    const lbPorLitro = litrosFechados > 0 ? lbFechados / litrosFechados : 0

    return {
      isLoading: l1 && currRows.length === 0,
      hasRede: dailyCurr.length > 0,
      mesIni,
      monthEnd,
      diasNoMes,
      diasFechados: proj.diasFechados,
      realizadoLB: proj.realizado,
      projetadoLB: proj.esperado,
      pctRealizado: proj.esperado > 0 ? proj.realizado / proj.esperado : 0,
      lbPorLitro,
      confiabilidadePct: proj.confiabilidadePct,
      confiabilidade: proj.confiabilidade,
      dailyCurr,
      dailyPrev,
      perPosto,
      empresaNome,
    }
  }, [currRows, prevRows, permitidas, mesIni, monthEnd, diasNoMes, l1])
}

export default useProjecaoLB

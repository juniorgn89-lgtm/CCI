import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'
import useCentralSazonal from '@/pages/Dashboard/hooks/useCentralSazonal'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchVendasCache } from '@/api/supabase/apuracao'
import { projecaoSazonal, projecaoAvancada, fimDoMesIso } from '@/lib/projection'
import { todayLocal, offsetPeriod } from '@/lib/period'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const pad = (n: number) => String(n).padStart(2, '0')
const SETORES = ['combustivel', 'automotivos', 'conveniencia'] as const
const NOME_SETOR = { combustivel: 'Combustível', automotivos: 'Automotivos', conveniencia: 'Conveniência' } as const

export interface FechamentoMes {
  carregando: boolean
  /** Lucro bruto da rede (3 setores) já realizado no período do filtro. */
  jaEntrou: number
  /** Previsão de fechamento do mês (sazonal, soma dos setores). */
  previsao: number
  diasFechados: number
  diasRestantes: number
  fechado: boolean
  /** dd/mm do último dia do mês. */
  fimMes: string
  /** Mês de referência inteiro (mês ou ano anterior, conforme a comparação). */
  cheioTotal: number | null
  cheioLabel: string
  cmpLabelLong: string
  /** Previsão × mês de referência inteiro, em %. */
  vsCheio: number | null
  /** Realizado × mesmos dias do período de comparação, em %. */
  vsParcial: number | null
  /** R$/dia para empatar com o mês de referência inteiro. */
  paraEmpatar: number | null
  /** R$/dia do ritmo previsto até o fim. */
  ritmoPrevisto: number
  confiabilidade: 'alta' | 'media' | 'baixa'
  confiabilidadePct: number
  algumLinear: boolean
  /** Por setor: previsão do mês × mês de referência inteiro (null = sem base). */
  setores: { id: 'combustivel' | 'automotivos' | 'conveniencia'; nome: string; previsao: number; cheio: number | null }[]
}

/**
 * "Como o mês vai fechar": os MESMOS cálculos do cartão da Central
 * (ProjecoesPainel) — projeção sazonal por setor somada, mês de referência
 * inteiro e confiança. Usado no Radar de Preços para mostrar o mesmo número.
 */
const useFechamentoMes = (options?: { empresaCodigos?: number[] }): FechamentoMes => {
  const dataInicial = useFilterStore((s) => s.dataInicial)
  const empresaCodigosStore = useFilterStore((s) => s.empresaCodigos)
  const empresaCodigos = options?.empresaCodigos ?? empresaCodigosStore
  const { combustivel, automotivos, conveniencia, global, isLoading, comparisonMode } = useRedeSetores({ empresaCodigos })
  const sazonal = useCentralSazonal({ empresaCodigos })

  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const empresas = useMemo(
    () => (empresasData?.resultados ?? []).map((e) => ({ codigo: e.empresaCodigo, nome: e.fantasia || e.razao || `Posto ${e.empresaCodigo}` })),
    [empresasData],
  )
  const permitidas = useEmpresasPermitidas(empresas)
  const codes = useMemo(() => {
    const base = permitidas.map((e) => e.codigo)
    return empresaCodigos.length > 0 ? base.filter((c) => empresaCodigos.includes(c)) : base
  }, [permitidas, empresaCodigos])

  const projMonthEnd = fimDoMesIso(dataInicial || todayLocal())
  const hoje = todayLocal()
  const setores = { combustivel, automotivos, conveniencia }
  const projs = SETORES.map((id) => projecaoSazonal({
    dailySeries: setores[id].daily.map((d) => ({ data: d.data, value: d.lucroBruto })),
    today: hoje,
    dataFinal: projMonthEnd,
    indices: sazonal.indice(id, 'lucro'),
  }))
  const previsao = projs.reduce((s, p) => s + p.esperado, 0)
  const diasFechados = Math.max(...projs.map((p) => p.diasFechados))
  const diasRestantes = Math.max(...projs.map((p) => p.diasRestantes))

  const mesCheio = useMemo(() => {
    const [y, m] = (dataInicial || todayLocal()).split('-').map(Number)
    if (!y || !m) return null
    const ini = offsetPeriod(`${y}-${pad(m)}-01`, comparisonMode === 'prevYear' ? 12 : 1)
    const [cy, cm] = ini.split('-').map(Number)
    return { ini, fim: fimDoMesIso(ini), label: `${MESES[cm - 1]}/${String(cy).slice(2)}` }
  }, [dataInicial, comparisonMode])
  // Mesma chave da Central → reaproveita o cache.
  const { data: cheioRows = [], isFetched: cheioFetched } = useQuery({
    queryKey: ['proj-mes-cheio-anterior', codes.join(','), mesCheio?.ini, mesCheio?.fim],
    queryFn: () => fetchVendasCache({ empresaCodigos: codes, dataInicial: mesCheio!.ini, dataFinal: mesCheio!.fim }),
    enabled: codes.length > 0 && !!mesCheio,
    staleTime: 10 * 60 * 1000,
  })
  const cheioSetor = useMemo(() => {
    const acc = { combustivel: 0, automotivos: 0, conveniencia: 0 }
    let linhas = 0
    for (const r of cheioRows) {
      if (r.setor !== 'combustivel' && r.setor !== 'automotivos' && r.setor !== 'conveniencia') continue
      acc[r.setor] += r.total_venda - r.total_custo
      linhas++
    }
    return cheioFetched && linhas > 0 ? acc : null
  }, [cheioRows, cheioFetched])
  const cheioTotal = cheioSetor ? cheioSetor.combustivel + cheioSetor.automotivos + cheioSetor.conveniencia : null

  // Confiança: mesma conta do cartão (série de faturamento consolidada).
  const [yy, mm] = (dataInicial || hoje).split('-').map(Number)
  const byDay = new Map<string, number>()
  for (const s of [combustivel, automotivos, conveniencia])
    for (const d of s.daily) byDay.set(d.data, (byDay.get(d.data) ?? 0) + d.faturamento)
  const confianca = projecaoAvancada({
    dailySeries: Array.from(byDay.entries()).map(([data, value]) => ({ data, value })),
    today: hoje,
    dataFinal: `${yy}-${pad(mm)}-${pad(new Date(yy, mm, 0).getDate())}`,
  })

  const jaEntrou = global.lucroBruto
  const fechado = diasRestantes <= 0
  const falta = Math.max(0, previsao - jaEntrou)
  return {
    carregando: isLoading,
    jaEntrou,
    previsao: fechado ? jaEntrou : previsao,
    diasFechados,
    diasRestantes,
    fechado,
    fimMes: projMonthEnd.split('-').reverse().slice(0, 2).join('/'),
    cheioTotal,
    cheioLabel: mesCheio?.label ?? (comparisonMode === 'prevYear' ? 'ano ant.' : 'mês ant.'),
    cmpLabelLong: comparisonMode === 'prevYear' ? 'ano ant.' : 'mês ant.',
    vsCheio: cheioTotal && cheioTotal > 0 ? ((previsao - cheioTotal) / cheioTotal) * 100 : null,
    vsParcial: global.lucroBrutoAnoAnterior > 0 ? ((jaEntrou - global.lucroBrutoAnoAnterior) / global.lucroBrutoAnoAnterior) * 100 : null,
    paraEmpatar: cheioTotal && diasRestantes > 0 ? Math.max(0, cheioTotal - jaEntrou) / diasRestantes : null,
    ritmoPrevisto: diasRestantes > 0 ? falta / diasRestantes : 0,
    confiabilidade: confianca.confiabilidade,
    confiabilidadePct: confianca.confiabilidadePct,
    algumLinear: SETORES.some((s) => sazonal.modo(s).linear),
    setores: SETORES.map((id, i) => ({ id, nome: NOME_SETOR[id], previsao: diasRestantes <= 0 ? setores[id].lucroBruto : projs[i].esperado, cheio: cheioSetor ? cheioSetor[id] : null })),
  }
}

export default useFechamentoMes

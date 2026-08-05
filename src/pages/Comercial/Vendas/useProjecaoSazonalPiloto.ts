import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { useRedeSetorDiaria } from '@/pages/Operacao/hooks/useRedeVendasCache'
import { todayLocal } from '@/lib/period'
import { fimDoMesIso, weekdayIndices, diasOperacaoProxy, projecaoSazonal, reprojectByFactor, type ProjecaoAvancadaResult } from '@/lib/projection'

/**
 * Projeção SAZONAL rede-wide. Busca 6 meses de histórico diário do cache
 * (`useRedeVendasCache`), calcula o índice de dia-da-semana POR MÉTRICA para o
 * `setor` pedido, e devolve a `projecaoSazonal` + o total do mês anterior COMPLETO
 * (base correta do badge "vs mês ant."). Parametrizado por setor no rollout Fase 3
 * (`combustivel` | `automotivos` | `conveniencia`). Per-posto fica pra fase seguinte.
 * Ver docs/SPEC-projecao-sazonal.md.
 */

export interface FuelDailyPoint { data: string; litros: number; faturamento: number; lucroBruto: number }

/** Referência estável pra quando o caller só precisa dos índices/comparativo
 * (não da projeção interna) — evita recomputar o useMemo a cada render. */
export const EMPTY_FUEL_DAILY: FuelDailyPoint[] = []

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
  /** Fator de fechamento REDE-WIDE por métrica (`esperado = realizado × fator`).
   * Mesmo fator em todo escopo → a projeção por posto soma exato com a rede. */
  fatores: { faturamento: number; litros: number; lucro: number }
  sazonal: { faturamento: ProjecaoAvancadaResult; litros: ProjecaoAvancadaResult; lucro: ProjecaoAvancadaResult }
  /** Total FECHADO do período de comparação COMPLETO (mês/ano anterior) — base
   * correta do badge "vs mês ant." (projeção do mês cheio × mês anterior cheio). */
  cmpAnterior: { litros: number; faturamento: number; lucro: number }
  cmpLabel: string
}

const useProjecaoSazonalPiloto = (dailyData: FuelDailyPoint[], enabled = true, setor = 'combustivel', dataInicialOverride?: string): ProjecaoSazonalPiloto => {
  const { empresaCodigos, dataInicial: storeIni, comparisonMode } = useFilterStore()
  // Override do mês (Radar trava no corrente). Default = filtro global.
  const dataInicial = dataInicialOverride ?? storeIni
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000, enabled })
  const permitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const permittedCodes = useMemo(() => new Set(permitidas.map((e) => e.codigo)), [permitidas])

  const monthStart = `${(dataInicial || todayLocal()).slice(0, 7)}-01`
  const histIni = monthsBackFirst(monthStart, 6)
  const histEnd = prevDay(monthStart)
  // Só busca os 6 meses quando ligado (evita custo no dia a dia). Lê o AGREGADO
  // por setor/dia (view) — a sazonal não precisa do detalhe por produto, então
  // troca ~675 páginas de apuracao_vendas por 1–3. Ver useCentralSazonal.
  const { data: histRows = [], isLoading } = useRedeSetorDiaria(histIni, histEnd, { enabled })

  // Período de comparação COMPLETO (mês inteiro anterior — ou o mesmo mês do ano
  // passado) pro badge. Comparar a projeção do mês CHEIO com um período PARCIAL
  // (o vendaCmp da tela) inflava a variação — este é o mês fechado inteiro.
  const cmpOffset = comparisonMode === 'prevYear' ? 12 : 1
  const cmpStart = monthsBackFirst(monthStart, cmpOffset)
  const cmpEnd = prevDay(monthsBackFirst(monthStart, cmpOffset - 1))
  const { data: cmpRows = [] } = useRedeSetorDiaria(cmpStart, cmpEnd, { enabled })

  // Mês CORRENTE rede-wide (agregado por setor/dia) — base do FATOR de fechamento
  // rede-wide, aplicado em TODO escopo pra a projeção por posto somar com a rede.
  const monthEndIso = fimDoMesIso(dataInicial || todayLocal())
  const { data: curRows = [] } = useRedeSetorDiaria(monthStart, monthEndIso, { enabled })

  return useMemo(() => {
    const matchEmpresa = (code: number) => (empresaCodigos.length === 0 ? permittedCodes.has(code) : empresaCodigos.includes(code))
    // Índices SAZONAIS são REDE-WIDE (todos os postos permitidos), independentes do
    // filtro de posto → todo escopo usa o mesmo peso de dia-da-semana. Antes eram
    // por posto (filtravam por empresaCodigos), o que já quebrava a soma.
    const byDay = new Map<string, { fat: number; lit: number; luc: number }>()
    let firstData = ''
    for (const r of histRows) {
      if (r.setor !== setor || !permittedCodes.has(r.empresa_codigo) || r.quantidade <= 0) continue
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

    // Total do período de comparação COMPLETO (combustível no ESCOPO atual —
    // este é do posto/rede selecionado, é o "vs mês ant." do realizado da tela).
    const cmpAnterior = { litros: 0, faturamento: 0, lucro: 0 }
    for (const r of cmpRows) {
      if (r.setor !== setor || !matchEmpresa(r.empresa_codigo) || r.quantidade <= 0) continue
      cmpAnterior.litros += r.quantidade
      cmpAnterior.faturamento += r.total_venda
      cmpAnterior.lucro += r.total_venda - r.total_custo
    }

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

    // FATOR de fechamento REDE-WIDE por métrica = esperado_rede ÷ realizado_rede,
    // do mês corrente da REDE inteira. Aplicado em todo escopo (`esperado =
    // realizado × fator`), faz a projeção por posto somar exato com a rede — sem
    // deixar a cobertura de dias de cada posto distorcer.
    const redeByDay = new Map<string, { fat: number; lit: number; luc: number }>()
    for (const r of curRows) {
      if (r.setor !== setor || !permittedCodes.has(r.empresa_codigo) || r.quantidade <= 0) continue
      const e = redeByDay.get(r.data) ?? { fat: 0, lit: 0, luc: 0 }
      e.fat += r.total_venda; e.lit += r.quantidade; e.luc += r.total_venda - r.total_custo
      redeByDay.set(r.data, e)
    }
    const redeSerie = (k: 'fat' | 'lit' | 'luc') =>
      [...redeByDay.entries()].map(([data, v]) => ({ data, value: v[k] })).sort((a, b) => a.data.localeCompare(b.data))
    const fatorDe = (k: 'fat' | 'lit' | 'luc', idx: Record<number, number>) => {
      const res = projecaoSazonal({ dailySeries: redeSerie(k), today, dataFinal: monthEnd, indices: linear ? ONE : idx })
      return res.realizado > 0 ? res.esperado / res.realizado : 1
    }
    const fatores = {
      faturamento: fatorDe('fat', idxFat),
      litros: fatorDe('lit', idxLit),
      lucro: fatorDe('luc', idxLuc),
    }

    return {
      isLoading,
      diasOperacao,
      linear,
      histDias: byDay.size,
      indices: { faturamento: idxFat, litros: idxLit, lucro: idxLuc },
      fatores,
      // `sazonal` também reprojEtado pelo fator rede-wide → o card grande
      // (ProjecaoExecutiva) bate com os KPIs pequenos e soma com a rede.
      sazonal: {
        faturamento: reprojectByFactor(proj('faturamento', idxFat), fatores.faturamento),
        litros: reprojectByFactor(proj('litros', idxLit), fatores.litros),
        lucro: reprojectByFactor(proj('lucroBruto', idxLuc), fatores.lucro),
      },
      cmpAnterior,
      cmpLabel: comparisonMode === 'prevYear' ? 'ano ant.' : 'mês ant.',
    }
  }, [histRows, cmpRows, curRows, isLoading, empresaCodigos, permittedCodes, dailyData, dataInicial, comparisonMode, setor])
}

export default useProjecaoSazonalPiloto

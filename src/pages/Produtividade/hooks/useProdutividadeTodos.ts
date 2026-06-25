import { useMemo } from 'react'
import { useFilterStore } from '@/store/filters'
import useSegmentosFaturamento, { type SegmentoFaturamento } from '@/pages/Produtividade/hooks/useSegmentosFaturamento'
import useOperacaoData, { type FrentistaRow } from '@/pages/Operacao/hooks/useOperacaoData'
import useVendedoresConveniencia, { type VendedorRow } from '@/pages/Produtividade/hooks/useVendedoresConveniencia'
import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import useConvenienceData from '@/pages/Conveniencias/hooks/useConvenienceData'
import useMetaFaturamento from '@/pages/Produtividade/hooks/useMetaFaturamento'

const MES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** "2025-10" → "Out/25". */
const fmtMes = (yyyyMM: string): string => {
  const [y, m] = yyyyMM.split('-')
  const idx = parseInt(m, 10) - 1
  return `${MES_ABREV[idx] ?? m}/${y.slice(2)}`
}

/** Variação % entre atual e anterior (null quando não há base de comparação). */
const variacaoPct = (atual: number, prev: number): number | null =>
  prev > 0 ? ((atual - prev) / prev) * 100 : null

/* ── Tipos ────────────────────────────────────────────────── */

export interface SegmentoResumo extends SegmentoFaturamento {
  /** Participação % no faturamento global (0 quando global = 0). */
  participacaoPct: number
  /** Variação % vs período comparativo (null sem base). */
  variacaoPct: number | null
}

export interface CampeaoFrentista {
  nome: string
  faturamento: number
  litros: number
  /** Crescimento vs MESMO frentista no período anterior (null sem base). */
  variacaoPct: number | null
  /** Campeão do período anterior (pode ser outra pessoa). */
  prevNome: string | null
  prevLitros: number
}

export interface CampeaoVendedor {
  nome: string
  itens: number
  ticketMedio: number
  faturamento: number
  /** Campeão do período anterior (pode ser outra pessoa). */
  prevNome: string | null
  prevFaturamento: number
}

export interface MelhorSetor {
  nome: string
  variacaoPct: number
}

export interface EvolucaoPonto {
  mes: string
  /** Label curto pro eixo X ("Out/25"). */
  label: string
  combustivel: number | null
  automotivos: number | null
  conveniencia: number | null
  [key: string]: unknown
}

export interface InsightTodos {
  type: 'positive' | 'warning' | 'info'
  text: string
}

export interface ProdutividadeTodosData {
  cmpLabel: string
  global: SegmentoResumo
  combustivel: SegmentoResumo
  automotivos: SegmentoResumo
  conveniencia: SegmentoResumo
  qtdFrentistas: number
  qtdVendedores: number
  totalColaboradores: number
  /** Litros de combustível vendidos no período (pista). */
  litrosTotais: number
  /** Nº de abastecimentos (transações de pista). */
  totalAbastecimentos: number
  /** Nº de cupons da conveniência. */
  totalCupons: number
  campeaoFrentista: CampeaoFrentista | null
  campeaoVendedor: CampeaoVendedor | null
  melhorSetor: MelhorSetor | null
  evolucao: EvolucaoPonto[]
  /** Séries que têm histórico mensal disponível (pro gráfico). */
  evolucaoSeries: { key: 'combustivel' | 'automotivos' | 'conveniencia'; label: string; color: string }[]
  /** Séries sem histórico mensal (pra relatar a limitação na UI). */
  evolucaoSemHistorico: string[]
  insights: InsightTodos[]
  meta: number | null
  setMeta: (value: number | null) => void
  ticketMedioLoja: number
  isLoading: boolean
  hasEmpresa: boolean
}

const toResumo = (seg: SegmentoFaturamento, globalFat: number): SegmentoResumo => ({
  ...seg,
  participacaoPct: globalFat > 0 ? (seg.faturamento / globalFat) * 100 : 0,
  variacaoPct: variacaoPct(seg.faturamento, seg.faturamentoPrev),
})

/**
 * Dados do modo "Todos" da Produtividade — compõe os hooks já existentes
 * (faturamento por segmento, frentistas, vendedores, séries mensais) e deriva
 * participação %, tendências, campeões, melhor setor, evolução 12m e insights.
 * Tudo GET/cache (React Query deduplica as fetches com as demais telas).
 */
const useProdutividadeTodos = (empresaCodigoOverride?: number | null): ProdutividadeTodosData => {
  const { empresaCodigos: filterCodes } = useFilterStore()
  // Posto explícito (seletor) tem prioridade; senão o filtro global.
  const empresaCodigos = empresaCodigoOverride !== undefined
    ? (empresaCodigoOverride !== null ? [empresaCodigoOverride] : [])
    : filterCodes
  const hasEmpresa = empresaCodigos.length > 0

  const segmentos = useSegmentosFaturamento(empresaCodigoOverride)
  const { kpis, frentistaRows, frentistaRowsPrev, isLoading: lOper } = useOperacaoData(empresaCodigoOverride)
  const { rows: vendedores, rowsPrev: vendedoresPrev, totalFaturamento: vendTotalFat, totalCupons: vendTotalCupons, isLoading: lVend } = useVendedoresConveniencia(undefined, empresaCodigoOverride)
  const { lbLitroData } = useAbastecimentosAnalytics(empresaCodigoOverride)
  const { revenueData } = useConvenienceData(empresaCodigoOverride)
  const { meta, setMeta } = useMetaFaturamento(empresaCodigos)

  return useMemo(() => {
    const globalFat = segmentos.global.faturamento
    const global: SegmentoResumo = { ...toResumo(segmentos.global, globalFat), participacaoPct: 100 }
    const combustivel = toResumo(segmentos.combustivel, globalFat)
    const automotivos = toResumo(segmentos.automotivos, globalFat)
    const conveniencia = toResumo(segmentos.conveniencia, globalFat)

    // ── Equipe ──
    const qtdFrentistas = frentistaRows.filter((f: FrentistaRow) => f.litrosVendidos > 0 || f.atendimentos > 0).length
    const qtdVendedores = vendedores.length
    const totalColaboradores = qtdFrentistas + qtdVendedores

    // ── Frentista campeão (por faturamento) ──
    const prevByCodigo = new Map<number, FrentistaRow>(
      frentistaRowsPrev.map((f) => [f.funcionarioCodigo, f]),
    )
    const topFrent = [...frentistaRows]
      .filter((f) => f.faturamento > 0)
      .sort((a, b) => b.faturamento - a.faturamento)[0] ?? null
    // Campeão do período anterior (pode ser outra pessoa).
    const topFrentPrev = [...frentistaRowsPrev]
      .filter((f) => f.faturamento > 0)
      .sort((a, b) => b.faturamento - a.faturamento)[0] ?? null
    const campeaoFrentista: CampeaoFrentista | null = topFrent
      ? {
          nome: topFrent.nome,
          faturamento: topFrent.faturamento,
          litros: topFrent.litrosVendidos,
          variacaoPct: variacaoPct(
            topFrent.faturamento,
            prevByCodigo.get(topFrent.funcionarioCodigo)?.faturamento ?? 0,
          ),
          prevNome: topFrentPrev?.nome ?? null,
          prevLitros: topFrentPrev?.litrosVendidos ?? 0,
        }
      : null

    // ── Vendedor campeão (por faturamento) ──
    const topVend: VendedorRow | undefined = vendedores[0] // já vem ordenado por faturamento desc
    const topVendPrev: VendedorRow | undefined = [...vendedoresPrev].sort((a, b) => b.faturamento - a.faturamento)[0]
    const campeaoVendedor: CampeaoVendedor | null = topVend
      ? {
          nome: topVend.nome,
          itens: topVend.itens,
          ticketMedio: topVend.ticketMedio,
          faturamento: topVend.faturamento,
          prevNome: topVendPrev?.nome ?? null,
          prevFaturamento: topVendPrev?.faturamento ?? 0,
        }
      : null

    // ── Melhor setor (maior evolução %) ──
    const setoresVar: MelhorSetor[] = [
      { nome: 'Combustível', variacaoPct: combustivel.variacaoPct },
      { nome: 'Automotivos', variacaoPct: automotivos.variacaoPct },
      { nome: 'Conveniência', variacaoPct: conveniencia.variacaoPct },
    ]
      .filter((s): s is MelhorSetor => s.variacaoPct !== null)
      .sort((a, b) => b.variacaoPct - a.variacaoPct)
    const melhorSetor = setoresVar[0] ?? null

    // ── Evolução 12 meses ──
    // Combustível: série mensal real (apuração 12m). Conveniência: revenueData
    // (cobre só ~3-4 meses — janela menor por limitação da fonte). Automotivos:
    // SEM histórico mensal disponível → relatado, não inventado.
    const combByMes = new Map<string, number>()
    for (const m of lbLitroData.monthly) {
      if (m.faturamento > 0) combByMes.set(m.mes, m.faturamento)
    }
    const convByMes = new Map<string, number>()
    for (const r of revenueData) {
      // revenueData.mes vem como "MM/YYYY" → normaliza pra "YYYY-MM".
      const [mm, yyyy] = r.mes.split('/')
      if (mm && yyyy && r.faturamento > 0) convByMes.set(`${yyyy}-${mm}`, r.faturamento)
    }

    const mesesUniao = Array.from(new Set([...combByMes.keys(), ...convByMes.keys()]))
      .sort((a, b) => a.localeCompare(b))
      .slice(-12)

    const evolucao: EvolucaoPonto[] = mesesUniao.map((mes) => ({
      mes,
      label: fmtMes(mes),
      combustivel: combByMes.get(mes) ?? null,
      automotivos: null, // sem fonte mensal
      conveniencia: convByMes.get(mes) ?? null,
    }))

    const evolucaoSeries: ProdutividadeTodosData['evolucaoSeries'] = []
    if (combByMes.size > 0) evolucaoSeries.push({ key: 'combustivel', label: 'Combustível', color: '#2563eb' })
    if (convByMes.size > 0) evolucaoSeries.push({ key: 'conveniencia', label: 'Conveniência', color: '#10b981' })
    const evolucaoSemHistorico = ['Automotivos']

    // ── Operação (pista + loja) ──
    const litrosTotais = kpis?.totalLitros ?? 0
    const totalAbastecimentos = kpis?.totalAbastecimentos ?? 0
    const totalCupons = vendTotalCupons

    // ── Ticket médio da loja (conveniência) ──
    const ticketMedioLoja = vendTotalCupons > 0 ? vendTotalFat / vendTotalCupons : 0

    // ── Insights automáticos (máx. 5) ──
    const insights: InsightTodos[] = []
    const segParaInsight = [
      { nome: 'Combustível', v: combustivel.variacaoPct },
      { nome: 'Conveniência', v: conveniencia.variacaoPct },
      { nome: 'Automotivos', v: automotivos.variacaoPct },
    ].filter((s): s is { nome: string; v: number } => s.v !== null)

    for (const s of [...segParaInsight].sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 2)) {
      if (s.v >= 0) {
        insights.push({ type: 'positive', text: `${s.nome} cresceu ${s.v.toFixed(1).replace('.', ',')}% vs ${segmentos.cmpLabel}` })
      } else {
        insights.push({ type: 'warning', text: `${s.nome} caiu ${Math.abs(s.v).toFixed(1).replace('.', ',')}% vs ${segmentos.cmpLabel}` })
      }
    }
    if (campeaoFrentista) {
      insights.push({ type: 'info', text: `${campeaoFrentista.nome} lidera a produtividade da pista` })
    }
    if (totalColaboradores > 0) {
      insights.push({ type: 'info', text: `Equipe ativa: ${totalColaboradores} colaboradores no período` })
    }
    if (ticketMedioLoja > 0) {
      insights.push({
        type: 'info',
        text: `Ticket médio da loja: ${ticketMedioLoja.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
      })
    }

    return {
      cmpLabel: segmentos.cmpLabel,
      global,
      combustivel,
      automotivos,
      conveniencia,
      qtdFrentistas,
      qtdVendedores,
      totalColaboradores,
      litrosTotais,
      totalAbastecimentos,
      totalCupons,
      campeaoFrentista,
      campeaoVendedor,
      melhorSetor,
      evolucao,
      evolucaoSeries,
      evolucaoSemHistorico,
      insights: insights.slice(0, 5),
      meta,
      setMeta,
      ticketMedioLoja,
      isLoading: segmentos.isLoading || lOper || lVend,
      hasEmpresa,
    }
  }, [segmentos, kpis, frentistaRows, frentistaRowsPrev, vendedores, vendedoresPrev, vendTotalFat, vendTotalCupons, lbLitroData, revenueData, meta, setMeta, lOper, lVend, hasEmpresa])
}

export default useProdutividadeTodos

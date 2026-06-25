import { useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useFilterStore, type ComparisonMode } from '@/store/filters'
import { fetchBombas, fetchBicos } from '@/api/endpoints/combustiveis'
import { fetchAbastecimentosChunked } from '@/api/helpers/fetchAbastecimentosChunked'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchCaixas, fetchCaixasApresentado } from '@/api/endpoints/financeiro'
import { CAIXA_APRESENTADO_FORMAS } from '@/api/types/financeiro'
import { fetchVendaFormasPagamento, fetchVendaItens, fetchVendaCodigosAutorizados } from '@/api/endpoints/vendas'
import type { VendaItem } from '@/api/types/venda'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { fetchVendasFuncionarioCache } from '@/api/supabase/apuracao'
import useAbastCache from '@/pages/Operacao/hooks/useAbastCache'
import useCaixasCache from '@/pages/Operacao/hooks/useCaixasCache'
import { todayLocal } from '@/lib/period'
import { labelFormaPagamento, isCartaoForma, CARTAO_TIPO } from '@/lib/formaPagamento'

/* ── Types ───────────────────────────────────────────────── */

export interface OperacaoKpiData {
  totalAbastecimentos: number
  totalLitros: number
  faturamentoCombustivel: number
  ticketMedio: number
  frentistasAtivos: number
  bombasAtivas: number
  caixasAbertos: number
  totalApurado: number
  /** Sobra (>0) / falta (<0) acumulada dos caixas fechados do período. */
  totalDiferenca: number
  // Previous-period totals for DeltaBadge comparison (sempre mês anterior —
  // base fixa do módulo Produtividade, não muda com o toggle de comparação)
  prevTotalAbastecimentos: number
  prevTotalLitros: number
  prevFaturamentoCombustivel: number
  prevTicketMedio: number
  prevTotalApurado: number
  prevTotalDiferenca: number
  // Comparison-period totals — honram o toggle global (mês ant. OU ano ant.).
  // Iguais aos prev* quando comparisonMode === 'prevMonth'.
  comparisonMode: ComparisonMode
  cmpTotalAbastecimentos: number
  cmpTotalLitros: number
  cmpFaturamentoCombustivel: number
  cmpTicketMedio: number
  cmpTotalApurado: number
  cmpTotalDiferenca: number
}

export interface FrentistaRow {
  [key: string]: unknown
  funcionarioCodigo: number
  nome: string
  ativo: boolean
  litrosVendidos: number
  atendimentos: number
  faturamento: number
  ticketMedio: number
}

export interface BombaCombustivelDetalhe {
  nome: string
  litros: number
  abastecimentos: number
  faturamento: number
}

export interface BombaRow {
  bombaCodigo: number
  descricao: string
  referencia: string
  quantidadeBicos: number
  ilha: number
  fabricante: string
  modelo: string
  litrosVendidos: number
  abastecimentos: number
  faturamento: number
  combustiveis: string[]
  /**
   * Detalhamento de litros / abastecimentos / faturamento por combustível
   * dentro da bomba. Ordenado por litros desc.
   */
  combustiveisDetalhes: BombaCombustivelDetalhe[]
  /** Litros bombeados por dia no período atual (para filtrar desde dataUltima manutenção) */
  dailyLitros: { data: string; litros: number }[]
}

export interface AbastecimentoRow {
  [key: string]: unknown
  codigo: number
  dataHora: string
  frentistaNome: string
  frentistaCodigo: number
  produtoNome: string
  produtoCodigo: number
  bicoCodigo: number
  litros: number
  valorUnitario: number
  valorTotal: number
  placa: string
}

export interface TurnoFrentista {
  nome: string
  litros: number
  atendimentos: number
  faturamento: number
}

/**
 * Vendedor de LOJA/conveniência envolvido no PDV. Vem do cache
 * `apuracao_vendas_funcionario` (setor='conveniencia'), que é granular por
 * DIA × funcionário — NÃO por caixa/PDV. Por isso é atribuído ao PDV de
 * Conveniência do dia (mesma limitação do "balde do dia" das formas de
 * pagamento). `cupons`/`itens` são do dia inteiro do vendedor.
 */
export interface TurnoVendedor {
  funcionarioCodigo: number
  nome: string
  faturamento: number
  itens: number
  cupons: number
}

export interface TurnoPagamento {
  tipo: string
  nome: string
  valor: number
  quantidade: number
}

export interface TurnoRow {
  caixaCodigo: number
  turno: string
  turnoCodigo: number
  pdvCodigo: number
  /** 'Pista' | 'Conveniência' | 'PDV {código}'. */
  pdvLabel: string
  funcionarioNome: string
  funcionarioCodigo: number
  dataMovimento: string
  abertura: string
  fechamento: string
  fechado: boolean
  apurado: number
  diferenca: number
  totalVendas: number
  /** Apresentado (conferido) deste caixa; null sem dado de /CAIXA_APRESENTADO. */
  apresentadoTotal: number | null
  /** Apurado CONFERIDO (Σ *Apurado do /CAIXA_APRESENTADO, mesma fonte do
   *  apresentado) — base correta da sobra/falta. null sem dado. NÃO é o
   *  c.apurado (/CAIXA = total de vendas, inclui a prazo). */
  apuradoConferido: number | null
  /** Quebra do apresentado por forma (vazio sem dado). */
  apresentadoFormas: TurnoPagamento[]
  frentistas: TurnoFrentista[]
  /** Vendedores de loja deste PDV no dia (só Conveniência; vazio na Pista). */
  vendedores: TurnoVendedor[]
  pagamentos: TurnoPagamento[]
}

export interface TurnoGroup {
  groupKey: string           // `${turnoCodigo}-${dataMovimento}-${pdvCodigo}`
  turnoCodigo: number
  turno: string
  pdvCodigo: number
  /** Rótulo do PDV: 'Pista', 'Conveniência' ou 'PDV {código}' (fallback). */
  pdvLabel: string
  dataMovimento: string
  responsaveis: string[]     // funcionario names in this group
  abertura: string           // earliest ISO abertura
  fechamento: string         // latest ISO fechamento (or '')
  fechado: boolean           // all caixas closed
  apuradoTotal: number
  diferencaTotal: number
  totalVendasTotal: number
  /** Total apresentado (conferido no fechamento) deste PDV. null = sem dado
   *  de /CAIXA_APRESENTADO (rede não expõe). */
  apresentadoTotal: number | null
  /** Total apurado CONFERIDO (Σ *Apurado do /CAIXA_APRESENTADO) deste PDV —
   *  base da sobra/falta real. null sem dado. */
  apuradoConferidoTotal: number | null
  /** Quebra do apresentado por forma de pagamento (vazio quando sem dado). */
  apresentadoFormas: TurnoPagamento[]
  frentistas: TurnoFrentista[]
  /** Vendedores de loja deste PDV no dia (só Conveniência; vazio na Pista). */
  vendedores: TurnoVendedor[]
  pagamentos: TurnoPagamento[]
  caixaCodigos: number[]
}

export interface CaixaResumo {
  totalApurado: number
  /** Soma das formas de pagamento do período (o "apresentado"). */
  totalApresentado: number
  totalDiferenca: number
  caixasAbertos: number
  caixasFechados: number
}

export interface PagamentoBreakdown {
  tipo: string
  nome: string
  valor: number
  quantidade: number
}

/** Linha de conferência (Fechamento Apresentado do webPosto): por forma. */
export interface ConferenciaForma {
  nome: string
  apresentado: number
  apurado: number
  diferenca: number
}

/** Conferência de um caixa/PDV: apresentado × apurado × diferença por forma. */
export interface ConferenciaCaixa {
  caixaCodigo: number
  dataMovimento: string
  turno: string
  pdvLabel: string
  responsavel: string
  formas: ConferenciaForma[]
  totalApresentado: number
  totalApurado: number
  totalDiferenca: number
}

export interface ApuradoPorDia {
  data: string  // YYYY-MM-DD
  apurado: number
}

/* ── Helpers ─────────────────────────────────────────────── */

/** Ref estável p/ default das queries de set (evita novo Set por render). */
const EMPTY_SET: Set<number> = new Set()

const fmtIsoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// Previous period of equal length, ending the day before the current period starts.
// e.g. 2025-04-01..2025-04-30  →  2025-03-02..2025-03-31
const previousPeriod = (inicial: string, final: string): { inicial: string; final: string } => {
  if (!inicial || !final) return { inicial: '', final: '' }
  const start = new Date(`${inicial}T00:00:00`)
  const end = new Date(`${final}T00:00:00`)
  const lengthMs = end.getTime() - start.getTime()
  const prevEnd = new Date(start.getTime() - 24 * 3600 * 1000)
  const prevStart = new Date(prevEnd.getTime() - lengthMs)
  return { inicial: fmtIsoDate(prevStart), final: fmtIsoDate(prevEnd) }
}

// Mesma faixa deslocada N meses pra trás — usado pro comparativo "vs ano ant." (12).
const offsetMonths = (dateStr: string, monthsBack: number): string => {
  if (!dateStr) return ''
  const d = new Date(`${dateStr}T00:00:00`)
  d.setMonth(d.getMonth() - monthsBack)
  return fmtIsoDate(d)
}

/* ── Hook ────────────────────────────────────────────────── */

const useOperacaoData = (empresaCodigoOverride?: number | null) => {
  const { empresaCodigos, dataInicial, dataFinal, comparisonMode, abastDateMode } = useFilterStore()
  // Operação é por-posto. `undefined` = legado (1º posto do filtro); um número =
  // posto explícito (telas que mostram um posto por vez via seletor).
  const empresaCodigo = empresaCodigoOverride !== undefined ? empresaCodigoOverride : (empresaCodigos[0] ?? null)
  const hasEmpresa = empresaCodigo !== null
  const isPrevYear = comparisonMode === 'prevYear'
  // Critério de data dos abastecimentos (espelha Abast./Fiscal/Movimento do
  // webPosto). 'ABAST' = default da API (omite tipoData). O cache do Supabase é
  // gravado/lido por data fiscal — então só serve no modo FISCAL; nos demais
  // modos buscamos live com o tipoData certo (bate com o webPosto).
  const abastTipoData = abastDateMode === 'FISCAL' ? 'FISCAL' : abastDateMode === 'MOVIMENTO' ? 'MOVIMENTO' : undefined
  const cacheActive = abastDateMode === 'FISCAL'
  // Captura "agora" uma vez por mount (lazy init) — usado pra filtrar
  // abastecimentos com data futura e pra fechamentoTs de caixas abertos.
  // Date.now() não pode ser chamado direto no render (regra de pureza).
  const [nowTs] = useState(() => Date.now())

  const prev = useMemo(() => previousPeriod(dataInicial, dataFinal), [dataInicial, dataFinal])

  // Período comparativo do toggle global. 'prevMonth' → mesma faixa do `prev`
  // (reaproveita o fetch, sem custo extra); 'prevYear' → mesma faixa 12 meses atrás.
  const cmp = useMemo(() => {
    if (!isPrevYear) return prev
    // "Mesmos dias decorridos": corta o fim em hoje antes de deslocar.
    const hoje = todayLocal()
    const fim = dataFinal > hoje ? hoje : dataFinal
    return { inicial: offsetMonths(dataInicial, 12), final: offsetMonths(fim, 12) }
  }, [isPrevYear, dataInicial, dataFinal, prev])

  // Cache raw de abastecimentos pra current + prev. HIT = pula fetch live;
  // MISS = fetch live como antes (sem regressão pra meses não apurados).
  const abastCacheCurrent = useAbastCache({
    dataInicial,
    dataFinal,
    empresaCodigo,
    empresasPermitidasCount: 1,
  })
  const abastCachePrev = useAbastCache({
    dataInicial: prev.inicial,
    dataFinal: prev.final,
    empresaCodigo,
    empresasPermitidasCount: 1,
  })
  // Cache do período comparativo. Quando 'prevMonth', as datas batem com o prev →
  // mesma queryKey, React Query deduplica (sem fetch extra).
  const abastCacheCmp = useAbastCache({
    dataInicial: cmp.inicial,
    dataFinal: cmp.final,
    empresaCodigo,
    empresasPermitidasCount: 1,
  })

  // Cache de caixas + formas de pagamento. Mesma técnica.
  const caixasCacheCurrent = useCaixasCache({ dataInicial, dataFinal, empresaCodigo })
  const caixasCachePrev = useCaixasCache({
    dataInicial: prev.inicial,
    dataFinal: prev.final,
    empresaCodigo,
  })
  const caixasCacheCmp = useCaixasCache({ dataInicial: cmp.inicial, dataFinal: cmp.final, empresaCodigo })

  // Abastecimentos — chunked by week to avoid 50k API limit
  // Live só quando o cache MISS (período não apurado ainda OU mês corrente
  // sem dias fechados suficientes).
  const { data: abastecimentosData, isLoading: l1 } = useQuery({
    queryKey: ['abastecimentos', dataInicial, dataFinal, abastDateMode],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial, dataFinal, tipoData: abastTipoData }),
    enabled: hasEmpresa && (!cacheActive || (!abastCacheCurrent.isCacheHit && !abastCacheCurrent.isChecking)),
    staleTime: 5 * 60 * 1000,
  })

  // Abastecimentos — previous period (for DeltaBadge variation)
  const { data: abastPrevData } = useQuery({
    queryKey: ['abastecimentos', prev.inicial, prev.final, abastDateMode],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial: prev.inicial, dataFinal: prev.final, tipoData: abastTipoData }),
    enabled: hasEmpresa && !!prev.inicial && !!prev.final && (!cacheActive || (!abastCachePrev.isCacheHit && !abastCachePrev.isChecking)),
    staleTime: 5 * 60 * 1000,
  })

  // Caixas — previous period (for totalApurado delta). Gateado por cache HIT.
  const { data: caixasPrevRaw } = useQuery({
    queryKey: ['caixas', empresaCodigo, prev.inicial, prev.final],
    queryFn: () => fetchCaixas({ empresaCodigo: empresaCodigo!, dataInicial: prev.inicial, dataFinal: prev.final, limite: 1000 }),
    enabled:
      hasEmpresa &&
      empresaCodigo !== null &&
      !!prev.inicial &&
      !!prev.final &&
      !caixasCachePrev.isCacheHit &&
      !caixasCachePrev.isChecking,
    staleTime: 5 * 60 * 1000,
  })

  // Abastecimentos + caixas do período comparativo — só fetcham quando 'vs ano ant.'
  // (no modo 'mês ant.' o cmp coincide com o prev e reaproveitamos aqueles dados).
  const { data: abastCmpData } = useQuery({
    queryKey: ['abastecimentos', cmp.inicial, cmp.final, abastDateMode],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial: cmp.inicial, dataFinal: cmp.final, tipoData: abastTipoData }),
    enabled: hasEmpresa && isPrevYear && !!cmp.inicial && !!cmp.final && (!cacheActive || (!abastCacheCmp.isCacheHit && !abastCacheCmp.isChecking)),
    staleTime: 5 * 60 * 1000,
  })
  const { data: caixasCmpRaw } = useQuery({
    queryKey: ['caixas', empresaCodigo, cmp.inicial, cmp.final],
    queryFn: () => fetchCaixas({ empresaCodigo: empresaCodigo!, dataInicial: cmp.inicial, dataFinal: cmp.final, limite: 1000 }),
    enabled:
      hasEmpresa &&
      empresaCodigo !== null &&
      isPrevYear &&
      !!cmp.inicial &&
      !!cmp.final &&
      !caixasCacheCmp.isCacheHit &&
      !caixasCacheCmp.isChecking,
    staleTime: 5 * 60 * 1000,
  })

  // Funcionários (direct call — small dataset)
  const { data: funcionariosRaw, isLoading: l2 } = useQuery({
    queryKey: ['funcionarios', empresaCodigo],
    queryFn: () => fetchFuncionarios({ empresaCodigo: empresaCodigo!, limite: 1000 }),
    enabled: hasEmpresa && empresaCodigo !== null,
    staleTime: 30 * 60 * 1000,
  })

  // Bombas (no pagination params in this endpoint)
  const { data: bombasRaw, isLoading: l3 } = useQuery({
    queryKey: ['bombas', empresaCodigo],
    queryFn: () => fetchBombas({ empresaCodigo: empresaCodigo! }),
    enabled: hasEmpresa && empresaCodigo !== null,
    staleTime: 30 * 60 * 1000,
  })

  // Bicos (direct call — small dataset)
  const { data: bicosRaw, isLoading: l4 } = useQuery({
    queryKey: ['bicos', empresaCodigo],
    queryFn: () => fetchBicos({ empresaCodigo: empresaCodigo!, limite: 1000 }),
    enabled: hasEmpresa && empresaCodigo !== null,
    staleTime: 30 * 60 * 1000,
  })

  // Produtos (cached, shared across modules)
  const { data: produtosData, isLoading: l5 } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100
    ),
    staleTime: 30 * 60 * 1000,
  })

  // Caixas (direct call). Gateado por cache HIT.
  const { data: caixasRaw, isLoading: l6 } = useQuery({
    queryKey: ['caixas', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchAllPages((p) => fetchCaixas({ empresaCodigo: empresaCodigo!, dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 20),
    enabled:
      hasEmpresa &&
      empresaCodigo !== null &&
      !caixasCacheCurrent.isCacheHit &&
      !caixasCacheCurrent.isChecking,
    staleTime: 5 * 60 * 1000,
  })

  // Formas de pagamento. Gateado por cache HIT (mesmo cache de caixas — gravados juntos).
  // Paginado: um posto movimentado passa de 1000 formas no período (undercount silencioso).
  const { data: formasPgtoRaw, isLoading: l7 } = useQuery({
    queryKey: ['vendaFormasPgto', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchAllPages((p) => fetchVendaFormasPagamento({ empresaCodigo: empresaCodigo!, dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    enabled:
      hasEmpresa &&
      empresaCodigo !== null &&
      !caixasCacheCurrent.isCacheHit &&
      !caixasCacheCurrent.isChecking,
    staleTime: 5 * 60 * 1000,
  })

  // Apresentado por caixa (formas conferidas no fechamento). NÃO está no cache
  // Supabase, então busca sempre que houver empresa. É o que permite quebrar o
  // "apresentado" por PDV (o /VENDA_FORMA_PAGAMENTO não tem caixa/PDV).
  // retry:false — se a rede não expõe /CAIXA_APRESENTADO, degrada pra vazio.
  const { data: apresentadoRaw } = useQuery({
    queryKey: ['caixasApresentado', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchAllPages((p) => fetchCaixasApresentado({ empresaCodigo: empresaCodigo!, dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    enabled: hasEmpresa && empresaCodigo !== null,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  // Apresentado do PERÍODO DE COMPARAÇÃO (mês/ano ant.) — pra o card "Total
  // Apurado" comparar conferido × conferido (não conferido × vendas).
  const cmpApresInicial = isPrevYear ? cmp.inicial : prev.inicial
  const cmpApresFinal = isPrevYear ? cmp.final : prev.final
  const { data: apresentadoCmpRaw } = useQuery({
    queryKey: ['caixasApresentado', empresaCodigo, cmpApresInicial, cmpApresFinal],
    queryFn: () => fetchAllPages((p) => fetchCaixasApresentado({ empresaCodigo: empresaCodigo!, dataInicial: cmpApresInicial, dataFinal: cmpApresFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    enabled: hasEmpresa && empresaCodigo !== null && !!cmpApresInicial && !!cmpApresFinal,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  // ── Combustível FATURADO (VENDA_ITEM) para a agregação de BOMBAS ──
  // As bombas passam a refletir o volume FISCAL autorizado (mesma base do card
  // "Litros vendidos" de Vendas·Combustível), não o volume físico de
  // /ABASTECIMENTO. Frentistas/caixas/turnos/conferência seguem em abastecimento.
  //
  // REUSO DELIBERADO das queryKeys/queryFns de `useFuelVendaAnalytics` no
  // período ATUAL → o React Query DEDUPLICA (sem refazer rede quando o usuário
  // navega entre as duas telas). Por isso os fetchers montam o conjunto por
  // `empresaCodigos` (array) exatamente como lá.
  const fetchFuelVendaItens = (di: string, df: string) => async (): Promise<VendaItem[]> => {
    const perEmpresa = await Promise.all(
      empresaCodigos.map((emp) =>
        fetchAllPages(
          (p) => fetchVendaItens({
            empresaCodigo: emp,
            dataInicial: di,
            dataFinal: df,
            usaProdutoLmc: false,
            ultimoCodigo: p.ultimoCodigo,
            limite: p.limite,
          }),
          1000, 50,
        ),
      ),
    )
    return perEmpresa.flat()
  }
  const fetchAutorizados = (di: string, df: string) => async (): Promise<Set<number>> => {
    const sets = await Promise.all(
      empresaCodigos.map((emp) => fetchVendaCodigosAutorizados({ empresaCodigo: emp, dataInicial: di, dataFinal: df })),
    )
    const all = new Set<number>()
    for (const s of sets) for (const c of s) all.add(c)
    return all
  }

  // Período ATUAL — MESMAS queryKeys de useFuelVendaAnalytics (dedup garantido).
  const { data: fuelVendaItens = [] } = useQuery({
    queryKey: ['fuel-venda-analytics', empresaCodigos.join(','), dataInicial, dataFinal],
    queryFn: fetchFuelVendaItens(dataInicial, dataFinal),
    enabled: hasEmpresa,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
  const { data: fuelAutorizados = EMPTY_SET } = useQuery({
    queryKey: ['fuel-venda-autorizados', empresaCodigos.join(','), dataInicial, dataFinal],
    queryFn: fetchAutorizados(dataInicial, dataFinal),
    enabled: hasEmpresa,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  // Período ANTERIOR (janela própria do módulo — length-based). A queryKey usa o
  // mesmo prefixo dos fetchers de combustível; como as datas são deste módulo,
  // não colidem com as do useFuelVendaAnalytics (que usa offsetPeriod).
  const { data: fuelVendaItensPrev = [] } = useQuery({
    queryKey: ['fuel-venda-analytics', empresaCodigos.join(','), prev.inicial, prev.final],
    queryFn: fetchFuelVendaItens(prev.inicial, prev.final),
    enabled: hasEmpresa && !!prev.inicial && !!prev.final,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
  const { data: fuelAutorizadosPrev = EMPTY_SET } = useQuery({
    queryKey: ['fuel-venda-autorizados', empresaCodigos.join(','), prev.inicial, prev.final],
    queryFn: fetchAutorizados(prev.inicial, prev.final),
    enabled: hasEmpresa && !!prev.inicial && !!prev.final,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  // Vendedores de loja (conveniência) — do cache `apuracao_vendas_funcionario`.
  // Granular por DIA × funcionário (NÃO por caixa/PDV), então só dá pra atribuir
  // ao PDV de Conveniência do dia. Lê só dias fechados (o cache não cobre "hoje").
  // Degrada pra vazio se a rede ainda não rodou a apuração de vendas por funcionário.
  const { data: vendedoresRaw } = useQuery({
    queryKey: ['vendasFuncionario', empresaCodigo, dataInicial, dataFinal],
    queryFn: () =>
      fetchVendasFuncionarioCache({
        empresaCodigos: empresaCodigo != null ? [empresaCodigo] : undefined,
        dataInicial,
        dataFinal,
      }),
    enabled: hasEmpresa && empresaCodigo !== null,
    staleTime: 5 * 60 * 1000,
  })

  // l1 (abast) e l6/l7 (caixas/formas) só são relevantes quando cache MISS.
  // Aguardar isChecking dos probes evita flicker entre cache e live.
  // Períodos `prev` (abast + caixas) NÃO entram no gate — UI renderiza
  // com dados correntes prontos; delta badges enchem quando o prev chegar.
  const isLoading =
    (l1 && !(cacheActive && abastCacheCurrent.isCacheHit)) ||
    (cacheActive && abastCacheCurrent.isChecking) ||
    caixasCacheCurrent.isChecking ||
    l2 || l3 || l4 || l5 ||
    (l6 && !caixasCacheCurrent.isCacheHit) ||
    (l7 && !caixasCacheCurrent.isCacheHit)

  const computed = useMemo(() => {
    // Filtra registros com data futura — provável erro de digitação no Quality
    // (ex: alguém cria abast com dataFiscal='2026-05-28' enquanto hoje é 17/05).
    // OR semantics: se qualquer um dos campos (dataFiscal ou dataHoraAbastecimento)
    // estiver no futuro, considera erro — alguns abasts têm typo só em um campo.
    const todayISO = new Date(nowTs).toISOString().slice(0, 10)
    const notFuture = (a: { dataFiscal?: string; dataHoraAbastecimento?: string }) => {
      const dF = (a.dataFiscal ?? '').slice(0, 10)
      const dH = (a.dataHoraAbastecimento ?? '').slice(0, 10)
      const fiscalFuturo = dF !== '' && dF > todayISO
      const horaFutura = dH !== '' && dH > todayISO
      return !fiscalFuturo && !horaFutura
    }

    // Abastecimentos: prioriza cache (já filtrado por empresa em Supabase),
    // fallback live (que ainda precisa de filtro client-side porque endpoint
    // Quality não aceita empresaCodigo).
    // Exclui aferição (teste de bomba — combustível volta pro tanque, não é
    // venda; o relatório "Abastecimento x Cupom" do webPosto também ignora).
    // No cache o flag vem sempre false (a apuração já filtra antes de gravar).
    const real = (a: { afericao?: boolean }) => !a.afericao
    // Cache só vale no modo FISCAL (gravado por data fiscal). Fora dele, usa o
    // live já buscado com o tipoData certo.
    const abastecimentos = (cacheActive && abastCacheCurrent.isCacheHit
      ? abastCacheCurrent.abastecimentos
      : (abastecimentosData ?? []).filter(
          (a) => !empresaCodigo || a.empresaCodigo === empresaCodigo
        )
    ).filter(notFuture).filter(real)
    const abastPrev = (cacheActive && abastCachePrev.isCacheHit
      ? abastCachePrev.abastecimentos
      : (abastPrevData ?? []).filter(
          (a) => !empresaCodigo || a.empresaCodigo === empresaCodigo
        )
    ).filter(notFuture).filter(real)
    const funcionarios = funcionariosRaw?.resultados ?? []
    const bombas = bombasRaw?.resultados ?? []
    const bicos = bicosRaw?.resultados ?? []
    const produtos = produtosData ?? []
    // Caixas e formas vêm do cache Supabase quando HIT; senão, live.
    const caixas = caixasCacheCurrent.isCacheHit
      ? caixasCacheCurrent.caixas
      : (caixasRaw ?? [])
    const formasPgto = caixasCacheCurrent.isCacheHit
      ? caixasCacheCurrent.formasPagamento
      : (formasPgtoRaw ?? [])

    // Apresentado (conferido no fechamento) por caixa → permite quebrar por PDV.
    // Sem cache: vem direto do /CAIXA_APRESENTADO (vazio se a rede não expõe).
    // /CAIXA_APRESENTADO: 1 linha larga por caixa, com {forma}Apresentado/Apurado/
    // Diferenca. Apresentado do caixa = soma dos *Apresentado por forma (>0).
    // Filtra pelos caixas do PERÍODO (o endpoint pode retornar caixas fora da
    // janela; sem isso o total estoura somando dias que não estão na tela).
    const periodoCaixaCods = new Set(caixas.map((c) => c.caixaCodigo))
    const apresentadoList = (apresentadoRaw ?? []).filter((a) => periodoCaixaCods.has(a.caixaCodigo))
    const hasApresentado = apresentadoList.length > 0
    // `total` = Σ *Apresentado (conferido). `apurado` = Σ *Apurado (esperado do
    // sistema, MESMA fonte do apresentado). A diferença real do caixa é
    // apresentado − apuradoConferido — não o c.apurado do /CAIXA (que é o total
    // de VENDAS, incluindo a prazo, e infla a diferença em postos de pista).
    const apresentadoByCaixa = new Map<number, { total: number; apurado: number; formas: Map<string, number> }>()
    for (const a of apresentadoList) {
      const rec = a as unknown as Record<string, number>
      const entry = apresentadoByCaixa.get(a.caixaCodigo) ?? { total: 0, apurado: 0, formas: new Map<string, number>() }
      for (const f of CAIXA_APRESENTADO_FORMAS) {
        const vApr = Number(rec[`${f.key}Apresentado`]) || 0
        const vApu = Number(rec[`${f.key}Apurado`]) || 0
        entry.apurado += vApu
        if (vApr !== 0) {
          entry.total += vApr
          entry.formas.set(f.nome, (entry.formas.get(f.nome) ?? 0) + vApr)
        }
      }
      apresentadoByCaixa.set(a.caixaCodigo, entry)
    }

    // ── Maps ──
    const funcMap = new Map<number, { nome: string; ativo: boolean }>()
    for (const f of funcionarios) {
      funcMap.set(f.funcionarioCodigo, { nome: f.nome, ativo: f.ativo })
    }

    // Map by produtoCodigo, produtoLmcCodigo, and codigo (API primary key)
    // Abastecimento.codigoProduto may match any of these
    const produtoMap = new Map<number, string>()
    for (const p of produtos) {
      produtoMap.set(p.produtoCodigo, p.nome)
      if (p.produtoLmcCodigo) produtoMap.set(p.produtoLmcCodigo, p.nome)
      if (p.codigo) produtoMap.set(p.codigo, p.nome)
    }

    const bicoToBomba = new Map<number, number>()
    const bicoProduto = new Map<number, number>()
    for (const b of bicos) {
      bicoToBomba.set(b.bicoCodigo, b.bombaCodigo)
      bicoProduto.set(b.bicoCodigo, b.produtoCodigo)
    }

    // Resolve product name: try direct lookup first, then via bico → produtoCodigo
    const resolveProdutoNome = (codigoProduto: number, codigoBico: number): string => {
      const direct = produtoMap.get(codigoProduto)
      if (direct) return direct
      const viaBico = bicoProduto.get(codigoBico)
      if (viaBico) {
        const nome = produtoMap.get(viaBico)
        if (nome) return nome
      }
      return `Produto ${codigoProduto}`
    }

    // ── Frentistas ──
    const frentistaAgg = new Map<number, { litros: number; count: number; valor: number }>()
    for (const a of abastecimentos) {
      const prev = frentistaAgg.get(a.codigoFrentista) ?? { litros: 0, count: 0, valor: 0 }
      frentistaAgg.set(a.codigoFrentista, {
        litros: prev.litros + a.quantidade,
        count: prev.count + 1,
        valor: prev.valor + a.valorTotal,
      })
    }

    const frentistaRows: FrentistaRow[] = Array.from(frentistaAgg.entries())
      .map(([cod, agg]) => {
        const func = funcMap.get(cod)
        return {
          funcionarioCodigo: cod,
          nome: func?.nome ?? `Frentista ${cod}`,
          ativo: func?.ativo ?? true,
          litrosVendidos: agg.litros,
          atendimentos: agg.count,
          faturamento: agg.valor,
          ticketMedio: agg.count > 0 ? agg.valor / agg.count : 0,
        }
      })
      .sort((a, b) => b.litrosVendidos - a.litrosVendidos)

    // ── Bombas ──
    // `porCombustivel` agrega litros/count/valor por nome do combustível
    // dentro da bomba — vira o `combustiveisDetalhes` do BombaRow.
    interface BombaAggEntry {
      litros: number
      count: number
      valor: number
      combustiveis: Set<string>
      porCombustivel: Map<string, { litros: number; count: number; valor: number }>
    }
    const makeEmptyAgg = (): BombaAggEntry => ({
      litros: 0,
      count: 0,
      valor: 0,
      combustiveis: new Set<string>(),
      porCombustivel: new Map(),
    })
    // Fonte das BOMBAS = VENDA fiscal autorizada (mesma base de Vendas·Combustível),
    // não /ABASTECIMENTO. Identifica combustível por tipoProduto 'C' (idêntico ao
    // useFuelVendaAnalytics), expandindo aliases de código (produtoCodigo /
    // produtoLmcCodigo / codigo). Vazio = não filtra (fallback defensivo).
    const fuelCodes = new Set<number>()
    for (const p of produtos) {
      if (p.tipoProduto !== 'C') continue
      for (const c of [p.produtoCodigo, p.produtoLmcCodigo, p.codigo]) {
        if (typeof c === 'number' && c > 0) fuelCodes.add(c)
      }
    }
    const isFuel = (prod: number) => fuelCodes.size === 0 || fuelCodes.has(prod)
    const inPeriod = (d: string, di: string, df: string) => {
      const dd = (d ?? '').slice(0, 10)
      return dd >= di && dd <= df
    }

    // Agrega itens de venda autorizados por bico → bomba. Itens cujo bico não
    // mapeia pra nenhuma bomba (produtos de loja / bico 0) são ignorados.
    const aggregateFuelVendas = (
      itens: VendaItem[],
      autorizados: Set<number>,
      di: string,
      df: string,
    ): { agg: Map<number, BombaAggEntry>; daily: Map<number, Map<string, number>> } => {
      const agg = new Map<number, BombaAggEntry>()
      const daily = new Map<number, Map<string, number>>()
      for (const it of itens) {
        if (empresaCodigo != null && it.empresaCodigo !== empresaCodigo) continue
        if (!autorizados.has(it.vendaCodigo)) continue
        if (it.quantidade <= 0) continue
        if (!isFuel(it.produtoCodigo)) continue
        if (!inPeriod(it.dataMovimento, di, df)) continue
        const bombaCod = bicoToBomba.get(it.bicoCodigo)
        if (bombaCod == null) continue // bico de loja / sem bomba

        const entry = agg.get(bombaCod) ?? makeEmptyAgg()
        entry.litros += it.quantidade
        entry.count += 1
        entry.valor += it.totalVenda
        const prodNome = resolveProdutoNome(it.produtoCodigo, it.bicoCodigo)
        if (!prodNome.startsWith('Produto ')) entry.combustiveis.add(prodNome)
        const combPrev = entry.porCombustivel.get(prodNome) ?? { litros: 0, count: 0, valor: 0 }
        combPrev.litros += it.quantidade
        combPrev.count += 1
        combPrev.valor += it.totalVenda
        entry.porCombustivel.set(prodNome, combPrev)
        agg.set(bombaCod, entry)

        const dayStr = (it.dataMovimento ?? '').substring(0, 10)
        if (dayStr.length === 10) {
          const dm = daily.get(bombaCod) ?? new Map<string, number>()
          dm.set(dayStr, (dm.get(dayStr) ?? 0) + it.quantidade)
          daily.set(bombaCod, dm)
        }
      }
      return { agg, daily }
    }

    const { agg: bombaAgg, daily: bombaDaily } = aggregateFuelVendas(
      fuelVendaItens, fuelAutorizados, dataInicial, dataFinal,
    )

    const buildBombaRows = (
      agg: typeof bombaAgg,
      daily: typeof bombaDaily,
    ): BombaRow[] =>
      bombas
        .map((b) => {
          const a = agg.get(b.bombaCodigo) ?? makeEmptyAgg()
          const bombaBicos = bicos.filter((bi) => bi.bombaCodigo === b.bombaCodigo)
          const combustiveis =
            a.combustiveis.size > 0
              ? Array.from(a.combustiveis)
              : bombaBicos.map((bi) => produtoMap.get(bi.produtoCodigo) ?? '').filter(Boolean)
          // Detalhes por combustível ordenados por litros desc
          const combustiveisDetalhes = Array.from(a.porCombustivel.entries())
            .map(([nome, v]) => ({
              nome,
              litros: v.litros,
              abastecimentos: v.count,
              faturamento: v.valor,
            }))
            .sort((x, y) => y.litros - x.litros)
          const dm = daily.get(b.bombaCodigo) ?? new Map<string, number>()
          const dailyLitros = Array.from(dm.entries())
            .map(([data, litros]) => ({ data, litros }))
            .sort((x, y) => x.data.localeCompare(y.data))
          return {
            bombaCodigo: b.bombaCodigo,
            descricao: b.descricao || `Bomba ${b.bombaCodigo}`,
            referencia: b.bombaReferencia,
            quantidadeBicos: b.quantidadeBicos,
            ilha: b.ilha,
            fabricante: b.fabricante,
            modelo: b.modelo,
            litrosVendidos: a.litros,
            abastecimentos: a.count,
            faturamento: a.valor,
            combustiveis: [...new Set(combustiveis)],
            combustiveisDetalhes,
            dailyLitros,
          }
        })
        .sort((x, y) => y.litrosVendidos - x.litrosVendidos)

    const bombaRows = buildBombaRows(bombaAgg, bombaDaily)

    // Previous-period bombas — mesma fonte (VENDA fiscal autorizada), na janela prev.
    const { agg: bombaAggPrev, daily: bombaDailyPrev } = aggregateFuelVendas(
      fuelVendaItensPrev, fuelAutorizadosPrev, prev.inicial, prev.final,
    )
    const bombaRowsPrev = buildBombaRows(bombaAggPrev, bombaDailyPrev)

    // ── Abastecimentos table ──
    const toAbastecimentoRow = (a: typeof abastecimentos[number]): AbastecimentoRow => ({
      codigo: a.codigo,
      dataHora: a.dataHoraAbastecimento || `${a.dataFiscal} ${a.horaFiscal}`,
      frentistaNome: funcMap.get(a.codigoFrentista)?.nome ?? `Frentista ${a.codigoFrentista}`,
      frentistaCodigo: a.codigoFrentista,
      produtoNome: resolveProdutoNome(a.codigoProduto, a.codigoBico),
      produtoCodigo: a.codigoProduto,
      bicoCodigo: a.codigoBico,
      litros: a.quantidade,
      valorUnitario: a.valorUnitario,
      valorTotal: a.valorTotal,
      placa: a.placa,
    })
    const abastecimentoRows: AbastecimentoRow[] = abastecimentos
      .map(toAbastecimentoRow)
      .sort((a, b) => b.dataHora.localeCompare(a.dataHora))
    // Mesma transformação para o período anterior (para módulo de Destaques semanais)
    const abastecimentoRowsPrev: AbastecimentoRow[] = abastPrev
      .map(toAbastecimentoRow)
      .sort((a, b) => b.dataHora.localeCompare(a.dataHora))

    // ── Helper: extract HH:mm from time or datetime string ──
    const extractTime = (raw: string | null | undefined): string => {
      if (!raw) return ''
      // If it contains a space, it's "YYYY-MM-DD HH:mm:ss" → take the time part
      if (raw.includes(' ')) {
        const timePart = raw.split(' ')[1]
        return timePart ? timePart.substring(0, 5) : ''
      }
      // If it contains 'T', it's ISO format
      if (raw.includes('T')) {
        const timePart = raw.split('T')[1]
        return timePart ? timePart.substring(0, 5) : ''
      }
      // Otherwise assume it's already HH:mm:ss
      return raw.substring(0, 5)
    }

    // ── Turnos (from Caixas) with frentistas cross-reference ──
    // Group caixas by pdvCodigo, then sort each group by abertura ascending.
    // Upper bound for open shifts uses the next caixa's abertura WITHIN THE SAME PDV,
    // so different PDVs (e.g. MAILANE and GILVONEY) never constrain each other.
    const caixasByPdv = new Map<number, typeof caixas>()
    for (const c of caixas) {
      const group = caixasByPdv.get(c.pdvCodigo) ?? []
      group.push(c)
      caixasByPdv.set(c.pdvCodigo, group)
    }
    for (const [pdv, group] of caixasByPdv) {
      caixasByPdv.set(pdv, group.sort((a, b) => {
        const ta = a.abertura ? new Date(a.abertura).getTime() : 0
        const tb = b.abertura ? new Date(b.abertura).getTime() : 0
        return ta - tb
      }))
    }

    // Pré-indexa abastecimentos e formas por DIA (com timestamp memoizado).
    // Antes o cruzamento caixa×abastecimento fazia `abastecimentos.filter` por
    // caixa → O(caixas × abast), que travava a tela em períodos longos (2+ meses).
    // Agora cada caixa só varre o bucket do seu dia.
    const abastByDay = new Map<string, { a: typeof abastecimentos[number]; ts: number | null }[]>()
    for (const a of abastecimentos) {
      const dia = (a.dataFiscal || a.dataHoraAbastecimento?.substring(0, 10)) ?? ''
      if (!dia) continue
      const ts = a.dataHoraAbastecimento ? new Date(a.dataHoraAbastecimento).getTime() : null
      const bucket = abastByDay.get(dia) ?? []
      bucket.push({ a, ts })
      abastByDay.set(dia, bucket)
    }
    const formasByDay = new Map<string, typeof formasPgto>()
    for (const fp of formasPgto) {
      const dia = fp.dataMovimento?.substring(0, 10) ?? ''
      if (!dia) continue
      const bucket = formasByDay.get(dia) ?? []
      bucket.push(fp)
      formasByDay.set(dia, bucket)
    }

    // Frentistas que bombearam combustível em cada dia. Usado pra classificar o
    // PDV de um caixa: se o operador do caixa aparece aqui, é PDV de Pista;
    // senão, Conveniência. (A API não liga abastecimento→PDV; só por frentista.)
    const frentistasFuelByDay = new Map<string, Set<number>>()
    for (const a of abastecimentos) {
      const dia = (a.dataFiscal || a.dataHoraAbastecimento?.substring(0, 10)) ?? ''
      if (!dia) continue
      const set = frentistasFuelByDay.get(dia) ?? new Set<number>()
      set.add(a.codigoFrentista)
      frentistasFuelByDay.set(dia, set)
    }

    // Vendedores de loja (conveniência) por DIA. O cache
    // apuracao_vendas_funcionario é granular por (data, funcionario, setor) —
    // não tem caixa/PDV, então só dá pra ligar ao PDV de Conveniência do dia.
    // Agrega faturamento/itens/cupons por funcionário dentro do dia.
    const vendedoresByDay = new Map<string, Map<number, TurnoVendedor>>()
    for (const r of vendedoresRaw ?? []) {
      if (r.setor !== 'conveniencia') continue
      if (empresaCodigo != null && r.empresa_codigo !== empresaCodigo) continue
      const dia = (r.data || '').substring(0, 10)
      if (!dia) continue
      const dayMap = vendedoresByDay.get(dia) ?? new Map<number, TurnoVendedor>()
      const prev = dayMap.get(r.funcionario_codigo) ?? {
        funcionarioCodigo: r.funcionario_codigo,
        nome: funcMap.get(r.funcionario_codigo)?.nome ?? `Vendedor ${r.funcionario_codigo}`,
        faturamento: 0,
        itens: 0,
        cupons: 0,
      }
      prev.faturamento += r.faturamento
      prev.itens += r.quantidade
      prev.cupons += r.cupons
      dayMap.set(r.funcionario_codigo, prev)
      vendedoresByDay.set(dia, dayMap)
    }
    const vendedoresDoDia = (dia: string): TurnoVendedor[] =>
      Array.from((vendedoresByDay.get(dia) ?? new Map<number, TurnoVendedor>()).values())
        .sort((a, b) => b.faturamento - a.faturamento)

    const turnoRows: TurnoRow[] = caixas
      .map((c) => {
        const caixaDate = c.dataMovimento?.substring(0, 10) ?? ''
        const aberturaTs = c.abertura ? new Date(c.abertura).getTime() : null

        // Upper bound: fechamento if closed, else next caixa on the same PDV, else now
        let fechamentoTs = c.fechamento ? new Date(c.fechamento).getTime() : null
        if (!fechamentoTs) {
          const pdvGroup = caixasByPdv.get(c.pdvCodigo) ?? []
          const myIdx = pdvGroup.findIndex((x) => x.caixaCodigo === c.caixaCodigo)
          const nextInPdv = pdvGroup.slice(myIdx + 1).find(
            (nx) => nx.dataMovimento?.substring(0, 10) === caixaDate && nx.abertura
          )
          fechamentoTs = nextInPdv
            ? new Date(nextInPdv.abertura).getTime() - 1
            : nowTs
        }

        // Classifica o PDV do caixa pelo operador (bombeou combustível no dia →
        // Pista). Combustível só conta pra Pista — senão a caixa de Conveniência
        // herdaria os abastecimentos do dia inteiro (valores misturados).
        const isPista = (frentistasFuelByDay.get(caixaDate) ?? new Set<number>()).has(c.funcionarioCodigo)

        const shiftAbast = !isPista ? [] : (abastByDay.get(caixaDate) ?? [])
          .filter(({ ts }) => {
            if (ts == null || aberturaTs == null) return true
            return ts >= aberturaTs && ts <= fechamentoTs!
          })
          .map(({ a }) => a)

        // Aggregate frentistas who worked this shift
        const frentistaAgg = new Map<number, { litros: number; count: number; valor: number }>()
        for (const a of shiftAbast) {
          const prev = frentistaAgg.get(a.codigoFrentista) ?? { litros: 0, count: 0, valor: 0 }
          frentistaAgg.set(a.codigoFrentista, {
            litros: prev.litros + a.quantidade,
            count: prev.count + 1,
            valor: prev.valor + a.valorTotal,
          })
        }

        const frentistas: TurnoFrentista[] = Array.from(frentistaAgg.entries())
          .map(([cod, agg]) => ({
            nome: funcMap.get(cod)?.nome ?? `Frentista ${cod}`,
            litros: agg.litros,
            atendimentos: agg.count,
            faturamento: agg.valor,
          }))
          .sort((a, b) => b.litros - a.litros)

        // Cross-reference formas de pagamento for this shift (bucket do dia)
        const shiftPgto = formasByDay.get(caixaDate) ?? []

        const pgtoAggShift = new Map<string, { nome: string; valor: number; count: number }>()
        for (const fp of shiftPgto) {
          const rawTipo = fp.tipoFormaPagamento || 'OUTROS'
          const cartao = isCartaoForma(rawTipo, fp.nomeFormaPagamento)
          const tipo = cartao ? CARTAO_TIPO : rawTipo
          const prev = pgtoAggShift.get(tipo) ?? { nome: cartao ? 'Cartão' : labelFormaPagamento(fp.nomeFormaPagamento || tipo), valor: 0, count: 0 }
          prev.valor += fp.valorPagamento
          prev.count += 1
          pgtoAggShift.set(tipo, prev)
        }

        const pagamentos: TurnoPagamento[] = Array.from(pgtoAggShift.entries())
          .map(([tipo, agg]) => ({ tipo, nome: agg.nome, valor: agg.valor, quantidade: agg.count }))
          .sort((a, b) => b.valor - a.valor)

        const totalVendas = pagamentos.reduce((s, p) => s + p.valor, 0)

        // Apresentado por caixa (de /CAIXA_APRESENTADO) — quebra por forma sem
        // a mistura do balde do dia inteiro.
        const apEntry = apresentadoByCaixa.get(c.caixaCodigo)
        const apresentadoTotal = hasApresentado && apEntry ? apEntry.total : null
        const apuradoConferido = hasApresentado && apEntry ? apEntry.apurado : null
        const apresentadoFormas: TurnoPagamento[] = apEntry
          ? Array.from(apEntry.formas.entries())
              .map(([nome, valor]) => ({ tipo: nome, nome, valor, quantidade: 0 }))
              .sort((a, b) => b.valor - a.valor)
          : []

        return {
          caixaCodigo: c.caixaCodigo,
          turno: c.turno || `Turno ${c.turnoCodigo}`,
          turnoCodigo: c.turnoCodigo,
          pdvCodigo: c.pdvCodigo,
          pdvLabel: isPista ? 'Pista' : 'Conveniência',
          funcionarioNome: funcMap.get(c.funcionarioCodigo)?.nome ?? `Funcionário ${c.funcionarioCodigo}`,
          funcionarioCodigo: c.funcionarioCodigo,
          dataMovimento: c.dataMovimento,
          abertura: extractTime(c.abertura),
          fechamento: extractTime(c.fechamento),
          fechado: c.fechado,
          apurado: c.apurado,
          diferenca: c.diferenca,
          totalVendas,
          apresentadoTotal,
          apuradoConferido,
          apresentadoFormas,
          frentistas,
          // Vendedores de loja só fazem sentido no PDV de Conveniência (o de
          // Pista já tem os frentistas via abastecimento). Atribuídos pelo dia.
          vendedores: isPista ? [] : vendedoresDoDia(caixaDate),
          pagamentos,
        }
      })
      .sort((a, b) => {
        if (a.fechado !== b.fechado) return a.fechado ? 1 : -1
        return b.dataMovimento.localeCompare(a.dataMovimento)
      })

    // ── Turno groups (group caixas by turnoCodigo + dataMovimento + PDV) ──
    // Índice caixa→turnoRow pra mesclar pagamentos sem varrer turnoRows por grupo.
    const turnoRowByCaixa = new Map(turnoRows.map((r) => [r.caixaCodigo, r]))
    const groupMap = new Map<string, typeof caixas>()
    for (const c of caixas) {
      const key = `${c.turnoCodigo}-${c.dataMovimento?.substring(0, 10)}-${c.pdvCodigo}`
      const grp = groupMap.get(key) ?? []
      grp.push(c)
      groupMap.set(key, grp)
    }

    const turnoGroups: TurnoGroup[] = Array.from(groupMap.entries())
      .map(([groupKey, grpCaixas]) => {
        const sorted = [...grpCaixas].sort((a, b) => {
          const ta = a.abertura ? new Date(a.abertura).getTime() : 0
          const tb = b.abertura ? new Date(b.abertura).getTime() : 0
          return ta - tb
        })
        const first = sorted[0]
        const caixaDate = first.dataMovimento?.substring(0, 10) ?? ''
        const fechado = grpCaixas.every((c) => c.fechado)

        // Combined time window
        const aberturaTs = Math.min(
          ...grpCaixas.map((c) => c.abertura ? new Date(c.abertura).getTime() : Infinity)
        )
        const maxFechamentoTs = fechado
          ? Math.max(...grpCaixas.map((c) => c.fechamento ? new Date(c.fechamento).getTime() : 0))
          : nowTs

        // Classifica o PDV: operador do caixa bombeou combustível no dia → Pista.
        // (A API não liga abastecimento→PDV; classificamos pelo operador.)
        const fuelSet = frentistasFuelByDay.get(caixaDate) ?? new Set<number>()
        const isPista = grpCaixas.some((c) => fuelSet.has(c.funcionarioCodigo))
        const pdvLabel = isPista ? 'Pista' : 'Conveniência'

        // Abastecimentos só fazem sentido no PDV de Pista — o de Conveniência não
        // herda dado de bomba (senão o combustível apareceria duplicado nos dois).
        const grpAbast = !isPista ? [] : (abastByDay.get(caixaDate) ?? [])
          .filter(({ ts }) => {
            if (ts == null || !isFinite(aberturaTs)) return true
            return ts >= aberturaTs && ts <= maxFechamentoTs
          })
          .map(({ a }) => a)

        // Frentistas aggregated for the whole turno
        const frentAgg = new Map<number, { litros: number; count: number; valor: number }>()
        for (const a of grpAbast) {
          const prev = frentAgg.get(a.codigoFrentista) ?? { litros: 0, count: 0, valor: 0 }
          frentAgg.set(a.codigoFrentista, {
            litros: prev.litros + a.quantidade,
            count: prev.count + 1,
            valor: prev.valor + a.valorTotal,
          })
        }
        const frentistas: TurnoFrentista[] = Array.from(frentAgg.entries())
          .map(([cod, agg]) => ({
            nome: funcMap.get(cod)?.nome ?? `Frentista ${cod}`,
            litros: agg.litros,
            atendimentos: agg.count,
            faturamento: agg.valor,
          }))
          .sort((a, b) => b.faturamento - a.faturamento)

        // Merged pagamentos (lookup direto por caixa, sem varrer turnoRows)
        const pgtoMerge = new Map<string, TurnoPagamento>()
        for (const c of grpCaixas) {
          const row = turnoRowByCaixa.get(c.caixaCodigo)
          if (!row) continue
          for (const p of row.pagamentos) {
            const prev = pgtoMerge.get(p.tipo) ?? { tipo: p.tipo, nome: p.nome, valor: 0, quantidade: 0 }
            pgtoMerge.set(p.tipo, { ...prev, valor: prev.valor + p.valor, quantidade: prev.quantidade + p.quantidade })
          }
        }

        const apuradoTotal = grpCaixas.reduce((s, c) => s + c.apurado, 0)
        const diferencaTotal = grpCaixas.filter((c) => c.fechado).reduce((s, c) => s + c.diferenca, 0)
        const totalVendasTotal = grpAbast.reduce((s, a) => s + a.valorTotal, 0)

        // Apresentado por PDV (soma dos caixas do grupo) + quebra por forma.
        const apFormasMap = new Map<string, number>()
        let apTotal = 0
        let apuradoConfTotal = 0
        let apHit = false
        for (const c of grpCaixas) {
          const entry = apresentadoByCaixa.get(c.caixaCodigo)
          if (!entry) continue
          apHit = true
          apTotal += entry.total
          apuradoConfTotal += entry.apurado
          for (const [nome, val] of entry.formas) apFormasMap.set(nome, (apFormasMap.get(nome) ?? 0) + val)
        }
        const apresentadoTotal = hasApresentado && apHit ? apTotal : null
        const apuradoConferidoTotal = hasApresentado && apHit ? apuradoConfTotal : null
        const apresentadoFormas: TurnoPagamento[] = Array.from(apFormasMap.entries())
          .map(([nome, valor]) => ({ tipo: nome, nome, valor, quantidade: 0 }))
          .sort((a, b) => b.valor - a.valor)

        return {
          groupKey,
          turnoCodigo: first.turnoCodigo,
          turno: first.turno || `Turno ${first.turnoCodigo}`,
          pdvCodigo: first.pdvCodigo,
          pdvLabel,
          dataMovimento: caixaDate,
          responsaveis: sorted.map((c) => funcMap.get(c.funcionarioCodigo)?.nome ?? `Func ${c.funcionarioCodigo}`),
          abertura: first.abertura ?? '',
          fechamento: sorted[sorted.length - 1].fechamento ?? '',
          fechado,
          apuradoTotal,
          diferencaTotal,
          totalVendasTotal,
          apresentadoTotal,
          apuradoConferidoTotal,
          apresentadoFormas,
          frentistas,
          // Vendedores de loja só no PDV de Conveniência (atribuídos pelo dia).
          vendedores: isPista ? [] : vendedoresDoDia(caixaDate),
          pagamentos: Array.from(pgtoMerge.values()).sort((a, b) => b.valor - a.valor),
          caixaCodigos: grpCaixas.map((c) => c.caixaCodigo),
        }
      })
      .sort((a, b) => {
        if (a.fechado !== b.fechado) return a.fechado ? 1 : -1
        return b.dataMovimento.localeCompare(a.dataMovimento) || b.abertura.localeCompare(a.abertura)
      })

    // Colisão de rótulo: se 2+ PDVs do mesmo turno/dia classificarem igual
    // (ex.: nenhum operador bombeou → ambos "Conveniência"), a heurística não
    // distingue — então caímos pro código ("PDV {n}") nesses grupos.
    const labelCount = new Map<string, number>()
    for (const g of turnoGroups) {
      const k = `${g.turnoCodigo}-${g.dataMovimento}-${g.pdvLabel}`
      labelCount.set(k, (labelCount.get(k) ?? 0) + 1)
    }
    for (const g of turnoGroups) {
      const k = `${g.turnoCodigo}-${g.dataMovimento}-${g.pdvLabel}`
      if ((labelCount.get(k) ?? 0) > 1) g.pdvLabel = `PDV ${g.pdvCodigo}`
    }

    // Propaga o rótulo final do grupo (já com fallback de colisão) pra cada
    // turnoRow, pra Fechamentos mostrar o mesmo Pista/Conveniência/PDV.
    const labelByCaixa = new Map<string, string>()
    for (const g of turnoGroups) {
      for (const cod of g.caixaCodigos) labelByCaixa.set(`${cod}-${g.dataMovimento}`, g.pdvLabel)
    }
    for (const r of turnoRows) {
      const lbl = labelByCaixa.get(`${r.caixaCodigo}-${r.dataMovimento.slice(0, 10)}`)
      if (lbl) r.pdvLabel = lbl
    }

    // ── Conferência por PDV (Fechamento Apresentado) ──
    // Junta cada linha do /CAIXA_APRESENTADO com o caixa (turno/PDV/responsável)
    // e quebra por forma: apresentado × apurado × diferença.
    const rowByCaixaCod = new Map(turnoRows.map((r) => [r.caixaCodigo, r]))
    const conferenciaPdv: ConferenciaCaixa[] = apresentadoList.map((a) => {
      const rec = a as unknown as Record<string, number>
      const row = rowByCaixaCod.get(a.caixaCodigo)
      const formas: ConferenciaForma[] = []
      let tApr = 0, tApu = 0, tDif = 0
      for (const f of CAIXA_APRESENTADO_FORMAS) {
        const apresentado = Number(rec[`${f.key}Apresentado`]) || 0
        const apurado = Number(rec[`${f.key}Apurado`]) || 0
        const diferenca = Number(rec[`${f.key}Diferenca`]) || 0
        if (apresentado === 0 && apurado === 0 && diferenca === 0) continue
        formas.push({ nome: f.nome, apresentado, apurado, diferenca })
        tApr += apresentado; tApu += apurado; tDif += diferenca
      }
      return {
        caixaCodigo: a.caixaCodigo,
        dataMovimento: row?.dataMovimento?.slice(0, 10) ?? '',
        turno: row?.turno ?? `Caixa ${a.caixaCodigo}`,
        pdvLabel: row?.pdvLabel ?? '—',
        responsavel: row?.funcionarioNome ?? '',
        formas: formas.sort((x, y) => y.apresentado - x.apresentado),
        totalApresentado: tApr,
        totalApurado: tApu,
        totalDiferenca: tDif,
      }
    }).sort((a, b) => b.dataMovimento.localeCompare(a.dataMovimento) || a.turno.localeCompare(b.turno))

    // ── Caixa summary ──
    // Apresentado: usa o /CAIXA_APRESENTADO (mesma fonte dos Turnos/Conferência,
    // pra bater entre as abas); só cai nas formas planas se a rede não expõe.
    const apresentadoFromCaixa = Array.from(apresentadoByCaixa.values()).reduce((s, e) => s + e.total, 0)
    // Apurado CONFERIDO (Σ *Apurado do /CAIXA_APRESENTADO) — mesma fonte/soma da
    // coluna "Apurado" da Conferência por PDV. É o que o card "Total Apurado"
    // deve mostrar pra bater com a tabela (não o total de VENDAS do /CAIXA).
    const apuradoConferidoFromCaixa = Array.from(apresentadoByCaixa.values()).reduce((s, e) => s + e.apurado, 0)
    // Diferença = apresentado − apurado por caixa fechado (fecha por subtração,
    // igual Turnos/Conferência). Sem apresentado do caixa, cai na diferença
    // oficial do /CAIXA.
    // Diferença = apresentado − apurado CONFERIDO (Σ *Apurado do /CAIXA_APRESENTADO,
    // mesma fonte do apresentado). NÃO usar c.apurado (/CAIXA = total de vendas,
    // inclui a prazo) — isso inflava a "Diferença de Caixa" em postos de pista.
    const totalDiferenca = caixas.filter((c) => c.fechado).reduce((s, c) => {
      const ap = apresentadoByCaixa.get(c.caixaCodigo)
      return s + (ap ? ap.total - ap.apurado : c.diferenca)
    }, 0)
    const caixaResumo: CaixaResumo = {
      totalApurado: hasApresentado ? apuradoConferidoFromCaixa : caixas.reduce((s, c) => s + c.apurado, 0),
      totalApresentado: hasApresentado ? apresentadoFromCaixa : formasPgto.reduce((s, fp) => s + fp.valorPagamento, 0),
      totalDiferenca,
      caixasAbertos: caixas.filter((c) => !c.fechado).length,
      caixasFechados: caixas.filter((c) => c.fechado).length,
    }

    // ── Payment breakdown ──
    // Cards are aggregated under tipoFormaPagamento ("CARTAO.") because the flat
    // /VENDA_FORMA_PAGAMENTO endpoint does not expose tipoTransacao (debit/credit).
    // To split, we'd need /VENDA's nested formaPagamento[].tipoTransacao field.
    const pgtoAgg = new Map<string, { nome: string; valor: number; count: number }>()
    for (const fp of formasPgto) {
      const rawTipo = fp.tipoFormaPagamento || 'OUTROS'
      const cartao = isCartaoForma(rawTipo, fp.nomeFormaPagamento)
      const tipo = cartao ? CARTAO_TIPO : rawTipo
      const prev = pgtoAgg.get(tipo) ?? { nome: cartao ? 'Cartão' : labelFormaPagamento(fp.nomeFormaPagamento || tipo), valor: 0, count: 0 }
      prev.valor += fp.valorPagamento
      prev.count += 1
      pgtoAgg.set(tipo, prev)
    }

    const pagamentoBreakdown: PagamentoBreakdown[] = Array.from(pgtoAgg.entries())
      .map(([tipo, agg]) => ({
        tipo,
        nome: agg.nome,
        valor: agg.valor,
        quantidade: agg.count,
      }))
      .sort((a, b) => b.valor - a.valor)

    // ── Daily evolution of apurado (only fechados — open caixas don't have
    // definitive value until closure) ──
    // Usa o apurado CONFERIDO (Σ *Apurado do /CAIXA_APRESENTADO) por caixa, igual
    // ao card "Total Apurado" — assim a evolução e o badge "Apurado até hoje"
    // batem com os cards. Sem conferência, cai no apurado de vendas do /CAIXA.
    const dailyAgg = new Map<string, number>()
    for (const c of caixas) {
      if (!c.fechado) continue
      const dia = c.dataMovimento?.substring(0, 10)
      if (!dia) continue
      const ap = apresentadoByCaixa.get(c.caixaCodigo)
      dailyAgg.set(dia, (dailyAgg.get(dia) ?? 0) + (ap ? ap.apurado : c.apurado))
    }

    const apuradoPorDia: ApuradoPorDia[] = []
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
      // Safety cap: max ~3 anos para evitar loop infinito
      for (let i = 0; i < 1100 && cursor <= dataFinal; i++) {
        apuradoPorDia.push({ data: cursor, apurado: dailyAgg.get(cursor) ?? 0 })
        cursor = addDays(cursor, 1)
      }
    } else {
      apuradoPorDia.push(
        ...Array.from(dailyAgg.entries())
          .map(([data, apurado]) => ({ data, apurado }))
          .sort((a, b) => a.data.localeCompare(b.data))
      )
    }

    // ── KPIs (current period) ──
    const totalLitros = abastecimentos.reduce((s, a) => s + a.quantidade, 0)
    const totalFat = abastecimentos.reduce((s, a) => s + a.valorTotal, 0)

    // ── Previous-period totals for DeltaBadge ──
    const prevTotalLitros = abastPrev.reduce((s, a) => s + a.quantidade, 0)
    const prevFaturamentoCombustivel = abastPrev.reduce((s, a) => s + a.valorTotal, 0)
    const prevCaixas = caixasCachePrev.isCacheHit
      ? caixasCachePrev.caixas
      : (caixasPrevRaw?.resultados ?? [])
    const prevTotalApurado = prevCaixas.reduce((s, c) => s + c.apurado, 0)
    const prevTotalDiferenca = prevCaixas
      .filter((c) => c.fechado)
      .reduce((s, c) => s + c.diferenca, 0)

    // ── Comparison-period totals (mode-aware) ──
    // 'prevMonth' reaproveita os números do prev; 'prevYear' usa o período 12m atrás.
    const abastCmp = !isPrevYear
      ? abastPrev
      : (cacheActive && abastCacheCmp.isCacheHit
          ? abastCacheCmp.abastecimentos
          : (abastCmpData ?? []).filter((a) => !empresaCodigo || a.empresaCodigo === empresaCodigo)
        ).filter(notFuture).filter(real)
    const cmpCaixas = !isPrevYear
      ? prevCaixas
      : (caixasCacheCmp.isCacheHit ? caixasCacheCmp.caixas : (caixasCmpRaw?.resultados ?? []))
    const cmpTotalLitros = abastCmp.reduce((s, a) => s + a.quantidade, 0)
    const cmpFaturamentoCombustivel = abastCmp.reduce((s, a) => s + a.valorTotal, 0)
    // Apurado CONFERIDO do período de comparação (Σ *Apurado do /CAIXA_APRESENTADO),
    // pra o delta do card "Total Apurado" comparar conferido × conferido. Sem
    // conferência no período anterior, cai no apurado de vendas do /CAIXA.
    const cmpApuradoConferido = (apresentadoCmpRaw ?? []).reduce((s, a) => {
      const rec = a as unknown as Record<string, number>
      let t = 0
      for (const f of CAIXA_APRESENTADO_FORMAS) t += Number(rec[`${f.key}Apurado`]) || 0
      return s + t
    }, 0)
    const cmpTotalApurado = (apresentadoCmpRaw ?? []).length > 0
      ? cmpApuradoConferido
      : cmpCaixas.reduce((s, c) => s + c.apurado, 0)
    const cmpTotalDiferenca = cmpCaixas.filter((c) => c.fechado).reduce((s, c) => s + c.diferenca, 0)

    // Per-frentista previous-period totals (para comparativos do módulo Produtividade)
    const frentistaPrevAgg = new Map<number, { litros: number; count: number; valor: number }>()
    for (const a of abastPrev) {
      const prev = frentistaPrevAgg.get(a.codigoFrentista) ?? { litros: 0, count: 0, valor: 0 }
      frentistaPrevAgg.set(a.codigoFrentista, {
        litros: prev.litros + a.quantidade,
        count: prev.count + 1,
        valor: prev.valor + a.valorTotal,
      })
    }
    const frentistaRowsPrev: FrentistaRow[] = Array.from(frentistaPrevAgg.entries())
      .map(([cod, agg]) => ({
        funcionarioCodigo: cod,
        nome: funcMap.get(cod)?.nome ?? `Frentista ${cod}`,
        ativo: funcMap.get(cod)?.ativo ?? true,
        litrosVendidos: agg.litros,
        atendimentos: agg.count,
        faturamento: agg.valor,
        ticketMedio: agg.count > 0 ? agg.valor / agg.count : 0,
      }))

    const kpis: OperacaoKpiData = {
      totalAbastecimentos: abastecimentos.length,
      totalLitros,
      faturamentoCombustivel: totalFat,
      ticketMedio: abastecimentos.length > 0 ? totalFat / abastecimentos.length : 0,
      frentistasAtivos: frentistaRows.filter((f) => f.ativo).length,
      bombasAtivas: bombaRows.filter((b) => b.abastecimentos > 0).length,
      caixasAbertos: caixaResumo.caixasAbertos,
      totalApurado: caixaResumo.totalApurado,
      totalDiferenca: caixaResumo.totalDiferenca,
      prevTotalAbastecimentos: abastPrev.length,
      prevTotalLitros,
      prevFaturamentoCombustivel,
      prevTicketMedio: abastPrev.length > 0 ? prevFaturamentoCombustivel / abastPrev.length : 0,
      prevTotalApurado,
      prevTotalDiferenca,
      comparisonMode,
      cmpTotalAbastecimentos: abastCmp.length,
      cmpTotalLitros,
      cmpFaturamentoCombustivel,
      cmpTicketMedio: abastCmp.length > 0 ? cmpFaturamentoCombustivel / abastCmp.length : 0,
      cmpTotalApurado,
      cmpTotalDiferenca,
    }

    // Filter lists for UI
    const frentistasList = frentistaRows.map((f) => ({ codigo: f.funcionarioCodigo, nome: f.nome }))
    // Build unique combustíveis list from resolved names
    const combMap = new Map<number, string>()
    for (const a of abastecimentos) {
      if (!combMap.has(a.codigoProduto)) {
        combMap.set(a.codigoProduto, resolveProdutoNome(a.codigoProduto, a.codigoBico))
      }
    }
    const combustiveisList = Array.from(combMap.entries()).map(([codigo, nome]) => ({ codigo, nome }))

    return {
      kpis,
      frentistaRows,
      frentistaRowsPrev,
      bombaRows,
      bombaRowsPrev,
      abastecimentoRows,
      abastecimentoRowsPrev,
      turnoRows,
      turnoGroups,
      caixaResumo,
      conferenciaPdv,
      pagamentoBreakdown,
      apuradoPorDia,
      frentistasList,
      combustiveisList,
    }
  }, [cacheActive, abastecimentosData, abastPrevData, abastCmpData, funcionariosRaw, bombasRaw, bicosRaw, produtosData, caixasRaw, caixasPrevRaw, caixasCmpRaw, formasPgtoRaw, apresentadoRaw, apresentadoCmpRaw, vendedoresRaw, fuelVendaItens, fuelAutorizados, fuelVendaItensPrev, fuelAutorizadosPrev, prev, empresaCodigo, dataInicial, dataFinal, nowTs, isPrevYear, comparisonMode, abastCacheCurrent.isCacheHit, abastCacheCurrent.abastecimentos, abastCachePrev.isCacheHit, abastCachePrev.abastecimentos, abastCacheCmp.isCacheHit, abastCacheCmp.abastecimentos, caixasCacheCurrent.isCacheHit, caixasCacheCurrent.caixas, caixasCacheCurrent.formasPagamento, caixasCachePrev.isCacheHit, caixasCachePrev.caixas, caixasCacheCmp.isCacheHit, caixasCacheCmp.caixas])

  return {
    ...computed,
    isLoading,
    hasEmpresa,
    // "Instantâneo": dados vieram do snapshot mensal (abastecimentos + caixas).
    // Fora do modo FISCAL o abast vem live, então não é snapshot.
    isCacheHit: cacheActive && abastCacheCurrent.isCacheHit && caixasCacheCurrent.isCacheHit,
  }
}

export default useOperacaoData

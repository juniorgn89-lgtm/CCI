import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchBombas, fetchBicos } from '@/api/endpoints/combustiveis'
import { fetchAbastecimentosChunked } from '@/api/helpers/fetchAbastecimentosChunked'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchCaixas } from '@/api/endpoints/financeiro'
import { fetchVendaFormasPagamento } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import useAbastCache from '@/pages/Operacao/hooks/useAbastCache'
import useCaixasCache from '@/pages/Operacao/hooks/useCaixasCache'

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
  // Previous-period totals for DeltaBadge comparison (3 main KPIs only)
  prevTotalLitros: number
  prevFaturamentoCombustivel: number
  prevTotalApurado: number
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
  funcionarioNome: string
  funcionarioCodigo: number
  dataMovimento: string
  abertura: string
  fechamento: string
  fechado: boolean
  apurado: number
  diferenca: number
  totalVendas: number
  frentistas: TurnoFrentista[]
  pagamentos: TurnoPagamento[]
}

export interface TurnoGroup {
  groupKey: string           // `${turnoCodigo}-${dataMovimento}`
  turnoCodigo: number
  turno: string
  dataMovimento: string
  responsaveis: string[]     // funcionario names in this group
  abertura: string           // earliest ISO abertura
  fechamento: string         // latest ISO fechamento (or '')
  fechado: boolean           // all caixas closed
  apuradoTotal: number
  diferencaTotal: number
  totalVendasTotal: number
  frentistas: TurnoFrentista[]
  pagamentos: TurnoPagamento[]
  caixaCodigos: number[]
}

export interface CaixaResumo {
  totalApurado: number
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

export interface ApuradoPorDia {
  data: string  // YYYY-MM-DD
  apurado: number
}

/* ── Helpers ─────────────────────────────────────────────── */

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

/* ── Hook ────────────────────────────────────────────────── */

const useOperacaoData = () => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0

  const prev = useMemo(() => previousPeriod(dataInicial, dataFinal), [dataInicial, dataFinal])

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

  // Cache de caixas + formas de pagamento. Mesma técnica.
  const caixasCacheCurrent = useCaixasCache({ dataInicial, dataFinal, empresaCodigo })
  const caixasCachePrev = useCaixasCache({
    dataInicial: prev.inicial,
    dataFinal: prev.final,
    empresaCodigo,
  })

  // Abastecimentos — chunked by week to avoid 50k API limit
  // Live só quando o cache MISS (período não apurado ainda OU mês corrente
  // sem dias fechados suficientes).
  const { data: abastecimentosData, isLoading: l1 } = useQuery({
    queryKey: ['abastecimentos', dataInicial, dataFinal],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial, dataFinal }),
    enabled: hasEmpresa && !abastCacheCurrent.isCacheHit && !abastCacheCurrent.isChecking,
  })

  // Abastecimentos — previous period (for DeltaBadge variation)
  const { data: abastPrevData } = useQuery({
    queryKey: ['abastecimentos', prev.inicial, prev.final],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial: prev.inicial, dataFinal: prev.final }),
    enabled: hasEmpresa && !!prev.inicial && !!prev.final && !abastCachePrev.isCacheHit && !abastCachePrev.isChecking,
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
    queryFn: () => fetchCaixas({ empresaCodigo: empresaCodigo!, dataInicial, dataFinal, limite: 1000 }),
    enabled:
      hasEmpresa &&
      empresaCodigo !== null &&
      !caixasCacheCurrent.isCacheHit &&
      !caixasCacheCurrent.isChecking,
  })

  // Formas de pagamento. Gateado por cache HIT (mesmo cache de caixas — gravados juntos).
  const { data: formasPgtoRaw, isLoading: l7 } = useQuery({
    queryKey: ['vendaFormasPgto', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchVendaFormasPagamento({ empresaCodigo: empresaCodigo!, dataInicial, dataFinal, limite: 1000 }),
    enabled:
      hasEmpresa &&
      empresaCodigo !== null &&
      !caixasCacheCurrent.isCacheHit &&
      !caixasCacheCurrent.isChecking,
  })

  // l1 (abast) e l6/l7 (caixas/formas) só são relevantes quando cache MISS.
  // Aguardar isChecking dos probes evita flicker entre cache e live.
  // Períodos `prev` (abast + caixas) NÃO entram no gate — UI renderiza
  // com dados correntes prontos; delta badges enchem quando o prev chegar.
  const isLoading =
    (l1 && !abastCacheCurrent.isCacheHit) ||
    abastCacheCurrent.isChecking ||
    caixasCacheCurrent.isChecking ||
    l2 || l3 || l4 || l5 ||
    (l6 && !caixasCacheCurrent.isCacheHit) ||
    (l7 && !caixasCacheCurrent.isCacheHit)

  const computed = useMemo(() => {
    // Filtra registros com data futura — provável erro de digitação no Quality
    // (ex: alguém cria abast com dataFiscal='2026-05-28' enquanto hoje é 17/05).
    // OR semantics: se qualquer um dos campos (dataFiscal ou dataHoraAbastecimento)
    // estiver no futuro, considera erro — alguns abasts têm typo só em um campo.
    const todayISO = new Date().toISOString().slice(0, 10)
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
    const abastecimentos = (abastCacheCurrent.isCacheHit
      ? abastCacheCurrent.abastecimentos
      : (abastecimentosData ?? []).filter(
          (a) => !empresaCodigo || a.empresaCodigo === empresaCodigo
        )
    ).filter(notFuture)
    const abastPrev = (abastCachePrev.isCacheHit
      ? abastCachePrev.abastecimentos
      : (abastPrevData ?? []).filter(
          (a) => !empresaCodigo || a.empresaCodigo === empresaCodigo
        )
    ).filter(notFuture)
    const funcionarios = funcionariosRaw?.resultados ?? []
    const bombas = bombasRaw?.resultados ?? []
    const bicos = bicosRaw?.resultados ?? []
    const produtos = produtosData ?? []
    // Caixas e formas vêm do cache Supabase quando HIT; senão, live.
    const caixas = caixasCacheCurrent.isCacheHit
      ? caixasCacheCurrent.caixas
      : (caixasRaw?.resultados ?? [])
    const formasPgto = caixasCacheCurrent.isCacheHit
      ? caixasCacheCurrent.formasPagamento
      : (formasPgtoRaw?.resultados ?? [])

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
    const bombaAgg = new Map<number, BombaAggEntry>()
    const bombaDaily = new Map<number, Map<string, number>>()
    for (const a of abastecimentos) {
      const bombaCod = bicoToBomba.get(a.codigoBico) ?? 0
      const prev = bombaAgg.get(bombaCod) ?? makeEmptyAgg()
      prev.litros += a.quantidade
      prev.count += 1
      prev.valor += a.valorTotal
      const prodNome = resolveProdutoNome(a.codigoProduto, a.codigoBico)
      if (!prodNome.startsWith('Produto ')) prev.combustiveis.add(prodNome)
      // Detalhamento por combustível
      const combPrev = prev.porCombustivel.get(prodNome) ?? { litros: 0, count: 0, valor: 0 }
      combPrev.litros += a.quantidade
      combPrev.count += 1
      combPrev.valor += a.valorTotal
      prev.porCombustivel.set(prodNome, combPrev)
      bombaAgg.set(bombaCod, prev)

      const dayStr = (a.dataHoraAbastecimento || a.dataFiscal || '').substring(0, 10)
      if (dayStr.length === 10) {
        const dm = bombaDaily.get(bombaCod) ?? new Map<string, number>()
        dm.set(dayStr, (dm.get(dayStr) ?? 0) + a.quantidade)
        bombaDaily.set(bombaCod, dm)
      }
    }

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

    // Previous-period bombas (mesmo cálculo, agregado em abastPrev)
    const bombaAggPrev = new Map<number, BombaAggEntry>()
    const bombaDailyPrev = new Map<number, Map<string, number>>()
    for (const a of abastPrev) {
      const bombaCod = bicoToBomba.get(a.codigoBico) ?? 0
      const prev = bombaAggPrev.get(bombaCod) ?? makeEmptyAgg()
      prev.litros += a.quantidade
      prev.count += 1
      prev.valor += a.valorTotal
      const prodNome = resolveProdutoNome(a.codigoProduto, a.codigoBico)
      if (!prodNome.startsWith('Produto ')) prev.combustiveis.add(prodNome)
      const combPrev = prev.porCombustivel.get(prodNome) ?? { litros: 0, count: 0, valor: 0 }
      combPrev.litros += a.quantidade
      combPrev.count += 1
      combPrev.valor += a.valorTotal
      prev.porCombustivel.set(prodNome, combPrev)
      bombaAggPrev.set(bombaCod, prev)

      const dayStr = (a.dataHoraAbastecimento || a.dataFiscal || '').substring(0, 10)
      if (dayStr.length === 10) {
        const dm = bombaDailyPrev.get(bombaCod) ?? new Map<string, number>()
        dm.set(dayStr, (dm.get(dayStr) ?? 0) + a.quantidade)
        bombaDailyPrev.set(bombaCod, dm)
      }
    }
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
            : Date.now()
        }

        const shiftAbast = abastecimentos.filter((a) => {
          // Pre-filter by date for performance
          const abastDate = (a.dataFiscal || a.dataHoraAbastecimento?.substring(0, 10)) ?? ''
          if (abastDate !== caixaDate) return false
          // Time window via UTC timestamps
          if (!a.dataHoraAbastecimento || !aberturaTs) return true
          const abastTs = new Date(a.dataHoraAbastecimento).getTime()
          if (abastTs < aberturaTs) return false
          if (abastTs > fechamentoTs!) return false
          return true
        })

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

        // Cross-reference formas de pagamento for this shift
        const shiftPgto = formasPgto.filter((fp) => {
          const fpDate = fp.dataMovimento?.substring(0, 10) ?? ''
          return fpDate === caixaDate
        })

        const pgtoAggShift = new Map<string, { nome: string; valor: number; count: number }>()
        for (const fp of shiftPgto) {
          const tipo = fp.tipoFormaPagamento || 'OUTROS'
          const prev = pgtoAggShift.get(tipo) ?? { nome: fp.nomeFormaPagamento || tipo, valor: 0, count: 0 }
          prev.valor += fp.valorPagamento
          prev.count += 1
          pgtoAggShift.set(tipo, prev)
        }

        const pagamentos: TurnoPagamento[] = Array.from(pgtoAggShift.entries())
          .map(([tipo, agg]) => ({ tipo, nome: agg.nome, valor: agg.valor, quantidade: agg.count }))
          .sort((a, b) => b.valor - a.valor)

        const totalVendas = pagamentos.reduce((s, p) => s + p.valor, 0)

        return {
          caixaCodigo: c.caixaCodigo,
          turno: c.turno || `Turno ${c.turnoCodigo}`,
          turnoCodigo: c.turnoCodigo,
          funcionarioNome: funcMap.get(c.funcionarioCodigo)?.nome ?? `Funcionário ${c.funcionarioCodigo}`,
          funcionarioCodigo: c.funcionarioCodigo,
          dataMovimento: c.dataMovimento,
          abertura: extractTime(c.abertura),
          fechamento: extractTime(c.fechamento),
          fechado: c.fechado,
          apurado: c.apurado,
          diferenca: c.diferenca,
          totalVendas,
          frentistas,
          pagamentos,
        }
      })
      .sort((a, b) => {
        if (a.fechado !== b.fechado) return a.fechado ? 1 : -1
        return b.dataMovimento.localeCompare(a.dataMovimento)
      })

    // ── Turno groups (group caixas by turnoCodigo + dataMovimento) ──
    const groupMap = new Map<string, typeof caixas>()
    for (const c of caixas) {
      const key = `${c.turnoCodigo}-${c.dataMovimento?.substring(0, 10)}`
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
          : Date.now()

        // All abastecimentos in the group's time window
        const grpAbast = abastecimentos.filter((a) => {
          const abastDate = (a.dataFiscal || a.dataHoraAbastecimento?.substring(0, 10)) ?? ''
          if (abastDate !== caixaDate) return false
          if (!a.dataHoraAbastecimento || !isFinite(aberturaTs)) return true
          const ts = new Date(a.dataHoraAbastecimento).getTime()
          return ts >= aberturaTs && ts <= maxFechamentoTs
        })

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

        // Merged pagamentos
        const pgtoMerge = new Map<string, TurnoPagamento>()
        for (const row of turnoRows.filter((r) => grpCaixas.some((c) => c.caixaCodigo === r.caixaCodigo))) {
          for (const p of row.pagamentos) {
            const prev = pgtoMerge.get(p.tipo) ?? { tipo: p.tipo, nome: p.nome, valor: 0, quantidade: 0 }
            pgtoMerge.set(p.tipo, { ...prev, valor: prev.valor + p.valor, quantidade: prev.quantidade + p.quantidade })
          }
        }

        const apuradoTotal = grpCaixas.reduce((s, c) => s + c.apurado, 0)
        const diferencaTotal = grpCaixas.filter((c) => c.fechado).reduce((s, c) => s + c.diferenca, 0)
        const totalVendasTotal = grpAbast.reduce((s, a) => s + a.valorTotal, 0)

        return {
          groupKey,
          turnoCodigo: first.turnoCodigo,
          turno: first.turno || `Turno ${first.turnoCodigo}`,
          dataMovimento: caixaDate,
          responsaveis: sorted.map((c) => funcMap.get(c.funcionarioCodigo)?.nome ?? `Func ${c.funcionarioCodigo}`),
          abertura: first.abertura ?? '',
          fechamento: sorted[sorted.length - 1].fechamento ?? '',
          fechado,
          apuradoTotal,
          diferencaTotal,
          totalVendasTotal,
          frentistas,
          pagamentos: Array.from(pgtoMerge.values()).sort((a, b) => b.valor - a.valor),
          caixaCodigos: grpCaixas.map((c) => c.caixaCodigo),
        }
      })
      .sort((a, b) => {
        if (a.fechado !== b.fechado) return a.fechado ? 1 : -1
        return b.dataMovimento.localeCompare(a.dataMovimento) || b.abertura.localeCompare(a.abertura)
      })

    // ── Caixa summary ──
    const caixaResumo: CaixaResumo = {
      totalApurado: caixas.reduce((s, c) => s + c.apurado, 0),
      totalDiferenca: caixas.filter((c) => c.fechado).reduce((s, c) => s + c.diferenca, 0),
      caixasAbertos: caixas.filter((c) => !c.fechado).length,
      caixasFechados: caixas.filter((c) => c.fechado).length,
    }

    // ── Payment breakdown ──
    // Cards are aggregated under tipoFormaPagamento ("CARTAO.") because the flat
    // /VENDA_FORMA_PAGAMENTO endpoint does not expose tipoTransacao (debit/credit).
    // To split, we'd need /VENDA's nested formaPagamento[].tipoTransacao field.
    const pgtoAgg = new Map<string, { nome: string; valor: number; count: number }>()
    for (const fp of formasPgto) {
      const tipo = fp.tipoFormaPagamento || 'OUTROS'
      const prev = pgtoAgg.get(tipo) ?? { nome: fp.nomeFormaPagamento || tipo, valor: 0, count: 0 }
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
    const dailyAgg = new Map<string, number>()
    for (const c of caixas) {
      if (!c.fechado) continue
      const dia = c.dataMovimento?.substring(0, 10)
      if (!dia) continue
      dailyAgg.set(dia, (dailyAgg.get(dia) ?? 0) + c.apurado)
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
      prevTotalLitros,
      prevFaturamentoCombustivel,
      prevTotalApurado,
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
      pagamentoBreakdown,
      apuradoPorDia,
      frentistasList,
      combustiveisList,
    }
  }, [abastecimentosData, abastPrevData, funcionariosRaw, bombasRaw, bicosRaw, produtosData, caixasRaw, caixasPrevRaw, formasPgtoRaw, empresaCodigo, dataInicial, dataFinal, abastCacheCurrent.isCacheHit, abastCacheCurrent.abastecimentos, abastCachePrev.isCacheHit, abastCachePrev.abastecimentos, caixasCacheCurrent.isCacheHit, caixasCacheCurrent.caixas, caixasCacheCurrent.formasPagamento, caixasCachePrev.isCacheHit, caixasCachePrev.caixas])

  return {
    ...computed,
    isLoading,
    hasEmpresa,
    // "Instantâneo": dados vieram do snapshot mensal (abastecimentos + caixas).
    isCacheHit: abastCacheCurrent.isCacheHit && caixasCacheCurrent.isCacheHit,
  }
}

export default useOperacaoData

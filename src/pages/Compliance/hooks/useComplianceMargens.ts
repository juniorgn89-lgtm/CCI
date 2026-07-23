import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchCompraItem, fetchTrocaPreco, type CompraItem } from '@/api/endpoints/combustiveis'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { fuelLabel } from '@/lib/fuel'
import type { Produto } from '@/api/types/produto'
import type { TrocaPreco } from '@/api/types/combustivel'

/**
 * Status de faixa por desvio da margem atual vs. a média das trocas do período.
 * Fase 1: referência = média das trocas do período selecionado (NÃO uma média
 * histórica de 365 dias — isso vem numa etapa posterior).
 */
export type StatusFaixa = 'verde' | 'amarelo' | 'laranja' | 'vermelho'

/** Limites de faixa de |desvio %| — DEFAULT fixo, configurável na Fase 2. */
const FAIXA_AMARELO = 20 // < 20% = Verde
const FAIXA_LARANJA = 40 // 20–40% = Amarelo
const FAIXA_VERMELHO = 70 // 40–70% = Laranja / > 70% = Vermelho

/** Classifica |desvio %| numa faixa de status (limites fixos da Fase 1).
 *  Exportado pra ser a FONTE ÚNICA dos limites (Detalhe + Visão Geral). */
export const faixaDeDesvio = (desvioPctAbs: number): StatusFaixa => {
  if (desvioPctAbs < FAIXA_AMARELO) return 'verde'
  if (desvioPctAbs < FAIXA_LARANJA) return 'amarelo'
  if (desvioPctAbs < FAIXA_VERMELHO) return 'laranja'
  return 'vermelho'
}

/* ─── Janela dos indicadores históricos (365d fixos, terminando no dataFinal) ─── */

/** Nº de dias da janela histórica fixa. */
const HIST_DIAS = 365
/** Buffer de trocas antes do início da janela (forward-fill da placa). */
const HIST_BUFFER_TROCA = 90
/** Janela do CMP diário = média ponderada das compras dos últimos 30 dias. */
const HIST_CMP_JANELA = 30

/** Soma `n` dias a uma data ISO (yyyy-MM-dd) e devolve ISO. */
const addDaysIso = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/* ─── Estatística (helpers puros, sem dependências) ─── */

/** Média aritmética. null se vazio. */
const mean = (xs: number[]): number | null =>
  xs.length === 0 ? null : xs.reduce((s, v) => s + v, 0) / xs.length

/** Desvio-padrão POPULACIONAL. null se vazio. */
const stdPop = (xs: number[]): number | null => {
  if (xs.length === 0) return null
  const m = xs.reduce((s, v) => s + v, 0) / xs.length
  const variance = xs.reduce((s, v) => s + (v - m) * (v - m), 0) / xs.length
  return Math.sqrt(variance)
}

/** Percentil (interpolação linear) sobre um array ASCENDENTE. null se vazio. */
const percentile = (sortedAsc: number[], p: number): number | null => {
  const n = sortedAsc.length
  if (n === 0) return null
  if (n === 1) return sortedAsc[0]
  const rank = (p / 100) * (n - 1)
  const lo = Math.floor(rank)
  const hi = Math.ceil(rank)
  if (lo === hi) return sortedAsc[lo]
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (rank - lo)
}

/** Média dos últimos `win` valores NÃO-nulos de uma série diária. */
const trailingMean = (vals: (number | null)[], win: number): number | null =>
  mean(vals.slice(Math.max(0, vals.length - win)).filter((v): v is number => v !== null))

/** Série de médias móveis trailing (janela `win`) — um ponto por dia. */
const rollingMean = (vals: (number | null)[], win: number): (number | null)[] =>
  vals.map((_, i) => mean(vals.slice(Math.max(0, i - win + 1), i + 1).filter((v): v is number => v !== null)))

/**
 * Ponto da série temporal por combustível (uma troca de preço realizada no
 * período). `margem` = placa − CMP; null quando não há CMP no período.
 */
export interface FuelSeriePoint {
  /** Data da troca (yyyy-MM-dd). */
  data: string
  /** Preço de placa à vista (novoPrecoA) registrado na troca. */
  placa: number
  /** Margem regulatória no ponto (placa − CMP do período). null se sem CMP. */
  margem: number | null
}

/**
 * Linha da tabela "CMP por combustível" — reconstrução da margem REGULATÓRIA
 * (placa − CMP) por produto de combustível, a partir de dados GET da Quality.
 */
export interface CmpRow {
  produtoCodigo: number
  nome: string
  /** Volume total comprado no período (L). */
  qtdComprada: number
  /** Nº de notas de compra distintas (compraCodigo) no período. */
  numNotas: number
  /** Custo médio ponderado = Σ(qtd × precoCusto) / Σ(qtd). null se sem compra. */
  cmp: number | null
  /** Placa vigente à vista (novoPrecoA da troca de preço mais recente). */
  placaVigente: number | null
  /** Coluna B da tabela de preços (a prazo/cartão). */
  placaB: number | null
  /** Coluna C da tabela de preços. */
  placaC: number | null
  /** Margem regulatória absoluta (placa − CMP), em R$/L. */
  margemAbs: number | null
  /** Margem regulatória em % (margem ÷ placa × 100). */
  margemPct: number | null
  /** Data (yyyy-MM-dd) da troca de preço usada como placa vigente. */
  placaData: string | null
  /** Série temporal (placa/margem por troca) no período, ascendente por data. */
  serie: FuelSeriePoint[]
  /** Média das margens das trocas do período. null se sem CMP/trocas. */
  margemMedia: number | null
  /** Desvio % da margem atual vs. a média do período. null se não computável. */
  desvioPct: number | null
  /** Faixa de status derivada de |desvioPct|. null quando não computável. */
  statusFaixa: StatusFaixa | null
}

/**
 * Ponto DIÁRIO da reconstrução histórica (365d fixos). `margem` = placa − CMP
 * diário; `mm30`/`mm90` = médias móveis trailing da margem (overlay do gráfico).
 * Valores null nos dias sem placa e/ou sem custo conhecido.
 */
export interface FuelDailyPoint {
  /** Dia (yyyy-MM-dd). */
  data: string
  /** Placa à vista vigente no dia (forward-fill da última troca ≤ dia). */
  placa: number | null
  /** CMP diário = média ponderada das compras dos últimos 30 dias (modelo v1). */
  cmp: number | null
  /** Margem regulatória do dia (placa − CMP). null se placa ou CMP indisponível. */
  margem: number | null
  /** Média móvel 30d da margem no dia. */
  mm30: number | null
  /** Média móvel 90d da margem no dia. */
  mm90: number | null
}

/** Comparativo da margem atual vs. uma média móvel (diferença R$/L e %). */
export interface HistComparativo {
  /** Janela da média móvel em dias (30, 90, 180 ou 365). */
  janela: number
  /** Valor da média móvel (R$/L). null se sem dado na janela. */
  mm: number | null
  /** Diferença absoluta margem atual − média (R$/L). */
  difAbs: number | null
  /** Diferença % ((atual − média) / média × 100). null se média ≤ 0. */
  difPct: number | null
}

/**
 * Indicadores históricos por combustível sobre a janela FIXA de 365 dias
 * terminando no `dataFinal` global. Só é populado com UM posto no escopo
 * (placa/margem são por posto). Modelo v1 — ver disclaimers na tela.
 */
export interface HistIndicadores {
  produtoCodigo: number
  nome: string
  /** Série diária (365 pontos) placa/CMP/margem + médias móveis. */
  daily: FuelDailyPoint[]
  /** Margem não-nula mais recente da série. */
  margemAtual: number | null
  /** Médias móveis trailing terminando no dataFinal. */
  mm30: number | null
  mm90: number | null
  mm180: number | null
  mm365: number | null
  /** Estatísticas das margens diárias não-nulas dos últimos 365 dias. */
  mediana: number | null
  p25: number | null
  p75: number | null
  minimo: number | null
  maximo: number | null
  /** Desvio-padrão populacional das margens diárias. */
  desvioPadrao: number | null
  /** Comparativos margem atual vs. médias móveis 30/90/180/365. */
  comparativos: HistComparativo[]
  /** Desvio % da margem atual vs. a média móvel de 90 dias. null se MM90 ≤ 0. */
  desvioVsMM90: number | null
  /** Faixa de status HISTÓRICA (de |desvioVsMM90|). null se não computável. */
  statusFaixaHist: StatusFaixa | null
  /** Nº de dias COM margem real (placa+custo) na janela — cobertura efetiva.
   *  Menor que 365 quando a integração ainda não tem 1 ano de dado. */
  coberturaDias: number
  /** Primeiro dia com margem real (yyyy-MM-dd). null se nenhum. */
  desde: string | null
}

/** Linha do log de troca de preço (audit-trail preview do /TROCA_PRECO). */
export interface TrocaLogRow {
  key: string
  data: string
  hora: string
  turno: string
  produtoCodigo: number
  nome: string
  /** Preço A anterior (antes da troca). */
  precoA: number
  /** Preço A novo (depois da troca). */
  novoPrecoA: number
  /** Custo do produto registrado no momento da troca. */
  custo: number
  /** Markup % da coluna A registrado na troca. */
  percMarkupA: number
  /** Instante combinado (data+hora) — usado só para ordenação. */
  sortKey: string
}

interface ComplianceMargensResult {
  cmpRows: CmpRow[]
  trocaLog: TrocaLogRow[]
  /** Indicadores históricos (365d fixos) por combustível. [] se >1 posto. */
  histIndicadores: HistIndicadores[]
  /** Nº de postos no escopo atual (seleção ou rede permitida). */
  scopedCount: number
  isLoading: boolean
  /** Carregando as séries históricas (queries de 365d + buffer). */
  isLoadingHist: boolean
  error: unknown
}

/** Filtra um dataset rede-wide pelo subconjunto de postos do escopo. */
const subset = <T extends { empresaCodigo: number }>(arr: T[], codes: number[]): T[] =>
  codes.length === 0 ? arr : arr.filter((r) => codes.includes(r.empresaCodigo))

/**
 * Reconstrói a margem regulatória de combustível (Preço de Placa − CMP) a partir
 * de /COMPRA_ITEM (custo médio ponderado das notas) e /TROCA_PRECO (preço de placa
 * vigente). READ-ONLY: apenas GET via useQuery. Consolidado rede-wide, recortado
 * pelo subconjunto de postos do filtro global (`[]` = toda a rede permitida).
 */
const useComplianceMargens = (): ComplianceMargensResult => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()

  // "Todos" ([]) = postos PERMITIDOS (não a rede Quality inteira). Espelha o
  // padrão do Financeiro: busca rede-wide keyed por período e recorta no cliente.
  const { data: empresasResp } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })
  const empresasPermitidas = useEmpresasPermitidas(empresasResp?.resultados ?? [])
  const scopedCodes = useMemo(
    () => (empresaCodigos.length > 0 ? empresaCodigos : empresasPermitidas.map((e) => e.codigo)),
    [empresaCodigos, empresasPermitidas],
  )

  // Catálogo de produtos — identifica quais são combustível (produto.combustivel).
  // Mesmo critério do módulo Qualidade de Dados (produtoMap keyed by produtoCodigo).
  const { data: produtosData = [], isLoading: isLoadingProdutos } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100,
    ),
    staleTime: 30 * 60 * 1000,
  })

  // Itens de nota de compra (rede-wide, keyed por período) — fonte do CMP.
  const { data: compraItensRaw = [], isLoading: isLoadingCompra, error: errorCompra } = useQuery({
    queryKey: ['compraItem', 'rede', dataInicial, dataFinal],
    queryFn: () => fetchAllPages<CompraItem>(
      (p) => fetchCompraItem({ dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
  })

  // Trocas de preço REALIZADAS no período (rede-wide) — fonte da placa vigente
  // e do log de auditoria.
  const { data: trocasRaw = [], isLoading: isLoadingTrocas, error: errorTrocas } = useQuery({
    queryKey: ['trocaPreco', 'rede', dataInicial, dataFinal],
    queryFn: () => fetchAllPages<TrocaPreco>(
      (p) => fetchTrocaPreco({ dataInicial, dataFinal, realizada: true, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
  })

  /* ─── Séries históricas (365d fixos terminando no dataFinal) ─── */
  // Só valem para UM posto (placa/margem são por posto) — evitamos os fetches
  // longos quando há vários postos no escopo. Buffer antes da janela: 90d pra
  // conhecer a placa no início e 30d pro CMP trailing.
  const histEnabled = !!dataFinal && scopedCodes.length === 1
  const histTrocaInicio = dataFinal ? addDaysIso(dataFinal, -(HIST_DIAS + HIST_BUFFER_TROCA)) : ''
  const histCompraInicio = dataFinal ? addDaysIso(dataFinal, -(HIST_DIAS + HIST_CMP_JANELA - 1)) : ''

  const { data: trocasHistRaw = [], isLoading: isLoadingTrocasHist } = useQuery({
    queryKey: ['trocaPreco', 'rede', 'hist', histTrocaInicio, dataFinal],
    queryFn: () => fetchAllPages<TrocaPreco>(
      (p) => fetchTrocaPreco({ dataInicial: histTrocaInicio, dataFinal, realizada: true, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 80,
    ),
    enabled: histEnabled,
  })

  const { data: compraHistRaw = [], isLoading: isLoadingCompraHist } = useQuery({
    queryKey: ['compraItem', 'rede', 'hist', histCompraInicio, dataFinal],
    queryFn: () => fetchAllPages<CompraItem>(
      (p) => fetchCompraItem({ dataInicial: histCompraInicio, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 40,
    ),
    enabled: histEnabled,
  })

  // Catálogo compartilhado: mapa produtoCodigo → nome e conjunto de combustíveis.
  const catalog = useMemo(() => {
    const produtoByCodigo = new Map<number, Produto>(produtosData.map((p) => [p.produtoCodigo, p]))
    const fuelCodes = new Set<number>()
    for (const p of produtosData) {
      if (p.combustivel === true) fuelCodes.add(p.produtoCodigo)
    }
    const nomeDe = (codigo: number): string =>
      fuelLabel(produtoByCodigo.get(codigo)?.nome ?? '') || `Produto ${codigo}`
    return { fuelCodes, nomeDe }
  }, [produtosData])

  const computed = useMemo(() => {
    const { fuelCodes, nomeDe } = catalog

    // Recorta os datasets rede-wide pelo escopo de postos.
    const compraItens = subset(compraItensRaw, scopedCodes)
    const trocas = subset(trocasRaw, scopedCodes)

    /* ─── CMP por combustível (Σ qtd×custo ÷ Σ qtd) ─── */
    interface CmpAcc {
      sumQty: number
      sumCost: number
      notas: Set<number>
    }
    const cmpAcc = new Map<number, CmpAcc>()
    for (const item of compraItens) {
      if (!fuelCodes.has(item.produtoCodigo)) continue
      const qty = item.quantidade ?? 0
      if (qty <= 0) continue
      const acc = cmpAcc.get(item.produtoCodigo) ?? { sumQty: 0, sumCost: 0, notas: new Set<number>() }
      acc.sumQty += qty
      acc.sumCost += qty * (item.precoCusto ?? 0)
      acc.notas.add(item.compraCodigo)
      cmpAcc.set(item.produtoCodigo, acc)
    }

    /* ─── Placa vigente = troca REALIZADA mais recente por produto ─── */
    interface PlacaAcc {
      sortKey: string
      data: string
      novoPrecoA: number
      novoPrecoB: number
      novoPrecoC: number
    }
    const placaByProduto = new Map<number, PlacaAcc>()
    // Pontos crus da série por produto (data + placa), ordenados depois por sortKey.
    const pointsByProduto = new Map<number, { sortKey: string; data: string; placa: number }[]>()
    const trocaLog: TrocaLogRow[] = []

    for (const troca of trocas) {
      if (troca.realizada !== true) continue
      const data = (troca.data ?? '').split('T')[0]
      const hora = troca.hora ?? ''
      const sortKey = `${data}T${hora}`
      for (const it of troca.precoItens ?? []) {
        if (!fuelCodes.has(it.codigoProduto)) continue

        // Log de auditoria — uma linha por item de troca de combustível.
        trocaLog.push({
          key: `${troca.trocaPrecoCodigo}-${it.codigoProduto}`,
          data,
          hora,
          turno: troca.turno ?? '',
          produtoCodigo: it.codigoProduto,
          nome: nomeDe(it.codigoProduto),
          precoA: it.precoA ?? 0,
          novoPrecoA: it.novoPrecoA ?? 0,
          custo: it.custo ?? 0,
          percMarkupA: it.percMarkupA ?? 0,
          sortKey,
        })

        // Ponto da série temporal (uma troca de preço por combustível).
        const pts = pointsByProduto.get(it.codigoProduto) ?? []
        pts.push({ sortKey, data, placa: it.novoPrecoA ?? 0 })
        pointsByProduto.set(it.codigoProduto, pts)

        // Placa vigente = a troca com sortKey mais alto (mais recente).
        const prev = placaByProduto.get(it.codigoProduto)
        if (!prev || sortKey > prev.sortKey) {
          placaByProduto.set(it.codigoProduto, {
            sortKey,
            data,
            novoPrecoA: it.novoPrecoA ?? 0,
            novoPrecoB: it.novoPrecoB ?? 0,
            novoPrecoC: it.novoPrecoC ?? 0,
          })
        }
      }
    }

    /* ─── Monta as linhas da tabela 1 (união compras ∪ trocas) ─── */
    const produtoCodigos = new Set<number>([...cmpAcc.keys(), ...placaByProduto.keys()])
    const cmpRows: CmpRow[] = Array.from(produtoCodigos).map((codigo) => {
      const acc = cmpAcc.get(codigo)
      const placa = placaByProduto.get(codigo)
      const cmp = acc && acc.sumQty > 0 ? acc.sumCost / acc.sumQty : null
      const placaVigente = placa ? placa.novoPrecoA : null
      const margemAbs = cmp !== null && placaVigente !== null ? placaVigente - cmp : null
      const margemPct = margemAbs !== null && placaVigente && placaVigente > 0
        ? (margemAbs / placaVigente) * 100
        : null

      // Série temporal ascendente por data — cada troca vira { placa, margem }.
      const serie: FuelSeriePoint[] = (pointsByProduto.get(codigo) ?? [])
        .slice()
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
        .map((p) => ({ data: p.data, placa: p.placa, margem: cmp !== null ? p.placa - cmp : null }))

      // Status por faixa (só quando há CMP): compara a margem ATUAL (= margemAbs,
      // a troca mais recente) com a MÉDIA das margens das trocas do período.
      const margens = serie.map((p) => p.margem).filter((m): m is number => m !== null)
      const margemMedia = margens.length > 0 ? margens.reduce((s, v) => s + v, 0) / margens.length : null
      let desvioPct: number | null = null
      let statusFaixa: StatusFaixa | null = null
      if (margemMedia !== null && margemAbs !== null) {
        desvioPct = margemMedia > 0 ? ((margemAbs - margemMedia) / margemMedia) * 100 : 0
        statusFaixa = faixaDeDesvio(Math.abs(desvioPct))
      }

      return {
        produtoCodigo: codigo,
        nome: nomeDe(codigo),
        qtdComprada: acc?.sumQty ?? 0,
        numNotas: acc?.notas.size ?? 0,
        cmp,
        placaVigente,
        placaB: placa ? placa.novoPrecoB : null,
        placaC: placa ? placa.novoPrecoC : null,
        margemAbs,
        margemPct,
        placaData: placa ? placa.data : null,
        serie,
        margemMedia,
        desvioPct,
        statusFaixa,
      }
    })
    cmpRows.sort((a, b) => b.qtdComprada - a.qtdComprada || a.nome.localeCompare(b.nome))

    // Log ordenado do mais recente pro mais antigo.
    trocaLog.sort((a, b) => b.sortKey.localeCompare(a.sortKey))

    return { cmpRows, trocaLog }
  }, [catalog, compraItensRaw, trocasRaw, scopedCodes])

  /* ─── Indicadores históricos (365d fixos) — reconstrução dia a dia ─── */
  const histIndicadores = useMemo<HistIndicadores[]>(() => {
    // Placa/margem são por posto → só computa com UM posto no escopo.
    if (!dataFinal || scopedCodes.length !== 1) return []
    const { fuelCodes, nomeDe } = catalog

    // Lista CONTÍNUA de 365 dias terminando no dataFinal (independe do início do
    // período selecionado). ISO yyyy-MM-dd compara lexicograficamente = cronológico.
    const dias: string[] = []
    let cursor = addDaysIso(dataFinal, -(HIST_DIAS - 1))
    while (cursor <= dataFinal) {
      dias.push(cursor)
      cursor = addDaysIso(cursor, 1)
    }

    // Agrupa compras (custo) e placas (troca) por combustível, recortadas no escopo.
    interface HistCompra { date: string; qty: number; cost: number }
    interface HistPlaca { sortKey: string; date: string; placa: number }
    const comprasByProd = new Map<number, HistCompra[]>()
    for (const item of subset(compraHistRaw, scopedCodes)) {
      if (!fuelCodes.has(item.produtoCodigo)) continue
      const qty = item.quantidade ?? 0
      if (qty <= 0) continue
      const date = (item.dataEntrada ?? '').split('T')[0]
      if (!date) continue
      const arr = comprasByProd.get(item.produtoCodigo) ?? []
      arr.push({ date, qty, cost: item.precoCusto ?? 0 })
      comprasByProd.set(item.produtoCodigo, arr)
    }
    const placasByProd = new Map<number, HistPlaca[]>()
    for (const troca of subset(trocasHistRaw, scopedCodes)) {
      if (troca.realizada !== true) continue
      const date = (troca.data ?? '').split('T')[0]
      if (!date) continue
      const sortKey = `${date}T${troca.hora ?? ''}`
      for (const it of troca.precoItens ?? []) {
        if (!fuelCodes.has(it.codigoProduto)) continue
        const arr = placasByProd.get(it.codigoProduto) ?? []
        arr.push({ sortKey, date, placa: it.novoPrecoA ?? 0 })
        placasByProd.set(it.codigoProduto, arr)
      }
    }

    const codigos = new Set<number>([...comprasByProd.keys(), ...placasByProd.keys()])
    const rows: { row: HistIndicadores; qty: number }[] = []

    for (const codigo of codigos) {
      const placas = (placasByProd.get(codigo) ?? []).slice().sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      if (placas.length === 0) continue // sem placa não há margem regulatória
      const compras = (comprasByProd.get(codigo) ?? []).slice().sort((a, b) => a.date.localeCompare(b.date))

      // Ponteiros monotônicos: placa (forward-fill) + janela trailing-30d do CMP.
      let pi = 0
      let lastPlaca: number | null = null
      let ci = 0 // entra na janela (data ≤ dia)
      let wi = 0 // sai da janela (data < dia−29)
      let sumQty = 0
      let sumCost = 0
      let lastCmp: number | null = null
      let anyPurchase = false

      const daily: FuelDailyPoint[] = dias.map((dia) => {
        // placa(dia) = última troca realizada com data ≤ dia.
        while (pi < placas.length && placas[pi].date <= dia) {
          lastPlaca = placas[pi].placa
          pi++
        }
        const placa = lastPlaca

        // cmp(dia) = Σ(qtd×custo)/Σ(qtd) das compras em [dia−29 ... dia].
        const lowIso = addDaysIso(dia, -(HIST_CMP_JANELA - 1))
        while (ci < compras.length && compras[ci].date <= dia) {
          sumQty += compras[ci].qty
          sumCost += compras[ci].qty * compras[ci].cost
          anyPurchase = true
          ci++
        }
        while (wi < ci && compras[wi].date < lowIso) {
          sumQty -= compras[wi].qty
          sumCost -= compras[wi].qty * compras[wi].cost
          wi++
        }
        // Janela vazia: zera explicitamente pra evitar resíduo de ponto flutuante
        // (adição/subtração da mesma qtd não devolve exatamente 0).
        if (wi === ci) {
          sumQty = 0
          sumCost = 0
        }
        let cmp: number | null
        if (sumQty > 1e-9) {
          cmp = sumCost / sumQty
          lastCmp = cmp
        } else {
          cmp = anyPurchase ? lastCmp : null // forward-fill; null antes da 1ª compra
        }

        const margem = placa !== null && cmp !== null ? placa - cmp : null
        return { data: dia, placa, cmp, margem, mm30: null, mm90: null }
      })

      // Médias móveis trailing por dia (curvas do gráfico).
      const margens = daily.map((p) => p.margem)
      const mm30Serie = rollingMean(margens, 30)
      const mm90Serie = rollingMean(margens, 90)
      daily.forEach((p, i) => {
        p.mm30 = mm30Serie[i]
        p.mm90 = mm90Serie[i]
      })

      const validMargens = margens.filter((v): v is number => v !== null)
      if (validMargens.length === 0) continue
      const sortedAsc = validMargens.slice().sort((a, b) => a - b)

      // Margem atual = margem não-nula mais recente.
      let margemAtual: number | null = null
      for (let i = daily.length - 1; i >= 0; i--) {
        if (daily[i].margem !== null) {
          margemAtual = daily[i].margem
          break
        }
      }

      const mm30 = trailingMean(margens, 30)
      const mm90 = trailingMean(margens, 90)
      const mm180 = trailingMean(margens, 180)
      const mm365 = trailingMean(margens, 365)

      const buildComp = (janela: number, mm: number | null): HistComparativo => ({
        janela,
        mm,
        difAbs: mm !== null && margemAtual !== null ? margemAtual - mm : null,
        difPct: mm !== null && mm > 0 && margemAtual !== null ? ((margemAtual - mm) / mm) * 100 : null,
      })

      let desvioVsMM90: number | null = null
      let statusFaixaHist: StatusFaixa | null = null
      if (mm90 !== null && mm90 > 0 && margemAtual !== null) {
        desvioVsMM90 = ((margemAtual - mm90) / mm90) * 100
        statusFaixaHist = faixaDeDesvio(Math.abs(desvioVsMM90))
      }

      rows.push({
        qty: compras.reduce((s, c) => s + c.qty, 0),
        row: {
          produtoCodigo: codigo,
          nome: nomeDe(codigo),
          daily,
          margemAtual,
          mm30,
          mm90,
          mm180,
          mm365,
          mediana: percentile(sortedAsc, 50),
          p25: percentile(sortedAsc, 25),
          p75: percentile(sortedAsc, 75),
          minimo: sortedAsc[0],
          maximo: sortedAsc[sortedAsc.length - 1],
          desvioPadrao: stdPop(validMargens),
          comparativos: [buildComp(30, mm30), buildComp(90, mm90), buildComp(180, mm180), buildComp(365, mm365)],
          desvioVsMM90,
          statusFaixaHist,
          coberturaDias: validMargens.length,
          desde: daily.find((p) => p.margem !== null)?.data ?? null,
        },
      })
    }

    return rows
      .sort((a, b) => b.qty - a.qty || a.row.nome.localeCompare(b.row.nome))
      .map((r) => r.row)
  }, [catalog, compraHistRaw, trocasHistRaw, scopedCodes, dataFinal])

  return {
    cmpRows: computed.cmpRows,
    trocaLog: computed.trocaLog,
    histIndicadores,
    scopedCount: scopedCodes.length,
    isLoading: isLoadingProdutos || isLoadingCompra || isLoadingTrocas,
    isLoadingHist: histEnabled && (isLoadingTrocasHist || isLoadingCompraHist),
    error: errorCompra ?? errorTrocas ?? null,
  }
}

export default useComplianceMargens

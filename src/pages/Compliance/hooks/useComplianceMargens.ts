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

/** Classifica |desvio %| numa faixa de status (limites fixos da Fase 1). */
const faixaDeDesvio = (desvioPctAbs: number): StatusFaixa => {
  if (desvioPctAbs < FAIXA_AMARELO) return 'verde'
  if (desvioPctAbs < FAIXA_LARANJA) return 'amarelo'
  if (desvioPctAbs < FAIXA_VERMELHO) return 'laranja'
  return 'vermelho'
}

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
  /** Nº de postos no escopo atual (seleção ou rede permitida). */
  scopedCount: number
  isLoading: boolean
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

  const computed = useMemo(() => {
    // Mapa produtoCodigo → Produto e conjunto dos códigos que são combustível.
    const produtoByCodigo = new Map<number, Produto>(produtosData.map((p) => [p.produtoCodigo, p]))
    const fuelCodes = new Set<number>()
    for (const p of produtosData) {
      if (p.combustivel === true) fuelCodes.add(p.produtoCodigo)
    }
    const nomeDe = (codigo: number): string =>
      fuelLabel(produtoByCodigo.get(codigo)?.nome ?? '') || `Produto ${codigo}`

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
  }, [produtosData, compraItensRaw, trocasRaw, scopedCodes])

  return {
    cmpRows: computed.cmpRows,
    trocaLog: computed.trocaLog,
    scopedCount: scopedCodes.length,
    isLoading: isLoadingProdutos || isLoadingCompra || isLoadingTrocas,
    error: errorCompra ?? errorTrocas ?? null,
  }
}

export default useComplianceMargens

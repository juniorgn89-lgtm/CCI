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
import { faixaDeDesvio, type StatusFaixa } from '@/pages/Compliance/hooks/useComplianceMargens'

/**
 * Célula da matriz Visão Geral: um combustível de UM posto sobre o período
 * selecionado. Placa/margem são por posto; CMP é ponderado do período.
 */
export interface VisaoGeralCell {
  produtoCodigo: number
  nome: string
  /** Custo médio ponderado = Σ(qtd × precoCusto) ÷ Σ(qtd) no período. null se sem compra. */
  cmp: number | null
  /** Placa à vista (novoPrecoA) da troca realizada mais recente do posto+combustível. */
  placa: number | null
  /** Margem regulatória (placa − CMP), R$/L. null se qualquer lado null. */
  margem: number | null
  /** Margem regulatória em % (margem ÷ placa × 100). null se placa ≤ 0 ou margem null. */
  margemPct: number | null
  /** Faixa de status (desvio da margem atual vs. média das trocas do período). */
  status: StatusFaixa | null
  /** Desvio % que gerou a faixa. null quando não computável. */
  desvioPct: number | null
}

/** Linha da matriz Visão Geral: um posto e suas células por combustível. */
export interface VisaoGeralPosto {
  empresaCodigo: number
  nome: string
  /** Células indexadas por produtoCodigo (só as com dado no período). */
  fuels: Map<number, VisaoGeralCell>
}

/** Coluna da matriz: um combustível distinto presente no período/escopo. */
export interface FuelColumn {
  produtoCodigo: number
  nome: string
}

/** Contagem de células (não-nulas) por faixa — resumo answer-first. */
export interface VisaoGeralResumo {
  verde: number
  amarelo: number
  laranja: number
  vermelho: number
  /** Total de células com status computável. */
  total: number
}

interface ComplianceVisaoGeralResult {
  /** Postos do escopo, ordenados por nome. */
  postos: VisaoGeralPosto[]
  /** Combustíveis presentes no período (colunas), ordenados por litros comprados desc. */
  fuels: FuelColumn[]
  resumo: VisaoGeralResumo
  isLoading: boolean
  error: unknown
}

/** Nome amigável do posto a partir da Empresa (fantasia > razão > fallback). */
const postoNome = (e: { codigo: number; fantasia?: string; razao?: string }): string =>
  e.fantasia || e.razao || `Posto ${e.codigo}`

/**
 * Panorama por posto × combustível sobre o PERÍODO selecionado (status leve).
 * READ-ONLY: só GET via useQuery, reaproveitando EXATAMENTE as mesmas queryKeys
 * do useComplianceMargens (`['empresas']`, `['produtos']`,
 * `['compraItem','rede',dataInicial,dataFinal]`,
 * `['trocaPreco','rede',dataInicial,dataFinal]`) — o React Query compartilha o
 * cache e não há fetch em dobro.
 */
const useComplianceVisaoGeral = (): ComplianceVisaoGeralResult => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()

  // Postos permitidos (mesma fonte/queryKey do useComplianceMargens).
  const { data: empresasResp } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })
  const empresasPermitidas = useEmpresasPermitidas(empresasResp?.resultados ?? [])

  // Escopo = permitidos ∩ filtro de empresa (vazio = todos os permitidos).
  const scopedPostos = useMemo(() => {
    const base = empresaCodigos.length > 0
      ? empresasPermitidas.filter((e) => empresaCodigos.includes(e.codigo))
      : empresasPermitidas
    return base.slice().sort((a, b) => postoNome(a).localeCompare(postoNome(b)))
  }, [empresasPermitidas, empresaCodigos])
  const scopedCodes = useMemo(() => scopedPostos.map((e) => e.codigo), [scopedPostos])

  // Catálogo de produtos (mesma queryKey do useComplianceMargens).
  const { data: produtosData = [], isLoading: isLoadingProdutos } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100,
    ),
    staleTime: 30 * 60 * 1000,
  })

  // Itens de nota de compra (rede-wide, keyed por período) — mesma queryKey.
  const { data: compraItensRaw = [], isLoading: isLoadingCompra, error: errorCompra } = useQuery({
    queryKey: ['compraItem', 'rede', dataInicial, dataFinal],
    queryFn: () => fetchAllPages<CompraItem>(
      (p) => fetchCompraItem({ dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
  })

  // Trocas de preço realizadas no período (rede-wide) — mesma queryKey.
  const { data: trocasRaw = [], isLoading: isLoadingTrocas, error: errorTrocas } = useQuery({
    queryKey: ['trocaPreco', 'rede', dataInicial, dataFinal],
    queryFn: () => fetchAllPages<TrocaPreco>(
      (p) => fetchTrocaPreco({ dataInicial, dataFinal, realizada: true, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 20,
    ),
  })

  // Catálogo: conjunto de combustíveis + resolução de nome (produto.combustivel).
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

  const { postos, fuels, resumo } = useMemo(() => {
    const { fuelCodes, nomeDe } = catalog
    const scopedSet = new Set(scopedCodes)

    /* ─── CMP por (posto, combustível) = Σ(qtd×custo) / Σ(qtd) ─── */
    const cmpAcc = new Map<number, Map<number, { sumQty: number; sumCost: number }>>()
    for (const item of compraItensRaw) {
      if (!scopedSet.has(item.empresaCodigo)) continue
      if (!fuelCodes.has(item.produtoCodigo)) continue
      const qty = item.quantidade ?? 0
      if (qty <= 0) continue
      const porProduto = cmpAcc.get(item.empresaCodigo) ?? new Map()
      const acc = porProduto.get(item.produtoCodigo) ?? { sumQty: 0, sumCost: 0 }
      acc.sumQty += qty
      acc.sumCost += qty * (item.precoCusto ?? 0)
      porProduto.set(item.produtoCodigo, acc)
      cmpAcc.set(item.empresaCodigo, porProduto)
    }

    /* ─── Pontos de troca por (posto, combustível), ordenáveis por sortKey ─── */
    const pointsAcc = new Map<number, Map<number, { sortKey: string; placa: number }[]>>()
    for (const troca of trocasRaw) {
      if (troca.realizada !== true) continue
      if (!scopedSet.has(troca.empresaCodigo)) continue
      const data = (troca.data ?? '').split('T')[0]
      const sortKey = `${data}T${troca.hora ?? ''}`
      for (const it of troca.precoItens ?? []) {
        if (!fuelCodes.has(it.codigoProduto)) continue
        const porProduto = pointsAcc.get(troca.empresaCodigo) ?? new Map()
        const pts = porProduto.get(it.codigoProduto) ?? []
        pts.push({ sortKey, placa: it.novoPrecoA ?? 0 })
        porProduto.set(it.codigoProduto, pts)
        pointsAcc.set(troca.empresaCodigo, porProduto)
      }
    }

    // Litros comprados por combustível (todo o escopo) — ordena as colunas.
    const litrosPorFuel = new Map<number, number>()
    const resumoAcc: VisaoGeralResumo = { verde: 0, amarelo: 0, laranja: 0, vermelho: 0, total: 0 }

    const postos: VisaoGeralPosto[] = scopedPostos.map((emp) => {
      const cmpProdutos = cmpAcc.get(emp.codigo)
      const pointProdutos = pointsAcc.get(emp.codigo)
      const codigos = new Set<number>([
        ...(cmpProdutos ? cmpProdutos.keys() : []),
        ...(pointProdutos ? pointProdutos.keys() : []),
      ])

      const fuels = new Map<number, VisaoGeralCell>()
      for (const codigo of codigos) {
        const acc = cmpProdutos?.get(codigo)
        const cmp = acc && acc.sumQty > 0 ? acc.sumCost / acc.sumQty : null
        if (acc) litrosPorFuel.set(codigo, (litrosPorFuel.get(codigo) ?? 0) + acc.sumQty)

        // Placa vigente = ponto com sortKey mais alto (mais recente).
        const pts = (pointProdutos?.get(codigo) ?? []).slice().sort((a, b) => a.sortKey.localeCompare(b.sortKey))
        const placa = pts.length > 0 ? pts[pts.length - 1].placa : null

        const margem = cmp !== null && placa !== null ? placa - cmp : null
        const margemPct = margem !== null && placa !== null && placa > 0 ? (margem / placa) * 100 : null

        // Status leve: margem atual (= margem) vs. média das margens das trocas
        // do período (mesma lógica do status por período do useComplianceMargens).
        let status: StatusFaixa | null = null
        let desvioPct: number | null = null
        if (cmp !== null && margem !== null) {
          const margens = pts.map((p) => p.placa - cmp)
          const margemMedia = margens.length > 0 ? margens.reduce((s, v) => s + v, 0) / margens.length : null
          if (margemMedia !== null) {
            desvioPct = margemMedia > 0 ? ((margem - margemMedia) / margemMedia) * 100 : 0
            status = faixaDeDesvio(Math.abs(desvioPct))
          }
        }

        if (status !== null) {
          resumoAcc[status] += 1
          resumoAcc.total += 1
        }

        fuels.set(codigo, { produtoCodigo: codigo, nome: nomeDe(codigo), cmp, placa, margem, margemPct, status, desvioPct })
      }

      return { empresaCodigo: emp.codigo, nome: postoNome(emp), fuels }
    })

    // Colunas de combustível = união dos combustíveis presentes, ordenadas por
    // litros comprados desc (fallback: nome).
    const fuelCodesPresent = new Set<number>()
    for (const p of postos) for (const c of p.fuels.keys()) fuelCodesPresent.add(c)
    const fuels: FuelColumn[] = Array.from(fuelCodesPresent)
      .map((codigo) => ({ produtoCodigo: codigo, nome: nomeDe(codigo) }))
      .sort((a, b) =>
        (litrosPorFuel.get(b.produtoCodigo) ?? 0) - (litrosPorFuel.get(a.produtoCodigo) ?? 0)
        || a.nome.localeCompare(b.nome),
      )

    return { postos, fuels, resumo: resumoAcc }
  }, [catalog, compraItensRaw, trocasRaw, scopedPostos, scopedCodes])

  return {
    postos,
    fuels,
    resumo,
    isLoading: isLoadingProdutos || isLoadingCompra || isLoadingTrocas,
    error: errorCompra ?? errorTrocas ?? null,
  }
}

export default useComplianceVisaoGeral

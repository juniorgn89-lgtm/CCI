import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendasFuncionarioCache, type ApuracaoVendaFuncionarioRow } from '@/api/supabase/apuracao'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { monthToDateProjFactor, previousCalendarMonth } from '@/lib/period'
import type { Empresa } from '@/api/types/empresa'

/** Vendedor de LOJA (conveniência) agregado rede-wide, carimbado com o posto. */
export interface LojaVendedorRow {
  funcionarioCodigo: number
  /** Posto de origem — parte da identidade única (ver PEGADINHA abaixo). */
  empresaCodigo: number
  postoNome?: string
  nome: string
  faturamento: number
  custo: number
  /** Margem = (faturamento − custo) ÷ faturamento × 100. */
  margemPct: number
  itens: number
  cupons: number
  /** Ticket médio = faturamento ÷ cupons. */
  ticketMedio: number
  /** Faturamento projetado pro fim do mês (mês-a-data); = faturamento fora da janela. */
  faturamentoTend: number
  /** Cupons projetados pro fim do mês (arredondado); = cupons fora da janela. */
  cuponsTend: number
}

/** Item de pódio cross-posto — leva o posto do colocado. */
export interface LojaPodio {
  funcionarioCodigo: number
  empresaCodigo: number
  postoNome?: string
  nome: string
  valor: number
}

type LojaPodios = { faturamento: LojaPodio[]; cupons: LojaPodio[]; ticket: LojaPodio[] }

export interface LojaRedeWideData {
  rows: LojaVendedorRow[]
  kpis: { faturamento: number; custo: number; margemPct: number; ticketMedio: number; cupons: number; itens: number }
  podios: LojaPodios
  /** Pódios do MÊS-CALENDÁRIO ANTERIOR (mesma estrutura cross-posto). Só os
   *  pódios têm versão "mês anterior" — KPIs e tabela seguem no filtro. */
  podiosPrev: LojaPodios
  /** Rows cross-posto do mês anterior — só pra o contexto dos pódios anteriores. */
  rowsPrev: LojaVendedorRow[]
  /** Rótulo curto do mês anterior, ex.: "jul/2026". */
  mesAnteriorLabel: string
  /** Fator de projeção de fim de mês (mês-a-data); 1 = sem projeção. Só faturamento
   *  e cupons projetam — margem e ticket são razões e não recebem projeção. */
  projFactor: number
  isLoading: boolean
  hasEmpresa: boolean
}

const EMPTY_KPIS = { faturamento: 0, custo: 0, margemPct: 0, ticketMedio: 0, cupons: 0, itens: 0 }

/** Identidade composta rede-wide: (empresaCodigo, funcionarioCodigo). O
 *  `funcionarioCodigo` sozinho COLIDE entre postos (cada posto numera do 1). */
const ck = (empresaCodigo: number, funcionarioCodigo: number) => `${empresaCodigo}:${funcionarioCodigo}`

/** Regra ÚNICA de agregação + pódios cross-posto da LOJA — usada pro mês atual E
 *  pro mês anterior (não duplicar). Recebe as rows do cache (já filtradas por
 *  posto/data no fetch) + o mapa de nomes composto + as fantasias dos postos. */
const buildLojaData = (
  cacheRows: ApuracaoVendaFuncionarioRow[],
  nomes: Map<string, string>,
  fantasiaByCod: Map<number, string | undefined>,
  dataInicial: string | null,
  dataFinal: string | null,
): { rows: LojaVendedorRow[]; kpis: LojaRedeWideData['kpis']; podios: LojaPodios; projFactor: number } => {
  const conv = cacheRows.filter((r) => r.setor === 'conveniencia')
  // Projeção de fim de mês (mês-a-data) pelo ritmo dos DIAS apurados em
  // conveniência — mesma regra da Pista. Só o mês corrente projeta (senão = 1).
  const diasApurados = new Set(conv.map((r) => r.data)).size
  const projFactor = monthToDateProjFactor(dataInicial, dataFinal, diasApurados)

  const agg = new Map<string, LojaVendedorRow>()
  for (const r of conv) {
    const key = ck(r.empresa_codigo, r.funcionario_codigo)
    const cur = agg.get(key) ?? {
      funcionarioCodigo: r.funcionario_codigo,
      empresaCodigo: r.empresa_codigo,
      postoNome: fantasiaByCod.get(r.empresa_codigo),
      nome: nomes.get(key) ?? `Funcionário ${r.funcionario_codigo}`,
      faturamento: 0, custo: 0, margemPct: 0, itens: 0, cupons: 0, ticketMedio: 0,
      faturamentoTend: 0, cuponsTend: 0,
    }
    cur.faturamento += r.faturamento
    cur.custo += r.custo
    cur.itens += r.quantidade
    cur.cupons += r.cupons
    agg.set(key, cur)
  }

  const rows = [...agg.values()]
    .map((v) => ({
      ...v,
      margemPct: v.faturamento > 0 ? ((v.faturamento - v.custo) / v.faturamento) * 100 : 0,
      ticketMedio: v.cupons > 0 ? v.faturamento / v.cupons : 0,
      faturamentoTend: v.faturamento * projFactor,
      cuponsTend: Math.round(v.cupons * projFactor),
    }))
    .sort((a, b) => b.faturamento - a.faturamento)

  const totFat = rows.reduce((s, r) => s + r.faturamento, 0)
  const totCusto = rows.reduce((s, r) => s + r.custo, 0)
  const totCupons = rows.reduce((s, r) => s + r.cupons, 0)
  const totItens = rows.reduce((s, r) => s + r.itens, 0)

  // Pódio cross-posto: cada item leva o posto de origem (identidade composta).
  const podio = (sel: (r: LojaVendedorRow) => number): LojaPodio[] =>
    rows
      .filter((r) => sel(r) > 0)
      .map((r) => ({ funcionarioCodigo: r.funcionarioCodigo, empresaCodigo: r.empresaCodigo, postoNome: r.postoNome, nome: r.nome, valor: sel(r) }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 3)

  return {
    rows,
    kpis: rows.length === 0 ? EMPTY_KPIS : {
      faturamento: totFat,
      custo: totCusto,
      margemPct: totFat > 0 ? ((totFat - totCusto) / totFat) * 100 : 0,
      ticketMedio: totCupons > 0 ? totFat / totCupons : 0,
      cupons: totCupons,
      itens: totItens,
    },
    podios: {
      faturamento: podio((r) => r.faturamento),
      cupons: podio((r) => r.cupons),
      ticket: podio((r) => r.ticketMedio),
    },
    projFactor,
  }
}

/**
 * Produtividade dos VENDEDORES da LOJA (setor conveniência) agregada sobre TODOS
 * os postos do filtro (Resumo da aba Loja). Espelha `useProdutividadeRedeWide`
 * (Pista), mas pra conveniência: sem litros/mix — só faturamento, margem, ticket,
 * cupons e itens. Fonte: cache `apuracao_vendas_funcionario` (setor conveniência).
 *
 * KPIs = **soma** de faturamento/custo/cupons/itens. Margem e ticket são
 * RECOMPUTADOS como razão dos totais (Σlucro/Σfat, Σfat/Σcupons) — NUNCA média de
 * razões. Pódios são CROSS-POSTO (Top 3 por faturamento/cupons/ticket), cada item
 * carrega o posto de origem.
 *
 * PEGADINHA: `funcionario_codigo` NÃO é único entre postos. A identidade única no
 * modo rede-wide é a chave composta (empresa_codigo, funcionario_codigo) —
 * usada em toda agregação/lookup/pódio. Ver [[project_vendedores_conveniencia]].
 */
const useLojaRedeWide = (postos: Empresa[]): LojaRedeWideData => {
  const { dataInicial, dataFinal } = useFilterStore()
  const codes = useMemo(() => postos.map((p) => p.codigo), [postos])
  const hasEmpresa = codes.length > 0
  // Mês-calendário anterior ao mês do filtro (do dataFinal, ou do dataInicial).
  const prev = useMemo(() => previousCalendarMonth(dataFinal || dataInicial), [dataFinal, dataInicial])

  const { data: cacheRows = [], isLoading: lCache } = useQuery({
    queryKey: ['vendas-funcionario', codes.join(','), dataInicial, dataFinal],
    queryFn: () => fetchVendasFuncionarioCache({ empresaCodigos: codes, dataInicial, dataFinal }),
    enabled: hasEmpresa && !!dataInicial && !!dataFinal,
    staleTime: 5 * 60 * 1000,
  })

  // Mês anterior — mesma fonte, janela recuada 1 mês. queryKey própria → 1 fetch
  // extra. Só os pódios usam; carrega junto.
  const { data: cacheRowsPrev = [] } = useQuery({
    queryKey: ['vendas-funcionario', codes.join(','), prev.dataInicial, prev.dataFinal],
    queryFn: () => fetchVendasFuncionarioCache({ empresaCodigos: codes, dataInicial: prev.dataInicial, dataFinal: prev.dataFinal }),
    enabled: hasEmpresa,
    staleTime: 5 * 60 * 1000,
  })

  // Nomes POR POSTO: o funcionarioCodigo colide entre postos, então o mapa de
  // nomes precisa ser composto (empresaCodigo:funcionarioCodigo) — diferente do
  // `funcionarios-multi` achatado usado pelas abas por-posto.
  const { data: nomeByCod, isLoading: lFunc } = useQuery({
    queryKey: ['funcionarios-por-posto', codes.join(',')],
    queryFn: async () => {
      const lists = await Promise.all(
        codes.map(async (ec) => [ec, (await fetchFuncionarios({ empresaCodigo: ec, limite: 1000 })).resultados] as const),
      )
      const m = new Map<string, string>()
      for (const [ec, list] of lists) for (const f of list) m.set(ck(ec, f.funcionarioCodigo), f.nome)
      return m
    },
    enabled: hasEmpresa,
    staleTime: 10 * 60 * 1000,
  })

  return useMemo(() => {
    const fantasiaByCod = new Map(postos.map((p) => [p.codigo, p.fantasia]))
    const nomes = nomeByCod ?? new Map<string, string>()

    const cur = buildLojaData(cacheRows, nomes, fantasiaByCod, dataInicial, dataFinal)
    // Mês anterior é sempre janela cheia fora do mês corrente → projFactor = 1.
    const ant = buildLojaData(cacheRowsPrev, nomes, fantasiaByCod, prev.dataInicial, prev.dataFinal)

    return {
      rows: cur.rows,
      kpis: cur.kpis,
      podios: cur.podios,
      podiosPrev: ant.podios,
      rowsPrev: ant.rows,
      mesAnteriorLabel: prev.label,
      projFactor: cur.projFactor,
      isLoading: hasEmpresa && (lCache || lFunc),
      hasEmpresa,
    }
  }, [cacheRows, cacheRowsPrev, nomeByCod, postos, hasEmpresa, lCache, lFunc, dataInicial, dataFinal, prev])
}

export default useLojaRedeWide

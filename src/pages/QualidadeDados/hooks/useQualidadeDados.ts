import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchProdutoEstoque } from '@/api/endpoints/estoques'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchCaixas, fetchTitulosReceber, fetchTitulosPagar } from '@/api/endpoints/financeiro'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import useAbastecimentosAnalytics, { type AbastecimentoRow } from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import type { IssueSeverity } from '@/pages/QualidadeDados/components/IssueSection'
import type { Caixa, TituloReceber, TituloPagar } from '@/api/types/financeiro'
import type { VendaItem } from '@/api/types/venda'
import type { ProdutoEstoque } from '@/api/types/estoque'

/* ─── Tipos públicos ─── */

export interface QualidadeIssue<T = unknown> {
  id: string
  label: string
  description: string
  severity: IssueSeverity
  count: number
  /** Lista bruta pra a página renderizar o detail (tabela). */
  items: T[]
}

export interface AbastecimentoPrecoSuspeito extends AbastecimentoRow {
  /** Z-score do valor unitário vs média do mesmo combustível. */
  zScore: number
  precoMedio: number
}

export interface CaixaAbertoDetalhe extends Caixa {
  /** Dias decorridos desde o dataMovimento até hoje. */
  diasAberto: number
}

export interface ProdutoEstoqueNegativo {
  produtoCodigo: number
  nome: string
  saldo: number
}

export interface QualidadeData {
  abastecimentos: QualidadeIssue[]
  vendas: QualidadeIssue[]
  caixa: QualidadeIssue[]
  estoque: QualidadeIssue[]
  financeiro: QualidadeIssue[]
  totalIssues: number
  totalCriticos: number
  totalAtencao: number
  totalInfo: number
  isLoading: boolean
  hasEmpresa: boolean
}

/* ─── Helpers ─── */

const todayISO = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const daysBetween = (a: string, b: string): number => {
  const da = new Date(`${a}T00:00:00`)
  const db = new Date(`${b}T00:00:00`)
  return Math.round((db.getTime() - da.getTime()) / 86_400_000)
}

/* ─── Hook ─── */

const useQualidadeDados = (): QualidadeData => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0

  // Reaproveita cache do módulo Vendas/Operação
  const { rows: abastRows, inconsistenciasFuturas, isLoading: isLoadingAbast } = useAbastecimentosAnalytics()

  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100,
    ),
    staleTime: 30 * 60 * 1000,
  })

  const { data: vendaItens = [], isLoading: isLoadingVendas } = useQuery({
    queryKey: ['vendaItens-pista', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchVendaItens({
        empresaCodigo: empresaCodigo!,
        dataInicial,
        dataFinal,
        usaProdutoLmc: false,
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 50,
    ),
    enabled: hasEmpresa && empresaCodigo !== null,
  })

  const { data: caixasRaw, isLoading: isLoadingCaixas } = useQuery({
    queryKey: ['caixas', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchCaixas({
      empresaCodigo: empresaCodigo!,
      dataInicial,
      dataFinal,
      limite: 1000,
    }),
    enabled: hasEmpresa && empresaCodigo !== null,
  })

  const { data: estoqueRaw, isLoading: isLoadingEstoque } = useQuery({
    queryKey: ['produtoEstoque', empresaCodigo],
    queryFn: () => fetchProdutoEstoque({
      empresaCodigo: empresaCodigo!,
      limite: 1000,
    }),
    enabled: hasEmpresa && empresaCodigo !== null,
    staleTime: 5 * 60 * 1000,
  })

  const { data: titulosReceberRaw, isLoading: isLoadingReceber } = useQuery({
    queryKey: ['titulosReceber', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchTitulosReceber({
      empresaCodigo: empresaCodigo!,
      dataInicial,
      dataFinal,
      limite: 1000,
    }),
    enabled: hasEmpresa && empresaCodigo !== null,
  })

  const { data: titulosPagarRaw, isLoading: isLoadingPagar } = useQuery({
    queryKey: ['titulosPagar', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchTitulosPagar({
      empresaCodigo: empresaCodigo!,
      dataInicial,
      dataFinal,
      limite: 1000,
    }),
    enabled: hasEmpresa && empresaCodigo !== null,
  })

  /* ─── Detectores ─── */

  // Abastecimentos
  const abastecimentos = useMemo<QualidadeIssue[]>(() => {
    // 1) Sem frentista
    const semFrentista = abastRows.filter((r) => !r.frentistaCodigo || r.frentistaNome === '—')

    // 2) Preço anormal — Z-score por combustivelNome
    type StatsByFuel = Map<string, { mean: number; sd: number; count: number }>
    const stats: StatsByFuel = new Map()
    const groups = new Map<string, number[]>()
    for (const r of abastRows) {
      if (r.valorUnitario <= 0) continue
      const arr = groups.get(r.combustivelNome) ?? []
      arr.push(r.valorUnitario)
      groups.set(r.combustivelNome, arr)
    }
    for (const [nome, arr] of groups.entries()) {
      const n = arr.length
      if (n < 5) continue // amostra muito pequena pra calcular sd confiável
      const mean = arr.reduce((s, v) => s + v, 0) / n
      const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / n
      const sd = Math.sqrt(variance)
      stats.set(nome, { mean, sd, count: n })
    }
    const precoSuspeito: AbastecimentoPrecoSuspeito[] = []
    for (const r of abastRows) {
      const s = stats.get(r.combustivelNome)
      if (!s || s.sd === 0) continue
      const z = (r.valorUnitario - s.mean) / s.sd
      if (Math.abs(z) >= 3) {
        precoSuspeito.push({ ...r, zScore: z, precoMedio: s.mean })
      }
    }

    // 3) Litros suspeito (< 1 ou > 200)
    const litrosSuspeito = abastRows.filter((r) => r.litros < 1 || r.litros > 200)

    return [
      {
        id: 'data-futura',
        label: 'Abastecimento com data futura',
        description: 'Provável erro de digitação no Quality — registros não entram nos totais.',
        severity: 'high',
        count: inconsistenciasFuturas.length,
        items: inconsistenciasFuturas,
      },
      {
        id: 'sem-frentista',
        label: 'Abastecimento sem frentista',
        description: 'codigoFrentista ausente — quebra rankings de produtividade.',
        severity: 'medium',
        count: semFrentista.length,
        items: semFrentista,
      },
      {
        id: 'preco-anormal',
        label: 'Preço unitário anormal',
        description: 'Valor unitário fora de ±3σ da média do combustível (Z-score). Possível digitação errada na bomba.',
        severity: 'medium',
        count: precoSuspeito.length,
        items: precoSuspeito,
      },
      {
        id: 'litros-suspeito',
        label: 'Litros suspeito',
        description: 'Abastecimento com menos de 1L ou mais de 200L — fora do esperado pra carro/caminhão típico.',
        severity: 'low',
        count: litrosSuspeito.length,
        items: litrosSuspeito,
      },
    ]
  }, [abastRows, inconsistenciasFuturas])

  // Vendas
  const vendas = useMemo<QualidadeIssue[]>(() => {
    if (!produtosData) {
      return [
        {
          id: 'item-sem-produto',
          label: 'Item de venda sem produto cadastrado',
          description: 'produtoCodigo referenciado em vendaItem não existe em /PRODUTO — registro fica sem nome/grupo.',
          severity: 'high',
          count: 0,
          items: [],
        },
      ]
    }
    const produtosSet = new Set(produtosData.map((p) => p.produtoCodigo))
    const itemSemProduto = vendaItens.filter((v) => !produtosSet.has(v.produtoCodigo))
    return [
      {
        id: 'item-sem-produto',
        label: 'Item de venda sem produto cadastrado',
        description: 'produtoCodigo referenciado em vendaItem não existe em /PRODUTO — registro fica sem nome/grupo.',
        severity: 'high',
        count: itemSemProduto.length,
        items: itemSemProduto,
      },
    ]
  }, [vendaItens, produtosData])

  // Caixa
  const caixa = useMemo<QualidadeIssue[]>(() => {
    const caixas = caixasRaw?.resultados ?? []
    const today = todayISO()
    // 1) Aberto há muito tempo — > 3 dias sem fechar
    const abertoMuito: CaixaAbertoDetalhe[] = caixas
      .filter((c) => !c.fechado)
      .map((c) => ({ ...c, diasAberto: daysBetween(c.dataMovimento.substring(0, 10), today) }))
      .filter((c) => c.diasAberto > 3)
    // 2) Diferença anormal — fechados com |diferenca| > 100
    const diferencaAnormal = caixas.filter((c) => c.fechado && Math.abs(c.diferenca) > 100)
    return [
      {
        id: 'caixa-aberto-muito',
        label: 'Caixa aberto há mais de 3 dias',
        description: 'Operador esqueceu de fechar o caixa — sangra os relatórios de fechamento.',
        severity: 'medium',
        count: abertoMuito.length,
        items: abertoMuito,
      },
      {
        id: 'caixa-diferenca-anormal',
        label: 'Diferença de caixa anormal',
        description: '|diferença| > R$ 100 — investigar para descartar erro de digitação ou irregularidade.',
        severity: 'medium',
        count: diferencaAnormal.length,
        items: diferencaAnormal,
      },
    ]
  }, [caixasRaw])

  // Estoque
  const estoque = useMemo<QualidadeIssue[]>(() => {
    const lista = estoqueRaw?.resultados ?? []
    const produtoMap = new Map((produtosData ?? []).map((p) => [p.produtoCodigo, p.nome]))
    // Soma os saldos por produto (pode ter vários estoqueCodigo)
    const saldoPorProduto = new Map<number, number>()
    for (const e of lista) {
      const saldo = e.saldoEstoque
        ? e.saldoEstoque.reduce((s, x) => s + x.quantidade, 0)
        : e.saldo
      saldoPorProduto.set(e.produtoCodigo, (saldoPorProduto.get(e.produtoCodigo) ?? 0) + saldo)
    }
    const saldoNegativo: ProdutoEstoqueNegativo[] = []
    for (const [produtoCodigo, saldo] of saldoPorProduto.entries()) {
      if (saldo < 0) {
        saldoNegativo.push({
          produtoCodigo,
          nome: produtoMap.get(produtoCodigo) ?? `Produto ${produtoCodigo}`,
          saldo,
        })
      }
    }
    return [
      {
        id: 'estoque-negativo',
        label: 'Estoque com saldo negativo',
        description: 'Vendeu mais do que tinha em estoque — ajuste contábil pendente ou erro de baixa.',
        severity: 'high',
        count: saldoNegativo.length,
        items: saldoNegativo,
      },
    ]
  }, [estoqueRaw, produtosData])

  // Financeiro
  const financeiro = useMemo<QualidadeIssue[]>(() => {
    const receber = titulosReceberRaw?.resultados ?? []
    const pagar = titulosPagarRaw?.resultados ?? []
    const isVencimentoInvalido = (v: string): boolean => {
      if (!v) return true
      const d = new Date(v)
      if (isNaN(d.getTime())) return true
      // Datas absurdas (ano 1900 ou inverso)
      if (d.getFullYear() < 1990 || d.getFullYear() > 2100) return true
      return false
    }
    const receberSemVenc: TituloReceber[] = receber.filter((t) => isVencimentoInvalido(t.dataVencimento))
    const pagarSemVenc: TituloPagar[] = pagar.filter((t) => isVencimentoInvalido(t.vencimento))
    return [
      {
        id: 'titulo-sem-vencimento',
        label: 'Título sem data de vencimento',
        description: 'Receber/pagar sem dataVencimento válida — não entra no fluxo de caixa nem em alertas de inadimplência.',
        severity: 'medium',
        count: receberSemVenc.length + pagarSemVenc.length,
        items: [
          ...receberSemVenc.map((t) => ({ ...t, _tipo: 'receber' as const })),
          ...pagarSemVenc.map((t) => ({ ...t, _tipo: 'pagar' as const })),
        ],
      },
    ]
  }, [titulosReceberRaw, titulosPagarRaw])

  /* ─── Agregados ─── */

  const allCategorias = [abastecimentos, vendas, caixa, estoque, financeiro]
  const allIssues = allCategorias.flat()
  const totalIssues = allIssues.reduce((s, i) => s + i.count, 0)
  const totalCriticos = allIssues.filter((i) => i.severity === 'high').reduce((s, i) => s + i.count, 0)
  const totalAtencao = allIssues.filter((i) => i.severity === 'medium').reduce((s, i) => s + i.count, 0)
  const totalInfo = allIssues.filter((i) => i.severity === 'low').reduce((s, i) => s + i.count, 0)

  const isLoading = isLoadingAbast || isLoadingVendas || isLoadingCaixas || isLoadingEstoque || isLoadingReceber || isLoadingPagar

  return {
    abastecimentos,
    vendas,
    caixa,
    estoque,
    financeiro,
    totalIssues,
    totalCriticos,
    totalAtencao,
    totalInfo,
    isLoading,
    hasEmpresa,
  }
}

export default useQualidadeDados

/* ─── Re-exports pra a página renderizar os details ─── */
export type { AbastecimentoRow, Caixa, TituloReceber, TituloPagar, VendaItem, ProdutoEstoque }

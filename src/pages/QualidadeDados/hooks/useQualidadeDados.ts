import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchProdutoEstoque } from '@/api/endpoints/estoques'
import { fetchVendaItens, fetchVendaFormasPagamento } from '@/api/endpoints/vendas'
import { fetchCaixas, fetchTitulosReceber, fetchTitulosPagar } from '@/api/endpoints/financeiro'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
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

/**
 * Cupom (venda) com 2+ abastecimentos de combustível — sinal de "montagem
 * de cupom" usada em fraudes documentadas no Posto Trivela (abr/2026).
 *
 * Frentista combina vários abastecimentos num único cupom pra ocultar
 * desvio de pagamento (parte cartão, parte dinheiro, valor real ≠ físico).
 */
export interface CupomMultiAbast {
  vendaCodigo: number
  dataHora: string
  funcionarioCodigo: number
  funcionarioNome: string
  abastecimentos: Array<{
    produtoCodigo: number
    produtoNome: string
    tipoCombustivel: string
    quantidade: number
    precoVenda: number
    totalVenda: number
    bicoCodigo: number
    /** Hora REAL do abastecimento na bomba (de /ABASTECIMENTO via vendaItemCodigo).
     * Usada pra detectar fraude: itens "montados" no mesmo cupom mas com
     * timestamps espalhados ao longo do turno. */
    dataHoraAbastecimento: string | null
  }>
  totalVenda: number
  formasPagamento: Array<{
    tipo: string
    nome: string
    valor: number
  }>
  /** Combustíveis diferentes no mesmo cupom (ex.: gasolina + diesel). */
  mixCombustiveis: boolean
  /** Formas de pagamento diferentes (ex.: cartão + dinheiro). */
  mixPagamentos: boolean
  /** Score 1-3: 1 = mesmo combustível + 1 forma pgto, 3 = mix de tudo. */
  riscoScore: 1 | 2 | 3
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

  // Formas de pagamento por venda — usado pra detectar mix cartão/dinheiro
  // no detector de cupons "montados" (sinal de fraude do Posto Trivela).
  const { data: formasPgto = [], isLoading: isLoadingFormas } = useQuery({
    queryKey: ['vendaFormasPgto', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchVendaFormasPagamento({
        empresaCodigo: empresaCodigo!,
        dataInicial,
        dataFinal,
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 50,
    ),
    enabled: hasEmpresa && empresaCodigo !== null,
  })

  // Funcionários — pra resolver funcionarioCodigo → nome do frentista
  // que emitiu o cupom suspeito. Mesma queryKey do useOperacaoData =
  // React Query dedupe automático.
  const { data: funcionariosRaw } = useQuery({
    queryKey: ['funcionarios', empresaCodigo],
    queryFn: () => fetchFuncionarios({ empresaCodigo: empresaCodigo!, limite: 1000 }),
    enabled: hasEmpresa && empresaCodigo !== null,
    staleTime: 30 * 60 * 1000,
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
        {
          id: 'cupom-multi-abast',
          label: 'Cupom com múltiplos abastecimentos',
          description: 'Vendas com 2+ itens de combustível — sinal de "montagem de cupom" usada em fraudes de cartão.',
          severity: 'high',
          count: 0,
          items: [],
        },
      ]
    }
    const produtosSet = new Set(produtosData.map((p) => p.produtoCodigo))
    const itemSemProduto = vendaItens.filter((v) => !produtosSet.has(v.produtoCodigo))

    // ── Detector cupom-multi-abast ──
    // Lista vendas com 2+ itens de combustível no mesmo cupom. Padrão de
    // fraude documentado no Posto Trivela (abr/2026): frentista junta vários
    // abastecimentos num cupom só pra disfarçar desvio em pagamento (mix
    // cartão + dinheiro). Score 1 = base, 2 = mix de combustíveis, 3 = + mix
    // formas pgto.
    const produtoMap = new Map(produtosData.map((p) => [p.produtoCodigo, p]))
    const funcMap = new Map<number, string>()
    for (const f of funcionariosRaw?.resultados ?? []) {
      funcMap.set(f.funcionarioCodigo, f.nome)
    }
    const pgtoByVenda = new Map<number, typeof formasPgto>()
    for (const fp of formasPgto) {
      const arr = pgtoByVenda.get(fp.vendaCodigo) ?? []
      arr.push(fp)
      pgtoByVenda.set(fp.vendaCodigo, arr)
    }

    // Ponte VendaItem → dataHora REAL do abastecimento na bomba.
    // Crítico pra detectar "montagem de cupom": cliente real abastece tudo de
    // uma vez; cupom montado tem timestamps espalhados pelo turno.
    //
    // Estratégia DUPLA pra cobrir cache (sem vendaItemCodigo) E live:
    //   1) Quando rows tem vendaItemCodigo → join direto por código (preciso).
    //   2) Senão, chave natural (empresa+bico+produto+qty+valor+data) — bate
    //      em quase todos os casos do dia-a-dia.
    const abastDataHoraByVendaItem = new Map<number, string>()
    // Chave natural: empresa+bico+produto+qty+data. Qty (3 decimais) é
    // discriminador forte — colisão exata na mesma bomba/dia é raríssima.
    // Não usamos valorTotal porque pode ter desconto no VendaItem (gross vs net).
    const abastDataHoraByNaturalKey = new Map<string, string>()
    const naturalKey = (
      empresa: number,
      bico: number,
      produto: number,
      qty: number,
      date: string,
    ) =>
      `${empresa}|${bico}|${produto}|${qty.toFixed(3)}|${date.slice(0, 10)}`
    for (const r of abastRows) {
      if (r.vendaItemCodigo) {
        abastDataHoraByVendaItem.set(r.vendaItemCodigo, r.dataHora)
      }
      if (r.dataHora) {
        const k = naturalKey(r.empresaCodigo, r.bicoCodigo, r.produtoCodigo, r.litros, r.dataHora)
        abastDataHoraByNaturalKey.set(k, r.dataHora)
      }
    }

    const itensPorVenda = new Map<number, typeof vendaItens>()
    for (const item of vendaItens) {
      const arr = itensPorVenda.get(item.vendaCodigo) ?? []
      arr.push(item)
      itensPorVenda.set(item.vendaCodigo, arr)
    }

    const cupomMultiAbast: CupomMultiAbast[] = []
    for (const [vendaCodigo, itens] of itensPorVenda.entries()) {
      const combItens = itens.filter((i) => {
        const p = produtoMap.get(i.produtoCodigo)
        return p?.combustivel === true
      })
      if (combItens.length < 2) continue

      const abastecimentos = combItens.map((i) => {
        const p = produtoMap.get(i.produtoCodigo)
        // Tenta primeiro pelo vendaItemCodigo (preciso, só funciona com dados live).
        // Cai pra natural-key (cobre dados de cache, onde vendaItemCodigo = 0).
        let dataHoraAbast: string | null = abastDataHoraByVendaItem.get(i.vendaItemCodigo) ?? null
        if (!dataHoraAbast) {
          const k = naturalKey(
            i.empresaCodigo,
            i.bicoCodigo,
            i.produtoCodigo,
            i.quantidade,
            i.dataMovimento,
          )
          dataHoraAbast = abastDataHoraByNaturalKey.get(k) ?? null
        }
        return {
          produtoCodigo: i.produtoCodigo,
          produtoNome: p?.nome ?? `Produto ${i.produtoCodigo}`,
          tipoCombustivel: p?.tipoCombustivel ?? '',
          quantidade: i.quantidade,
          precoVenda: i.precoVenda,
          totalVenda: i.totalVenda,
          bicoCodigo: i.bicoCodigo,
          dataHoraAbastecimento: dataHoraAbast,
        }
      })

      // Ordena em ordem cronológica (1º = mais antigo). Itens sem hora vão
      // pro fim. Facilita visualizar o "spread" da fraude no modal.
      abastecimentos.sort((a, b) => {
        if (!a.dataHoraAbastecimento && !b.dataHoraAbastecimento) return 0
        if (!a.dataHoraAbastecimento) return 1
        if (!b.dataHoraAbastecimento) return -1
        return a.dataHoraAbastecimento.localeCompare(b.dataHoraAbastecimento)
      })

      const tiposUnicos = new Set(abastecimentos.map((a) => a.tipoCombustivel).filter(Boolean))
      const mixCombustiveis = tiposUnicos.size >= 2

      const pgtos = pgtoByVenda.get(vendaCodigo) ?? []
      const formasPagamento = pgtos.map((fp) => ({
        tipo: fp.tipoFormaPagamento || 'OUTROS',
        nome: fp.nomeFormaPagamento || fp.tipoFormaPagamento || 'Outros',
        valor: fp.valorPagamento,
      }))
      const tiposFpgUnicos = new Set(formasPagamento.map((f) => f.tipo))
      const mixPagamentos = tiposFpgUnicos.size >= 2

      const riscoScore: 1 | 2 | 3 = mixCombustiveis && mixPagamentos
        ? 3
        : mixCombustiveis || mixPagamentos
        ? 2
        : 1

      const firstItem = itens[0]
      // Hora do cupom = primeiro abastecimento real do conjunto (não
      // dataMovimento, que só tem data). Se nenhum item tem hora, cai pra
      // dataMovimento mesmo.
      const horasAbast = abastecimentos
        .map((a) => a.dataHoraAbastecimento)
        .filter((d): d is string => !!d)
        .sort()
      const dataHoraCupom = horasAbast[0] ?? firstItem.dataMovimento
      cupomMultiAbast.push({
        vendaCodigo,
        dataHora: dataHoraCupom,
        funcionarioCodigo: firstItem.funcionarioCodigo,
        funcionarioNome: funcMap.get(firstItem.funcionarioCodigo) ?? `Funcionário ${firstItem.funcionarioCodigo}`,
        abastecimentos,
        totalVenda: abastecimentos.reduce((s, a) => s + a.totalVenda, 0),
        formasPagamento,
        mixCombustiveis,
        mixPagamentos,
        riscoScore,
      })
    }

    // Ordena por risco desc, depois data mais recente primeiro
    cupomMultiAbast.sort((a, b) => {
      if (a.riscoScore !== b.riscoScore) return b.riscoScore - a.riscoScore
      return b.dataHora.localeCompare(a.dataHora)
    })

    return [
      {
        id: 'item-sem-produto',
        label: 'Item de venda sem produto cadastrado',
        description: 'produtoCodigo referenciado em vendaItem não existe em /PRODUTO — registro fica sem nome/grupo.',
        severity: 'high',
        count: itemSemProduto.length,
        items: itemSemProduto,
      },
      {
        id: 'cupom-multi-abast',
        label: 'Cupom com múltiplos abastecimentos',
        description: 'Vendas com 2+ itens de combustível no mesmo cupom. Padrão associado a fraude — frentista "monta" cupons combinando abastecimentos pra ocultar mix de cartão/dinheiro.',
        severity: 'high',
        count: cupomMultiAbast.length,
        items: cupomMultiAbast,
      },
    ]
  }, [vendaItens, produtosData, formasPgto, funcionariosRaw, abastRows])

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

  const isLoading = isLoadingAbast || isLoadingVendas || isLoadingFormas || isLoadingCaixas || isLoadingEstoque || isLoadingReceber || isLoadingPagar

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

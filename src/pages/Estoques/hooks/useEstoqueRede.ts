import { useMemo } from 'react'
import { useQueries, useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchProdutoEstoque, fetchProdutoEstoqueExtrato } from '@/api/endpoints/estoques'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { saldoAtualPorProduto } from '@/api/helpers/produtoEstoqueSaldo'
import useVendasCache from '@/pages/Conveniencias/hooks/useVendasCache'
import { todayLocal } from '@/lib/period'
import type { PostoOption } from '@/components/filters/PostoLocalSelect'
import type { Produto } from '@/api/types/produto'
import type { ProdutoEstoque, ProdutoEstoqueExtrato } from '@/api/types/estoque'

/** Resumo de estoque de UM posto (linha da tabela por posto). */
export interface PostoEstoqueResumo {
  /** Valor em estoque = Σ (saldo × custo) dos produtos controlados. */
  valor: number
  /** Nº de SKUs controlados com saldo ou venda no período. */
  skus: number
  /** Nº de SKUs com 0 < saldo < mínimo (mínimo cadastrado > 0). */
  abaixoMinimo: number
  /** Nº de SKUs zerados que ainda vendem (ruptura → perda de venda). */
  emFalta: number
  /** Nº de SKUs com saldo negativo (inconsistência de lançamento). */
  negativos: number
}

/** Produto crítico de um posto (drill da linha). */
export interface CriticoRow {
  produtoCodigo: number
  nome: string
  categoria: string
  saldo: number
  minimo: number
  situacao: 'negativo' | 'emFalta' | 'abaixoMinimo'
}

/** Janela de venda (dias) usada só pra saber se um produto "vende" (ruptura). */
const VENDA_JANELA_DIAS = 90

/** Ordem de severidade dos produtos críticos (mais grave primeiro). */
const SEVERIDADE: Record<CriticoRow['situacao'], number> = { negativo: 0, emFalta: 1, abaixoMinimo: 2 }

/**
 * Resumo de estoque REDE-WIDE por posto. Estoque é físico e por-posto e NÃO tem
 * cache Supabase — então é tudo ao vivo, com FAN-OUT (`useQueries`) por posto,
 * reusando as MESMAS queryKeys de `useEstoqueAnalytics` (`produtoEstoqueAll` /
 * `produtoEstoqueExtrato`) pra compartilhar cache e bater com as abas de detalhe.
 * Aplica as mesmas exclusões (combustível, LMC, sem controle de inventário).
 * A venda rede-wide (cache de conveniência, ~90 dias) serve só pra qualificar
 * "em falta" (produto zerado que vende) e como fallback de custo médio.
 */
const useEstoqueRede = (postos: PostoOption[]) => {
  const postoCodes = useMemo(() => postos.map((p) => p.codigo), [postos])

  // Catálogo de produtos (cache compartilhado com useEstoqueAnalytics).
  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100,
    ),
    staleTime: 30 * 60 * 1000,
  })

  // Grupos (cache compartilhado) — categoria por produto.
  const { data: gruposData } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => fetchAllPages(
      (p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100,
    ),
    staleTime: 30 * 60 * 1000,
  })

  // Fan-out: saldo atual por produto de cada posto (queryKey idêntica à analytics).
  const estoqueQueries = useQueries({
    queries: postos.map((p) => ({
      queryKey: ['produtoEstoqueAll', p.codigo],
      queryFn: () => fetchAllPages(
        (q) => fetchProdutoEstoque({ empresaCodigo: p.codigo, ultimoCodigo: q.ultimoCodigo, limite: q.limite }),
        1000, 20,
      ),
      enabled: postos.length > 0,
      placeholderData: keepPreviousData,
    })),
  })

  // Fan-out: cadastro por produto (estoque mínimo + preço de custo/venda).
  const extratoQueries = useQueries({
    queries: postos.map((p) => ({
      queryKey: ['produtoEstoqueExtrato', p.codigo],
      queryFn: () => fetchAllPages(
        (q) => fetchProdutoEstoqueExtrato({ empresaCodigo: p.codigo, exibeHistoricoCompra: false, ultimoCodigo: q.ultimoCodigo, limite: q.limite }),
        1000, 20,
      ),
      enabled: postos.length > 0,
      staleTime: 30 * 60 * 1000,
      placeholderData: keepPreviousData,
    })),
  })

  // Venda rede-wide (cache de conveniência, ~90 dias) — só pra "vende?" e custo médio.
  const vendaInicial = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - (VENDA_JANELA_DIAS - 1))
    const yy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yy}-${mm}-${dd}`
  }, [])
  const vendasCache = useVendasCache({
    dataInicial: vendaInicial,
    dataFinal: todayLocal(),
    empresaCodigo: null,
    empresasPermitidasCount: postos.length,
  })

  const isLoading = estoqueQueries.some((q) => q.isLoading)

  // Chaves de atualização estáveis pro memo (útil com useQueries, que gera arrays novos).
  const estoqueKey = estoqueQueries.map((q) => q.dataUpdatedAt).join('-')
  const extratoKey = extratoQueries.map((q) => q.dataUpdatedAt).join('-')

  const { byPosto, criticosByPosto, hasData } = useMemo(() => {
    const produtos: Produto[] = produtosData ?? []
    const grupos = gruposData ?? []

    const grupoMap = new Map<number, string>()
    for (const g of grupos) grupoMap.set(g.grupoCodigo, g.nome)

    // Venda por (empresa, produto): qtd (vende?) + custo médio (fallback).
    const vendaAcc = new Map<string, { qtd: number; custo: number }>()
    for (const v of vendasCache.vendas) {
      const key = `${v.empresaCodigo}|${v.produtoCodigo}`
      const acc = vendaAcc.get(key) ?? { qtd: 0, custo: 0 }
      acc.qtd += v.quantidade
      acc.custo += v.totalCusto
      vendaAcc.set(key, acc)
    }

    const byPosto = new Map<number, PostoEstoqueResumo>()
    const criticosByPosto = new Map<number, CriticoRow[]>()
    let hasData = false

    postos.forEach((posto, i) => {
      const estoqueData = estoqueQueries[i]?.data
      // Sem retorno do saldo ainda → posto "sem dado" (a tabela mostra "—").
      if (!Array.isArray(estoqueData)) return

      const saldoMap = saldoAtualPorProduto(estoqueData as ProdutoEstoque[])

      // Cadastro por produto: mínimo + preço de custo (dedup por produtoCodigo).
      const minimoMap = new Map<number, number>()
      const custoCadastroMap = new Map<number, number>()
      for (const e of (extratoQueries[i]?.data ?? []) as ProdutoEstoqueExtrato[]) {
        if (!minimoMap.has(e.produtoCodigo)) minimoMap.set(e.produtoCodigo, e.estoqueMinimo ?? 0)
        if (!custoCadastroMap.has(e.produtoCodigo)) custoCadastroMap.set(e.produtoCodigo, e.precoCusto ?? 0)
      }

      const resumo: PostoEstoqueResumo = { valor: 0, skus: 0, abaixoMinimo: 0, emFalta: 0, negativos: 0 }
      const criticos: CriticoRow[] = []

      for (const produto of produtos) {
        // Mesmas exclusões da useEstoqueAnalytics.
        if (produto.combustivel || produto.produtoLmcCodigo > 0) continue
        if (produto.registraInventario === 'N') continue

        const saldo = saldoMap.get(produto.produtoCodigo) ?? 0
        const vendaKey = `${posto.codigo}|${produto.produtoCodigo}`
        const venda = vendaAcc.get(vendaKey)
        const sells = (venda?.qtd ?? 0) > 0

        // Sem saldo e sem venda → irrelevante (igual à analytics).
        if (saldo === 0 && !sells) continue

        const min = minimoMap.get(produto.produtoCodigo) ?? 0
        const custoCadastro = custoCadastroMap.get(produto.produtoCodigo) ?? 0
        const custoMedio = venda && venda.qtd > 0 ? venda.custo / venda.qtd : 0
        const custo = custoCadastro > 0 ? custoCadastro : custoMedio
        const valor = saldo * custo

        resumo.valor += valor
        resumo.skus += 1

        // Classificação exclusiva por severidade.
        let situacao: CriticoRow['situacao'] | null = null
        if (saldo < 0) { situacao = 'negativo'; resumo.negativos += 1 }
        else if (saldo === 0 && sells) { situacao = 'emFalta'; resumo.emFalta += 1 }
        else if (saldo > 0 && min > 0 && saldo < min) { situacao = 'abaixoMinimo'; resumo.abaixoMinimo += 1 }

        if (situacao) {
          criticos.push({
            produtoCodigo: produto.produtoCodigo,
            nome: produto.nome,
            categoria: grupoMap.get(produto.grupoCodigo) ?? 'Outros',
            saldo,
            minimo: min,
            situacao,
          })
        }
      }

      criticos.sort((a, b) => SEVERIDADE[a.situacao] - SEVERIDADE[b.situacao] || a.nome.localeCompare(b.nome))
      byPosto.set(posto.codigo, resumo)
      criticosByPosto.set(posto.codigo, criticos)
      if (resumo.skus > 0) hasData = true
    })

    return { byPosto, criticosByPosto, hasData }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtosData, gruposData, vendasCache.vendas, postoCodes, estoqueKey, extratoKey])

  return { byPosto, criticosByPosto, isLoading, hasData }
}

export default useEstoqueRede

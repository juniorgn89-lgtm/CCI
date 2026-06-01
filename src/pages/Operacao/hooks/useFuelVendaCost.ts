import { useMemo } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { isVendaCancelada } from '@/lib/setorClassification'

export interface FuelVendaCost {
  /** Custo médio (CMV) por litro do produto, vindo do item de venda. */
  custoUnit: number
  /** Taxa de desconto do produto = desconto / faturamento bruto. */
  descRate: number
}

/**
 * Custo médio (CMV) e taxa de desconto por produto, a partir do /VENDA_ITEM —
 * a MESMA fonte que o BI usa pro lucro bruto de combustível, substituindo o
 * custo do LMC (última compra). O mapa é "alias-expandido": indexado por
 * produtoCodigo, produtoLmcCodigo e codigo, então o lookup casa mesmo quando o
 * abastecimento referencia o combustível por outro código.
 *
 * Casamos por produto (não por vendaItemCodigo) porque o cache de abastecimento
 * grava vendaItemCodigo=0. Como os litros do abast = qty da venda por produto,
 * em agregado bate exato com o BI.
 *
 * Compartilhado entre as telas que mostram lucro/margem de combustível
 * (Combustível, Dashboard, Gerente).
 */
const useFuelVendaCost = (
  empresaCodigos: number[],
  dataInicial: string,
  dataFinal: string,
) => {
  const hasEmpresa = empresaCodigos.length > 0

  const { data: vendaItens = [], isLoading } = useQuery({
    queryKey: ['fuel-venda-cost', empresaCodigos.join(','), dataInicial, dataFinal],
    queryFn: async () => {
      const perEmpresa = await Promise.all(
        empresaCodigos.map((emp) =>
          fetchAllPages(
            (p) => fetchVendaItens({
              empresaCodigo: emp,
              dataInicial, dataFinal,
              usaProdutoLmc: false,
              ultimoCodigo: p.ultimoCodigo, limite: p.limite,
            }),
            1000, 50,
          ),
        ),
      )
      return perEmpresa.flat()
    },
    enabled: hasEmpresa,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })

  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })

  const vendaByProduct = useMemo(() => {
    // Grupos de aliases por produto (produtoCodigo / produtoLmcCodigo / codigo).
    const codeAliases = new Map<number, number[]>()
    for (const p of produtosData ?? []) {
      const codes = [p.produtoCodigo, p.produtoLmcCodigo, p.codigo].filter(
        (c): c is number => typeof c === 'number' && c > 0,
      )
      const uniq = [...new Set(codes)]
      for (const c of codes) codeAliases.set(c, uniq)
    }
    // Agrega os itens por produtoCodigo.
    const agg = new Map<number, { qty: number; custo: number; venda: number; desconto: number }>()
    for (const it of vendaItens) {
      if (isVendaCancelada(it)) continue  // BI conta só cancelada="N"
      if (it.quantidade <= 0) continue
      const cur = agg.get(it.produtoCodigo) ?? { qty: 0, custo: 0, venda: 0, desconto: 0 }
      cur.qty += it.quantidade
      cur.custo += it.totalCusto > 0 ? it.totalCusto : it.precoCusto * it.quantidade
      cur.venda += it.totalVenda
      cur.desconto += it.totalDesconto
      agg.set(it.produtoCodigo, cur)
    }
    // Monta o mapa, expandindo pras chaves-alias.
    const map = new Map<number, FuelVendaCost>()
    for (const [prod, v] of agg) {
      const gross = v.venda + v.desconto
      const val: FuelVendaCost = {
        custoUnit: v.qty > 0 ? v.custo / v.qty : 0,
        descRate: gross > 0 ? v.desconto / gross : 0,
      }
      const keys = codeAliases.get(prod) ?? [prod]
      for (const k of keys) if (!map.has(k)) map.set(k, val)
    }
    return map
  }, [vendaItens, produtosData])

  return { vendaByProduct, isLoading: hasEmpresa && isLoading }
}

export default useFuelVendaCost

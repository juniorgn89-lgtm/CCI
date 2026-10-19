import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCompras } from '@/api/endpoints/compras'
import { fetchCompraItem, type CompraItem } from '@/api/endpoints/combustiveis'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { Compra } from '@/api/types/compra'
import { todayLocal } from '@/lib/period'

export interface ProdutoDoFornecedor {
  produtoCodigo: number
  /** Último preço de compra pago a este fornecedor. */
  ultimoCusto: number
  ultimaCompra: string
  /** Quantas notas deste fornecedor tiveram o produto nos últimos 12 meses. */
  notas: number
}

const umAnoAtras = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10) }

/**
 * O que um fornecedor já entregou à rede nos últimos 12 meses: junta os
 * cabeçalhos de nota (/COMPRA, que têm o fornecedor) com os itens
 * (/COMPRA_ITEM, que têm o produto). É a aproximação honesta de "catálogo
 * do fornecedor" — o ERP não expõe um catálogo de verdade. Carrega uma vez
 * por rede (30 min de cache) e só quando um fornecedor do ERP é escolhido.
 */
export const useCatalogoFornecedor = (redeId: string | null, fornecedorCodigo: number | null) => {
  const ativo = !!redeId && fornecedorCodigo != null
  const cab = useQuery({
    queryKey: ['compras-erp-cabecalhos', redeId],
    enabled: ativo,
    staleTime: 30 * 60_000,
    queryFn: () => fetchAllPages<Compra>((p) => fetchCompras({ dataInicial: umAnoAtras(), dataFinal: todayLocal(), ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 30),
  })
  const itens = useQuery({
    queryKey: ['compras-erp-itens', redeId],
    enabled: ativo,
    staleTime: 30 * 60_000,
    queryFn: () => fetchAllPages<CompraItem>((p) => fetchCompraItem({ dataInicial: umAnoAtras(), dataFinal: todayLocal(), ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 60),
  })

  const produtos = useMemo<Map<number, ProdutoDoFornecedor> | null>(() => {
    if (!ativo || !cab.data || !itens.data) return null
    const notasDoFornecedor = new Map<number, Compra>()
    for (const c of cab.data) if (c.fornecedorCodigo === fornecedorCodigo) notasDoFornecedor.set(c.compraCodigo, c)
    const m = new Map<number, ProdutoDoFornecedor>()
    for (const i of itens.data) {
      const nota = notasDoFornecedor.get(i.compraCodigo)
      if (!nota) continue
      const dia = (i.dataEntrada || nota.dataEntrada || '').slice(0, 10)
      const custo = i.precoCompra && i.precoCompra > 0 ? i.precoCompra : i.precoCusto
      const cur = m.get(i.produtoCodigo)
      if (!cur) m.set(i.produtoCodigo, { produtoCodigo: i.produtoCodigo, ultimoCusto: custo, ultimaCompra: dia, notas: 1 })
      else { cur.notas += 1; if (dia > cur.ultimaCompra) { cur.ultimaCompra = dia; cur.ultimoCusto = custo } }
    }
    return m
  }, [ativo, cab.data, itens.data, fornecedorCodigo])

  return { produtos, carregando: ativo && (cab.isLoading || itens.isLoading), erro: (cab.error ?? itens.error) as Error | null }
}

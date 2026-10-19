import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCompras } from '@/api/endpoints/compras'
import { fetchCompraItem, type CompraItem } from '@/api/endpoints/combustiveis'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { Compra } from '@/api/types/compra'
import { todayLocal } from '@/lib/period'

/** De quem o produto foi comprado por último (nota de entrada do ERP). */
export interface UltimoFornecedor {
  codigo_erp: number
  cnpj: string | null
  /** Dia da última entrada (yyyy-MM-dd). */
  data: string
  /** Preço pago na última compra (preço da nota; sem ele, o custo). */
  custo: number
  /** true = a última compra foi do PRÓPRIO posto; false = de outro posto da rede. */
  doPosto: boolean
}

const umAnoAtras = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return d.toISOString().slice(0, 10) }

/**
 * Produto → último fornecedor, das notas de entrada dos últimos 12 meses
 * (/COMPRA tem o fornecedor; /COMPRA_ITEM tem o produto). Vale primeiro a
 * compra do próprio posto; se o posto nunca comprou, a última da rede.
 * É HISTÓRICO, não catálogo: fornecedor novo só aparece depois da 1ª nota, e
 * nota sem fornecedor no ERP não vira palpite. Mesmas chaves de cache do
 * useCatalogoFornecedor (uma leitura só por rede, 30 min).
 */
export const useUltimoFornecedor = (redeId: string | null, empresaCodigo: number | null) => {
  const ativo = !!redeId
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

  const porProduto = useMemo(() => {
    const m = new Map<number, UltimoFornecedor>()
    if (!cab.data || !itens.data) return m
    const notas = new Map<number, Compra>()
    for (const c of cab.data) notas.set(c.compraCodigo, c)
    const doPosto = new Map<number, UltimoFornecedor>()
    const daRede = new Map<number, UltimoFornecedor>()
    for (const i of itens.data) {
      const nota = notas.get(i.compraCodigo)
      if (!nota?.fornecedorCodigo) continue // sem fornecedor no ERP: não chuta
      const data = (i.dataEntrada || nota.dataEntrada || '').slice(0, 10)
      const custo = i.precoCompra && i.precoCompra > 0 ? i.precoCompra : i.precoCusto
      const reg: UltimoFornecedor = { codigo_erp: nota.fornecedorCodigo, cnpj: nota.cnpjCpfFornecedor ?? null, data, custo, doPosto: false }
      const alvo = empresaCodigo != null && (i.empresaCodigo ?? nota.empresaCodigo) === empresaCodigo ? doPosto : daRede
      const cur = alvo.get(i.produtoCodigo)
      if (!cur || data > cur.data) alvo.set(i.produtoCodigo, reg)
    }
    for (const [p, r] of daRede) m.set(p, r)
    for (const [p, r] of doPosto) m.set(p, { ...r, doPosto: true })
    return m
  }, [cab.data, itens.data, empresaCodigo])

  return { porProduto, carregando: ativo && (cab.isLoading || itens.isLoading) }
}

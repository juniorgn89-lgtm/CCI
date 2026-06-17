import type { ProdutoEstoque } from '@/api/types/estoque'

/**
 * Saldo atual por produto a partir de `/PRODUTO_ESTOQUE`.
 *
 * A API devolve registros DUPLICADOS — o mesmo produto/local repetido N vezes
 * (observado: 20× o mesmo {produto, estoqueCodigo, saldo}). Somar os registros
 * inflava o saldo (ex.: 18 × 20 = 360). Aqui deduplicamos por LOCAL
 * (`estoqueCodigo`): cada local conta uma vez e somamos os locais distintos do
 * produto — robusto tanto pras duplicatas quanto pro caso real de multi-local.
 */
export const saldoAtualPorProduto = (rows: ProdutoEstoque[]): Map<number, number> => {
  // produtoCodigo → (estoqueCodigo → quantidade)
  const porLocal = new Map<number, Map<number, number>>()
  for (const pe of rows) {
    const locais = pe.saldoEstoque && pe.saldoEstoque.length > 0
      ? pe.saldoEstoque.map((se) => ({ estoqueCodigo: se.estoqueCodigo, quantidade: se.quantidade }))
      : [{ estoqueCodigo: pe.estoqueCodigo, quantidade: pe.saldo }]
    const m = porLocal.get(pe.produtoCodigo) ?? new Map<number, number>()
    // last-write-wins: duplicatas do mesmo local trazem o mesmo valor.
    for (const l of locais) m.set(l.estoqueCodigo, l.quantidade)
    porLocal.set(pe.produtoCodigo, m)
  }
  const out = new Map<number, number>()
  for (const [prod, locais] of porLocal) {
    out.set(prod, Array.from(locais.values()).reduce((s, q) => s + q, 0))
  }
  return out
}

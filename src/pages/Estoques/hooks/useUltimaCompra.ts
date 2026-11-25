import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCompraItem, type CompraItem } from '@/api/endpoints/combustiveis'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { todayLocal } from '@/lib/period'

/** Até onde olhar para trás atrás da última nota de entrada de cada produto. */
export const ULTIMA_COMPRA_DIAS = 365

export interface UltimaCompra { custo: number; data: string; quantidade: number }

const menosDias = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d - n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/**
 * Custo da ÚLTIMA COMPRA de cada produto do posto, pela nota de entrada
 * (/COMPRA_ITEM, custo unitário da nota). Produto sem nota no último ano = sem valor.
 */
const useUltimaCompra = (empresaCodigo: number | null) => {
  const hoje = todayLocal()
  const desde = menosDias(hoje, ULTIMA_COMPRA_DIAS)
  const q = useQuery({
    queryKey: ['compra-item', 'ultima', empresaCodigo, desde, hoje],
    queryFn: () => fetchAllPages((p) => fetchCompraItem({ empresaCodigo: [empresaCodigo!], dataInicial: desde, dataFinal: hoje, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 30),
    enabled: empresaCodigo != null,
    staleTime: 30 * 60_000,
  })
  // Histórico do ano por produto (mais antiga → mais recente) e a última compra.
  const { porProduto, historico } = useMemo(() => {
    const hist = new Map<number, UltimaCompra[]>()
    for (const i of (q.data ?? []) as CompraItem[]) {
      if (empresaCodigo != null && i.empresaCodigo !== empresaCodigo) continue
      if (!(i.precoCusto > 0)) continue
      const lista = hist.get(i.produtoCodigo) ?? []
      lista.push({ custo: i.precoCusto, data: (i.dataEntrada ?? '').slice(0, 10), quantidade: i.quantidade })
      hist.set(i.produtoCodigo, lista)
    }
    const ultima = new Map<number, UltimaCompra>()
    for (const [cod, lista] of hist) {
      lista.sort((a, b) => a.data.localeCompare(b.data))
      ultima.set(cod, lista[lista.length - 1])
    }
    return { porProduto: ultima, historico: hist }
  }, [q.data, empresaCodigo])
  return { porProduto, historico, carregando: q.isLoading }
}

export default useUltimaCompra

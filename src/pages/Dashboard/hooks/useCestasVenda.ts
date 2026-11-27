import { useQuery } from '@tanstack/react-query'
import { fetchVendas, fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { todayLocal } from '@/lib/period'

/** Janela dos "comprados juntos": cupons dos últimos N dias. */
export const DIAS_CESTAS = 30

const isoMenosDias = (iso: string, dias: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d - dias)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export interface CestasVenda {
  /** Produtos de cada cupom com 2 ou mais produtos diferentes. */
  cestas: number[][]
  /** Cupons autorizados lidos no período. */
  totalCupons: number
  /** De onde vieram os itens: aninhados no /VENDA ou, na falta, do /VENDA_ITEM. */
  fonte: 'venda' | 'venda_item'
  dataInicial: string
  dataFinal: string
}

/**
 * Os cupons AUTORIZADOS do posto nos últimos 30 dias, cada um reduzido à lista
 * de produtos que saíram juntos (sem repetir). Base dos kits "comprados juntos".
 *
 * Fonte: /VENDA com situacao='A' (o /VENDA_ITEM não diz se a venda foi
 * cancelada). Os itens costumam vir aninhados em cada venda; se vierem vazios,
 * os cupons são remontados pelo /VENDA_ITEM, mantendo só os vendaCodigo
 * autorizados. Cupom com um produto só não forma par e fica de fora.
 */
const useCestasVenda = (empresaCodigo: number | null, enabled = true) => {
  const dataFinal = todayLocal()
  const dataInicial = isoMenosDias(dataFinal, DIAS_CESTAS - 1)
  return useQuery({
    queryKey: ['cestas-venda', empresaCodigo, dataInicial, dataFinal],
    queryFn: async (): Promise<CestasVenda> => {
      const vendas = await fetchAllPages(
        (p) => fetchVendas({ empresaCodigo: empresaCodigo!, dataInicial, dataFinal, situacao: 'A', ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        1000,
        // Teto de segurança: 120k cupons/posto em 30 dias, bem acima do real.
        120,
      )
      const porVenda = new Map<number, Set<number>>()
      let itensAninhados = 0
      for (const v of vendas) {
        const codigos = new Set<number>()
        for (const it of v.itens ?? []) {
          itensAninhados++
          if (it.produtoCodigo && it.quantidade > 0) codigos.add(it.produtoCodigo)
        }
        porVenda.set(v.vendaCodigo, codigos)
      }
      let fonte: CestasVenda['fonte'] = 'venda'
      if (vendas.length > 0 && itensAninhados === 0) {
        // Reserva: itens pelo /VENDA_ITEM, só dos cupons autorizados lidos acima.
        fonte = 'venda_item'
        const itens = await fetchAllPages(
          (p) => fetchVendaItens({ empresaCodigo: empresaCodigo!, dataInicial, dataFinal, usaProdutoLmc: false, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
          1000,
          300,
        )
        for (const it of itens) {
          const set = porVenda.get(it.vendaCodigo)
          if (set && it.produtoCodigo && it.quantidade > 0) set.add(it.produtoCodigo)
        }
      }
      const cestas: number[][] = []
      for (const set of porVenda.values()) if (set.size >= 2) cestas.push([...set])
      return { cestas, totalCupons: vendas.length, fonte, dataInicial, dataFinal }
    },
    enabled: enabled && empresaCodigo != null,
    staleTime: 30 * 60 * 1000,
  })
}

export default useCestasVenda

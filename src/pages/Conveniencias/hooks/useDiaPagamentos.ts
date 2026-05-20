import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendaFormasPagamento, fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import type { VendaItem, VendaFormaPagamento } from '@/api/types/venda'

/**
 * Dados crus de um dia (itens + formas de pagamento) pro modal de detalhe.
 * Carregado sob demanda quando o dia abre.
 *
 * As formas de pagamento na API são por VENDA (transação), não por item. Pra
 * fazer o pagamento "acompanhar o filtro" de produtos, ratemos o pagamento de
 * cada venda na proporção do valor dos produtos exibidos dentro dela
 * (computeProratedPagamentos). É uma estimativa — o cliente pagou a cesta
 * inteira junto, mas distribuímos por valor.
 */

export interface PagamentoDia {
  tipo: string
  nome: string
  valor: number
  quantidade: number
}

export interface ProratedPagamentos {
  breakdown: PagamentoDia[]
  total: number
  totalTransacoes: number
}

export interface UseDiaPagamentosResult {
  itens: VendaItem[]
  formas: VendaFormaPagamento[]
  isLoading: boolean
}

/**
 * Rateia o pagamento de cada venda pela fração do valor que pertence aos
 * produtos exibidos (`displayedCodes`). Vendas sem nenhum produto exibido
 * ficam de fora.
 */
export const computeProratedPagamentos = (
  itens: VendaItem[],
  formas: VendaFormaPagamento[],
  displayedCodes: Set<number>,
): ProratedPagamentos => {
  // Por venda: total de todos os itens (loja + combustível) e total só dos exibidos.
  const totalPorVenda = new Map<number, number>()
  const matchPorVenda = new Map<number, number>()
  for (const it of itens) {
    const total = it.totalVenda ?? 0
    totalPorVenda.set(it.vendaCodigo, (totalPorVenda.get(it.vendaCodigo) ?? 0) + total)
    if (displayedCodes.has(it.produtoCodigo)) {
      matchPorVenda.set(it.vendaCodigo, (matchPorVenda.get(it.vendaCodigo) ?? 0) + total)
    }
  }

  const map = new Map<string, PagamentoDia>()
  for (const f of formas) {
    const total = totalPorVenda.get(f.vendaCodigo) ?? 0
    const match = matchPorVenda.get(f.vendaCodigo) ?? 0
    const fraction = total > 0 ? match / total : 0
    if (fraction <= 0) continue
    const tipo = f.tipoFormaPagamento || 'OUTROS'
    const prev = map.get(tipo) ?? { tipo, nome: f.nomeFormaPagamento || tipo, valor: 0, quantidade: 0 }
    prev.valor += (f.valorPagamento ?? 0) * fraction
    prev.quantidade += 1
    map.set(tipo, prev)
  }

  const breakdown = Array.from(map.values()).sort((a, b) => b.valor - a.valor)
  const total = breakdown.reduce((s, p) => s + p.valor, 0)
  const totalTransacoes = breakdown.reduce((s, p) => s + p.quantidade, 0)
  return { breakdown, total, totalTransacoes }
}

const useDiaPagamentos = (data: string | null): UseDiaPagamentosResult => {
  const empresaCodigo = useFilterStore((s) => s.empresaCodigos[0] ?? null)
  const enabled = !!data && empresaCodigo != null

  // Itens crus do dia — TODOS (loja + combustível), pra calcular a proporção.
  // usaProdutoLmc:false garante o produtoCodigo real (casa com o catálogo).
  const { data: itens = [], isLoading: loadingItens } = useQuery({
    queryKey: ['conv-dia-itens', empresaCodigo, data],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchVendaItens({
          empresaCodigo: empresaCodigo ?? undefined,
          dataInicial: data!,
          dataFinal: data!,
          usaProdutoLmc: false,
          ultimoCodigo: p.ultimoCodigo,
          limite: p.limite,
        }),
        1000, 50,
      ),
    enabled,
    staleTime: 5 * 60 * 1000,
  })

  const { data: formas = [], isLoading: loadingFormas } = useQuery({
    queryKey: ['conv-dia-formas', empresaCodigo, data],
    queryFn: () =>
      fetchAllPages(
        (p) => fetchVendaFormasPagamento({
          empresaCodigo: empresaCodigo ?? undefined,
          dataInicial: data!,
          dataFinal: data!,
          ultimoCodigo: p.ultimoCodigo,
          limite: p.limite,
        }),
        1000, 50,
      ),
    enabled,
    staleTime: 5 * 60 * 1000,
  })

  return { itens, formas, isLoading: loadingItens || loadingFormas }
}

export default useDiaPagamentos

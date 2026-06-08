import { useMemo, useState } from 'react'
import { Search, Info } from 'lucide-react'
import DataTable, { type Column } from '@/components/tables/DataTable'
import HeatmapCell from '@/components/tables/HeatmapCell'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { computeProratedPagamentos } from '@/pages/Conveniencias/hooks/useDiaPagamentos'
import type { DaySaleProduct } from '@/pages/Conveniencias/hooks/useConvenienceData'
import type { VendaItem, VendaFormaPagamento } from '@/api/types/venda'

const PGTO_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316']

const productCols: Column<DaySaleProduct>[] = [
  { key: 'nome', label: 'Produto', sortable: true },
  { key: 'grupo', label: 'Grupo', sortable: true },
  { key: 'quantidade', label: 'Qtd', align: 'right', sortable: true, render: (r) => formatNumber(r.quantidade) },
  { key: 'faturamento', label: 'Faturamento', align: 'right', sortable: true, render: (r) => formatCurrency(r.faturamento) },
  { key: 'margemRs', label: 'Margem R$', align: 'right', sortable: true, render: (r) => formatCurrency(r.margemRs) },
  {
    key: 'margemPct', label: 'Margem %', align: 'right', sortable: true,
    render: (r) => <HeatmapCell value={r.margemPct} min={-10} max={40} formatted={`${r.margemPct.toFixed(0)}%`} />,
  },
]

interface VendaDetailModalProps {
  open: boolean
  onClose: () => void
  title: string
  /** Produtos do recorte (dia ou grupo), sem filtro aplicado. */
  products: DaySaleProduct[]
  /** Mostra o dropdown de grupo (modal do dia). No modal de grupo, fica oculto. */
  showGroupFilter?: boolean
  /** Itens + formas crus do período pro rateio do pagamento. */
  itens: VendaItem[]
  formas: VendaFormaPagamento[]
  pagLoading: boolean
}

const VendaDetailModal = ({ open, onClose, title, products, showGroupFilter, itens, formas, pagLoading }: VendaDetailModalProps) => {
  const [search, setSearch] = useState('')
  const [grupo, setGrupo] = useState('')
  // Reseta os filtros ao abrir um novo recorte.
  const openKey = `${open}-${title}`
  const [prevOpenKey, setPrevOpenKey] = useState(openKey)
  if (prevOpenKey !== openKey) {
    setPrevOpenKey(openKey)
    setSearch('')
    setGrupo('')
  }

  const grupos = useMemo(
    () => (showGroupFilter ? [...new Set(products.map((p) => p.grupo))].sort() : []),
    [products, showGroupFilter],
  )

  const filtered = useMemo(() => {
    let result = products
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((p) => p.nome.toLowerCase().includes(q) || p.grupo.toLowerCase().includes(q))
    }
    if (showGroupFilter && grupo) result = result.filter((p) => p.grupo === grupo)
    return result
  }, [products, search, grupo, showGroupFilter])

  const totals = useMemo(() => {
    const faturamento = filtered.reduce((s, p) => s + p.faturamento, 0)
    const custo = filtered.reduce((s, p) => s + p.custo, 0)
    const margem = faturamento - custo
    return {
      faturamento,
      margemPct: faturamento > 0 ? (margem / faturamento) * 100 : 0,
      itens: filtered.length,
    }
  }, [filtered])

  // Pagamento rateado pelos produtos exibidos (acompanha busca + grupo).
  const pagamentos = useMemo(
    () => computeProratedPagamentos(itens, formas, new Set(filtered.map((p) => p.produtoCodigo))),
    [itens, formas, filtered],
  )

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-5xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {totals.itens} produto{totals.itens === 1 ? '' : 's'} · {formatCurrency(totals.faturamento)} · margem {totals.margemPct.toFixed(0)}%
          </DialogDescription>
        </DialogHeader>

        {products.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">Sem produtos nesse recorte.</p>
        ) : (
          <>
            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder={showGroupFilter ? 'Buscar produto ou grupo...' : 'Buscar produto...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                />
              </div>
              {showGroupFilter && (
                <select
                  value={grupo}
                  onChange={(e) => setGrupo(e.target.value)}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
                >
                  <option value="">Todos os grupos</option>
                  {grupos.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              )}
              {(search || grupo) && (
                <button
                  onClick={() => { setSearch(''); setGrupo('') }}
                  className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Só a tabela rola; o resumo de pagamentos fica fixo abaixo. */}
            <div className="-mx-6 mt-1 flex-1 overflow-auto px-6">
              <DataTable columns={productCols} data={filtered} keyExtractor={(r) => r.produtoCodigo} enableRowHighlight />
              <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                Exibindo {filtered.length} de {products.length} produtos
              </p>
            </div>

            {/* Formas de pagamento — rateadas pelos produtos exibidos. */}
            <div className="mt-3 shrink-0 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Formas de pagamento</h4>
                <span className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500" title="O pagamento é por venda; rateamos pela proporção do valor dos produtos exibidos.">
                  <Info className="h-3 w-3" /> estimado · rateio por valor
                </span>
              </div>
              {pagLoading ? (
                <p className="py-2 text-xs text-gray-400">Carregando…</p>
              ) : pagamentos.breakdown.length === 0 ? (
                <p className="py-2 text-xs text-gray-400">Sem pagamentos para esse recorte.</p>
              ) : (
                <div className="space-y-2">
                  {pagamentos.breakdown.map((p, i) => {
                    const pct = pagamentos.total > 0 ? (p.valor / pagamentos.total) * 100 : 0
                    return (
                      <div key={p.tipo} className="flex items-center gap-3">
                        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: PGTO_COLORS[i % PGTO_COLORS.length] }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs text-gray-700 dark:text-gray-300">{p.nome}</span>
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{pct.toFixed(0)}%</span>
                          </div>
                          <p className="text-[10px] tabular-nums text-gray-400">
                            {formatCurrency(p.valor)} · {formatNumber(p.quantidade)} transações
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Total</span>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(pagamentos.total)}</p>
                      <p className="text-[10px] tabular-nums text-gray-400">
                        {formatNumber(pagamentos.totalTransacoes)} {pagamentos.totalTransacoes === 1 ? 'transação' : 'transações'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default VendaDetailModal

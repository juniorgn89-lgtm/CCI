import { useMemo } from 'react'
import { Fuel, Receipt, DollarSign, Gauge } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { formatCurrency, formatLiters, formatNumber } from '@/lib/formatters'
import type { AbastecimentoRow } from '@/pages/Operacao/hooks/useOperacaoData'

interface FrentistaDetalheModalProps {
  open: boolean
  onClose: () => void
  nome: string
  codigo: number
  abastecimentos: AbastecimentoRow[]
}

interface ProdutoLinha {
  produto: string
  litros: number
  faturamento: number
  abastecimentos: number
}

interface DiaGrupo {
  dia: string // yyyy-MM-dd
  linhas: ProdutoLinha[]
  litros: number
  faturamento: number
  abastecimentos: number
}

/** Preço médio R$/L (3 casas, como no webPosto). */
const precoMedio = (faturamento: number, litros: number): string =>
  litros > 0 ? `R$ ${(faturamento / litros).toFixed(3).replace('.', ',')}` : '—'

/** 'yyyy-MM-dd' → 'dd/MM/yyyy'. */
const formatDia = (iso: string): string => {
  const [y, m, d] = iso.split('-')
  return y && m && d ? `${d}/${m}/${y}` : iso
}

/** Detalhe do frentista por DIA e produto — espelha o relatório de Abastecimento
 *  do webPosto (agrupa por data do abastecimento, com subtotal por dia). */
const FrentistaDetalheModal = ({ open, onClose, nome, codigo, abastecimentos }: FrentistaDetalheModalProps) => {
  const { dias, totLitros, totFat, totAbast } = useMemo(() => {
    // dia → produto → linha
    const porDia = new Map<string, Map<string, ProdutoLinha>>()
    for (const a of abastecimentos) {
      if (a.frentistaCodigo !== codigo) continue
      const dia = (a.dataHora || '').slice(0, 10)
      const nomeProd = a.produtoNome || `Produto ${a.produtoCodigo}`
      const prods = porDia.get(dia) ?? new Map<string, ProdutoLinha>()
      const prev = prods.get(nomeProd) ?? { produto: nomeProd, litros: 0, faturamento: 0, abastecimentos: 0 }
      prev.litros += a.litros
      prev.faturamento += a.valorTotal
      prev.abastecimentos += 1
      prods.set(nomeProd, prev)
      porDia.set(dia, prods)
    }
    // Dias em ordem decrescente (mais recente primeiro), produtos por faturamento.
    const dias: DiaGrupo[] = Array.from(porDia.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([dia, prods]) => {
        const linhas = Array.from(prods.values()).sort((a, b) => b.faturamento - a.faturamento)
        return {
          dia,
          linhas,
          litros: linhas.reduce((s, l) => s + l.litros, 0),
          faturamento: linhas.reduce((s, l) => s + l.faturamento, 0),
          abastecimentos: linhas.reduce((s, l) => s + l.abastecimentos, 0),
        }
      })
    return {
      dias,
      totLitros: dias.reduce((s, d) => s + d.litros, 0),
      totFat: dias.reduce((s, d) => s + d.faturamento, 0),
      totAbast: dias.reduce((s, d) => s + d.abastecimentos, 0),
    }
  }, [abastecimentos, codigo])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>
            <span className="flex items-center gap-2">
              <Fuel className="h-4 w-4 text-blue-500" />
              {nome}
            </span>
          </DialogTitle>
          <DialogDescription>Abastecimentos por produto no período</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {/* KPIs do frentista */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi Icon={Fuel} label="Litros" value={formatLiters(totLitros)} />
            <Kpi Icon={DollarSign} label="Faturamento" value={formatCurrency(totFat)} />
            <Kpi Icon={Receipt} label="Abastecimentos" value={formatNumber(totAbast)} />
            <Kpi Icon={Gauge} label="Preço médio" value={precoMedio(totFat, totLitros)} />
          </div>

          {dias.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">Sem abastecimentos no período.</p>
          ) : (
            <table className="mt-3 w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Data</th>
                  <th className="px-3 py-2 text-left font-medium">Produto</th>
                  <th className="px-3 py-2 text-right font-medium">Litros</th>
                  <th className="px-3 py-2 text-right font-medium">Preço médio</th>
                  <th className="px-3 py-2 text-right font-medium">Faturamento</th>
                  <th className="px-3 py-2 text-right font-medium">Nº Abast.</th>
                </tr>
              </thead>
              {dias.map((d) => (
                <tbody key={d.dia} className="divide-y divide-gray-100 dark:divide-gray-800">
                  {d.linhas.map((l, i) => (
                    <tr key={`${d.dia}-${l.produto}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="whitespace-nowrap px-3 py-2 font-medium tabular-nums text-gray-700 dark:text-gray-300">
                        {i === 0 ? formatDia(d.dia) : ''}
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{l.produto}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatLiters(l.litros)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{precoMedio(l.faturamento, l.litros)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(l.faturamento)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatNumber(l.abastecimentos)}</td>
                    </tr>
                  ))}
                  {/* Subtotal do dia — só quando o dia tem mais de um produto. */}
                  {d.linhas.length > 1 && (
                    <tr className="bg-gray-50/70 text-[11px] font-medium text-gray-600 dark:bg-gray-800/40 dark:text-gray-300">
                      <td className="px-3 py-1.5" />
                      <td className="px-3 py-1.5">Subtotal {formatDia(d.dia)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatLiters(d.litros)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{precoMedio(d.faturamento, d.litros)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(d.faturamento)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(d.abastecimentos)}</td>
                    </tr>
                  )}
                </tbody>
              ))}
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold dark:border-gray-700 dark:bg-gray-800/50">
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-200" colSpan={2}>Total</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(totLitros)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{precoMedio(totFat, totLitros)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(totFat)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(totAbast)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

const Kpi = ({ Icon, label, value }: { Icon: typeof Fuel; label: string; value: string }) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-2.5 dark:border-gray-700 dark:bg-gray-800/40">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <Icon className="h-3.5 w-3.5 text-gray-400" />
    </div>
    <p className="mt-1 text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
  </div>
)

export default FrentistaDetalheModal

import { useState } from 'react'
import { Users, DollarSign, Receipt, TrendingUp, Trophy, ShoppingBag } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyShort, formatNumber, formatPercent } from '@/lib/formatters'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import BarCell from '@/components/tables/BarCell'
import useVendedoresConveniencia, { type VendedorRow } from '@/pages/Produtividade/hooks/useVendedoresConveniencia'

type SortKey = 'faturamento' | 'lucroBruto' | 'margemPct' | 'itens' | 'cupons' | 'ticketMedio'
type BarColor = 'blue' | 'green' | 'amber'

const COLS: { key: SortKey; label: string; color: BarColor; val: (r: VendedorRow) => number; fmt: (r: VendedorRow) => string }[] = [
  { key: 'faturamento', label: 'Faturamento', color: 'green', val: (r) => r.faturamento, fmt: (r) => formatCurrency(r.faturamento) },
  { key: 'lucroBruto', label: 'Lucro bruto', color: 'green', val: (r) => r.lucroBruto, fmt: (r) => formatCurrency(r.lucroBruto) },
  { key: 'margemPct', label: 'Margem', color: 'amber', val: (r) => r.margemPct, fmt: (r) => formatPercent(r.margemPct) },
  { key: 'itens', label: 'Itens', color: 'blue', val: (r) => r.itens, fmt: (r) => formatNumber(r.itens) },
  { key: 'cupons', label: 'Cupons', color: 'blue', val: (r) => r.cupons, fmt: (r) => formatNumber(r.cupons) },
  { key: 'ticketMedio', label: 'Ticket médio', color: 'amber', val: (r) => r.ticketMedio, fmt: (r) => formatCurrency(r.ticketMedio) },
]

/** Colunas que iniciam um grupo → divisor vertical (Financeiro é o 1º, sem divisor). */
const GROUP_START = new Set<SortKey>(['itens', 'ticketMedio'])
const gStart = 'border-l border-gray-200 dark:border-gray-700'

const GroupTh = ({ label, colSpan, first }: { label: string; colSpan: number; first?: boolean }) => (
  <th colSpan={colSpan} className={cn('bg-gray-100/60 px-3 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:bg-gray-800/60 dark:text-gray-500', !first && gStart)}>
    {label}
  </th>
)

const KpiCard = ({ icon: Icon, label, value, sub, tint }: {
  icon: typeof Users; label: string; value: string; sub?: string; tint: string
}) => (
  <div className={cn('rounded-xl border border-gray-200 bg-gradient-to-br p-5 shadow-sm dark:border-gray-700 dark:to-gray-900', tint)}>
    <div className="flex items-center gap-2">
      <Icon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
    </div>
    <p className="mt-3 text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
    {sub && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{sub}</p>}
  </div>
)

/**
 * Produtividade dos VENDEDORES da conveniência — ranking por funcionário,
 * lendo o cache apuracao_vendas_funcionario (setor conveniência). Mesmo período
 * e postos do filtro global. Ticket médio = faturamento ÷ cupons.
 */
const VendedoresConveniencia = () => {
  const { rows, totalFaturamento, totalLucro, totalCupons, isLoading, hasEmpresa } = useVendedoresConveniencia()
  const [sort, setSort] = useState<SortKey>('faturamento')

  if (!hasEmpresa) return <SelectCompanyState />

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <ShoppingBag className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
        <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">Sem vendas de conveniência por vendedor no período</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Reapure o período (Admin · Apuração) pra preencher o cache de vendedores.
        </p>
      </div>
    )
  }

  const ticketMedioGeral = totalCupons > 0 ? totalFaturamento / totalCupons : 0
  const sorted = [...rows].sort((a, b) => (b[sort] as number) - (a[sort] as number))
  const colMax = Object.fromEntries(COLS.map((c) => [c.key, Math.max(...rows.map((r) => c.val(r)), 0)])) as Record<SortKey, number>

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Users} label="Vendedores" value={formatNumber(rows.length)}
          sub={`${rows.filter((r) => r.ativo).length} ativos`} tint="from-blue-50/60 to-white dark:from-blue-950/30" />
        <KpiCard icon={DollarSign} label="Faturamento (loja)" value={formatCurrencyShort(totalFaturamento)}
          sub={`Lucro ${formatCurrencyShort(totalLucro)}`} tint="from-emerald-50/60 to-white dark:from-emerald-950/30" />
        <KpiCard icon={Receipt} label="Cupons" value={formatNumber(totalCupons)}
          sub="vendas de conveniência" tint="from-violet-50/60 to-white dark:from-violet-950/30" />
        <KpiCard icon={TrendingUp} label="Ticket médio" value={formatCurrency(ticketMedioGeral)}
          sub="faturamento ÷ cupons" tint="from-amber-50/60 to-white dark:from-amber-950/30" />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ranking de vendedores</span>
          <span className="ml-auto text-xs text-gray-400">{rows.length} vendedores · ordenado por {COLS.find((c) => c.key === sort)?.label.toLowerCase()}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th colSpan={2} className="px-3 py-1.5" />
                <GroupTh first label="Financeiro" colSpan={3} />
                <GroupTh label="Operação" colSpan={2} />
                <GroupTh label="Eficiência" colSpan={1} />
              </tr>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-xs uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-400">
                <th className="px-5 py-2.5 text-left font-medium">#</th>
                <th className="px-3 py-2.5 text-left font-medium">Vendedor</th>
                {COLS.map((c) => (
                  <th key={c.key} className={cn('px-3 py-2.5 text-right font-medium', GROUP_START.has(c.key) && gStart)}>
                    <button
                      type="button"
                      onClick={() => setSort(c.key)}
                      className={cn('inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200', sort === c.key && 'text-gray-900 dark:text-gray-100')}
                    >
                      {c.label}
                      {sort === c.key && <span className="text-[9px]">▼</span>}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sorted.map((r, i) => (
                <tr key={r.funcionarioCodigo} className="transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                  <td className="px-5 py-2.5 text-left font-bold text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{r.nome}</span>
                      {!r.ativo && <span className="rounded bg-gray-100 px-1.5 text-[10px] text-gray-400 dark:bg-gray-800">inativo</span>}
                    </div>
                  </td>
                  {COLS.map((c) => (
                    <td key={c.key} className={cn('px-2 py-2.5', GROUP_START.has(c.key) && gStart)}>
                      <BarCell value={c.val(r)} max={colMax[c.key]} formatted={c.fmt(r)} color={c.color} align="near" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default VendedoresConveniencia

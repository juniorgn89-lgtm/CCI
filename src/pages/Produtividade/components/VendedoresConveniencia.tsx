import { useState } from 'react'
import { Users, DollarSign, Receipt, TrendingUp, ShoppingBag, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatCurrencyShort, formatNumber } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import BarCell from '@/components/tables/BarCell'
import useVendedoresConveniencia, { type VendedorRow } from '@/pages/Produtividade/hooks/useVendedoresConveniencia'

type SortKey = 'nome' | 'itens' | 'cupons' | 'faturamento' | 'lucroBruto' | 'margemPct' | 'ticketMedio'
type SortDir = 'asc' | 'desc'
type BarColor = 'blue' | 'green' | 'amber'

/** Colunas de dado, na ordem dos grupos Operação · Financeiro · Eficiência. */
const COLS: {
  key: Exclude<SortKey, 'nome'>
  label: string
  bar: BarColor | null
  help: string
  /** Início de grupo → divisor vertical. */
  groupStart?: boolean
  val: (r: VendedorRow) => number
  fmt: (r: VendedorRow) => string
}[] = [
  // Operação
  { key: 'itens', label: 'Itens', bar: 'blue', help: 'Itens vendidos (Σ quantidade) pelo vendedor no período.', val: (r) => r.itens, fmt: (r) => formatNumber(r.itens) },
  { key: 'cupons', label: 'Cupons', bar: 'blue', help: 'Número de cupons (vendas) do vendedor no período.', val: (r) => r.cupons, fmt: (r) => formatNumber(r.cupons) },
  // Financeiro
  { key: 'faturamento', label: 'Faturamento', bar: 'green', groupStart: true, help: 'Faturamento de conveniência do vendedor no período.', val: (r) => r.faturamento, fmt: (r) => formatCurrencyInt(r.faturamento) },
  { key: 'lucroBruto', label: 'Lucro bruto', bar: 'green', help: 'Faturamento − custo (CMV) da mercadoria vendida.', val: (r) => r.lucroBruto, fmt: (r) => formatCurrencyInt(r.lucroBruto) },
  { key: 'margemPct', label: '% Margem', bar: null, help: '(Lucro bruto ÷ faturamento) × 100.', val: (r) => r.margemPct, fmt: (r) => fmtPct(r.margemPct) },
  // Eficiência
  { key: 'ticketMedio', label: 'Ticket méd.', bar: 'amber', groupStart: true, help: 'Faturamento ÷ número de cupons.', val: (r) => r.ticketMedio, fmt: (r) => formatCurrencyInt(r.ticketMedio) },
]

const fmtPct = (v: number): string => `${v.toFixed(2).replace('.', ',')}%`

const KpiCard = ({ icon: Icon, label, value, sub, tint, help }: {
  icon: typeof Users; label: string; value: string; sub?: string; tint: string; help?: string
}) => (
  <div className={cn('rounded-xl border border-gray-200 bg-gradient-to-br p-5 shadow-sm dark:border-gray-700 dark:to-gray-900', tint)}>
    <div className="flex items-center gap-2">
      <Icon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</span>
      {help && <InfoHint text={help} />}
    </div>
    <p className="mt-3 text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
    {sub && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{sub}</p>}
  </div>
)

/* ── Cabeçalho ordenável (padrão Frentistas) ── */
interface ThSortProps {
  label: string
  k: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onClick: () => void
  align?: 'left' | 'right'
  groupStart?: boolean
  help?: string
}

const ThSort = ({ label, k, sortKey, sortDir, onClick, align = 'right', groupStart, help }: ThSortProps) => {
  const isActive = sortKey === k
  return (
    <th className={cn(
      'whitespace-nowrap px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400',
      align === 'left' ? 'text-left' : 'text-right',
      groupStart && 'border-l border-gray-200 dark:border-gray-700',
    )}>
      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'justify-end')}>
        <button
          onClick={onClick}
          className={cn(
            'inline-flex items-center gap-1 transition-colors hover:text-gray-700 dark:hover:text-gray-200',
            align === 'right' && 'flex-row-reverse',
            isActive && 'text-gray-900 dark:text-gray-100',
          )}
        >
          {label}
          {isActive ? (
            sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-30" />
          )}
        </button>
        {help && <InfoHint text={help} />}
      </span>
    </th>
  )
}

/**
 * Produtividade dos VENDEDORES da conveniência — ranking por funcionário,
 * lendo o cache apuracao_vendas_funcionario (setor conveniência). Mesmo período
 * e postos do filtro global. Padronizado conforme o Comparativo de Frentistas.
 */
const VendedoresConveniencia = () => {
  const { rows, totalFaturamento, totalLucro, totalCupons, totalItens, isLoading, hasEmpresa } = useVendedoresConveniencia()
  const [sortKey, setSortKey] = useState<SortKey>('faturamento')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const handleColumnSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'nome' ? 'asc' : 'desc')
    }
  }

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
  const sorted = [...rows].sort((a, b) => {
    if (sortKey === 'nome') return sortDir === 'asc' ? a.nome.localeCompare(b.nome) : b.nome.localeCompare(a.nome)
    const av = a[sortKey] as number
    const bv = b[sortKey] as number
    return sortDir === 'asc' ? av - bv : bv - av
  })
  const colMax = Object.fromEntries(COLS.map((c) => [c.key, Math.max(...rows.map((r) => c.val(r)), 0)])) as Record<string, number>

  const totals = {
    itens: totalItens,
    cupons: totalCupons,
    faturamento: totalFaturamento,
    lucroBruto: totalLucro,
    margemPct: totalFaturamento > 0 ? (totalLucro / totalFaturamento) * 100 : 0,
    ticketMedio: ticketMedioGeral,
  }
  const totalFmt: Record<Exclude<SortKey, 'nome'>, string> = {
    itens: formatNumber(totals.itens),
    cupons: formatNumber(totals.cupons),
    faturamento: formatCurrencyInt(totals.faturamento),
    lucroBruto: formatCurrencyInt(totals.lucroBruto),
    margemPct: fmtPct(totals.margemPct),
    ticketMedio: formatCurrencyInt(totals.ticketMedio),
  }

  const activeLabel = COLS.find((c) => c.key === sortKey)?.label.toLowerCase() ?? (sortKey === 'nome' ? 'vendedor' : '')

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard icon={Users} label="Vendedores" value={formatNumber(rows.length)}
          sub={`${rows.filter((r) => r.ativo).length} ativos`} tint="from-blue-50/60 to-white dark:from-blue-950/30"
          help="Vendedores com vendas de conveniência no período (e quantos estão ativos)." />
        <KpiCard icon={DollarSign} label="Faturamento (loja)" value={formatCurrencyShort(totalFaturamento)}
          sub={`Lucro ${formatCurrencyShort(totalLucro)}`} tint="from-emerald-50/60 to-white dark:from-emerald-950/30"
          help="Faturamento total da conveniência no período · lucro bruto (faturamento − custo)." />
        <KpiCard icon={Receipt} label="Cupons" value={formatNumber(totalCupons)}
          sub="vendas de conveniência" tint="from-violet-50/60 to-white dark:from-violet-950/30"
          help="Número de cupons (vendas) da conveniência no período." />
        <KpiCard icon={TrendingUp} label="Ticket médio" value={formatCurrency(ticketMedioGeral)}
          sub="faturamento ÷ cupons" tint="from-amber-50/60 to-white dark:from-amber-950/30"
          help="Ticket médio da loja = faturamento ÷ número de cupons." />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Comparativo de Vendedores</h3>
              <InfoHint
                text="Consolidado do período por vendedor da conveniência (cache de apuração). Clique nos cabeçalhos pra ordenar."
                align="start"
              />
            </div>
            <p className="mt-0.5 text-xs italic text-gray-400">
              Desempenho consolidado no período · conveniência
            </p>
          </div>
          <span className="text-xs text-gray-400">{rows.length} vendedores · ordenado por {activeLabel}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              {/* Títulos de grupo (padrão Operação · Financeiro · Eficiência) */}
              <tr className="border-b border-gray-100 bg-gray-50/60 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-500">
                <th colSpan={2} className="px-2 py-1.5" />
                <th colSpan={2} className="px-3 py-1.5 text-center">Operação</th>
                <th colSpan={3} className="border-l border-gray-200 px-3 py-1.5 text-center dark:border-gray-700">Financeiro</th>
                <th colSpan={1} className="border-l border-gray-200 px-3 py-1.5 text-center dark:border-gray-700">Eficiência</th>
              </tr>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <th className="w-10 px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">#</th>
                <ThSort label="Vendedor" k="nome" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('nome')} align="left" />
                {COLS.map((c) => (
                  <ThSort
                    key={c.key}
                    label={c.label}
                    k={c.key}
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onClick={() => handleColumnSort(c.key)}
                    groupStart={c.groupStart}
                    help={c.help}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sorted.map((r, i) => (
                <tr
                  key={r.funcionarioCodigo}
                  className={cn(
                    'transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40',
                    i % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30',
                  )}
                >
                  <td className="px-4 py-2.5 text-xs tabular-nums text-gray-400">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{r.nome}</span>
                      {!r.ativo && <span className="rounded bg-gray-100 px-1.5 text-[10px] text-gray-400 dark:bg-gray-800">inativo</span>}
                    </div>
                  </td>
                  {COLS.map((c) => {
                    if (c.key === 'margemPct') {
                      return (
                        <td key={c.key} className={cn(
                          'px-4 py-2.5 text-right text-sm font-medium tabular-nums',
                          c.groupStart && 'border-l border-gray-200 dark:border-gray-700',
                          r.margemPct >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
                        )}>
                          {c.fmt(r)}
                        </td>
                      )
                    }
                    return (
                      <td key={c.key} className={cn('px-2 py-2.5', c.groupStart && 'border-l border-gray-200 dark:border-gray-700')}>
                        <BarCell value={c.val(r)} max={colMax[c.key]} formatted={c.fmt(r)} color={c.bar ?? 'blue'} align="near" />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-200">
                <td />
                <td className="px-4 py-2.5">Total do período</td>
                {COLS.map((c) => (
                  <td key={c.key} className={cn('px-4 py-2.5 text-right tabular-nums', c.groupStart && 'border-l border-gray-200 dark:border-gray-700')}>
                    {totalFmt[c.key]}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}

export default VendedoresConveniencia

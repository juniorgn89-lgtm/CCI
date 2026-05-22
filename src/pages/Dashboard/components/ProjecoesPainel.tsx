import { TrendingUp, TrendingDown, AlertTriangle, Minus, Calendar, CircleDollarSign, DollarSign, PieChart } from 'lucide-react'
import useProjecaoMes from '@/pages/Dashboard/hooks/useProjecaoMes'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { ComparisonMode } from '@/store/filters'

const comparisonLabel = (mode: ComparisonMode): string =>
  mode === 'prevMonth' ? 'vs mês anterior' : 'vs ano anterior'

const VariationBadge = ({ value, mode }: { value: number; mode: ComparisonMode }) => {
  if (!isFinite(value) || value === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
        <Minus className="h-3 w-3" />
        sem comparativo
      </span>
    )
  }
  const positive = value > 0
  const Icon = positive ? TrendingUp : TrendingDown
  // Cinza neutro (sem verde/vermelho) — a seta já indica subiu/caiu.
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
      <Icon className="h-3 w-3" />
      {positive ? '+' : ''}
      {formatPercent(value)} {comparisonLabel(mode)}
    </span>
  )
}

interface KpiBlockProps {
  label: string
  realizado: string
  projetado: string
  variacao: number
  comparisonMode: ComparisonMode
  projetadoLabel?: string
  Icon: typeof CircleDollarSign
  chipClass: string
  iconClass: string
}

const KpiBlock = ({ label, realizado, projetado, variacao, comparisonMode, projetadoLabel = 'Projetado', Icon, chipClass, iconClass }: KpiBlockProps) => (
  <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-start justify-between gap-2">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{label}</p>
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', chipClass)}>
        <Icon className={cn('h-4 w-4', iconClass)} />
      </div>
    </div>
    <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{realizado}</p>
    <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">{projetadoLabel}</p>
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-semibold tabular-nums text-blue-700 dark:text-blue-300">{projetado}</span>
      <VariationBadge value={variacao} mode={comparisonMode} />
    </div>
  </div>
)

const ProjecoesPainel = () => {
  const {
    realizado,
    projetado,
    variacao,
    comparisonMode,
    diasFechados,
    diasNoMes,
    alertaMenorMargem,
    awaitingFirstClose,
    isLoading,
  } = useProjecaoMes()

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <div className="mb-3 flex items-center gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
          <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Projeção do mês
          </h2>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
            <Calendar className="h-3 w-3" />
            {awaitingFirstClose
              ? `Mês corrente · ${diasNoMes} dias`
              : `${diasFechados} de ${diasNoMes} dias fechados`}
          </p>
        </div>
      </div>

      {awaitingFirstClose ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-6 text-center dark:border-gray-700 dark:bg-gray-800/30">
          <Calendar className="mx-auto h-6 w-6 text-gray-400" />
          <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Aguardando primeiro fechamento
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            A projeção será calculada após o fechamento do primeiro dia do mês.
          </p>
        </div>
      ) : isLoading && realizado.faturamento === 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/50"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <KpiBlock
            label="Faturamento"
            realizado={formatCurrency(realizado.faturamento)}
            projetado={formatCurrency(projetado.faturamento)}
            variacao={variacao.faturamento}
            comparisonMode={comparisonMode}
            Icon={CircleDollarSign}
            chipClass="bg-blue-100 dark:bg-blue-900/30"
            iconClass="text-blue-600 dark:text-blue-400"
          />
          <KpiBlock
            label="Lucro Bruto"
            realizado={formatCurrency(realizado.lucroBruto)}
            projetado={formatCurrency(projetado.lucroBruto)}
            variacao={variacao.lucroBruto}
            comparisonMode={comparisonMode}
            Icon={DollarSign}
            chipClass="bg-emerald-100 dark:bg-emerald-900/30"
            iconClass="text-emerald-600 dark:text-emerald-400"
          />
          <KpiBlock
            label="Margem"
            realizado={formatPercent(realizado.margem)}
            projetado={formatPercent(projetado.margem)}
            variacao={0}
            comparisonMode={comparisonMode}
            projetadoLabel="Projetada"
            Icon={PieChart}
            chipClass="bg-amber-100 dark:bg-amber-900/30"
            iconClass="text-amber-600 dark:text-amber-400"
          />

          {/* Alerta menor margem */}
          {alertaMenorMargem ? (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  Menor margem na rede
                </p>
              </div>
              <div>
                <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                  {alertaMenorMargem.empresa}
                </p>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  Margem combustível:{' '}
                  <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                    {formatPercent(alertaMenorMargem.margem)}
                  </span>
                </p>
              </div>
            </div>
          ) : (
            // Placeholder vazio pra manter o grid alinhado quando não há alerta
            <div className="hidden xl:block" />
          )}
        </div>
      )}
    </section>
  )
}

export default ProjecoesPainel

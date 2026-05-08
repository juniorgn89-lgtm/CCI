import { TrendingUp, TrendingDown, AlertTriangle, Minus, Calendar } from 'lucide-react'
import useProjecaoMes from '@/pages/Dashboard/hooks/useProjecaoMes'
import { formatCurrency, formatPercent } from '@/lib/formatters'

const VariationBadge = ({ value }: { value: number }) => {
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
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
      }`}
    >
      <Icon className="h-3 w-3" />
      {positive ? '+' : ''}
      {formatPercent(value)} vs ano anterior
    </span>
  )
}

const KpiBlock = ({
  label,
  realizado,
  projetado,
  variacao,
}: {
  label: string
  realizado: string
  projetado: string
  variacao: number
}) => (
  <div className="space-y-1.5">
    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {label}
    </p>
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400">Realizado</span>
      <span className="text-sm font-semibold tabular-nums text-gray-700 dark:text-gray-300">
        {realizado}
      </span>
    </div>
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400">Projetado</span>
      <span className="text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">
        {projetado}
      </span>
    </div>
    <VariationBadge value={variacao} />
  </div>
)

const ProjecoesPainel = () => {
  const {
    realizado,
    projetado,
    variacaoYoY,
    diasFechados,
    diasNoMes,
    alertaMenorMargem,
    awaitingFirstClose,
    isLoading,
  } = useProjecaoMes()

  return (
    <aside className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 lg:p-5 xl:h-full">
      {/* Header */}
      <div className="mb-4 flex items-start gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
          <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
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

      {/* Awaiting first close */}
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
        // Initial loading skeleton
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800/50"
            />
          ))}
        </div>
      ) : (
        <>
          {/* KPI Blocks */}
          <div className="space-y-4">
            <KpiBlock
              label="Faturamento"
              realizado={formatCurrency(realizado.faturamento)}
              projetado={formatCurrency(projetado.faturamento)}
              variacao={variacaoYoY.faturamento}
            />
            <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
              <KpiBlock
                label="Lucro Bruto"
                realizado={formatCurrency(realizado.lucroBruto)}
                projetado={formatCurrency(projetado.lucroBruto)}
                variacao={variacaoYoY.lucroBruto}
              />
            </div>
            <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Margem projetada
              </p>
              <p className="mt-1.5 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {formatPercent(projetado.margem)}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Realizado: {formatPercent(realizado.margem)}
              </p>
            </div>
          </div>

          {/* Alerta menor margem */}
          {alertaMenorMargem && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/50 dark:bg-amber-900/10">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-amber-900 dark:text-amber-300">
                    Menor margem na rede
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {alertaMenorMargem.empresa}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                    Margem combustível:{' '}
                    <span className="font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                      {formatPercent(alertaMenorMargem.margem)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  )
}

export default ProjecoesPainel

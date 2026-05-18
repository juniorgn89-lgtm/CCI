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
        positive ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
      }`}
    >
      <Icon className="h-3 w-3" />
      {positive ? '+' : ''}
      {formatPercent(value)} vs ano anterior
    </span>
  )
}

interface KpiBlockProps {
  label: string
  realizado: string
  projetado: string
  variacao: number
  projetadoLabel?: string
}

const KpiBlock = ({ label, realizado, projetado, variacao, projetadoLabel = 'Projetado' }: KpiBlockProps) => (
  <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
    <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
      {label}
    </p>

    {/* Realizado */}
    <div>
      <p className="text-[10px] text-gray-500 dark:text-gray-400">Realizado</p>
      <p className="text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">
        {realizado}
      </p>
    </div>

    {/* Projetado — bloco azul */}
    <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50/60 px-2.5 py-1.5 dark:border-blue-800/40 dark:bg-blue-900/20">
      <TrendingUp className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" />
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
          {projetadoLabel}
        </p>
        <p className="text-sm font-bold tabular-nums text-blue-700 dark:text-blue-300">
          {projetado}
        </p>
      </div>
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
            variacao={variacaoYoY.faturamento}
          />
          <KpiBlock
            label="Lucro Bruto"
            realizado={formatCurrency(realizado.lucroBruto)}
            projetado={formatCurrency(projetado.lucroBruto)}
            variacao={variacaoYoY.lucroBruto}
          />
          <KpiBlock
            label="Margem"
            realizado={formatPercent(realizado.margem)}
            projetado={formatPercent(projetado.margem)}
            variacao={0}
            projetadoLabel="Projetada"
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

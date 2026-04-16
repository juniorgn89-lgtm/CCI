import { Users, Trophy, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLitersShort, formatCurrencyShort } from '@/lib/formatters'
import useGerenteMobileData from '@/pages/Gerente/hooks/useGerenteMobileData'
import GerenteFiltros from '@/pages/Gerente/components/GerenteFiltros'
import GerenteLoadingScreen from '@/pages/Gerente/components/GerenteLoadingScreen'
import { useFilterStore } from '@/store/filters'

const POSITION_STYLES = [
  { bg: 'bg-amber-50 dark:bg-amber-950/20', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  { bg: 'bg-gray-50 dark:bg-gray-800/20', text: 'text-gray-500 dark:text-gray-400', border: 'border-gray-200 dark:border-gray-700' },
  { bg: 'bg-orange-50 dark:bg-orange-950/20', text: 'text-orange-500 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800' },
]

const Frentistas = () => {
  const { frentistaRanking, fuelLitros, isLoading, loadingStatus } = useGerenteMobileData()
  const { empresaCodigos } = useFilterStore()

  if (!empresaCodigos.length) {
    return (
      <div className="flex flex-col gap-4">
        <GerenteFiltros />
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e3a5f]/10">
            <Building2 className="h-7 w-7 text-[#1e3a5f]/60 dark:text-blue-400/60" />
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Selecione uma empresa</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">para visualizar os dados</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <GerenteFiltros />
        <GerenteLoadingScreen status={loadingStatus} />
      </div>
    )
  }

  const topLitros = frentistaRanking[0]?.litros ?? 1

  return (
    <div className="flex flex-col gap-4">
      <GerenteFiltros />

      {/* Header strip */}
      <div className="flex items-center gap-3 rounded-lg border border-gray-200/60 bg-white px-4 py-3 shadow-sm dark:border-gray-700/60 dark:bg-gray-900">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
          <Trophy className="h-4.5 w-4.5 text-[#1e3a5f] dark:text-blue-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Ranking de Frentistas</p>
          <p className="text-[11px] text-gray-400">{frentistaRanking.length} frentistas · {formatLitersShort(fuelLitros)} total</p>
        </div>
      </div>

      {/* Ranking list */}
      <div className="rounded-lg border border-gray-200/60 bg-white shadow-sm dark:border-gray-700/60 dark:bg-gray-900 overflow-hidden">
        {/* Table header */}
        <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/80 px-4 py-2 dark:border-gray-800 dark:bg-gray-800/50">
          <div className="w-7 shrink-0" />
          <p className="flex-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Frentista</p>
          <p className="w-16 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-400">Litros</p>
          <p className="w-14 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-400">Fatur.</p>
        </div>

        {frentistaRanking.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12">
            <Users className="h-10 w-10 text-gray-300" />
            <p className="text-sm text-gray-400">Nenhum dado disponível</p>
          </div>
        )}

        {frentistaRanking.map((f, idx) => {
          const pct = topLitros > 0 ? (f.litros / topLitros) * 100 : 0
          const style = POSITION_STYLES[idx] ?? null
          return (
            <div
              key={f.codigo}
              className={cn('px-4 py-2.5', idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30')}
            >
              <div className="flex items-center gap-3">
                {/* Position badge */}
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                    style
                      ? cn(style.bg, style.text, 'border', style.border)
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  )}
                >
                  {idx + 1}
                </div>

                {/* Name + bar */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">{f.nome}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                      <div
                        className="h-full rounded-full bg-[#1e3a5f]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-400">{f.atendimentos} atend.</span>
                  </div>
                </div>

                {/* Litros */}
                <p className="w-16 text-right text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                  {formatLitersShort(f.litros)}
                </p>

                {/* Faturamento */}
                <p className="w-14 text-right text-xs tabular-nums text-gray-500 dark:text-gray-400">
                  {formatCurrencyShort(f.receita)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Frentistas

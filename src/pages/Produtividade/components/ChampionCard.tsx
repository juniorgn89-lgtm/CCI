import { Trophy, DollarSign, ShoppingCart, Receipt } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import type { RankingRow } from '@/pages/Produtividade/hooks/useProductivityData'

interface ChampionCardProps {
  champion: RankingRow
}

const ChampionCard = ({ champion }: ChampionCardProps) => {
  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 p-6 shadow-sm dark:border-amber-700/50 dark:from-amber-950/30 dark:via-yellow-950/20 dark:to-orange-950/20">
      {/* Decorative background elements */}
      <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-amber-200/20 dark:bg-amber-500/10" />
      <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-yellow-200/30 dark:bg-yellow-500/10" />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
        {/* Trophy section */}
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-200/50 dark:shadow-amber-900/30">
            <Trophy className="h-8 w-8 text-white" />
          </div>
          <div className="sm:min-w-[160px]">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
                <Trophy className="h-3 w-3" />
                Campeao de Vendas
              </span>
            </div>
            <p className="mt-1.5 text-xl font-bold text-gray-900 dark:text-gray-100">
              {champion.funcionarioNome}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-1 flex-wrap items-center gap-3 sm:justify-end sm:gap-4">
          <div className="flex items-center gap-3 rounded-xl border border-amber-100 bg-white/70 px-4 py-3 backdrop-blur-sm dark:border-amber-800/30 dark:bg-gray-900/50">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 dark:bg-green-900/30">
              <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Total Vendido</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(champion.totalVendas)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-amber-100 bg-white/70 px-4 py-3 backdrop-blur-sm dark:border-amber-800/30 dark:bg-gray-900/50">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
              <ShoppingCart className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Vendas</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatNumber(champion.quantidadeVendas)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-amber-100 bg-white/70 px-4 py-3 backdrop-blur-sm dark:border-amber-800/30 dark:bg-gray-900/50">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/30">
              <Receipt className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Ticket Medio</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(champion.ticketMedio)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ChampionCard

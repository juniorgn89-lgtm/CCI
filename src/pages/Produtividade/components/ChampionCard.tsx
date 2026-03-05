import { Trophy } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import type { RankingRow } from '@/pages/Produtividade/hooks/useProductivityData'

interface ChampionCardProps {
  champion: RankingRow
}

const ChampionCard = ({ champion }: ChampionCardProps) => {
  return (
    <div className="flex items-center gap-6 rounded-xl border border-yellow-200 bg-gradient-to-r from-yellow-50 to-amber-50 p-6 shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
        <Trophy className="h-8 w-8 text-yellow-600" />
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-yellow-500 px-2.5 py-0.5 text-xs font-bold text-white">
            CAMPEÃO
          </span>
        </div>
        <p className="mt-1 text-xl font-bold text-gray-900">{champion.funcionarioNome}</p>
      </div>

      <div className="flex gap-8">
        <div className="text-center">
          <p className="text-xs font-medium text-gray-500">Total Vendido</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(champion.totalVendas)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-medium text-gray-500">Vendas</p>
          <p className="text-lg font-bold text-gray-900">{formatNumber(champion.quantidadeVendas)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-medium text-gray-500">Ticket Médio</p>
          <p className="text-lg font-bold text-gray-900">{formatCurrency(champion.ticketMedio)}</p>
        </div>
      </div>
    </div>
  )
}

export default ChampionCard

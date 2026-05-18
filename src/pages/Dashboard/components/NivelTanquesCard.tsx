import { Fuel, AlertTriangle, Loader2 } from 'lucide-react'
import { formatLiters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import useReabastecimento from '@/pages/Dashboard/hooks/useReabastecimento'

interface NivelTanquesCardProps {
  empresaCodigo: number
}

/**
 * Lista todos os tanques de um posto específico com nível atual. Diferente
 * do ReabastecimentoCard (Central da Rede), aqui mostramos TODOS — não só
 * os baixos — pra o gerente ter visão completa do estoque do posto.
 *
 * Cor da barra: verde (OK), amber (alerta), vermelho (crítico).
 */
const NivelTanquesCard = ({ empresaCodigo }: NivelTanquesCardProps) => {
  const { tanques, criticos, isLoading } = useReabastecimento({ empresaCodigo })

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }

  if (tanques.length === 0) return null

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
          <Fuel className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Nível dos tanques</h3>
            {criticos.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-2.5 w-2.5" />
                {criticos.length} crítico{criticos.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Estoque escritural atual · crítico abaixo de 20% · alerta abaixo de 30%
          </p>
        </div>
      </div>

      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {tanques.map((t) => {
          const barColor =
            t.nivel === 'critico' ? 'bg-red-500' :
            t.nivel === 'alerta' ? 'bg-amber-500' :
            'bg-emerald-500'
          const textColor =
            t.nivel === 'critico' ? 'text-red-600 dark:text-red-400' :
            t.nivel === 'alerta' ? 'text-amber-700 dark:text-amber-400' :
            'text-emerald-700 dark:text-emerald-400'
          const badge =
            t.nivel === 'critico' ? { label: 'Crítico', bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' } :
            t.nivel === 'alerta' ? { label: 'Alerta', bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' } :
            { label: 'OK', bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' }
          return (
            <li
              key={`${t.empresaCodigo}-${t.tanqueCodigo}`}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {t.tanqueNome}
                  </p>
                  <span className="text-xs text-gray-400">·</span>
                  <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">
                    {t.produtoNome}
                  </p>
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={cn('h-1.5 rounded-full transition-all', barColor)}
                      style={{ width: `${Math.max(2, Math.min(100, t.nivelPct))}%` }}
                    />
                  </div>
                  <span className={cn('shrink-0 text-xs font-semibold tabular-nums', textColor)}>
                    {t.nivelPct.toFixed(0)}%
                  </span>
                </div>

                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                  {formatLiters(t.estoqueAtual)} de {formatLiters(t.capacidade)}
                </p>
              </div>

              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                  badge.bg,
                )}
              >
                {badge.label}
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default NivelTanquesCard

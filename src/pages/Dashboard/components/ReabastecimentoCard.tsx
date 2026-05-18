import { Fuel, AlertTriangle, Clock } from 'lucide-react'
import { formatLiters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import useReabastecimento from '@/pages/Dashboard/hooks/useReabastecimento'

/**
 * Painel de Reabastecimento na Central da Rede.
 * Renderiza só quando há ao menos 1 tanque com nível abaixo de 30%
 * (crítico < 20%, alerta < 30%). Some quando tudo está OK.
 *
 * Visibilidade é controlada pelo Dashboard (isMaster || canVerReabastecimento).
 */
const ReabastecimentoCard = () => {
  const { baixos, criticos, isLoading } = useReabastecimento()

  // Card some quando não há nada baixo.
  if (isLoading || baixos.length === 0) return null

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30">
          <Fuel className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Reabastecimento</h2>
            {criticos.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-2.5 w-2.5" />
                {criticos.length} crítico{criticos.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Tanques com estoque baixo · crítico abaixo de 20% · alerta abaixo de 30%
          </p>
        </div>
      </div>

      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {baixos.map((t) => {
          const isCritico = t.nivel === 'critico'
          return (
            <li
              key={`${t.empresaCodigo}-${t.tanqueCodigo}`}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                    {t.empresaNome}
                  </p>
                  <span className="text-xs text-gray-400">·</span>
                  <p className="truncate text-xs text-gray-600 dark:text-gray-400">
                    {t.tanqueNome}
                  </p>
                  <span className="text-xs text-gray-400">·</span>
                  <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">
                    {t.produtoNome}
                  </p>
                </div>

                {/* Barra de progresso */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={cn(
                        'h-1.5 rounded-full transition-all',
                        isCritico ? 'bg-red-500' : 'bg-amber-500',
                      )}
                      style={{ width: `${Math.max(2, Math.min(100, t.nivelPct))}%` }}
                    />
                  </div>
                  <span className={cn(
                    'shrink-0 text-xs font-semibold tabular-nums',
                    isCritico
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-amber-700 dark:text-amber-400',
                  )}>
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
                  isCritico
                    ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                )}
              >
                {isCritico ? 'Crítico' : 'Alerta'}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="border-t border-gray-100 px-4 py-2 dark:border-gray-800">
        <p className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
          <Clock className="h-3 w-3" />
          Baseado no estoque escritural atual de cada tanque
        </p>
      </div>
    </section>
  )
}

export default ReabastecimentoCard

import { Clock, User, CheckCircle2, AlertCircle } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { cn, isPastPeriod } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import type { TurnoRow } from '@/pages/Operacao/hooks/useOperacaoData'

interface TurnosTrabalhoProps {
  turnoRows: TurnoRow[]
}

const fmtTime = (t: string) => {
  if (!t) return '-'
  return t.substring(0, 5)
}

const TurnosTrabalho = ({ turnoRows }: TurnosTrabalhoProps) => {
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const periodIsPast = isPastPeriod(dataFinal)
  const abertos = turnoRows.filter((t) => !t.fechado)

  return (
    <div className="space-y-4">
      {/* Em Turno Agora — só faz sentido pro período corrente */}
      {!periodIsPast && (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-2.5 w-2.5 items-center justify-center">
            <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative h-2 w-2 rounded-full bg-green-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Em Turno Agora</h3>
          <span className="ml-auto rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-600 dark:bg-green-900/20 dark:text-green-400">
            {abertos.length} aberto{abertos.length !== 1 ? 's' : ''}
          </span>
        </div>

        {abertos.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum turno aberto no momento.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {abertos.map((t) => (
              <div
                key={`${t.caixaCodigo}-${t.turnoCodigo}`}
                className="rounded-lg border border-green-200 bg-green-50/50 p-4 dark:border-green-800/50 dark:bg-green-900/10"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <User className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t.funcionarioNome}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t.turno}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Início: {fmtTime(t.abertura)}</span>
                  </div>
                  <span>{formatDate(t.dataMovimento)}</span>
                </div>
                {t.apurado > 0 && (
                  <p className="mt-2 text-xs tabular-nums text-gray-500">
                    Apurado: <span className="font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(t.apurado)}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* All shifts table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Histórico de Turnos</h3>
        </div>

        {turnoRows.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-gray-400">
            Nenhum turno encontrado no período.
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {turnoRows.map((t) => (
              <div key={`${t.caixaCodigo}-${t.turnoCodigo}-${t.dataMovimento}`} className="flex items-center gap-4 px-6 py-3">
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  t.fechado
                    ? 'bg-gray-100 dark:bg-gray-800'
                    : 'bg-green-100 dark:bg-green-900/30'
                )}>
                  {t.fechado ? (
                    <CheckCircle2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{t.funcionarioNome}</p>
                      <p className="text-xs text-gray-400">{t.turno} &middot; {formatDate(t.dataMovimento)}</p>
                    </div>
                    <div className="ml-4 shrink-0 text-right">
                      <div className="flex items-center gap-3 text-sm tabular-nums">
                        <span className="text-gray-500 dark:text-gray-400">
                          {fmtTime(t.abertura)} - {t.fechado ? fmtTime(t.fechamento) : 'Aberto'}
                        </span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">
                          {formatCurrency(t.apurado)}
                        </span>
                      </div>
                      {t.fechado && t.diferenca !== 0 && (
                        <p className={cn(
                          'text-xs tabular-nums',
                          t.diferenca > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                        )}>
                          Diferença: {t.diferenca > 0 ? '+' : ''}{formatCurrency(t.diferenca)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <span className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  t.fechado
                    ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                )}>
                  {t.fechado ? 'Fechado' : 'Aberto'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default TurnosTrabalho

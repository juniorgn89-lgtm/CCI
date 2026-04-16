import { Check, Loader2, Fuel, BarChart3, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingStatus {
  resumo: boolean
  abastecimentos: boolean
  lmc: boolean
}

interface GerenteLoadingScreenProps {
  status: LoadingStatus
}

const STEPS = [
  {
    key: 'resumo' as const,
    label: 'Resumo de vendas',
    sublabel: 'Faturamento por empresa',
    icon: BarChart3,
  },
  {
    key: 'abastecimentos' as const,
    label: 'Abastecimentos',
    sublabel: 'Litros, frentistas e combustíveis',
    icon: Fuel,
  },
  {
    key: 'lmc' as const,
    label: 'Preços de custo',
    sublabel: 'Livro de movimentação de combustível',
    icon: BookOpen,
  },
]

const GerenteLoadingScreen = ({ status }: GerenteLoadingScreenProps) => {
  const totalSteps = STEPS.length
  const doneSteps = STEPS.filter((s) => !status[s.key]).length
  const pct = Math.round((doneSteps / totalSteps) * 100)

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6">
      {/* Logo / brand */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e3a5f]">
          <BarChart3 className="h-7 w-7 text-white" />
        </div>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Carregando dados do posto</p>
        <p className="text-xs text-gray-400">Aguarde um momento...</p>
      </div>

      {/* Overall progress bar */}
      <div className="w-full max-w-xs">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Progresso</span>
          <span className="text-[11px] font-semibold text-[#1e3a5f] dark:text-blue-400">{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-[#1e3a5f] transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Step list */}
      <div className="w-full max-w-xs divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200/60 bg-white shadow-sm dark:divide-gray-800 dark:border-gray-700/60 dark:bg-gray-900">
        {STEPS.map((step) => {
          const Icon = step.icon
          const loading = status[step.key]
          const done = !loading

          return (
            <div key={step.key} className="flex items-center gap-3 px-4 py-3">
              {/* Step icon */}
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
                  done
                    ? 'bg-emerald-50 dark:bg-emerald-900/30'
                    : 'bg-gray-50 dark:bg-gray-800'
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 transition-colors',
                    done ? 'text-emerald-500' : 'text-gray-400'
                  )}
                />
              </div>

              {/* Labels */}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-xs font-medium transition-colors',
                    done ? 'text-gray-800 dark:text-gray-200' : 'text-gray-400 dark:text-gray-500'
                  )}
                >
                  {step.label}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-600">{step.sublabel}</p>
              </div>

              {/* Status indicator */}
              {done ? (
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                </div>
              ) : (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#1e3a5f] dark:text-blue-400" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default GerenteLoadingScreen

import { Banknote, Clock, CheckCircle2, AlertTriangle, Search } from 'lucide-react'
import { useFreentistaStore } from '@/store/frentista'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import InsightBanner from '@/components/kpi/InsightBanner'

interface Sangria {
  id: string
  valor: number
  motivo: string
  data: string
  hora: string
  status: 'pendente' | 'aprovada'
}

// Mock data — will be replaced by Quality API endpoint when available
const MOCK_SANGRIAS: Sangria[] = [
  { id: '1', valor: 500, motivo: 'Troco para caixa 2', data: '14/04/2026', hora: '10:30', status: 'aprovada' },
  { id: '2', valor: 200, motivo: 'Pagamento fornecedor água', data: '13/04/2026', hora: '15:45', status: 'aprovada' },
  { id: '3', valor: 1500, motivo: 'Depósito bancário', data: '12/04/2026', hora: '09:15', status: 'aprovada' },
  { id: '4', valor: 300, motivo: 'Retirada do gerente', data: '11/04/2026', hora: '14:00', status: 'pendente' },
]

const MinhaSangria = () => {
  const { session } = useFreentistaStore()

  if (!session) return null

  // TODO: Replace with real data from Quality API (GET /SANGRIA or similar)
  const sangrias = MOCK_SANGRIAS
  const totalSangrias = sangrias.reduce((sum, s) => sum + s.valor, 0)
  const totalPendente = sangrias.filter((s) => s.status === 'pendente').reduce((sum, s) => sum + s.valor, 0)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Sangrias</h2>

      {/* Info banner */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2.5 dark:border-blue-800/30 dark:bg-blue-900/10">
        <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
        <p className="text-[11px] text-blue-700 dark:text-blue-400">
          As sangrias são registradas no sistema de retaguarda (Quality). Aqui você acompanha o histórico das retiradas do seu caixa.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-lg border border-gray-200/60 bg-gradient-to-br from-blue-50/60 to-white px-3 py-2.5 shadow-sm dark:border-gray-700/60 dark:from-blue-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Retirado</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900/30">
              <Banknote className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(totalSangrias)}</p>
        </div>
        <div className="rounded-lg border border-gray-200/60 bg-gradient-to-br from-amber-50/60 to-white px-3 py-2.5 shadow-sm dark:border-gray-700/60 dark:from-amber-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Pendente</p>
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 dark:bg-amber-900/30">
              <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="mt-1 text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">{formatCurrency(totalPendente)}</p>
        </div>
      </div>

      {/* Insight banner */}
      {totalPendente === 0
        ? <InsightBanner type="success" message="Nenhuma sangria pendente. Tudo em ordem com suas retiradas!" />
        : <InsightBanner type="warning" message={`Você tem ${formatCurrency(totalPendente)} em sangrias pendentes de confirmação no retaguarda.`} />
      }

      {/* Warning — no API yet */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2.5 dark:border-amber-800/30 dark:bg-amber-900/10">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          Dados de demonstração. Aguardando endpoint da API Quality para sangrias reais.
        </p>
      </div>

      {/* History */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Histórico de Sangrias
            <span className="ml-2 text-xs font-normal text-gray-400">{sangrias.length} registros</span>
          </h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {sangrias.map((s, idx) => (
            <div key={s.id} className={cn('flex items-center gap-3 px-4 py-3', idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30')}>
              <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                s.status === 'aprovada' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-amber-50 dark:bg-amber-900/20'
              )}>
                <Banknote className={cn(
                  'h-4 w-4',
                  s.status === 'aprovada' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                )} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{s.motivo}</p>
                <p className="text-[10px] text-gray-400">{s.data} às {s.hora}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {formatCurrency(s.valor)}
                </p>
                <span className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-medium',
                  s.status === 'aprovada' ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'
                )}>
                  {s.status === 'aprovada' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                  {s.status === 'aprovada' ? 'Aprovada' : 'Pendente'}
                </span>
              </div>
            </div>
          ))}
          {sangrias.length === 0 && (
            <div className="flex h-32 items-center justify-center text-sm text-gray-400">
              Nenhuma sangria registrada no período.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MinhaSangria

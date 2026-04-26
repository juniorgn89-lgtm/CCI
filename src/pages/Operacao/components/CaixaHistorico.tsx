import { History, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CaixaAlteracao } from '@/api/supabase/caixaHistory'

interface CaixaHistoricoProps {
  alteracoes: CaixaAlteracao[]
  isLoading: boolean
  configured: boolean
}

const formatDateTime = (iso: string) => {
  const d = new Date(iso)
  const date = d.toLocaleDateString('pt-BR')
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${date} às ${time}`
}

const campoColor = (campo: string) => {
  switch (campo) {
    case 'apurado': return 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
    case 'diferenca': return 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
    case 'fechado': return 'border-green-500 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
    default: return 'border-gray-500 bg-gray-50 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400'
  }
}

const campoLabel = (campo: string) => {
  switch (campo) {
    case 'apurado': return 'Apurado'
    case 'diferenca': return 'Diferença'
    case 'fechado': return 'Status'
    default: return campo
  }
}

const CaixaHistorico = ({ alteracoes, isLoading, configured }: CaixaHistoricoProps) => {
  // Sem Supabase configurado, oculta a seção inteira.
  // O aviso visual será reativado junto com a integração futura.
  if (!configured) return null

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 animate-pulse text-gray-400" />
          <span className="text-sm text-gray-400">Carregando histórico...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-purple-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Histórico de Alterações
            </h3>
          </div>
          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
            {alteracoes.length} registro{alteracoes.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {alteracoes.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-gray-400">
          Nenhuma alteração detectada no período.
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {alteracoes.map((a) => (
            <div key={a.id} className="px-6 py-3">
              <div className="flex items-start gap-3">
                {/* Timeline dot */}
                <div className="mt-1 flex flex-col items-center">
                  <div className={cn(
                    'h-2.5 w-2.5 rounded-full',
                    a.campo === 'apurado' ? 'bg-blue-500' :
                    a.campo === 'diferenca' ? 'bg-amber-500' :
                    'bg-green-500'
                  )} />
                  <div className="mt-1 h-full w-px bg-gray-200 dark:bg-gray-700" />
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {a.funcionario_nome}
                    </span>
                    <span className={cn(
                      'inline-flex rounded-full border-l-2 px-2 py-0.5 text-[10px] font-semibold',
                      campoColor(a.campo)
                    )}>
                      {campoLabel(a.campo)}
                    </span>
                  </div>

                  <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">
                    {a.descricao}
                  </p>

                  {a.valor_anterior && a.valor_novo && (
                    <div className="mt-1 flex items-center gap-2 text-xs tabular-nums">
                      <span className="text-gray-500 line-through">{a.valor_anterior}</span>
                      <ArrowRight className="h-3 w-3 text-gray-400" />
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{a.valor_novo}</span>
                    </div>
                  )}

                  <p className="mt-1 text-[10px] text-gray-400">
                    {a.data_movimento.split('-').reverse().join('/')} &middot; Detectado {formatDateTime(a.detectado_em)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CaixaHistorico

import { useMemo, useState } from 'react'
import { History, ArrowRight, Plus, Edit3, Trash2, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CaixaAlteracao, TipoEvento } from '@/api/supabase/caixaHistory'

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

/** Tempo relativo curto pra UX ("agora", "há 3 min", "há 2 h", "ontem"). */
const relativeTime = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'ontem'
  return `há ${days} dias`
}

type EventMeta = {
  Icon: typeof Plus
  label: string
  badgeBg: string
  dotColor: string
}

const eventMetaByTipo = (tipo: TipoEvento): EventMeta => {
  switch (tipo) {
    case 'inclusao':
      return {
        Icon: Plus,
        label: 'Inclusão',
        badgeBg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
        dotColor: 'bg-emerald-500',
      }
    case 'alteracao':
      return {
        Icon: Edit3,
        label: 'Alteração',
        badgeBg: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
        dotColor: 'bg-blue-500',
      }
    case 'exclusao':
      return {
        Icon: Trash2,
        label: 'Exclusão',
        badgeBg: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
        dotColor: 'bg-red-500',
      }
  }
}

type FilterTipo = 'todos' | TipoEvento

const CaixaHistorico = ({ alteracoes, isLoading, configured }: CaixaHistoricoProps) => {
  const [filter, setFilter] = useState<FilterTipo>('todos')

  // Conta por tipo pra mostrar nas pills sem render extra
  const counts = useMemo(() => {
    const c = { inclusao: 0, alteracao: 0, exclusao: 0 }
    for (const a of alteracoes) c[a.tipo_evento]++
    return c
  }, [alteracoes])

  const filtered = useMemo(() => {
    if (filter === 'todos') return alteracoes
    return alteracoes.filter((a) => a.tipo_evento === filter)
  }, [alteracoes, filter])

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

  const pills: { v: FilterTipo; l: string; n: number }[] = [
    { v: 'todos', l: 'Todos', n: alteracoes.length },
    { v: 'inclusao', l: 'Inclusões', n: counts.inclusao },
    { v: 'alteracao', l: 'Alterações', n: counts.alteracao },
    { v: 'exclusao', l: 'Exclusões', n: counts.exclusao },
  ]

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="border-b border-gray-200 px-6 py-4 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
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

        {/* Pills de filtro por tipo de evento */}
        {alteracoes.length > 0 && (
          <div className="mt-3 inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
            {pills.map((p) => {
              const active = filter === p.v
              return (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => setFilter(p.v)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'bg-[#1e3a5f] text-white shadow-sm'
                      : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200',
                  )}
                >
                  {p.l}
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-px text-[10px] tabular-nums',
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
                    )}
                  >
                    {p.n}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
          <History className="h-7 w-7 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {alteracoes.length === 0
              ? 'Nenhum evento registrado no período'
              : `Nenhum evento do tipo "${pills.find((p) => p.v === filter)?.l}"`}
          </p>
          {alteracoes.length === 0 && (
            <p className="max-w-md text-xs text-gray-400 dark:text-gray-500">
              O sistema registra: novos caixas (Inclusão), mudanças em
              apurado/diferença/status (Alteração) e caixas removidos do PDV
              (Exclusão). Cada evento mostra quem detectou e quando.
            </p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {filtered.map((a) => {
            const meta = eventMetaByTipo(a.tipo_evento)
            return (
              <div key={a.id} className="px-6 py-3">
                <div className="flex items-start gap-3">
                  {/* Timeline dot + line */}
                  <div className="mt-1 flex flex-col items-center">
                    <div className={cn('h-2.5 w-2.5 rounded-full', meta.dotColor)} />
                    <div className="mt-1 h-full w-px bg-gray-200 dark:bg-gray-700" />
                  </div>

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    {/* Linha 1: badge do tipo + caixa de quem */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold', meta.badgeBg)}>
                        <meta.Icon className="h-2.5 w-2.5" />
                        {meta.label}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Caixa de{' '}
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {a.funcionario_nome}
                        </span>
                      </span>
                    </div>

                    {/* Linha 2: descrição completa */}
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                      {a.descricao}
                    </p>

                    {/* Linha 3: diff valor_anterior → valor_novo (quando aplicável) */}
                    {a.valor_anterior && a.valor_novo && (
                      <div className="mt-1.5 flex items-center gap-2 text-xs tabular-nums">
                        <span className="text-gray-500 line-through">{a.valor_anterior}</span>
                        <ArrowRight className="h-3 w-3 text-gray-400" />
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{a.valor_novo}</span>
                      </div>
                    )}

                    {/* Linha 4: rodapé com data do caixa + detectado por + quando */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                      <span>
                        Data: <span className="tabular-nums">{a.data_movimento.split('-').reverse().join('/')}</span>
                      </span>
                      {a.detectado_por_nome && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-0.5">
                            <User className="h-2.5 w-2.5" />
                            Detectado por <span className="font-medium text-gray-600 dark:text-gray-400">{a.detectado_por_nome}</span>
                          </span>
                        </>
                      )}
                      <span>·</span>
                      <span title={formatDateTime(a.detectado_em)}>{relativeTime(a.detectado_em)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CaixaHistorico

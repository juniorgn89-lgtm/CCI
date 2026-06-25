import { useState } from 'react'
import { MessageSquare, Activity, ShieldCheck, ShieldOff, AlertTriangle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import CaduAvatar from './CaduAvatar'
import ChatPanel from './ChatPanel'
import MonitorPanel from './MonitorPanel'
import { useRedeAssistente } from './hooks/useRedeAssistente'

type SubTab = 'chat' | 'monitor'

const SUB_TABS: { key: SubTab; label: string; icon: typeof MessageSquare; desc: string }[] = [
  { key: 'chat', label: 'Chat', icon: MessageSquare, desc: 'Pergunte em linguagem natural' },
  { key: 'monitor', label: 'Monitor', icon: Activity, desc: 'Tool calls e auditoria' },
]

const AssistenteInteligente = () => {
  const [sub, setSub] = useState<SubTab>('chat')
  const { status, redeNome } = useRedeAssistente()

  return (
    <div className="space-y-4">
      {/* Banner do módulo */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <CaduAvatar className="h-10 w-10 rounded-lg" iconClassName="h-5 w-5" />
          <div className="min-w-0 flex-1">
            <h2 className="flex flex-wrap items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
              Cadu
              <span className="rounded-full border border-gray-300 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-600 dark:border-gray-600 dark:text-gray-400">
                Beta
              </span>
              <StatusBadge status={status} />
            </h2>
            <p className="text-[11px] text-gray-600 dark:text-gray-400">
              Copiloto de IA com acesso a <strong>todos os postos disponíveis pro seu usuário</strong>
              {redeNome && <> · rede <strong>{redeNome}</strong></>}
              {' '}— configuração gerenciada pelo administrador.
            </p>
          </div>
        </div>
      </div>

      {/* Sub-nav */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-[#0f0f0f]">
        {SUB_TABS.map((t) => {
          const Icon = t.icon
          const active = sub === t.key
          return (
            <button
              key={t.key}
              onClick={() => setSub(t.key)}
              className={cn(
                'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                active
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
              )}
              title={t.desc}
            >
              <Icon className={cn('h-3.5 w-3.5', active && 'text-[#1e3a5f] dark:text-gray-300')} />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Conteúdo */}
      <div>
        {sub === 'chat' && <ChatPanel />}
        {sub === 'monitor' && <MonitorPanel />}
      </div>
    </div>
  )
}

const StatusBadge = ({ status }: { status: ReturnType<typeof useRedeAssistente>['status'] }) => {
  if (status === 'ativo') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300">
        <ShieldCheck className="h-2.5 w-2.5" />
        Ativo
      </span>
    )
  }
  if (status === 'validando') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
        Verificando
      </span>
    )
  }
  if (status === 'invalido' || status === 'erro') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300">
        <AlertTriangle className="h-2.5 w-2.5" />
        Indisponível
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
      <ShieldOff className="h-2.5 w-2.5" />
      Não habilitado
    </span>
  )
}

export default AssistenteInteligente

import { ShieldCheck, ShieldOff, AlertTriangle, Loader2 } from 'lucide-react'
import CaduAvatar from '@/pages/Inteligencia/components/AssistenteInteligente/CaduAvatar'
import ChatPanel from '@/pages/Inteligencia/components/AssistenteInteligente/ChatPanel'
import { useRedeAssistente } from '@/pages/Inteligencia/components/AssistenteInteligente/hooks/useRedeAssistente'

const StatusBadge = ({ status }: { status: ReturnType<typeof useRedeAssistente>['status'] }) => {
  if (status === 'ativo')
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-900/20 dark:text-emerald-300">
        <ShieldCheck className="h-2.5 w-2.5" /> Ativo
      </span>
    )
  if (status === 'validando')
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        <Loader2 className="h-2.5 w-2.5 animate-spin" /> Verificando
      </span>
    )
  if (status === 'invalido' || status === 'erro')
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-red-700 dark:border-red-700/40 dark:bg-red-900/20 dark:text-red-300">
        <AlertTriangle className="h-2.5 w-2.5" /> Indisponível
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
      <ShieldOff className="h-2.5 w-2.5" /> Não habilitado
    </span>
  )
}

/**
 * Cadu IA — versão mobile. Banner compacto + chat (ChatPanel). As abas
 * Histórico/Dashboard/Monitor do desktop ficam de fora no mobile (foco no chat).
 */
const CaduMobile = () => {
  const { status, redeNome } = useRedeAssistente()
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white p-3 dark:border-[#3a3a3a] dark:bg-[#242424]">
        <CaduAvatar className="h-9 w-9 rounded-lg" iconClassName="h-[18px] w-[18px]" />
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-1.5 text-[14px] font-bold text-gray-900 dark:text-gray-100">
            Cadu
            <span className="rounded-full border border-gray-300 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-gray-600 dark:border-gray-600 dark:text-gray-400">Beta</span>
            <StatusBadge status={status} />
          </h2>
          <p className="text-[10.5px] leading-snug text-gray-500 dark:text-gray-400">
            Copiloto de IA com acesso aos seus postos{redeNome && <> · rede <strong>{redeNome}</strong></>}.
          </p>
        </div>
      </div>

      <ChatPanel heightClass="h-[calc(100dvh-220px)] min-h-[420px]" />
    </div>
  )
}

export default CaduMobile

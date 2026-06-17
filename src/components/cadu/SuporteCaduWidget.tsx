import { useState } from 'react'
import { X, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import CaduAvatar from '@/pages/Inteligencia/components/AssistenteInteligente/CaduAvatar'
import ChatPanel from '@/pages/Inteligencia/components/AssistenteInteligente/ChatPanel'
import { useScreenContext } from '@/components/cadu/screenContext'
import { useFilterStore } from '@/store/filters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import { useCaduChat } from '@/pages/Inteligencia/components/AssistenteInteligente/caduChatStore'

/**
 * Suporte Cadu iA — lançador flutuante global. Reaproveita o ChatPanel/engine do
 * Cadu (Claude + tools + chave do cliente) e injeta o contexto da tela atual +
 * glossário, pra responder tanto "o que significa este campo" quanto perguntas
 * sobre os dados. Montado no AppLayout (desktop), some no módulo Inteligência.
 */
const SuporteCaduWidget = () => {
  const [open, setOpen] = useState(false)
  const newConversa = useCaduChat((s) => s.newConversa)
  const screenContext = useScreenContext()

  // Ao FECHAR a conversa, limpa o histórico (cada abertura começa do zero).
  const close = () => { setOpen(false); newConversa() }
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const empresaNome = useEmpresaNome()

  // Escopo: o Suporte responde só sobre o posto selecionado no filtro global.
  const uiContext = empresaCodigos.length > 0
    ? `${screenContext}\n\n# Escopo de dados\nResponda APENAS sobre o posto atualmente selecionado no filtro${empresaNome ? `: ${empresaNome}` : ''}. Não some nem compare com outros postos da rede, a menos que o usuário peça explicitamente.`
    : screenContext

  return (
    <>
      {/* Painel */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 flex h-[calc(100vh-7rem)] max-h-[720px] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
          <div className="flex shrink-0 items-center justify-between gap-2 bg-[#1e3a5f] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <CaduAvatar className="h-7 w-7 rounded-lg" iconClassName="h-4 w-4" />
              <div className="leading-tight">
                <p className="flex items-center gap-1 text-sm font-bold">
                  Suporte Cadu iA
                  <Sparkles className="h-3 w-3 text-amber-300" />
                </p>
                <p className="text-[10px] text-white/70">Tira dúvidas da tela e dos seus dados</p>
              </div>
            </div>
            <button onClick={close} className="rounded-md p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ChatPanel uiContext={uiContext} restrictToEmpresaCodigos={empresaCodigos} suggestions={[]} heightClass="min-h-0 flex-1" />
        </div>
      )}

      {/* Botão flutuante */}
      <button
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? 'Fechar Suporte Cadu iA' : 'Abrir Suporte Cadu iA'}
        className={cn(
          'fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105',
          open ? 'bg-gray-700' : 'bg-[#1e3a5f]',
        )}
      >
        {open ? <X className="h-5 w-5 text-white" /> : <CaduAvatar className="h-9 w-9 rounded-full" iconClassName="h-5 w-5" />}
      </button>
    </>
  )
}

export default SuporteCaduWidget

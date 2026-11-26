import { useEffect, useState } from 'react'
import { EVENTO_CONCLUIDA as EVENTO } from './concluirEvento'

/**
 * Comemoração ao concluir uma tarefa: o detalhe fecha e, no centro da tela,
 * um círculo verde com o ✓ se desenhando + "Tarefa concluída" e o título.
 * Some sozinho (~1,4 s) e não bloqueia cliques. Só é chamada DEPOIS de a
 * conclusão gravar — nunca comemora o que não foi salvo.
 *
 * Uso: monte <Celebracao /> uma vez (Gestão) e chame celebrarConclusao(titulo)
 * (./concluirEvento.ts).
 */
const DURACAO_MS = 1400

export const Celebracao = () => {
  const [atual, setAtual] = useState<{ titulo: string; id: number } | null>(null)
  useEffect(() => {
    let timer = 0
    const on = (e: Event) => {
      const titulo = String((e as CustomEvent).detail ?? '')
      window.clearTimeout(timer)
      setAtual({ titulo, id: Date.now() })
      timer = window.setTimeout(() => setAtual(null), DURACAO_MS)
    }
    window.addEventListener(EVENTO, on)
    return () => { window.removeEventListener(EVENTO, on); window.clearTimeout(timer) }
  }, [])
  if (!atual) return null
  return (
    <div key={atual.id} role="status" aria-live="polite" className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center">
      <div className="celebra-cartao flex flex-col items-center gap-3 rounded-3xl bg-white/95 px-10 py-8 shadow-2xl ring-1 ring-black/5 backdrop-blur dark:bg-[#1e293b]/95 dark:ring-white/10">
        <span className="celebra-circulo flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
          <svg viewBox="0 0 52 52" className="h-11 w-11" aria-hidden>
            <path className="celebra-check" d="M14 27 l8 8 l16 -18" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-[16px] font-bold text-gray-900 dark:text-white">Tarefa concluída</span>
        {atual.titulo && <span className="max-w-[260px] truncate text-[13px] text-gray-500 dark:text-gray-400">{atual.titulo}</span>}
      </div>
    </div>
  )
}

export default Celebracao

import { useEffect, useRef, useState } from 'react'
import { Presentation, EyeOff, Info } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useDemoStore } from '@/store/demo'
import { useTenantStore } from '@/store/tenant'
import { useRedeNomeExibicao } from '@/hooks/useDemo'
import { nomeLegivel } from '@/lib/nomeLegivel'

/**
 * Modo Demonstração na barra de cima — só um ícone (como tema e sino). O clique
 * abre uma janelinha com a chave e o que muda. Mascara nome da rede/postos,
 * CNPJ e endereço em todo o app; ao alternar, invalida as queries para os dados
 * voltarem já com (ou sem) a máscara. Só para quem tem `pode_demonstrar` (ou master).
 * Ligado, o ícone fica âmbar e pulsando: quem apresenta enxerga de relance.
 */
const DemoModeToggle = () => {
  const canDemonstrar = useAuthStore((s) => s.canDemonstrar)
  const ativo = useDemoStore((s) => s.ativo)
  const set = useDemoStore((s) => s.set)
  const queryClient = useQueryClient()
  const redeReal = useTenantStore((s) => s.rede?.nome)
  const redeExibida = useRedeNomeExibicao(redeReal)
  const [aberto, setAberto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return undefined
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setAberto(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [aberto])

  if (!canDemonstrar) return null

  const alternar = () => {
    set(!ativo)
    void queryClient.invalidateQueries()
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={ativo ? 'Modo Demonstração ligado' : 'Modo Demonstração'}
        className={cn(
          'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors',
          ativo
            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25'
            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-300',
        )}
      >
        <Presentation className="h-4 w-4" />
        {ativo && <span className="absolute right-1 top-1 h-2 w-2 animate-pulse rounded-full bg-amber-500" />}
      </button>

      {aberto && (
        <div role="dialog" aria-label="Modo Demonstração"
          className="absolute right-0 top-10 z-50 w-[300px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-[#2f3b4f] dark:bg-[#1e293b]">
          <div className="flex items-start gap-3 px-4 pb-3 pt-4">
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', ativo ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-300')}>
              <Presentation className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">Modo Demonstração</p>
              <p className="mt-0.5 text-[12px] leading-snug text-gray-500 dark:text-gray-400">Para apresentar o Visor a outras pessoas sem mostrar dados do cliente.</p>
            </div>
          </div>

          <button type="button" role="switch" aria-checked={ativo} onClick={alternar}
            className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-3 text-left hover:bg-gray-50 dark:border-[#2f3b4f] dark:hover:bg-white/[0.03]">
            <EyeOff className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-gray-900 dark:text-gray-100">Esconder nomes e documentos</span>
              <span className="block text-[11.5px] text-gray-500 dark:text-gray-400">Rede, postos, CNPJ e endereço</span>
            </span>
            <span aria-hidden className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', ativo ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-700')}>
              <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all', ativo ? 'left-6' : 'left-1')} />
            </span>
          </button>

          {redeReal && (
            <div className="border-t border-gray-100 px-4 py-3 text-[12px] dark:border-[#2f3b4f]">
              <p className="text-gray-500 dark:text-gray-400">A rede aparece como</p>
              <p className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">{nomeLegivel(redeExibida ?? redeReal)}</p>
            </div>
          )}

          <p className="flex items-start gap-1.5 border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-[11px] leading-snug text-gray-500 dark:border-[#2f3b4f] dark:bg-[#172234] dark:text-gray-400">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            Vale só nesta aba do navegador. Os números continuam os reais; só os nomes ficam escondidos.
          </p>
        </div>
      )}
    </div>
  )
}

export default DemoModeToggle

import { useEffect, useRef, useState } from 'react'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import RedeSwitcher from '@/components/layout/RedeSwitcher'
import CompanySelect from '@/components/filters/CompanySelect'
import ComoFuncionaButton from '@/components/help/ComoFuncionaButton'

interface HeaderContextMenuProps {
  /** Mostra o seletor de posto (escondido na Central da Rede / quando há 1 posto). */
  showCompanySelect: boolean
  /** Trava de "ao vivo" — desabilita a troca de posto. */
  liveLock: boolean
}

/**
 * Menu de contexto (hambúrguer) do Header — agrupa Rede, Posto e "Como funciona?"
 * num painel só, em vez de espalhá-los pela barra. Reaproveita os componentes
 * existentes (cada um com seu próprio dropdown/modal); o painel só os empilha.
 */
const HeaderContextMenu = ({ showCompanySelect, liveLock }: HeaderContextMenuProps) => {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora — mas ignora cliques nos dropdowns portalizados
  // (rede/posto) e no modal do "Como funciona?", que vivem fora do painel.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (ref.current?.contains(t)) return
      if (t.closest('[data-radix-popper-content-wrapper]') || t.closest('[role="menu"]') || t.closest('[role="dialog"]')) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Rede, posto e ajuda"
        title="Rede, posto e ajuda"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Contexto
          </p>
          <div className="flex flex-col gap-2">
            <RedeSwitcher />
            {showCompanySelect && (
              <span className={cn('block', liveLock && 'pointer-events-none opacity-40')} aria-disabled={liveLock}>
                <CompanySelect />
              </span>
            )}
            <ComoFuncionaButton />
          </div>
        </div>
      )}
    </div>
  )
}

export default HeaderContextMenu

import { useEffect, useRef, useState } from 'react'
import { Building2, ChevronDown, Network, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFilters } from '@/hooks/useFilters'
import RedeSwitcher from '@/components/layout/RedeSwitcher'
import CompanySelect from '@/components/filters/CompanySelect'
import ComoFuncionaButton from '@/components/help/ComoFuncionaButton'

/**
 * Atalho "Todos os postos" (rede consolidada = empresaCodigos vazio) — vive fora
 * do dropdown de posto, logo abaixo da Rede. É um toggle radial: marcar consolida
 * a rede inteira e limpa a seleção específica; escolher um posto no dropdown de
 * baixo desmarca este atalho sozinho (a seleção passa a ter comprimento > 0).
 */
const TodosPostosToggle = ({ disabled }: { disabled?: boolean }) => {
  const { empresaCodigos, setEmpresas } = useFilters()
  const active = empresaCodigos.length === 0
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => { if (!active) setEmpresas([]) }}
      className={cn(
        'flex h-7 w-full items-center justify-between rounded-md border px-2 text-[11px] font-normal transition-colors xl:text-xs',
        active
          ? 'border-[#2563eb] bg-blue-50 text-[#1e3a5f] dark:border-blue-500/50 dark:bg-blue-950/30 dark:text-blue-100'
          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800',
        disabled && 'pointer-events-none opacity-40',
      )}
    >
      <span className="flex items-center gap-1.5 truncate">
        <Network className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
        <span className="truncate">Todos os postos</span>
        <span className="text-[10px] text-gray-400">rede consolidada</span>
      </span>
      <Check className={cn('h-3.5 w-3.5 shrink-0 text-[#2563eb]', active ? 'opacity-100' : 'opacity-0')} />
    </button>
  )
}

interface HeaderContextMenuProps {
  /** Rótulo do contexto atual (posto/rede) — exibido na própria pílula. */
  label: string
  /** Mostra o seletor de posto (escondido quando o usuário tem 1 posto). */
  showCompanySelect: boolean
  /** Permite "Todos os postos" (rede consolidada). False = módulo gateado. */
  allowTodos: boolean
  /** Trava de "ao vivo" — desabilita a troca de posto. */
  liveLock: boolean
}

/**
 * Pílula de contexto do Header — mostra o posto/rede atual e, ao clicar, abre um
 * painel com Rede, Posto e "Como funciona?". Antes era um ☰ genérico no canto
 * (escondido); virou uma pílula visível com o contexto atual. Reaproveita os
 * componentes existentes (cada um com seu dropdown/modal); o painel só os empilha.
 */
const HeaderContextMenu = ({ label, showCompanySelect, allowTodos, liveLock }: HeaderContextMenuProps) => {
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
        className={cn(
          'flex h-8 max-w-[240px] items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-colors',
          open
            ? 'border-[#2563eb] bg-blue-50 text-[#1e3a5f] dark:border-blue-500/50 dark:bg-blue-950/30 dark:text-blue-100'
            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800',
        )}
      >
        <Building2 className="h-4 w-4 shrink-0 text-gray-400 dark:text-gray-500" />
        <span className="truncate">{label}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg dark:border-gray-700 dark:bg-gray-900">
          <p className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Contexto
          </p>
          <div className="flex flex-col gap-2">
            <RedeSwitcher />
            {showCompanySelect && allowTodos && <TodosPostosToggle disabled={liveLock} />}
            {showCompanySelect && (
              <span className={cn('block', liveLock && 'pointer-events-none opacity-40')} aria-disabled={liveLock}>
                <CompanySelect allowTodos={allowTodos} hideTodosRow={allowTodos} onApplied={() => setOpen(false)} />
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

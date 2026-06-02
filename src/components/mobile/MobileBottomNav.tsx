import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MoreHorizontal, Check, RotateCcw } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { navGroups, type NavItem } from '@/components/layout/navConfig'
import { useMobileBar } from '@/store/mobileBar'

interface MobileBottomNavProps {
  /** Módulos que o usuário PODE ver (já filtrados por permissão no AppLayout). */
  items: NavItem[]
}

/**
 * Bottom-nav fixa: até 4 módulos fixados + botão "Mais". Personalizável
 * (fixar até 4, persistido em localStorage `visor360.bar`). Toque-longo no
 * "Mais" (contextmenu) abre o drawer já em modo edição.
 */
const MobileBottomNav = ({ items }: MobileBottomNavProps) => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { bar, toggle, reset } = useMobileBar()
  const [maisOpen, setMaisOpen] = useState(false)
  const [edit, setEdit] = useState(false)

  const byPath = new Map(items.map((i) => [i.path, i]))
  const fixed = bar.map((p) => byPath.get(p)).filter((i): i is NavItem => !!i).slice(0, 4)
  const effectiveBar = fixed.length > 0 ? fixed : items.slice(0, 4)

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  const openMais = (inEdit: boolean) => {
    setEdit(inEdit)
    setMaisOpen(true)
  }

  const NavBtn = ({ item }: { item: NavItem }) => {
    const active = isActive(item.path)
    const Icon = item.icon
    return (
      <button
        type="button"
        onClick={() => navigate(item.path)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'relative flex h-full flex-1 flex-col items-center justify-center gap-0.5 transition-transform active:scale-95',
          active ? 'text-[#2563eb] dark:text-[#60a5fa]' : 'text-gray-500 dark:text-gray-400',
        )}
      >
        {active && <span className="absolute top-0 h-[3px] w-5 rounded-full bg-[#2563eb] dark:bg-[#60a5fa]" />}
        <Icon className={cn('h-5 w-5 transition-transform', active && '-translate-y-px scale-105')} />
        <span className="max-w-full truncate px-0.5 text-[10px] font-medium leading-none">{item.label}</span>
      </button>
    )
  }

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-[#1c1c1c]/95"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {effectiveBar.map((item) => (
          <NavBtn key={item.path} item={item} />
        ))}
        <button
          type="button"
          onClick={() => openMais(false)}
          onContextMenu={(e) => { e.preventDefault(); openMais(true) }}
          aria-label="Mais módulos"
          aria-haspopup="dialog"
          className="flex h-full flex-1 flex-col items-center justify-center gap-0.5 text-gray-500 transition-transform active:scale-95 dark:text-gray-400"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">Mais</span>
        </button>
      </nav>

      <Sheet open={maisOpen} onOpenChange={setMaisOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-bold">Módulos</SheetTitle>
            <button
              type="button"
              onClick={() => setEdit((e) => !e)}
              className="rounded-md px-2.5 py-1 text-xs font-semibold text-[#2563eb] hover:bg-blue-50 dark:text-[#60a5fa] dark:hover:bg-blue-950/30"
            >
              {edit ? 'Concluir' : 'Editar barra'}
            </button>
          </div>

          {edit && (
            <div className="mt-1 flex items-center justify-between rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              <span>Fixe até 4 módulos na barra ({bar.length}/4).</span>
              <button type="button" onClick={reset} aria-label="Restaurar barra padrão" className="inline-flex items-center gap-1 font-semibold">
                <RotateCcw className="h-3 w-3" /> Padrão
              </button>
            </div>
          )}

          <div className="mt-3 space-y-4 pb-2">
            {navGroups.map((group) => {
              const groupItems = group.items.filter((i) => byPath.has(i.path))
              if (groupItems.length === 0) return null
              return (
                <div key={group.title}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{group.title}</p>
                  <div className="grid grid-cols-1 gap-1">
                    {groupItems.map((item) => {
                      const Icon = item.icon
                      const pinned = bar.includes(item.path)
                      return (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => {
                            if (edit) { toggle(item.path); return }
                            setMaisOpen(false)
                            navigate(item.path)
                          }}
                          aria-current={isActive(item.path) ? 'page' : undefined}
                          className={cn(
                            'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors active:bg-gray-100 dark:active:bg-white/10',
                            isActive(item.path)
                              ? 'bg-gray-100 font-semibold text-gray-900 dark:bg-white/10 dark:text-white'
                              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5',
                          )}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="flex-1 text-left">{item.label}</span>
                          {edit && (
                            <span className={cn(
                              'flex h-5 w-5 items-center justify-center rounded-full border',
                              pinned
                                ? 'border-[#2563eb] bg-[#2563eb] text-white dark:border-[#60a5fa] dark:bg-[#60a5fa]'
                                : 'border-gray-300 text-transparent dark:border-gray-600',
                            )}>
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}

export default MobileBottomNav

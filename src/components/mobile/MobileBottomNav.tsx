import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MoreHorizontal, Check, RotateCcw } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { navGroups, type NavItem } from '@/components/layout/navConfig'
import { useMobileBar } from '@/store/mobileBar'
import { LinhaInstalar } from '@/components/pwa/InstallAppBanner'

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
          'relative flex h-full flex-1 flex-col items-center justify-center gap-1 text-white transition-transform active:scale-95',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60',
          !active && 'text-white/75',
        )}
      >
        {/* Ativo: pílula branca atrás do ícone (padrão dos apps CCI). */}
        <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', // bg-[#fff] (não bg-white): no escuro do celular o bg-white vira ardósia.
          active && 'bg-[#fff] text-[#0f766e]')}>
          <Icon className="h-5 w-5" />
        </span>
        <span className={cn('max-w-full truncate px-0.5 text-[10.5px] leading-none', active ? 'font-semibold' : 'font-medium')}>{item.label}</span>
      </button>
    )
  }

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch bg-[#0f766e]"
        // Petróleo nos dois temas; a cor da barra do Android segue (theme-color no MobileShell).
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', height: 'calc(4rem + env(safe-area-inset-bottom))', backgroundColor: '#0f766e' }}
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
          className="flex h-full flex-1 flex-col items-center justify-center gap-1 text-white/75 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/60"
        >
          <span className="flex h-7 w-12 items-center justify-center rounded-full"><MoreHorizontal className="h-5 w-5" /></span>
          <span className="text-[10.5px] font-medium leading-none">Mais</span>
        </button>
      </nav>

      <Sheet open={maisOpen} onOpenChange={setMaisOpen}>
        <SheetContent side="bottom" className="max-h-[82vh] overflow-y-auto rounded-t-3xl border-0 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:bg-[#1e293b]">
          <div className="flex items-center justify-between pr-9">
            <SheetTitle className="text-[19px] font-bold tracking-tight">Módulos</SheetTitle>
            <button
              type="button"
              onClick={() => setEdit((e) => !e)}
              className="rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold text-teal-700 hover:bg-teal-50 dark:text-[#5eead4] dark:hover:bg-white/[0.06]"
            >
              {edit ? 'Concluir' : 'Editar barra'}
            </button>
          </div>

          {edit && (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
              <span>Fixe até 4 módulos na barra ({bar.length}/4).</span>
              <button type="button" onClick={reset} aria-label="Restaurar barra padrão" className="inline-flex items-center gap-1 font-semibold">
                <RotateCcw className="h-3 w-3" /> Padrão
              </button>
            </div>
          )}

          {!edit && <div className="mt-2"><LinhaInstalar /></div>}

          <div className="mt-3 space-y-4 pb-2">
            {navGroups.map((group) => {
              const groupItems = group.items.filter((i) => byPath.has(i.path))
              if (groupItems.length === 0) return null
              return (
                <div key={group.title}>
                  <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-[#94a3b8]">{group.title}</p>
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
                            'flex min-h-[48px] items-center gap-3 rounded-xl px-3 text-[15px] transition-colors active:bg-gray-100 dark:active:bg-white/[0.08]',
                            isActive(item.path)
                              ? 'bg-teal-50 font-semibold text-teal-800 dark:bg-teal-500/[0.12] dark:text-[#5eead4]'
                              : 'text-gray-800 hover:bg-gray-50 dark:text-[#f1f5f9] dark:hover:bg-white/[0.04]',
                          )}
                        >
                          <Icon className={cn('h-5 w-5 shrink-0', isActive(item.path) ? '' : 'text-gray-500 dark:text-[#94a3b8]')} />
                          <span className="flex-1 text-left">{item.label}</span>
                          {edit && (
                            <span className={cn(
                              'flex h-5 w-5 items-center justify-center rounded-full border',
                              pinned
                                ? 'border-[#0d9488] bg-[#0d9488] text-white'
                                : 'border-gray-300 text-transparent dark:border-[#3e4c63]',
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

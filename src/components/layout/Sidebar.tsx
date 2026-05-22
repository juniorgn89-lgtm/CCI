import { useEffect, useRef, useState } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Warehouse,
  DollarSign,
  Brain,
  Gauge,
  Receipt,
  Settings,
  LogOut,
  Users,
  UserCog,
  Network,
  Database,
  PanelLeft,
  Check,
  LineChart,
  Fuel,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/auth'
import { supabase } from '@/lib/supabase'
import { MODULOS } from '@/lib/modulos'

interface NavItem {
  label: string
  path: string
  icon: typeof BarChart3
  /** Quando true, item só aparece pro gerente (is_master). */
  masterOnly?: boolean
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: 'Sistema',
    items: [
      { label: 'Selecionar Rede', path: '/selecionar-rede', icon: Network, masterOnly: true },
    ],
  },
  {
    title: 'Geral',
    items: [
      { label: 'Central da Rede', path: '/dashboard', icon: BarChart3 },
    ],
  },
  {
    title: 'Posto',
    items: [
      { label: 'Vendas', path: '/comercial/vendas', icon: LineChart },
      { label: 'Abastecimentos', path: '/abastecimentos', icon: Fuel },
      { label: 'Operação', path: '/operacao', icon: Gauge },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { label: 'Estoques', path: '/estoques', icon: Warehouse },
      { label: 'Financeiro', path: '/financeiro', icon: DollarSign },
      { label: 'Fechamentos', path: '/fechamento-caixa', icon: Receipt },
    ],
  },
  {
    title: 'Análise',
    items: [
      { label: 'Inteligência', path: '/inteligencia', icon: Brain },
    ],
  },
]

const navItems = navGroups.flatMap((g) => g.items)

/** Mapa path → id de módulo do catálogo, pra filtrar nav items pela permissão. */
const moduloIdByPath = new Map(MODULOS.map((m) => [m.path, m.id]))

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

type SidebarMode = 'expanded' | 'collapsed' | 'hover'

const SIDEBAR_MODE_KEY = 'sidebar_mode'

const readMode = (): SidebarMode => {
  if (typeof window === 'undefined') return 'collapsed'
  const v = localStorage.getItem(SIDEBAR_MODE_KEY)
  if (v === 'expanded' || v === 'collapsed' || v === 'hover') return v
  return 'collapsed'
}

const modeOptions: { value: SidebarMode; label: string }[] = [
  { value: 'expanded', label: 'Expandido' },
  { value: 'collapsed', label: 'Recolhido' },
  { value: 'hover', label: 'Expandir ao passar o mouse' },
]

const Sidebar = () => {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const supabaseUser = useAuthStore((s) => s.user)
  const isMaster = useAuthStore((s) => s.isMaster)
  const canApurar = useAuthStore((s) => s.canApurar)
  const modulosPermitidos = useAuthStore((s) => s.modulosPermitidos)

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const [mode, setMode] = useState<SidebarMode>(readMode)
  const [hovered, setHovered] = useState(false)
  const [controlOpen, setControlOpen] = useState(false)
  const controlRef = useRef<HTMLDivElement>(null)
  const leaveTimerRef = useRef<number | null>(null)
  const expanded = mode === 'expanded' || (mode === 'hover' && hovered)

  // Dois "shadows" do `expanded` pra coordenar UI com a animação CSS:
  //  - `wide`: true 200ms DEPOIS de expandir → renderiza labels inline
  //  - `narrow`: true 220ms DEPOIS de recolher → renderiza tooltips
  // No intervalo (durante a animação), nem labels nem tooltips são renderizados;
  // só o ícone fica visível. Evita: (a) labels aparecerem antes do menu abrir
  // e (b) tooltips piscarem ao tirar o mouse.
  const [wide, setWide] = useState(expanded)
  const [narrow, setNarrow] = useState(!expanded)
  useEffect(() => {
    if (expanded) {
      setNarrow(false)
      const t = window.setTimeout(() => setWide(true), 200)
      return () => window.clearTimeout(t)
    }
    setWide(false)
    const t = window.setTimeout(() => setNarrow(true), 220)
    return () => window.clearTimeout(t)
  }, [expanded])

  const handleHoverEnter = () => {
    if (mode !== 'hover') return
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current)
      leaveTimerRef.current = null
    }
    setHovered(true)
  }

  const handleHoverLeave = () => {
    if (mode !== 'hover') return
    // Pequeno delay pra não recolher se o cursor "raspar" a borda ou cruzar
    // pra um popover (config/perfil) que abre fora da sidebar.
    if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current)
    leaveTimerRef.current = window.setTimeout(() => {
      setHovered(false)
      leaveTimerRef.current = null
    }, 180)
  }

  // Limpa timer pendente ao desmontar
  useEffect(() => {
    return () => {
      if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current)
    }
  }, [])

  const setSidebarMode = (m: SidebarMode) => {
    setMode(m)
    try {
      localStorage.setItem(SIDEBAR_MODE_KEY, m)
    } catch { /* noop */ }
    setControlOpen(false)
  }

  // Close control popover on outside click
  useEffect(() => {
    if (!controlOpen) return
    const handler = (e: MouseEvent) => {
      if (controlRef.current && !controlRef.current.contains(e.target as Node)) {
        setControlOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [controlOpen])

  const userName =
    (supabaseUser?.user_metadata?.full_name as string | undefined) || 'Usuário'
  const userEmail = supabaseUser?.email || '—'
  const initials = getInitials(userName)

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Close on Esc
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [menuOpen])

  const handleConfiguracoes = () => {
    setMenuOpen(false)
    navigate('/configuracoes')
  }

  const handleAdminFrentistas = () => {
    setMenuOpen(false)
    navigate('/admin/frentistas')
  }

  const handleAdminUsuarios = () => {
    setMenuOpen(false)
    navigate('/admin/usuarios')
  }

  const handleAdminRedes = () => {
    setMenuOpen(false)
    navigate('/admin/redes')
  }

  const handleAdminApuracao = () => {
    setMenuOpen(false)
    navigate('/admin/apuracao')
  }

  const handleLogout = () => {
    setMenuOpen(false)
    logout()
  }

  // Role do usuário — só pra decidir o menu "Frentistas" (supervisor).
  const [role, setRole] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const fetchProfile = async () => {
      if (!supabaseUser || !supabase) return
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', supabaseUser.id)
        .maybeSingle()
      if (!cancelled) setRole(data?.role ?? null)
    }
    fetchProfile()
    return () => { cancelled = true }
  }, [supabaseUser])
  const isSupervisor = role === 'supervisor'

  // Filtra (a) itens masterOnly pra não-master, (b) itens cujo módulo está
  // fora da lista permitida. Master sempre vê tudo (ignora todas as flags).
  const visibleNavGroups = navGroups
    .map((group) => {
      let items = group.items
      if (!isMaster) {
        items = items.filter((item) => !item.masterOnly)
        if (modulosPermitidos && modulosPermitidos.length > 0) {
          items = items.filter((item) => {
            const id = moduloIdByPath.get(item.path)
            if (!id) return true
            return modulosPermitidos.includes(id)
          })
        }
      }
      return { ...group, items }
    })
    .filter((g) => g.items.length > 0)

  return (
    <aside
      onMouseEnter={handleHoverEnter}
      onMouseLeave={handleHoverLeave}
      className={cn(
        'hidden flex-col overflow-visible border-r border-gray-100 bg-white text-gray-700 dark:border-gray-800 dark:bg-[#1e3a5f] dark:text-gray-200 md:flex',
        '[transition:width_220ms_cubic-bezier(0.4,0,0.2,1)]',
        expanded ? 'w-52' : 'w-14',
      )}
    >
      {/* Logo */}
      <div className={cn('flex h-14 items-center', wide ? 'px-4' : 'justify-center')}>
        <Link
          to="/"
          aria-label="Página inicial"
          title="Visor360"
          className={cn(
            'font-bold tracking-wider text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200',
            wide ? 'text-lg' : 'text-[13px]',
          )}
        >
          {wide ? 'Visor360' : 'V360'}
        </Link>
      </div>

      <nav aria-label="Menu principal" className="flex-1 px-2 pb-4 pt-3 md:pt-4">
        {visibleNavGroups.map((group, gi) => (
          <div key={group.title} className={cn(wide && gi > 0 && 'mt-4')}>
            {wide ? (
              <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-white/40">
                {group.title}
              </p>
            ) : (
              gi > 0 && <div className="mx-2 my-2 border-t border-gray-100 dark:border-white/10" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.path || pathname.startsWith(item.path + '/')
                const Icon = item.icon

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-label={item.label}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'group relative flex h-10 items-center rounded-lg transition-colors',
                      isActive
                        ? 'bg-gray-100 text-gray-900 dark:bg-white/15 dark:text-white'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white',
                    )}
                  >
                    {/* Coluna fixa do ícone — fica sempre na mesma posição quer
                        a sidebar esteja narrow ou wide. */}
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center">
                      <Icon
                        className={cn(
                          'h-[18px] w-[18px]',
                          isActive
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-gray-500 dark:text-white/60',
                        )}
                      />
                    </span>
                    {wide && (
                      <span className="text-sm font-medium">{item.label}</span>
                    )}
                    {narrow && (
                      <span className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-700">
                        {item.label}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Controle do menu lateral — popover acima do perfil */}
      <div ref={controlRef} className={cn('relative px-2 pb-1 pt-2', wide ? '' : 'flex justify-center')}>
        <button
          onClick={() => setControlOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={controlOpen}
          aria-label="Controle do menu lateral"
          title="Controle do menu lateral"
          className={cn(
            'group relative flex h-7 items-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white',
            wide ? 'w-full justify-start gap-2 px-2 text-xs' : 'w-7 justify-center',
          )}
        >
          <PanelLeft className="h-3.5 w-3.5 shrink-0" />
          {wide && <span>Menu lateral</span>}
          {narrow && (
            <span className="pointer-events-none absolute left-full z-50 ml-2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-700">
              Controle do menu
            </span>
          )}
        </button>

        {controlOpen && (
          <div
            role="menu"
            className="absolute bottom-0 left-full z-50 ml-2 w-60 rounded-xl border border-gray-200 bg-white py-2 shadow-lg dark:border-gray-700 dark:bg-gray-900"
          >
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Controle do menu
            </p>
            {modeOptions.map((opt) => (
              <button
                key={opt.value}
                role="menuitemradio"
                aria-checked={mode === opt.value}
                onClick={() => setSidebarMode(opt.value)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {mode === opt.value && <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />}
                </span>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer — perfil */}
      <div className="border-t border-gray-100 px-2 py-3 dark:border-white/10">
        <div ref={menuRef} className={cn('relative', wide ? 'flex items-center gap-2' : 'flex justify-center')}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`Conta de ${userName}`}
            title={userName}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {initials}
          </button>
          {wide && (
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="min-w-0 flex-1 truncate text-left text-sm text-gray-700 hover:text-gray-900 dark:text-white/80 dark:hover:text-white"
              title={userName}
            >
              {userName}
            </button>
          )}

          {menuOpen && (
            <div
              role="menu"
              className="absolute bottom-0 left-full z-50 ml-2 w-56 rounded-xl border border-gray-200 bg-white py-1 text-gray-700 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              <p className="truncate px-3 py-2 text-xs text-gray-400" title={userEmail}>
                {userEmail}
              </p>

              <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

              <button
                role="menuitem"
                onClick={handleConfiguracoes}
                className="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <span className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-gray-500" />
                  Configurações
                </span>
                <kbd className="font-mono text-[10px] text-gray-400">⇧+Ctrl+,</kbd>
              </button>

              {isSupervisor && (
                <button
                  role="menuitem"
                  onClick={handleAdminFrentistas}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Users className="h-4 w-4 text-gray-500" />
                  Frentistas
                </button>
              )}

              {isMaster && (
                <>
                  <button
                    role="menuitem"
                    onClick={handleAdminUsuarios}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <UserCog className="h-4 w-4 text-gray-500" />
                    Usuários
                  </button>
                  <button
                    role="menuitem"
                    onClick={handleAdminRedes}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <Network className="h-4 w-4 text-gray-500" />
                    Redes
                  </button>
                </>
              )}

              {canApurar && (
                <button
                  role="menuitem"
                  onClick={handleAdminApuracao}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Database className="h-4 w-4 text-gray-500" />
                  Apuração
                </button>
              )}

              <div className="my-1 border-t border-gray-100 dark:border-gray-800" />

              <button
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <LogOut className="h-4 w-4 text-gray-500" />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

export { navItems }
export default Sidebar

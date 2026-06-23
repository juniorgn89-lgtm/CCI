import { useEffect, useRef, useState } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import {
  Settings,
  LogOut,
  Users,
  UserCog,
  Network,
  Database,
  PanelLeft,
  Check,
  Sparkles,
  LayoutGrid,
  Fuel,
  Wrench,
  Store,
  ShoppingBag,
  GitCompareArrows,
  Radar,
  LayoutDashboard,
  ClipboardCheck,
  Scale,
  Target,
  Package,
  RefreshCw,
  Boxes,
  ShoppingCart,
  ClipboardList,
  ArrowDownCircle,
  ArrowUpCircle,
  Activity,
  BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/store/auth'
import { supabase } from '@/lib/supabase'
import { MODULOS } from '@/lib/modulos'
import { navGroups } from '@/components/layout/navConfig'

/** Mapa path → id de módulo do catálogo, pra filtrar nav items pela permissão. */
const moduloIdByPath = new Map(MODULOS.map((m) => [m.path, m.id]))

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

type SidebarMode = 'expanded' | 'collapsed' | 'hover' | 'options'

const SIDEBAR_MODE_KEY = 'sidebar_mode'

const readMode = (): SidebarMode => {
  if (typeof window === 'undefined') return 'collapsed'
  const v = localStorage.getItem(SIDEBAR_MODE_KEY)
  if (v === 'expanded' || v === 'collapsed' || v === 'hover' || v === 'options') return v
  return 'collapsed'
}

const modeOptions: { value: SidebarMode; label: string }[] = [
  { value: 'expanded', label: 'Expandido' },
  { value: 'collapsed', label: 'Recolhido' },
  { value: 'hover', label: 'Expandir ao passar o mouse' },
  { value: 'options', label: 'Opções ao passar o mouse' },
]

/** Sub-opções (abas deep-linkáveis) por módulo — usadas no flyout do modo
 * "Opções ao passar o mouse". Só os módulos com abas navegáveis por URL. */
interface SubOption {
  label: string
  to: string
  Icon: typeof LayoutGrid
}
const MODULE_SUBOPTIONS: Record<string, SubOption[]> = {
  '/dashboard': [
    { label: 'Visão Geral', to: '/dashboard', Icon: LayoutGrid },
    { label: 'Ao Vivo Rede', to: '/dashboard?tab=aovivo', Icon: Activity },
    { label: 'Reabastecimento', to: '/dashboard?tab=reabastecimento', Icon: Fuel },
    { label: 'Produtividade', to: '/dashboard?tab=produtividade', Icon: BarChart3 },
  ],
  '/comercial/vendas': [
    { label: 'Visão Geral', to: '/comercial/vendas', Icon: LayoutGrid },
    { label: 'Combustível', to: '/comercial/vendas?tab=combustivel', Icon: Fuel },
    { label: 'Pista', to: '/comercial/vendas?tab=pista', Icon: Wrench },
    { label: 'Conveniência', to: '/comercial/vendas?tab=conveniencia', Icon: Store },
  ],
  '/inteligencia': [
    { label: 'Análise', to: '/inteligencia', Icon: GitCompareArrows },
    { label: 'Radar', to: '/inteligencia?tab=radar', Icon: Radar },
    { label: 'Cadu IA', to: '/inteligencia?tab=assistente', Icon: Sparkles },
  ],
  '/caixas-turnos': [
    { label: 'Visão Geral', to: '/caixas-turnos', Icon: LayoutDashboard },
    { label: 'Conferência por PDV', to: '/caixas-turnos?tab=conferencia', Icon: ClipboardCheck },
    { label: 'Diferenças', to: '/caixas-turnos?tab=diferencas', Icon: Scale },
  ],
  '/produtividade': [
    { label: 'Visão Geral', to: '/produtividade', Icon: LayoutDashboard },
    { label: 'Frentistas', to: '/produtividade?tab=frentistas', Icon: Fuel },
    { label: 'Vendedores', to: '/produtividade?tab=vendedores', Icon: ShoppingBag },
    { label: 'Metas', to: '/produtividade?tab=metas', Icon: Target },
  ],
  '/estoques': [
    { label: 'Visão Geral', to: '/estoques', Icon: LayoutDashboard },
    { label: 'Estoque geral', to: '/estoques?tab=geral', Icon: Package },
    { label: 'Giro', to: '/estoques?tab=giro', Icon: RefreshCw },
    { label: 'Estoque médio', to: '/estoques?tab=estoqueMedio', Icon: Boxes },
    { label: 'Média de venda (6m)', to: '/estoques?tab=mediaVendas', Icon: ShoppingCart },
    { label: 'Necessidade', to: '/estoques?tab=necessidade', Icon: ClipboardList },
  ],
  '/financeiro': [
    { label: 'Visão Geral', to: '/financeiro', Icon: LayoutDashboard },
    { label: 'Receber', to: '/financeiro?tab=receber', Icon: ArrowDownCircle },
    { label: 'Pagar', to: '/financeiro?tab=pagar', Icon: ArrowUpCircle },
    { label: 'Fluxo de Caixa', to: '/financeiro?tab=fluxo', Icon: Activity },
  ],
}

const Sidebar = () => {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const supabaseUser = useAuthStore((s) => s.user)
  const profileFullName = useAuthStore((s) => s.fullName)
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
  // Modo "Opções ao passar o mouse": hover só mostra o nome (tooltip); o menu
  // de opções do módulo abre por CLIQUE. Guarda qual módulo está aberto.
  const [openOptions, setOpenOptions] = useState<string | null>(null)
  const expanded = mode === 'expanded' || (mode === 'hover' && hovered)

  // Dois "shadows" do `expanded` pra coordenar UI com a animação CSS:
  //  - `wide`: true 200ms DEPOIS de expandir → renderiza labels inline
  //  - `narrow`: true 220ms DEPOIS de recolher → renderiza tooltips
  // No intervalo (durante a animação), nem labels nem tooltips são renderizados;
  // só o ícone fica visível. Evita: (a) labels aparecerem antes do menu abrir
  // e (b) tooltips piscarem ao tirar o mouse.
  const [wide, setWide] = useState(expanded)
  const [narrow, setNarrow] = useState(!expanded)
  // Timer-based animation sync; não é derivação direta de state.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (expanded) {
      setNarrow(false)
      const t = window.setTimeout(() => setWide(true), 200)
      return () => window.clearTimeout(t)
    }
    setWide(false)
    const t = window.setTimeout(() => setNarrow(true), 220)
    return () => window.clearTimeout(t)
    /* eslint-enable react-hooks/set-state-in-effect */
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

  // Fecha o menu de opções do módulo (modo "options") ao clicar fora ou Esc.
  useEffect(() => {
    if (!openOptions) return
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-module-options]')) setOpenOptions(null)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenOptions(null) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [openOptions])

  // Prioriza profiles.full_name (fonte da verdade do app); user_metadata
  // do Supabase auth pode estar desatualizado (ex.: usuário renomeado no admin
  // mas o auth metadata ficou com o valor antigo "SUPERVISOR").
  const userName =
    profileFullName ||
    (supabaseUser?.user_metadata?.full_name as string | undefined) ||
    'Usuário'
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

  const handleAssistente = () => {
    setMenuOpen(false)
    navigate('/inteligencia?tab=assistente')
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
        'hidden flex-col overflow-visible bg-white text-gray-700 dark:bg-[#1e3a5f] dark:text-gray-200 md:flex',
        '[transition:width_220ms_cubic-bezier(0.4,0,0.2,1)]',
        expanded ? 'w-52' : 'w-14',
      )}
    >
      <nav aria-label="Menu principal" className="flex-1 px-2 pb-4 pt-3 md:pt-4">
        {visibleNavGroups.map((group, gi) => (
          <div key={group.title} className={cn(wide && gi > 0 && 'mt-4')}>
            {wide ? (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 dark:text-white/35">
                {group.title}
              </p>
            ) : (
              gi > 0 && <div className="mx-2 my-2 border-t border-gray-100 dark:border-white/10" />
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.path || pathname.startsWith(item.path + '/')
                const Icon = item.icon
                const subOptions = MODULE_SUBOPTIONS[item.path]
                // Modo "Opções ao passar o mouse": hover mostra só o nome; o CLIQUE
                // abre o menu de opções (em vez de navegar direto). Só vale pros
                // módulos com abas deep-linkáveis; os demais navegam normal.
                const optionsMode = mode === 'options' && narrow && !!subOptions
                const optionsOpen = openOptions === item.path

                const inner = (
                  <>
                    {/* Barra vertical indicando item ativo. Fica colada à esquerda
                        do botão, encostando no texto (alinhada com o início da palavra). */}
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-sky-500 dark:bg-sky-400"
                      />
                    )}
                    {/* Coluna fixa do ícone — fica sempre na mesma posição quer
                        a sidebar esteja narrow ou wide. */}
                    <span className="flex h-9 w-10 shrink-0 items-center justify-center">
                      <Icon
                        className={cn(
                          'h-[17px] w-[17px]',
                          isActive
                            ? 'text-sky-600 dark:text-sky-300'
                            : 'text-gray-400 dark:text-white/55',
                        )}
                      />
                    </span>
                    {wide && (
                      <span className="text-[13px] font-medium">{item.label}</span>
                    )}
                  </>
                )
                const baseCls = cn(
                  'relative flex h-9 w-full items-center rounded-lg transition-colors',
                  isActive
                    ? 'bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-white/65 dark:hover:bg-white/10 dark:hover:text-white',
                )

                return (
                  <div key={item.path} className="group relative" data-module-options={optionsMode ? '' : undefined}>
                    {/* Modo "options": o clique abre o menu de abas (NÃO navega) —
                        a navegação acontece ao escolher uma aba. Os demais módulos
                        (sem abas) navegam direto. */}
                    {optionsMode ? (
                      <button
                        type="button"
                        onClick={() => setOpenOptions((p) => (p === item.path ? null : item.path))}
                        aria-label={item.label}
                        aria-haspopup="menu"
                        aria-expanded={optionsOpen}
                        className={cn(baseCls, 'text-left')}
                      >
                        {inner}
                      </button>
                    ) : (
                      <Link
                        to={item.path}
                        aria-label={item.label}
                        aria-current={isActive ? 'page' : undefined}
                        className={baseCls}
                      >
                        {inner}
                      </Link>
                    )}

                    {/* Tooltip com o NOME do módulo (narrow). Escondido enquanto o
                        menu de opções desse módulo estiver aberto. */}
                    {narrow && !optionsOpen && (
                      <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-700">
                        {item.label}
                      </span>
                    )}

                    {/* Menu de opções do módulo — abre por CLIQUE (modo "options"). */}
                    {optionsMode && optionsOpen && (
                      <div className="absolute left-full top-0 z-50 ml-2">
                        <div className="min-w-[12rem] rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                            {item.label}
                          </p>
                          {subOptions.map((opt) => {
                            const optActive = pathname + search === opt.to
                            return (
                              <Link
                                key={opt.to}
                                to={opt.to}
                                onClick={() => setOpenOptions(null)}
                                className={cn(
                                  'flex items-center gap-2 px-3 py-1.5 text-sm transition-colors',
                                  optActive
                                    ? 'bg-sky-50 font-medium text-sky-900 dark:bg-sky-500/15 dark:text-white'
                                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800',
                                )}
                              >
                                <opt.Icon className={cn('h-4 w-4 shrink-0', optActive ? 'text-sky-600 dark:text-sky-300' : 'text-gray-400 dark:text-gray-500')} />
                                {opt.label}
                              </Link>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-xs font-semibold text-white transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-400"
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
                    onClick={handleAssistente}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <Sparkles className="h-4 w-4 text-gray-500" />
                    Cadu IA
                  </button>
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

export default Sidebar

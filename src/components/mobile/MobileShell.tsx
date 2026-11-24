import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SlidersHorizontal, ChevronDown, Sun, Moon, Settings, Database, LogOut, ChevronRight, Bug, Bell, Network } from 'lucide-react'
import { useThemeStore } from '@/store/theme'
import { useTenantStore } from '@/store/tenant'
import { useFilterStore } from '@/store/filters'
import { useAuthStore } from '@/store/auth'
import { useAuth } from '@/hooks/useAuth'
import useEmpresaNome from '@/hooks/useEmpresaNome'
import { useRedeNomeExibicao } from '@/hooks/useDemo'
import AppLauncher from '@/components/layout/AppLauncher'
import SinoNotificacoes from '@/components/layout/SinoNotificacoes'
import type { NavItem } from '@/components/layout/navConfig'
import MobileBottomNav from '@/components/mobile/MobileBottomNav'
import MobileFilterSheet from '@/components/mobile/MobileFilterSheet'
import InstallAppBanner from '@/components/pwa/InstallAppBanner'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'

interface MobileShellProps {
  /** Módulos visíveis (já filtrados por permissão). */
  items: NavItem[]
  /** Se a tela usa filtros globais (esconde a barra de filtro quando false). */
  showFilters: boolean
  children: ReactNode
}

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

/** "Mai/26" pra mês inteiro, "05/05–18/05" pra intervalo custom. */
const periodLabel = (di: string, df: string): string => {
  const [yi, mi, dia1] = di.split('-').map(Number)
  const [yf, mf, dia2] = df.split('-').map(Number)
  if (!yi || !mi || !yf || !mf) return ''
  const lastDay = new Date(yf, mf, 0).getDate()
  const mesInteiro = yi === yf && mi === mf && dia1 === 1 && dia2 === lastDay
  if (mesInteiro) return `${MESES[mi - 1]}/${String(yi).slice(-2)}`
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(dia1)}/${p(mi)}–${p(dia2)}/${p(mf)}`
}

const MobileShell = ({ items, showFilters, children }: MobileShellProps) => {
  const { pathname } = useLocation()
  const dark = useThemeStore((s) => s.dark)
  const toggleTheme = useThemeStore((s) => s.toggle)
  const rede = useTenantStore((s) => s.rede)
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const user = useAuthStore((s) => s.user)
  const fullName = useAuthStore((s) => s.fullName)
  const isMaster = useAuthStore((s) => s.isMaster)
  const canApurar = useAuthStore((s) => s.canApurar)
  const canAbrirChamados = useAuthStore((s) => s.canAbrirChamados)
  const [filterOpen, setFilterOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  // Android pinta as barras do sistema com o theme-color: segue a barra inferior
  // (petróleo), senão sobra uma faixa de outra cor embaixo do menu.
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    const original = meta?.getAttribute('content')
    meta?.setAttribute('content', '#0f766e')
    return () => { if (meta && original) meta.setAttribute('content', original) }
  }, [])

  const userName = fullName || (user?.user_metadata?.full_name as string | undefined) || 'Usuário'
  const userEmail = user?.email ?? '—'
  const initials = userName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'
  const go = (path: string) => { setProfileOpen(false); navigate(path) }

  // Central da Rede agora é o hub: a Visão Geral é rede-wide, mas as abas de
  // vendas detalham um posto → o seletor de posto fica disponível (default
  // "Todos os postos").
  const isCentral = pathname === '/dashboard'
  const showFilterBar = showFilters

  // Nome da rede mascarado no Modo Demonstração.
  const redeNome = useRedeNomeExibicao(rede?.nome)
  const subtitle = isCentral ? 'Visor360 · Central da rede' : 'Visor360 · Gestão de postos'
  // Convite "baixe o app" só no alto das telas principais (não em detalhe/formulário).
  const telaPrincipal = items.some((i) => i.path === pathname)

  const empresaNome = useEmpresaNome()
  const postoResumo = empresaCodigos.length === 1
    ? (empresaNome || '1 posto')
    : empresaCodigos.length === 0 ? 'Todos os postos' : `${empresaCodigos.length} postos`
  const filterResumo = `${postoResumo} · ${periodLabel(dataInicial, dataFinal)}`

  return (
    <div className="flex h-[100dvh] flex-col bg-gray-50 dark:bg-[#0b1220]">
      {/* Topo (padrão CCI): branco no claro, ardósia #1e293b no escuro; separa pela cor. */}
      <header
        className="sticky top-0 z-30 shrink-0 bg-white dark:bg-[#1e293b]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex h-[60px] items-center gap-1.5 pl-4 pr-2.5">
          {/* Rede → abre perfil + configurações + apuração */}
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            aria-label="Perfil e configurações"
            className="mr-1 flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left transition-opacity active:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white">
              <Network className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold leading-tight text-gray-900 dark:text-gray-100">{redeNome ?? 'Visor360'}</span>
              <span className="block truncate text-[11.5px] leading-tight text-gray-500 dark:text-gray-400">{subtitle}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/60 dark:hover:bg-white/10"
          >
            {dark ? <Sun className="h-[18px] w-[18px] text-amber-400" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
          <SinoNotificacoes variant="mobile" />
          {/* Launcher da suíte CCI (grade ⋮⋮⋮) — abre os outros apps. */}
          <AppLauncher variant="mobile" />
        </div>
      </header>

      {/* Barra-resumo de filtro (sticky) */}
      {showFilterBar && (
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="z-20 flex shrink-0 items-center gap-2.5 border-b border-gray-200 bg-white px-4 py-3 text-left dark:border-white/[0.06] dark:bg-[#1e293b]"
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-[#94a3b8]">Filtros</span>
          <span className="flex-1 truncate text-[14px] font-semibold text-gray-800 dark:text-[#f1f5f9]">{filterResumo}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        </button>
      )}

      {/* Conteúdo rolável — o padding-bottom limpa o bottom-nav (h-16) + a
          safe-area do aparelho, pra o último item nunca ficar sob a barra. */}
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))]">
        {telaPrincipal && <InstallAppBanner />}
        {children}
      </main>

      <MobileBottomNav items={items} />
      <MobileFilterSheet open={filterOpen} onOpenChange={setFilterOpen} />

      {/* Perfil + configurações (básico) + apuração — abre ao tocar na logo. */}
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl border-0 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] dark:bg-[#1e293b]">
          <SheetTitle className="sr-only">Perfil e configurações</SheetTitle>
          {/* Identidade */}
          <div className="flex items-center gap-3 pb-2">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-sm font-semibold text-white">{initials}</span>
            <div className="min-w-0">
              <p className="truncate text-[15.5px] font-semibold text-gray-900 dark:text-[#f1f5f9]">{userName}</p>
              <p className="truncate text-[12.5px] text-gray-500 dark:text-[#94a3b8]">{userEmail}</p>
            </div>
          </div>

          <div className="mt-2 space-y-0.5 border-t border-gray-100 pt-2 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => go('/configuracoes')}
              className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-[15px] text-gray-800 active:bg-gray-100 dark:text-[#f1f5f9] dark:active:bg-white/[0.08]"
            >
              <Settings className="h-5 w-5 shrink-0 text-gray-500 dark:text-[#94a3b8]" />
              <span className="flex-1 text-left">Parâmetros</span>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>

            {/* Atalho para ligar os avisos no celular (seção #avisos das Configurações). */}
            <button
              type="button"
              onClick={() => go('/configuracoes#avisos')}
              className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-[15px] text-gray-800 active:bg-gray-100 dark:text-[#f1f5f9] dark:active:bg-white/[0.08]"
            >
              <Bell className="h-5 w-5 shrink-0 text-gray-500 dark:text-[#94a3b8]" />
              <span className="flex-1 text-left">Avisos no celular</span>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>

            {canAbrirChamados && (
              <button
                type="button"
                onClick={() => go('/meus-chamados')}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-[15px] text-gray-800 active:bg-gray-100 dark:text-[#f1f5f9] dark:active:bg-white/[0.08]"
              >
                <Bug className="h-5 w-5 shrink-0 text-gray-500 dark:text-[#94a3b8]" />
                <span className="flex-1 text-left">Meus chamados</span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
            )}

            {(isMaster || canApurar) && (
              <button
                type="button"
                onClick={() => go('/admin/apuracao')}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-[15px] text-gray-800 active:bg-gray-100 dark:text-[#f1f5f9] dark:active:bg-white/[0.08]"
              >
                <Database className="h-5 w-5 shrink-0 text-gray-500 dark:text-[#94a3b8]" />
                <span className="flex-1 text-left">Apuração</span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
            )}

            <button
              type="button"
              onClick={() => { setProfileOpen(false); logout() }}
              className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-[15px] text-red-600 active:bg-red-50 dark:text-[#fda4af] dark:active:bg-rose-500/10"
            >
              <LogOut className="h-5 w-5 shrink-0" />
              <span className="flex-1 text-left">Sair</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

export default MobileShell

import { useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { SlidersHorizontal, ChevronDown, Sun, Moon, Settings, Database, LogOut, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useThemeStore } from '@/store/theme'
import { useTenantStore } from '@/store/tenant'
import { useFilterStore } from '@/store/filters'
import { useAuthStore } from '@/store/auth'
import { useAuth } from '@/hooks/useAuth'
import useEmpresaNome from '@/hooks/useEmpresaNome'
import type { NavItem } from '@/components/layout/navConfig'
import MobileBottomNav from '@/components/mobile/MobileBottomNav'
import MobileFilterSheet from '@/components/mobile/MobileFilterSheet'
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
  const [filterOpen, setFilterOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const userName = fullName || (user?.user_metadata?.full_name as string | undefined) || 'Usuário'
  const userEmail = user?.email ?? '—'
  const initials = userName.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '?'
  const go = (path: string) => { setProfileOpen(false); navigate(path) }

  // Central da Rede agora é o hub: a Visão Geral é rede-wide, mas as abas de
  // vendas detalham um posto → o seletor de posto fica disponível (default
  // "Todos os postos").
  const isCentral = pathname === '/dashboard'
  const showFilterBar = showFilters

  const subtitle = isCentral
    ? (rede?.nome ? `Rede · ${rede.nome}` : 'Visão consolidada da rede')
    : (rede?.nome ?? 'Visor360')

  const empresaNome = useEmpresaNome()
  const postoResumo = empresaCodigos.length === 1
    ? (empresaNome || '1 posto')
    : empresaCodigos.length === 0 ? 'Todos os postos' : `${empresaCodigos.length} postos`
  const filterResumo = `${postoResumo} · ${periodLabel(dataInicial, dataFinal)}`

  return (
    <div className="flex h-[100dvh] flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header navy */}
      <header
        className="z-30 shrink-0 bg-[#1e3a5f] text-white dark:bg-[#131316]"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex h-14 items-center gap-2.5 px-4">
          {/* Logo → abre perfil + configurações + apuração */}
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            aria-label="Perfil e configurações"
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left transition-opacity active:opacity-70"
          >
            <img src="/brand/visor360-icon-512.png" alt="Visor360" className="h-9 w-9 shrink-0 object-contain" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold leading-tight">Visor<span className="text-[#14b8a6]">360</span></span>
              <span className="block truncate text-[11px] leading-tight text-white/70">{subtitle}</span>
            </span>
          </button>
          {/* Pill "Tempo real" */}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ade80] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4ade80]" />
            </span>
            Tempo real
          </span>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Alternar tema"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/10"
          >
            {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </header>

      {/* Barra-resumo de filtro (sticky) */}
      {showFilterBar && (
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          className="z-20 flex shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-4 py-2.5 text-left dark:border-gray-800 dark:bg-[#1c1c1c]"
        >
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
          <span className="text-[9.5px] font-semibold uppercase tracking-wider text-gray-400">Filtros</span>
          <span className="flex-1 truncate text-[12.5px] font-semibold text-gray-700 dark:text-gray-200">{filterResumo}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
        </button>
      )}

      {/* Conteúdo rolável */}
      <main className={cn('flex-1 overflow-y-auto px-3.5 pt-3.5', 'pb-24')}>
        {children}
      </main>

      <MobileBottomNav items={items} />
      <MobileFilterSheet open={filterOpen} onOpenChange={setFilterOpen} />

      {/* Perfil + configurações (básico) + apuração — abre ao tocar na logo. */}
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetTitle className="sr-only">Perfil e configurações</SheetTitle>
          {/* Identidade */}
          <div className="flex items-center gap-3 pb-2">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-sm font-semibold text-white">{initials}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{userName}</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{userEmail}</p>
            </div>
          </div>

          <div className="mt-2 space-y-1 border-t border-gray-100 pt-2 dark:border-gray-800">
            <button
              type="button"
              onClick={() => go('/configuracoes')}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-sm text-gray-700 active:bg-gray-100 dark:text-gray-300 dark:active:bg-white/10"
            >
              <Settings className="h-5 w-5 shrink-0 text-gray-500" />
              <span className="flex-1 text-left">Configurações</span>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>

            {(isMaster || canApurar) && (
              <button
                type="button"
                onClick={() => go('/admin/apuracao')}
                className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-sm text-gray-700 active:bg-gray-100 dark:text-gray-300 dark:active:bg-white/10"
              >
                <Database className="h-5 w-5 shrink-0 text-gray-500" />
                <span className="flex-1 text-left">Apuração</span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
            )}

            <button
              type="button"
              onClick={() => { setProfileOpen(false); logout() }}
              className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-sm text-red-600 active:bg-red-50 dark:text-red-400 dark:active:bg-red-950/30"
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

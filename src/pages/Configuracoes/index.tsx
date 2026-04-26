import { Settings, Sun, Moon, Monitor, User, Mail, Info, LifeBuoy, Smartphone, LayoutDashboard, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useThemeStore, type ThemeMode } from '@/store/theme'

const APP_VERSION = 'v1.0.0'
const SUPPORTE_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string) || 'suporte@ccisga.com.br'

const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
]

const Configuracoes = () => {
  const { mode, setMode } = useThemeStore()

  const userName = (import.meta.env.VITE_APP_USER as string) || 'Usuário'
  const userEmail = (import.meta.env.VITE_APP_EMAIL as string) || `${userName}@ccisga.local`

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
          <Settings className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Configurações</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Preferências da conta e do sistema</p>
        </div>
      </div>

      {/* Aparência */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Aparência
        </h2>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Tema</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Escolha como o sistema deve ser exibido</p>
            </div>
            <div
              role="radiogroup"
              aria-label="Modo de tema"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800"
            >
              {themeOptions.map((opt) => {
                const Icon = opt.icon
                const active = mode === opt.value
                return (
                  <button
                    key={opt.value}
                    role="radio"
                    aria-checked={active}
                    onClick={() => setMode(opt.value)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? 'bg-[#1e3a5f] text-white shadow-sm'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Conta */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Conta
        </h2>
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
              <User className="h-4 w-4 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">Nome</p>
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{userName}</p>
            </div>
            <span className="text-[10px] font-medium uppercase text-gray-400">Somente leitura</span>
          </div>
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
              <Mail className="h-4 w-4 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{userEmail}</p>
            </div>
            <span className="text-[10px] font-medium uppercase text-gray-400">Somente leitura</span>
          </div>
        </div>
      </section>

      {/* Ferramentas */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Ferramentas
        </h2>
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900">
          <Link
            to="/gerente"
            className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
              <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Mobile (Gerente)</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                Visão mobile para gestores acompanharem o posto em tempo real
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </Link>
          <Link
            to="/frentista"
            className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 dark:bg-green-900/30">
              <Smartphone className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Mobile (Frentista)</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                Visão mobile para frentistas verem suas vendas e ranking
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </Link>
          <Link
            to="/mobile"
            className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-50 dark:bg-purple-900/30">
              <LayoutDashboard className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">App Gerente</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                Gestão de acessos e QR codes do app dos frentistas
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </Link>
        </div>
      </section>

      {/* Sobre */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Sobre
        </h2>
        <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
              <Info className="h-4 w-4 text-gray-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">Versão do sistema</p>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">CCISGA {APP_VERSION}</p>
            </div>
          </div>
          <a
            href={`mailto:${SUPPORTE_EMAIL}`}
            className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
              <LifeBuoy className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Suporte</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{SUPPORTE_EMAIL}</p>
            </div>
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Entrar em contato</span>
          </a>
        </div>
      </section>
    </div>
  )
}

export default Configuracoes

import { useEffect, useState } from 'react'
import { Settings, Sun, Moon, Monitor, User, Mail, Info, LifeBuoy, Smartphone, LayoutDashboard, ChevronRight, ChevronDown, Wrench, Save, HelpCircle } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useThemeStore, type ThemeMode } from '@/store/theme'
import { useAuthStore } from '@/store/auth'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { formatLiters } from '@/lib/formatters'
import {
  useManutencaoStore,
  type ManutencaoConfig,
  DEFAULT_CONFIG,
} from '@/store/manutencao'

const APP_VERSION = 'v1.0.0'
const SUPPORTE_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string) || 'suporte@ccisga.com.br'

const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'system', label: 'Sistema', icon: Monitor },
  { value: 'dark', label: 'Escuro', icon: Moon },
]

/* ─── Mini preview de cada modo de tema ────────────────── */
/* Cores via style inline para escapar das overrides do dark mode no index.css */

const PreviewLight = () => (
  <div className="flex h-full w-full flex-col p-2" style={{ backgroundColor: '#ffffff' }}>
    <div className="ml-auto mb-1.5 h-3 w-1/3 rounded-sm" style={{ backgroundColor: '#e5e7eb' }} />
    <div className="space-y-1">
      <div className="h-1 w-2/3 rounded-full" style={{ backgroundColor: '#d1d5db' }} />
      <div className="h-1 w-3/4 rounded-full" style={{ backgroundColor: '#d1d5db' }} />
      <div className="h-1 w-1/2 rounded-full" style={{ backgroundColor: '#d1d5db' }} />
    </div>
    <div className="mt-auto flex items-center gap-1">
      <div className="h-3 flex-1 rounded-sm" style={{ backgroundColor: '#f3f4f6' }} />
      <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: '#f97316' }} />
    </div>
  </div>
)

const PreviewDark = () => (
  <div className="flex h-full w-full flex-col p-2" style={{ backgroundColor: '#1f1f1f' }}>
    <div className="ml-auto mb-1.5 h-3 w-1/3 rounded-sm" style={{ backgroundColor: '#4b5563' }} />
    <div className="space-y-1">
      <div className="h-1 w-2/3 rounded-full" style={{ backgroundColor: '#6b7280' }} />
      <div className="h-1 w-3/4 rounded-full" style={{ backgroundColor: '#6b7280' }} />
      <div className="h-1 w-1/2 rounded-full" style={{ backgroundColor: '#6b7280' }} />
    </div>
    <div className="mt-auto flex items-center gap-1">
      <div className="h-3 flex-1 rounded-sm" style={{ backgroundColor: '#374151' }} />
      <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: '#f97316' }} />
    </div>
  </div>
)

const PreviewSystem = () => (
  <div className="relative h-full w-full">
    <div className="absolute inset-y-0 left-0 w-1/2 overflow-hidden">
      <PreviewLight />
    </div>
    <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden">
      <PreviewDark />
    </div>
  </div>
)

const renderPreview = (mode: ThemeMode) => {
  if (mode === 'light') return <PreviewLight />
  if (mode === 'dark') return <PreviewDark />
  return <PreviewSystem />
}

const ManutencaoBombasSection = () => {
  const { data: empresasData, isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })

  const { configs, setConfig, clearConfig } = useManutencaoStore()
  const [openCodigo, setOpenCodigo] = useState<number | null>(null)
  const [buffer, setBuffer] = useState<ManutencaoConfig>(DEFAULT_CONFIG)
  const [showHelp, setShowHelp] = useState(false)

  const empresas = empresasData?.resultados ?? []

  const handleEdit = (codigo: number) => {
    if (openCodigo === codigo) {
      setOpenCodigo(null)
      return
    }
    setBuffer(configs[codigo] ?? DEFAULT_CONFIG)
    setOpenCodigo(codigo)
  }

  const handleSave = (codigo: number) => {
    setConfig(codigo, {
      intervaloLitros: Number(buffer.intervaloLitros) || DEFAULT_CONFIG.intervaloLitros,
      avisarAoAtingirPct: Number(buffer.avisarAoAtingirPct) || DEFAULT_CONFIG.avisarAoAtingirPct,
      responsavel: buffer.responsavel || '',
    })
    setOpenCodigo(null)
  }

  return (
    <section id="manutencao-bombas" className="scroll-mt-6 space-y-3">
      <div className="flex items-center gap-1.5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Manutenção de Bombas
        </h2>
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          aria-expanded={showHelp}
          aria-label="Como funciona a manutenção de bombas"
          className={cn(
            'flex h-4 w-4 items-center justify-center rounded-full transition-colors',
            showHelp
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
          )}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </div>

      {showHelp && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-sm dark:border-blue-800/40 dark:bg-blue-900/20">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            Como configurar
          </p>
          <ul className="ml-4 list-disc space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
            <li>
              <span className="font-semibold text-gray-900 dark:text-gray-100">Intervalo (litros):</span>{' '}
              volume total que cada bomba pode bombear antes da manutenção preventiva.
              Ex: <span className="tabular-nums">100.000 L</span>.
            </li>
            <li>
              <span className="font-semibold text-gray-900 dark:text-gray-100">Avisar ao atingir (%):</span>{' '}
              percentual do intervalo a partir do qual o sistema sinaliza manutenção próxima.
              Ex: <span className="tabular-nums">80%</span> avisa quando a bomba bombeou{' '}
              <span className="tabular-nums">80.000 L</span>.
            </li>
            <li>
              <span className="font-semibold text-gray-900 dark:text-gray-100">Responsável:</span>{' '}
              pessoa que cuida da execução/acompanhamento da manutenção (apenas referência).
            </li>
          </ul>
          <p className="mb-2 mt-3 text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
            Após configurar
          </p>
          <ul className="ml-4 list-disc space-y-1.5 text-xs text-gray-700 dark:text-gray-300">
            <li>
              A aba <span className="font-semibold text-gray-900 dark:text-gray-100">Operação → Bombas</span> exibe barras de desgaste e badges:
              <span className="ml-1 inline-flex items-center gap-1">
                <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">Regular</span>
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Próxima</span>
                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">Verificar agora</span>
              </span>
            </li>
            <li>
              Notificações automáticas são geradas no sino do topo quando o limite de aviso é atingido.
            </li>
            <li>
              Cada posto pode ter intervalo e responsável próprios — a configuração não afeta os outros postos.
            </li>
          </ul>
        </div>
      )}

      <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900">
        {isLoading ? (
          <div className="p-5 text-sm text-gray-400">Carregando postos…</div>
        ) : empresas.length === 0 ? (
          <div className="p-5 text-sm text-gray-400">Nenhum posto encontrado.</div>
        ) : (
          empresas.map((emp) => {
            const codigo = emp.empresaCodigo
            const config = configs[codigo]
            const hasConfig = !!config
            const isOpen = openCodigo === codigo
            const nome = emp.fantasia || emp.razao || `Posto ${codigo}`
            return (
              <div key={codigo}>
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                    <Wrench className="h-4 w-4 text-gray-500" />
                  </div>
                  <span className={cn('h-2.5 w-2.5 shrink-0 rounded-full', hasConfig ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600')} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100" title={nome}>
                      {nome}
                    </p>
                    {hasConfig ? (
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        Configurado · intervalo {formatLiters(config.intervaloLitros)}, aviso {config.avisarAoAtingirPct}%
                        {config.responsavel ? ` · ${config.responsavel}` : ''}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">Sem configuração</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleEdit(codigo)}
                    className={cn(
                      'flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                      hasConfig
                        ? 'border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    )}
                  >
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
                    {hasConfig ? 'Editar' : 'Configurar'}
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4 dark:border-gray-800 dark:bg-gray-800/30">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <label className="block">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Intervalo (litros)</span>
                        <input
                          type="number"
                          min={0}
                          placeholder="Ex: 100000"
                          value={buffer.intervaloLitros || ''}
                          onChange={(e) => setBuffer((p) => ({ ...p, intervaloLitros: Number(e.target.value) || 0 }))}
                          className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Avisar ao atingir (%)</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          placeholder="Ex: 80"
                          value={buffer.avisarAoAtingirPct || ''}
                          onChange={(e) => setBuffer((p) => ({ ...p, avisarAoAtingirPct: Number(e.target.value) || 0 }))}
                          className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm tabular-nums focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Responsável</span>
                        <input
                          type="text"
                          placeholder="Ex: João Silva"
                          value={buffer.responsavel}
                          onChange={(e) => setBuffer((p) => ({ ...p, responsavel: e.target.value }))}
                          className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                        />
                      </label>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => handleSave(codigo)}
                        className="flex items-center gap-1.5 rounded-md bg-[#1e3a5f] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#172d4a]"
                      >
                        <Save className="h-3.5 w-3.5" />
                        Salvar configuração
                      </button>
                      {hasConfig && (
                        <button
                          onClick={() => {
                            clearConfig(codigo)
                            setOpenCodigo(null)
                          }}
                          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

const Configuracoes = () => {
  const { mode, setMode } = useThemeStore()
  const location = useLocation()
  const supabaseUser = useAuthStore((s) => s.user)

  // Pull nome/email da sessão Supabase quando o usuário logou via Auth.
  // Fallback pras env vars do fluxo legacy (frentista ou config de dev sem Supabase).
  const userName =
    (supabaseUser?.user_metadata?.full_name as string | undefined) ||
    (import.meta.env.VITE_APP_USER as string) ||
    'Usuário'
  const userEmail =
    supabaseUser?.email ||
    (import.meta.env.VITE_APP_EMAIL as string) ||
    `${userName}@ccisga.local`

  // Scroll suave para a seção quando vier com hash (ex: /configuracoes#manutencao-bombas)
  useEffect(() => {
    if (!location.hash) return
    const id = location.hash.slice(1)
    // Pequeno delay para garantir que a seção já está montada
    const timer = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
    return () => clearTimeout(timer)
  }, [location])

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
        <div>
          <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Modo de cor</p>
          <div role="radiogroup" aria-label="Modo de tema" className="flex flex-wrap gap-3">
            {themeOptions.map((opt) => {
              const active = mode === opt.value
              return (
                <button
                  key={opt.value}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMode(opt.value)}
                  className="group flex w-[150px] flex-col items-center gap-2"
                >
                  <div
                    className={cn(
                      'relative h-20 w-full overflow-hidden rounded-xl border-2 transition-all',
                      active
                        ? 'border-blue-500 shadow-md ring-2 ring-blue-500/20'
                        : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                    )}
                  >
                    {renderPreview(opt.value)}
                  </div>
                  <span
                    className={cn(
                      'text-sm transition-colors',
                      active
                        ? 'font-semibold text-gray-900 dark:text-gray-100'
                        : 'text-gray-500 dark:text-gray-400'
                    )}
                  >
                    {opt.label}
                  </span>
                </button>
              )
            })}
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

      {/* Manutenção de Bombas */}
      <ManutencaoBombasSection />

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

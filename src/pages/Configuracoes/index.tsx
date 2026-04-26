import { useState } from 'react'
import { Settings, Sun, Moon, Monitor, User, Mail, Info, LifeBuoy, Smartphone, LayoutDashboard, ChevronRight, ChevronDown, Wrench, Save } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useThemeStore, type ThemeMode } from '@/store/theme'
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
  { value: 'dark', label: 'Escuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
]

const ManutencaoBombasSection = () => {
  const { data: empresasData, isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })

  const { configs, setConfig, clearConfig } = useManutencaoStore()
  const [openCodigo, setOpenCodigo] = useState<number | null>(null)
  const [buffer, setBuffer] = useState<ManutencaoConfig>(DEFAULT_CONFIG)

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
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        Manutenção de Bombas
      </h2>
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

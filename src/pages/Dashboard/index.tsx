import { lazy, Suspense, useState } from 'react'
import { LayoutDashboard, Building2, Network, Activity, Fuel, Layers } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import ResumoOperacao from '@/pages/Dashboard/components/ResumoOperacao'
import ProjecoesPainel from '@/pages/Dashboard/components/ProjecoesPainel'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import useDashboardData from '@/pages/Dashboard/hooks/useDashboardData'
import { useAuthStore } from '@/store/auth'
import { cn, isPastPeriod } from '@/lib/utils'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import HeaderTray from '@/components/layout/HeaderTray'
import ModuleSettings from '@/components/layout/ModuleSettings'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import { useDashboardLayout } from '@/store/moduleLayout'

// Lazy: TurnosAoVivo (cards live) e ReabastecimentoCard (recharts/lógica de
// tanques) só carregam quando a aba é aberta.
const TurnosAoVivo = lazy(() => import('@/pages/Dashboard/components/TurnosAoVivo'))
const ReabastecimentoCard = lazy(() => import('@/pages/Dashboard/components/ReabastecimentoCard'))
const BenchmarkSetor = lazy(() => import('@/pages/Dashboard/components/BenchmarkSetor'))

type TabId = 'setor' | 'aovivo' | 'reabastecimento'

const TAB_ICONS: Record<TabId, typeof Activity> = {
  setor: Layers,
  aovivo: Activity,
  reabastecimento: Fuel,
}

const TabSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  </div>
)

const Dashboard = () => {
  const { empresaCodigos, setEmpresas, dataFinal } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  useDashboardData() // dispara prefetch (cache de apuração + dependências)
  const canVerReabastecimento = useAuthStore((s) => s.canVerReabastecimento)

  // Quando o período inteiro já passou, esconde elementos "ao vivo" — não
  // existe turno aberto em mês passado, só ruído visual.
  const periodIsPast = isPastPeriod(dataFinal)

  // Layout das abas (Ao Vivo Rede / Reabastecimento). Engrenagem no HeaderTray
  // permite reordenar/ocultar; permissão (canVerReabastecimento) e contexto
  // (periodIsPast) escondem abas que não fazem sentido naquele estado.
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useDashboardLayout()
  const knownTabs = layoutTabs.filter((t) => {
    if (t.id === 'aovivo' && periodIsPast) return false
    if (t.id === 'reabastecimento' && !canVerReabastecimento) return false
    return true
  })
  const visibleTabs = knownTabs.filter((t) => t.visible)
  const [activeTab, setActiveTab] = useState<TabId>((visibleTabs[0]?.id ?? 'setor') as TabId)
  // Set-state durante render quando a aba persistida foi escondida via engrenagem.
  if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === activeTab)) {
    setActiveTab(visibleTabs[0].id as TabId)
  }

  // Carrega empresas pra: (a) descobrir nome do posto selecionado;
  // (b) saber quantos postos o user tem permissão pra ver — se for 1 só,
  // mostramos o toggle Central ⇄ Posto.
  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 30 * 60 * 1000,
  })
  const empresas = empresasData?.resultados ?? []
  const empresasPermitidas = useEmpresasPermitidas(empresas)

  const empresa = empresaCodigo
    ? empresas.find((e) => e.empresaCodigo === empresaCodigo)
    : null
  const empresaNome = empresa?.fantasia || empresa?.razao || (empresaCodigo ? `Posto ${empresaCodigo}` : '')

  // Toggle:
  // - Sempre aparece pra user com exatamente 1 posto permitido (Keidma).
  // - Pra multi-posto, aparece SOMENTE quando há um posto selecionado no
  //   filtro atual. Quando o user clica "Central da Rede", o filtro é
  //   limpo e o toggle some — pra voltar ao posto, use o dropdown do header.
  const isSinglePermitido = empresasPermitidas.length === 1
  const togglePostoCodigo = isSinglePermitido
    ? empresasPermitidas[0].codigo
    : empresaCodigo
  const togglePosto = togglePostoCodigo
    ? empresasPermitidas.find((e) => e.codigo === togglePostoCodigo) ?? null
    : null
  const showToggle = togglePosto !== null
  const singleNome = togglePosto?.fantasia || togglePosto?.razao || ''

  return (
    <div className="space-y-4">
      {showToggle && togglePosto && (
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
          <button
            onClick={() => setEmpresas([])}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              empresaCodigo === null
                ? 'bg-[#1e3a5f] text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            <Network className="h-3.5 w-3.5" />
            Central da Rede
          </button>
          <button
            onClick={() => setEmpresas([togglePosto.codigo])}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              empresaCodigo === togglePosto.codigo
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            <Building2 className="h-3.5 w-3.5" />
            {singleNome || 'Meu posto'}
          </button>
        </div>
      )}

      {empresaCodigo !== null ? (
        <ResumoOperacao empresaNome={empresaNome} />
      ) : (
        <>
          <PageHeaderTitle>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-900/30">
                <LayoutDashboard className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">Central da Rede</h1>
                  <FocusModeToggle />
                </div>
                <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                  {periodIsPast
                    ? 'Resumo consolidado do período selecionado'
                    : 'Acompanhamento dos postos em tempo real'}
                </p>
              </div>
            </div>
          </PageHeaderTitle>
          <PageHeaderActions>
            <DateRangeToolbar />
          </PageHeaderActions>
          {knownTabs.length > 0 && (
            <HeaderTray>
              <ModuleSettings
                title="Central da Rede"
                tabs={knownTabs}
                toggleVisibility={toggleVisibility}
                moveUp={moveUp}
                moveDown={moveDown}
                reset={reset}
              />
            </HeaderTray>
          )}

          {/* Cards de segmento sempre visíveis (Combustível, Automotivos, Conveniência, Global, Projeção). */}
          <ProjecoesPainel />

          {/* Tab strip + conteúdo (Ao Vivo Rede / Reabastecimento) */}
          {visibleTabs.length > 0 && (
            <>
              <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-[#0f0f0f]">
                {visibleTabs.map((tab) => {
                  const Icon = TAB_ICONS[tab.id as TabId] ?? Activity
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as TabId)}
                      className={cn(
                        'flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all',
                        activeTab === tab.id
                          ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              <Suspense fallback={<TabSkeleton />}>
                {activeTab === 'setor' && <BenchmarkSetor />}
                {activeTab === 'aovivo' && <TurnosAoVivo />}
                {activeTab === 'reabastecimento' && <ReabastecimentoCard />}
              </Suspense>
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Dashboard

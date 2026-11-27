import { lazy, Suspense, useEffect } from 'react'
import useVisivel from '@/hooks/useVisivel'
import { useQueryClient } from '@tanstack/react-query'
import { Activity, Layers, Fuel, Wrench, Store, Tag, Stethoscope, ArrowUpRight } from 'lucide-react'
import { useFilterStore } from '@/store/filters'
import useTabParam from '@/hooks/useTabParam'
import { Skeleton } from '@/components/ui/skeleton'
import ProjecoesPainel from '@/pages/Dashboard/components/ProjecoesPainel'
import RealizadoChave from '@/components/kpi/RealizadoChave'
import SecaoTitulo from './components/SecaoTitulo'
import useIsMobile from '@/hooks/useIsMobile'
import CentralMobile from '@/pages/Dashboard/CentralMobile'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import ModuloAbas from '@/components/layout/ModuloAbas'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import { useModuleTabSettings } from '@/hooks/usePersonalizedTabs'
import useBoolParam from '@/hooks/useBoolParam'
import CollapseTransition from '@/components/ui/CollapseTransition'

const BenchmarkSetor = lazy(() => import('@/pages/Dashboard/components/BenchmarkSetor'))
// Abas de Vendas (por-posto) movidas pra Central — renderizadas `embedded`
// (pulam header/SelectCompanyState/nav próprios). Arquivos seguem em Comercial/Vendas.
const Combustivel = lazy(() => import('@/pages/Comercial/Vendas/Combustivel'))
const Pista = lazy(() => import('@/pages/Comercial/Vendas/Pista'))
const Conveniencia = lazy(() => import('@/pages/Comercial/Vendas/Conveniencia'))
const GestaoPrecos = lazy(() => import('@/pages/Dashboard/components/GestaoPrecos'))
// Gráficos executivos da Visão Geral (mesmo chunk lazy do Recharts).
const VisaoGeralGraficos = lazy(() => import('@/pages/Dashboard/components/VisaoGeralGraficos'))
const TanquesRedeCard = lazy(() => import('@/pages/Dashboard/components/TanquesRedeCard'))
const ContasRedeCard = lazy(() => import('@/pages/Dashboard/components/ContasRedeCard'))

type TabId = 'setor' | 'combustivel' | 'pista' | 'conveniencia' | 'precos'

// Combustível, Pista e Conveniência agora são CONSOLIDADOS (cache apuracao_vendas)
// → renderizam rede-wide sempre, respeitando o filtro de posto. Nenhuma aba pede
// mais a seleção de um posto único (o gate SelectCompanyState foi removido).

const TAB_ICONS: Record<TabId, typeof Activity> = {
  setor: Layers,
  combustivel: Fuel,
  pista: Wrench,
  conveniencia: Store,
  precos: Tag,
}

const TabSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  </div>
)

const Dashboard = () => {
  const isMobile = useIsMobile()
  // "Diagnóstico anual" abre em nova guia: com o posto do filtro quando há um só, senão a rede inteira.
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  // Pedaços de outros módulos na Central somem junto quando o módulo é ocultado.
  const financeiroVisivel = useVisivel().modulo('/financeiro')
  const diagnosticoHref = `/diagnostico?empresa=${empresaCodigos.length === 1 ? empresaCodigos[0] : 'rede'}`

  // Layout das abas (engrenagem no HeaderTray permite reordenar/ocultar) —
  // fonte única compartilhada com a tela de Personalização (Configurações).
  const { tabs: knownTabs } = useModuleTabSettings('/dashboard')
  const visibleTabs = knownTabs.filter((t) => t.visible)
  // Aba controlada pela URL (?tab=) — permite deep-link das sub-opções da sidebar.
  // 'setor' é o default (sem ?tab=).
  const [activeTab, setActiveTab] = useTabParam<TabId>(
    'setor',
    (v): v is TabId =>
      v === 'setor' || v === 'combustivel' || v === 'pista' || v === 'conveniencia' || v === 'precos',
  )
  // Modo de análise da Visão Geral (`?detalhe=1`): F5 e link compartilhado
  // abrem direto no Detalhamento; não toca em `?tab=` nem nos filtros.
  const [detalhe, setDetalhe] = useBoolParam('detalhe')
  // Set-state durante render quando a aba persistida foi escondida via engrenagem.
  if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === activeTab)) {
    setActiveTab(visibleTabs[0].id as TabId)
  }

  // Ao trocar de aba, a aba anterior desmonta e suas queries ficam SEM
  // observador (inactive). Se ainda estavam buscando (ex.: Combustível live),
  // continuariam rodando em segundo plano: "sujam" o indicador global de
  // "Atualizando…" na aba nova e desperdiçam chamadas na Quality (pioram o
  // rate-limit). Cancelar as inactive resolve os dois — as ativas da aba atual
  // (com observador) não são tocadas.
  const queryClient = useQueryClient()
  useEffect(() => {
    queryClient.cancelQueries({ type: 'inactive' })
  }, [activeTab, queryClient])

  // Mobile: tela própria (KPIs + projeção + setores + ranking), no shell mobile.
  if (isMobile) return <CentralMobile />

  return (
    <div className="space-y-4">
      <>
          {/* Sem título de módulo no topo (removido em 24/11/2026, a pedido). */}
          {/* Abas continuam na TopBar (slot esquerdo padrão). */}
          {visibleTabs.length > 0 && (
            <PageHeaderTitle>
              <ModuloAbas
                active={activeTab}
                onChange={(id) => setActiveTab(id as TabId)}
                tabs={visibleTabs.map((t) => ({
                  id: t.id,
                  label: t.label,
                  Icon: TAB_ICONS[t.id as TabId] ?? Activity,
                }))}
              />
            </PageHeaderTitle>
          )}
          <PageHeaderActions>
            <DateRangeToolbar />
          </PageHeaderActions>

          {/* Cards de segmento rede-wide (Combustível, Automotivos, Conveniência,
              Global, Projeção) — só na "Visão Geral". As abas ao vivo e as de
              vendas por-posto têm seus próprios painéis/projeções. */}
          {activeTab === 'setor' && (
            <div className="acetinado contents">
              {/* Ações desta tela (diagnóstico anual e PDF) ficam no conteúdo, à
                  direita, acima dos cartões — a barra do topo fica só com abas e
                  filtros, sem espremer nada em telas menores. */}
              {/* Atalho do diagnóstico na altura do título (não colado nos cartões). */}
              <SecaoTitulo titulo="Resultado do período" subtitulo="Lucro bruto por setor e a projeção de fechamento do mês" className="items-center pb-1">
                <a
                  href={diagnosticoHref}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Diagnóstico anual: este ano comparado ao anterior, abre em nova guia"
                  className="group inline-flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white py-1.5 pl-1.5 pr-3 transition-colors hover:border-gray-300 hover:bg-gray-50 dark:border-[#2f3b4f] dark:bg-[#1e293b] dark:hover:border-[#3e4c63] dark:hover:bg-[#223049]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-500/[0.12] dark:text-[#8cc7bf]">
                    <Stethoscope className="h-4 w-4" />
                  </span>
                  <span className="flex flex-col text-left leading-tight">
                    <span className="text-[13px] font-semibold text-gray-900 dark:text-[#e2e8f0]">Diagnóstico anual</span>
                    <span className="text-[11px] text-gray-500 dark:text-[#94a3b8]">este ano × o anterior</span>
                  </span>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 dark:text-[#64748b]" />
                </a>
              </SecaoTitulo>
              <ProjecoesPainel />
            </div>
          )}

          {/* Conteúdo da aba ativa (abas no header, padrão TopBarTabs). Todas as
              abas de vendas são consolidadas (cache) → renderizam rede-wide. */}
          {visibleTabs.length > 0 && (
            <Suspense fallback={<TabSkeleton />}>
              {activeTab === 'setor' && (
                <div className="acetinado space-y-4" style={{ animation: 'chartIn .35s cubic-bezier(.4,0,.2,1) both' }}>
                  {/* MODO EXECUTIVO (default): KPIs → gráficos → Detalhamento fechado.
                      MODO ANÁLISE (?detalhe=1): KPIs → Detalhamento expandido; os
                      gráficos ficam MONTADOS e só recolhem (sem refetch/flicker). */}
                  <CollapseTransition open={!detalhe}>
                    <div className="space-y-4">
                      <SecaoTitulo titulo="Vendas e lucro" subtitulo="Evolução, participação de cada setor e ranking dos postos" />
                      <RealizadoChave label="Realizado · Período selecionado" className="-mb-2" />
                      <VisaoGeralGraficos />
                      <SecaoTitulo titulo="Estoque de combustível" subtitulo="Nível dos tanques de cada posto" />
                      {/* Tanques da rede: nível de cada tanque por posto (abaixo dos gráficos). */}
                      <RealizadoChave label="Agora · nível atual dos tanques" className="-mb-2" />
                      <TanquesRedeCard />
                      {/* Contas a pagar × a receber da rede (abaixo dos tanques). */}
                      {financeiroVisivel && (<>
                      <SecaoTitulo titulo="Financeiro" subtitulo="Contas a pagar e a receber da rede" />
                      {/* Cada bloco (saldo, a pagar, a receber) traz a própria chave "Hoje". */}
                      <ContasRedeCard />
                      </>)}
                    </div>
                  </CollapseTransition>
                  <SecaoTitulo titulo="Posto a posto" subtitulo="Vendas de cada setor detalhadas por posto, grupo e produto" />
                  <RealizadoChave label="Realizado · Período selecionado" className="-mb-2" />
                  <BenchmarkSetor expanded={detalhe} onToggle={() => setDetalhe(!detalhe)} />
                </div>
              )}
              {activeTab === 'combustivel' && <Combustivel embedded />}
              {activeTab === 'pista' && <Pista embedded />}
              {activeTab === 'conveniencia' && <Conveniencia embedded />}
              {activeTab === 'precos' && <GestaoPrecos />}
            </Suspense>
          )}
        </>
    </div>
  )
}

export default Dashboard

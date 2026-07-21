import { lazy, Suspense, useMemo, useState } from 'react'
import { Receipt, CreditCard, Settings, LayoutDashboard, Sparkles } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import ModuleSettings from '@/components/layout/ModuleSettings'
import HeaderTray from '@/components/layout/HeaderTray'
import TopBarTabs from '@/components/layout/TopBarTabs'
import useTabParam from '@/hooks/useTabParam'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import { useFinanceiroLayout } from '@/store/moduleLayout'
import TitulosEmAtraso from '@/pages/Financeiro/components/TitulosEmAtraso'
import CartoesEModo from '@/pages/Financeiro/components/CartoesEModo'
import SaldoAbertoCards from '@/pages/Financeiro/components/SaldoAbertoCards'
import AgingVencidos from '@/pages/Financeiro/components/AgingVencidos'
import ProximosVencimentos from '@/pages/Financeiro/components/ProximosVencimentos'
import PeriodFilterLocal, { type LocalPeriod } from '@/pages/Financeiro/components/PeriodFilterLocal'
// Conteúdo das abas em chunks separados (recharts só baixa quando a aba abre).
const DashboardMensal = lazy(() => import('@/pages/Financeiro/components/DashboardMensal'))
const ReceivablesIntel = lazy(() => import('@/pages/Financeiro/components/ReceivablesIntel'))
const PayablesIntel = lazy(() => import('@/pages/Financeiro/components/PayablesIntel'))
// Módulo Cartões (conciliação) embutido como aba do Financeiro.
const CartoesModule = lazy(() => import('@/pages/Cartoes'))
import useFinanceData from '@/pages/Financeiro/hooks/useFinanceData'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import useIsMobile from '@/hooks/useIsMobile'
import FinanceiroMobile from '@/pages/Financeiro/FinanceiroMobile'

const TAB_ICONS: Record<string, typeof Receipt> = {
  dashboard: LayoutDashboard,
  inteligencia: Sparkles,
  receber: Receipt,
  pagar: CreditCard,
  cartoes: CreditCard,
}

const TableSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  </div>
)

const Financeiro = () => {
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useFinanceiroLayout()
  const visibleTabs = layoutTabs.filter((t) => t.visible)
  // Aba controlada pela URL (?tab=) pro flyout/deep link. `activeTab` é derivado:
  // se a aba do ?tab= estiver escondida via engrenagem, cai na primeira visível.
  const [tabParam, setActiveTab] = useTabParam<string>(
    'visao',
    (v): v is string => v != null && layoutTabs.some((t) => t.id === v),
  )
  const activeTab = visibleTabs.some((t) => t.id === tabParam) ? tabParam : (visibleTabs[0]?.id ?? tabParam)

  // Filtro de período LOCAL (Visão Geral / Receber / Pagar). Default = snapshot
  // completo do que está em aberto ("Todo o período"), já que são pendências.
  const hojeISO = new Date().toISOString().split('T')[0]
  const inicioAnoISO = `${hojeISO.slice(0, 4)}-01-01`
  const [localPeriod, setLocalPeriod] = useState<LocalPeriod>({
    allPeriod: true,
    dataInicial: inicioAnoISO,
    dataFinal: hojeISO,
  })

  const {
    kpis,
    receivablesAtraso,
    payablesAtraso,
    duplicatasAberto,
    cardNotasNaoFaturadas,
    cardDuplicatasAberto,
    cardPagarAberto,
    cartoesAppsAVencer,
    cartoesReceberBruto,
    cartoesReceberLiquido,
    cartoesReceberCount,
    carteiraDigitalItems,
    modoRecebimento,
    pmr,
    pmp,
    receivablesPagos,
    saldoEmCaixa,
    isLoading,
  } = useFinanceData(localPeriod)

  // Posição líquida (hero) — a receber em aberto (títulos + duplicatas) − a pagar.
  const posicao = useMemo(() => {
    const aReceber = receivablesAtraso.reduce((s, r) => s + r.valor, 0)
      + duplicatasAberto.reduce((s, d) => s + d.saldoRestante, 0)
    const aReceberVencido = receivablesAtraso.reduce((s, r) => (r.statusTag === 'vencido' ? s + r.valor : s), 0)
      + duplicatasAberto.reduce((s, d) => (d.statusTag === 'vencido' ? s + d.saldoRestante : s), 0)
    const aPagar = cardPagarAberto.total
    return {
      posicao: aReceber - aPagar,
      aReceber,
      aPagar,
      vencidoTotal: aReceberVencido + cardPagarAberto.vencidoTotal,
    }
  }, [receivablesAtraso, duplicatasAberto, cardPagarAberto])
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)
  const isMobile = useIsMobile()

  // Mobile: tela própria (Visão Geral / Receber / Pagar / Fluxo).
  if (isMobile) return <FinanceiroMobile />

  return (
    <div className="space-y-6">
      {visibleTabs.length > 0 && (
        <PageHeaderTitle>
          <TopBarTabs
            active={activeTab}
            onChange={setActiveTab}
            tabs={visibleTabs.map((t) => {
                const overdue = t.id === 'receber'
                  ? (kpis?.countVencidosReceber ?? 0)
                  : t.id === 'pagar'
                    ? (kpis?.countVencidosPagar ?? 0)
                    : 0
                const badgeTitle = t.id === 'receber'
                  ? `${overdue} ${overdue === 1 ? 'título a receber vencido' : 'títulos a receber vencidos'}`
                  : `${overdue} ${overdue === 1 ? 'conta a pagar vencida' : 'contas a pagar vencidas'}`
                return {
                  id: t.id,
                  label: t.label,
                  Icon: TAB_ICONS[t.id] ?? Receipt,
                  badge: overdue > 0 && activeTab !== t.id ? (
                    <span
                      title={badgeTitle}
                      aria-label={badgeTitle}
                      className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-100 px-1 text-[9px] font-bold text-red-600 dark:bg-red-900/50 dark:text-red-400"
                    >
                      {overdue}
                    </span>
                  ) : undefined,
                }
              })}
            />
        </PageHeaderTitle>
      )}
      <HeaderTray>
        <ModuleSettings title="Financeiro" tabs={layoutTabs} toggleVisibility={toggleVisibility} moveUp={moveUp} moveDown={moveDown} reset={reset} />
      </HeaderTray>
      {/* Conteúdo — consolidado rede-wide (respeita o filtro de posto). */}
      {(
        <>
          {visibleTabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
              <Settings className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma aba visível. Use o botão ⚙️ para personalizar.</p>
            </div>
          ) : (
            <>
              {/* Content (abas na TopBar) */}
              {showSkeleton ? (
                <TableSkeleton />
              ) : (
                <Suspense fallback={<TableSkeleton />}>
                  {activeTab === 'dashboard' && <DashboardMensal />}
                  {activeTab === 'inteligencia' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Saldo em aberto</h2>
                        <PeriodFilterLocal value={localPeriod} onChange={setLocalPeriod} />
                      </div>
                      <SaldoAbertoCards
                        posicao={posicao}
                        notasNaoFaturadas={cardNotasNaoFaturadas}
                        duplicatasAberto={cardDuplicatasAberto}
                        pagarAberto={cardPagarAberto}
                      />
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.5fr_1fr]">
                        <AgingVencidos receivables={receivablesAtraso} payables={payablesAtraso} duplicatas={duplicatasAberto} />
                        <ProximosVencimentos receivables={receivablesAtraso} payables={payablesAtraso} duplicatas={duplicatasAberto} />
                      </div>
                      <TitulosEmAtraso receivablesData={receivablesAtraso} payablesData={payablesAtraso} />
                      <CartoesEModo
                        cartoesAppsAVencer={cartoesAppsAVencer}
                        cartoesReceberBruto={cartoesReceberBruto}
                        cartoesReceberLiquido={cartoesReceberLiquido}
                        cartoesReceberCount={cartoesReceberCount}
                        carteiraDigitalItems={carteiraDigitalItems}
                        modoRecebimento={modoRecebimento}
                        pmr={pmr}
                        pmp={pmp}
                      />
                    </div>
                  )}
                  {activeTab === 'receber' && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <PeriodFilterLocal value={localPeriod} onChange={setLocalPeriod} />
                      </div>
                      <ReceivablesIntel
                        data={receivablesAtraso}
                        duplicatas={duplicatasAberto}
                        pagos={receivablesPagos}
                        pmr={pmr}
                      />
                    </div>
                  )}
                  {activeTab === 'pagar' && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <PeriodFilterLocal value={localPeriod} onChange={setLocalPeriod} />
                      </div>
                      <PayablesIntel data={payablesAtraso} saldoEmCaixa={saldoEmCaixa} />
                    </div>
                  )}
                  {activeTab === 'cartoes' && (
                    <CartoesModule embedded />
                  )}
                </Suspense>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Financeiro

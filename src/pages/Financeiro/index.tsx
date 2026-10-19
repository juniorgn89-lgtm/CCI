import { lazy, Suspense, useMemo, useState } from 'react'
import { Receipt, CreditCard, Settings, LayoutDashboard, ClipboardCheck } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import ModuleSettings from '@/components/layout/ModuleSettings'
import HeaderTray from '@/components/layout/HeaderTray'
import TopBarTabs from '@/components/layout/TopBarTabs'
import useTabParam from '@/hooks/useTabParam'
import { useSearchParams } from 'react-router-dom'
import { lerFiltroLink, PARAMS_FILTRO_LINK } from '@/pages/Financeiro/lib/filtroLink'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import { useModuleTabSettings } from '@/hooks/usePersonalizedTabs'
import ContasRedeCard from '@/pages/Dashboard/components/ContasRedeCard'
import ReceberTabela from '@/pages/Financeiro/components/ReceberTabela'
import PagarTabela from '@/pages/Financeiro/components/PagarTabela'
import ReceberCalendario from '@/pages/Financeiro/components/ReceberCalendario'
import PagarCalendario from '@/pages/Financeiro/components/PagarCalendario'
import CollapseTransition from '@/components/ui/CollapseTransition'
import PeriodFilterLocal, { type LocalPeriod } from '@/pages/Financeiro/components/PeriodFilterLocal'
// Conteúdo das abas em chunks separados (recharts só baixa quando a aba abre).
const ReceivablesIntel = lazy(() => import('@/pages/Financeiro/components/ReceivablesIntel'))
const PayablesIntel = lazy(() => import('@/pages/Financeiro/components/PayablesIntel'))
// Módulo Cartões (conciliação) embutido como aba do Financeiro.
// Aba Fechamento — copiloto por exceção + seletor de posto LOCAL (não usa o
// filtro global, pra não vazar o posto pras outras abas/módulos).
const FechamentoTab = lazy(() => import('@/pages/Financeiro/components/FechamentoTab'))
import useFinanceData from '@/pages/Financeiro/hooks/useFinanceData'
import useDuplicatasReceber from '@/pages/Financeiro/hooks/useDuplicatasReceber'
import useScopedEmpresaCodes from '@/pages/Financeiro/hooks/useScopedEmpresaCodes'
import { buildReceberRows, buildPagarRows, scopeDuplicatas } from '@/pages/Financeiro/lib/instrumentos'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import useIsMobile from '@/hooks/useIsMobile'
import FinanceiroMobile from '@/pages/Financeiro/FinanceiroMobile'

// adminTipo só rotula app vs cartão — não muda a CONTAGEM de vencidos; mapa vazio cai no
// fallback pela descrição da administradora e basta pro badge.
const NO_ADMIN = new Map<string, string>()

const TAB_ICONS: Record<string, typeof Receipt> = {
  dashboard: LayoutDashboard,
  receber: Receipt,
  pagar: CreditCard,
  fechamento: ClipboardCheck,
}

const TableSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  </div>
)

const Financeiro = () => {
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useModuleTabSettings('/financeiro')
  const visibleTabs = layoutTabs.filter((t) => t.visible)
  // Aba controlada pela URL (?tab=) pro flyout/deep link. `activeTab` é derivado:
  // se a aba do ?tab= estiver escondida via engrenagem, cai na primeira visível.
  const [tabParam, setActiveTab] = useTabParam<string>(
    'visao',
    (v): v is string => v != null && layoutTabs.some((t) => t.id === v),
    PARAMS_FILTRO_LINK,
  )
  const activeTab = visibleTabs.some((t) => t.id === tabParam) ? tabParam : (visibleTabs[0]?.id ?? tabParam)

  // Filtro de período LOCAL (Visão Geral / Receber / Pagar). Default = snapshot
  // completo do que está em aberto ("Todo o período"), já que são pendências.
  const hojeISO = new Date().toISOString().split('T')[0]
  const inicioAnoISO = `${hojeISO.slice(0, 4)}-01-01`
  // "Ver detalhamento" das abas Receber/Pagar: aberto → o calendário recolhe (como os gráficos da Central).
  // Veio do modal de contas com filtro na URL → já abre o detalhamento (a lista filtrada).
  const [searchParams] = useSearchParams()
  // A tela já pode estar montada (o modal fica no Dashboard daqui) → reage à troca do filtro.
  const filtroKey = lerFiltroLink(searchParams) != null ? `${tabParam}|${searchParams.toString()}` : ''
  const [detalheReceber, setDetalheReceber] = useState(() => !!filtroKey && tabParam === 'receber')
  const [detalhePagar, setDetalhePagar] = useState(() => !!filtroKey && tabParam === 'pagar')
  const [filtroKeyVisto, setFiltroKeyVisto] = useState(filtroKey)
  if (filtroKey !== filtroKeyVisto) {
    setFiltroKeyVisto(filtroKey)
    if (filtroKey && tabParam === 'receber') setDetalheReceber(true)
    if (filtroKey && tabParam === 'pagar') setDetalhePagar(true)
  }
  const [localPeriod, setLocalPeriod] = useState<LocalPeriod>({
    allPeriod: true,
    dataInicial: inicioAnoISO,
    dataFinal: hojeISO,
  })

  const {
    kpis,
    receivablesAtraso,
    payablesAtraso,
    cartoesAVencer,
    pmr,
    receivablesPagos,
    saldoEmCaixa,
    isLoading,
  } = useFinanceData(localPeriod)

  // Badge das abas = MESMA base do que a aba LISTA (snapshot de pendentes), NÃO o
  // período-scoped do `kpis` — senão o número não bate com o que o usuário vê. Conta
  // TODOS os recebíveis vencidos que a aba Receber mostra: notas + faturas de duplicata
  // + outros + cartões + apps (o toggle "com cartões e app" vem ligado). A pagar = idem.
  const duplicatas = useDuplicatasReceber()
  const scopedCodes = useScopedEmpresaCodes()
  const overdueCounts = useMemo(() => {
    const dups = scopeDuplicatas(duplicatas, scopedCodes, localPeriod)
    const receber = buildReceberRows(receivablesAtraso, cartoesAVencer, NO_ADMIN, dups).filter((r) => r.vencido).length
    const pagar = buildPagarRows(payablesAtraso).filter((r) => r.vencido).length
    return { receber, pagar }
  }, [receivablesAtraso, payablesAtraso, cartoesAVencer, duplicatas, scopedCodes, localPeriod])

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
                  ? overdueCounts.receber
                  : t.id === 'pagar'
                    ? overdueCounts.pagar
                    : 0
                const badgeTitle = t.id === 'receber'
                  ? `${overdue} ${overdue === 1 ? 'recebível vencido' : 'recebíveis vencidos'}`
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
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
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
                  {activeTab === 'dashboard' && (
                    <div className="space-y-4">
                      {/* Saldo da janela + Contas a pagar + Contas a receber (mesmos cards da
                          Central). Os cards de posição por instrumento saíram: diziam o mesmo
                          em outro corte e confundiam. */}
                      <ContasRedeCard />
                    </div>
                  )}
                  {activeTab === 'receber' && (
                    <div className="space-y-3">
                      <ReceivablesIntel
                        data={receivablesAtraso}
                        pagos={receivablesPagos}
                        pmr={pmr}
                      />
                      <CollapseTransition open={!detalheReceber}>
                        <ReceberCalendario data={receivablesAtraso} />
                      </CollapseTransition>
                      <ReceberTabela
                        detalheAberto={detalheReceber}
                        onToggleDetalhe={() => setDetalheReceber((v) => !v)}
                        titulos={receivablesAtraso}
                        cartoes={cartoesAVencer}
                        periodoLocal={localPeriod}
                        dateFilter={<PeriodFilterLocal value={localPeriod} onChange={setLocalPeriod} />}
                      />
                    </div>
                  )}
                  {activeTab === 'pagar' && (
                    <div className="space-y-3">
                      <PayablesIntel data={payablesAtraso} saldoEmCaixa={saldoEmCaixa} />
                      <CollapseTransition open={!detalhePagar}>
                        <PagarCalendario data={payablesAtraso} />
                      </CollapseTransition>
                      <PagarTabela
                        detalheAberto={detalhePagar}
                        onToggleDetalhe={() => setDetalhePagar((v) => !v)}
                        payables={payablesAtraso}
                        periodoLocal={localPeriod}
                        dateFilter={<PeriodFilterLocal value={localPeriod} onChange={setLocalPeriod} />}
                      />
                    </div>
                  )}
                  {activeTab === 'fechamento' && <FechamentoTab />}
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

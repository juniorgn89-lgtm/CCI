import { useState } from 'react'
import { Warehouse, Package, RefreshCw, TrendingUp, ShoppingCart, Settings, LayoutDashboard, CalendarRange } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import ModuleSettings from '@/components/layout/ModuleSettings'
import HeaderTray from '@/components/layout/HeaderTray'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import TopBarTabs from '@/components/layout/TopBarTabs'
import useTabParam from '@/hooks/useTabParam'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import { useEstoquesLayout } from '@/store/moduleLayout'
import EstoqueVisaoGeral from '@/pages/Estoques/components/abas/EstoqueVisaoGeral'
import EstoqueGeral from '@/pages/Estoques/components/abas/EstoqueGeral'
import GiroProdutos from '@/pages/Estoques/components/abas/GiroProdutos'
import MediaVendas from '@/pages/Estoques/components/abas/MediaVendas'
import NecessidadeEstoque from '@/pages/Estoques/components/abas/NecessidadeEstoque'
import useEstoqueAnalytics from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import useIsMobile from '@/hooks/useIsMobile'
import EstoqueMobile from '@/pages/Estoques/EstoqueMobile'

const TAB_ICONS: Record<string, typeof Warehouse> = {
  visao: LayoutDashboard,
  geral: Package,
  giro: RefreshCw,
  mediaVendas: TrendingUp,
  necessidade: ShoppingCart,
}

/** Intervalo de datas coberto pela janela móvel (hoje − (N−1) dias … hoje). */
const fmtJanelaPeriodo = (janelaDias: number): string => {
  const fim = new Date()
  const ini = new Date()
  ini.setDate(ini.getDate() - (janelaDias - 1))
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  return `${fmt(ini)} a ${fmt(fim)}`
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

/** Seletor de janela móvel (30/60/90 dias) — pills no estilo do design system. */
const JanelaSelect = ({
  value,
  onChange,
}: {
  value: 30 | 60 | 90
  onChange: (v: 30 | 60 | 90) => void
}) => (
  <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
    {([30, 60, 90] as const).map((opt) => (
      <button
        key={opt}
        type="button"
        onClick={() => onChange(opt)}
        aria-pressed={value === opt}
        className={cn(
          'h-7 whitespace-nowrap rounded-md px-3 text-xs font-medium transition-all',
          value === opt
            ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-gray-900 dark:text-gray-100'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
        )}
      >
        {opt} dias
      </button>
    ))}
  </div>
)

const Estoques = () => {
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useEstoquesLayout()
  const visibleTabs = layoutTabs.filter((t) => t.visible)
  // Aba controlada pela URL (?tab=) pro flyout/deep link. `activeTab` é derivado:
  // se a aba do ?tab= estiver escondida via engrenagem, cai na primeira visível
  // (sem mutar estado/URL no render).
  const [tabParam, setActiveTab] = useTabParam<string>(
    'visao',
    (v): v is string => v != null && layoutTabs.some((t) => t.id === v),
  )
  const activeTab = visibleTabs.some((t) => t.id === tabParam) ? tabParam : (visibleTabs[0]?.id ?? tabParam)
  const [coberturaDias, setCoberturaDias] = useState(30)
  // Janela móvel (30/60/90 dias) que controla as métricas de volume: giro,
  // estoque médio, média de venda e a necessidade de reabastecimento derivada.
  const [janelaDias, setJanelaDias] = useState<30 | 60 | 90>(30)

  const { productAnalytics, categorias, estoqueValorMensal, isLoading, hasEmpresa } = useEstoqueAnalytics(coberturaDias, janelaDias)

  // Abas cuja métrica depende da janela e mostram o seletor NO PARENT. A Visão
  // Geral tem o seletor na própria barra de controles → fica fora desta lista.
  const showJanelaSelector = ['giro', 'mediaVendas', 'necessidade'].includes(activeTab)
  // Esqueleto SEMPRE que estiver carregando sem dados (não só na 1ª vez) — evita
  // mostrar cards zerados durante o (re)carregamento do estoque.
  const showSkeleton = isLoading && productAnalytics.length === 0
  const isMobile = useIsMobile()

  // Mobile: tela própria (Reposição / Estoque / Giro).
  if (isMobile) return <EstoqueMobile />

  return (
    <div className="space-y-6">
      <PageHeaderTitle placement="header">
        <div className="flex items-center gap-2.5">
          <span className="h-7 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
          <Warehouse className="h-5 w-5 shrink-0 text-[#1e3a5f] dark:text-gray-300" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">Estoques</h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Saldo atual e giro de produtos
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      {hasEmpresa && visibleTabs.length > 0 && (
        <PageHeaderTitle>
          <TopBarTabs
            tabs={visibleTabs.map((t) => ({ id: t.id, label: t.label, Icon: TAB_ICONS[t.id] ?? Warehouse }))}
            active={activeTab}
            onChange={setActiveTab}
          />
        </PageHeaderTitle>
      )}
      <HeaderTray>
        <ModuleSettings title="Estoques" tabs={layoutTabs} toggleVisibility={toggleVisibility} moveUp={moveUp} moveDown={moveDown} reset={reset} />
      </HeaderTray>
      {/* Sem filtro de período: o estoque é sempre o saldo ATUAL (igual ao
          webPosto, cujo "Qtd" não muda com a data). Histórico fixo de 6m é
          interno. Sem DateRangeToolbar aqui → a barra de período não aparece. */}

      {!hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        <>
          {/* Tabs */}
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
                <>
                  {showJanelaSelector && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
                        <CalendarRange className="h-3.5 w-3.5" />
                        Janela de cálculo
                      </span>
                      <JanelaSelect value={janelaDias} onChange={setJanelaDias} />
                      <span className="text-[11px] tabular-nums text-gray-400/80 dark:text-gray-500/80">
                        {fmtJanelaPeriodo(janelaDias)}
                      </span>
                    </div>
                  )}
                  {activeTab === 'visao' && (
                    <EstoqueVisaoGeral
                      data={productAnalytics}
                      categorias={categorias}
                      valorMensal={estoqueValorMensal}
                      janelaDias={janelaDias}
                      onJanelaChange={setJanelaDias}
                      onNavigateTab={setActiveTab}
                    />
                  )}
                  {activeTab === 'geral' && <EstoqueGeral data={productAnalytics} categorias={categorias} />}
                  {activeTab === 'giro' && <GiroProdutos data={productAnalytics} categorias={categorias} janelaDias={janelaDias} />}
                  {activeTab === 'mediaVendas' && <MediaVendas data={productAnalytics} categorias={categorias} janelaDias={janelaDias} />}
                  {activeTab === 'necessidade' && (
                    <NecessidadeEstoque
                      data={productAnalytics}
                      categorias={categorias}
                      coberturaDias={coberturaDias}
                      janelaDias={janelaDias}
                      onCoberturaChange={setCoberturaDias}
                    />
                  )}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default Estoques

import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import useTabParam from '@/hooks/useTabParam'
import { BarChart3, Fuel, ShoppingBag, LayoutGrid } from 'lucide-react'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import TopBarTabs from '@/components/layout/TopBarTabs'
import HeaderTray from '@/components/layout/HeaderTray'
import ModuleSettings from '@/components/layout/ModuleSettings'
import { useProdutividadeLayout } from '@/store/moduleLayout'
import { useFilterStore } from '@/store/filters'
import { subTabs, type SubTab } from '@/pages/Operacao/components/produtividade/subTabs'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import type { AbastecimentoRow } from '@/pages/Operacao/hooks/useOperacaoData'
import useIsMobile from '@/hooks/useIsMobile'
import ProdutividadeMobile from '@/pages/Produtividade/ProdutividadeMobile'
import VendedoresConveniencia from '@/pages/Produtividade/components/VendedoresConveniencia'
import ProdutividadeTodos from '@/pages/Produtividade/components/ProdutividadeTodos'
import { cn } from '@/lib/utils'

const ProdutividadeTab = lazy(() => import('@/pages/Operacao/components/ProdutividadeTab'))

const TabFallback = () => (
  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
  </div>
)

/** Abast/hora ativa — mede utilização durante o expediente real do posto. */
const ritmoPorHoraAtiva = (rows: AbastecimentoRow[]): number => {
  if (rows.length === 0) return 0
  const horasAtivas = new Set<number>()
  for (const a of rows) {
    const h = parseInt(a.dataHora?.substring(11, 13) || '', 10)
    if (!isNaN(h)) horasAtivas.add(h)
  }
  if (horasAtivas.size === 0) return 0
  return rows.length / horasAtivas.size
}

/**
 * Página Produtividade — só header + DateRangeToolbar. KPIs e listas vivem
 * dentro do ProdutividadeTab, que tem suas próprias sub-tabs (Visão Geral,
 * Projeções, Metas, Destaques) seguindo o padrão Header → Tabs → Content.
 */
const Produtividade = () => {
  const {
    kpis,
    frentistaRows,
    frentistaRowsPrev,
    abastecimentoRows,
    abastecimentoRowsPrev,
    isLoading,
    hasEmpresa,
  } = useOperacaoData()
  const showSkeleton = useShowSkeleton(isLoading, !!kpis)
  const isMobile = useIsMobile()
  const [prodTab, setProdTab] = useTabParam<SubTab>(
    'visao',
    (v): v is SubTab => v === 'visao' || v === 'projecoes' || v === 'metas' || v === 'destaques',
  )
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useProdutividadeLayout()
  const subTabByKey = useMemo(() => new Map(subTabs.map((t) => [t.key, t])), [])
  const visibleTabs = layoutTabs.filter((t) => t.visible)
  // Se a aba ativa foi ocultada, cai pra primeira visível.
  if (visibleTabs.length > 0 && !visibleTabs.some((t) => t.id === prodTab)) {
    setProdTab(visibleTabs[0].id as SubTab)
  }
  // Alternador: Todos (visão global) · Frentistas (combustível) · Vendedores (conveniência).
  const [modo, setModo] = useState<'todos' | 'frentistas' | 'vendedores'>('frentistas')
  // Produtividade do frentista usa SEMPRE a data de abastecimento como base
  // (sem o seletor Abast./Fiscal/Movimento). Fixa o modo ao montar a tela.
  const abastDateMode = useFilterStore((s) => s.abastDateMode)
  const setAbastDateMode = useFilterStore((s) => s.setAbastDateMode)
  useEffect(() => {
    if (abastDateMode !== 'ABAST') setAbastDateMode('ABAST')
  }, [abastDateMode, setAbastDateMode])

  // Linhas com custo por abastecimento (lucro bruto), do useAbastecimentosAnalytics
  // (LMC/cache). Alimentam o Lucro bruto por dia da tabela; "—" até o custo chegar.
  const { rows: abastComCusto, descAcrByFrentista } = useAbastecimentosAnalytics()

  const ritmo = useMemo(() => ritmoPorHoraAtiva(abastecimentoRows), [abastecimentoRows])
  const ritmoPrev = useMemo(() => ritmoPorHoraAtiva(abastecimentoRowsPrev), [abastecimentoRowsPrev])

  const topFrentista = useMemo(() => {
    const ativos = frentistaRows.filter((f) => f.ativo && f.litrosVendidos > 0)
    return ativos.sort((a, b) => b.litrosVendidos - a.litrosVendidos)[0] ?? null
  }, [frentistaRows])

  const topKpis = useMemo(
    () => kpis
      ? {
          frentistasAtivos: kpis.frentistasAtivos,
          totalAbastecimentos: kpis.totalAbastecimentos,
          prevTotalAbastecimentos: kpis.prevTotalAbastecimentos,
          ritmo,
          ritmoPrev,
          topFrentistaNome: topFrentista?.nome ?? null,
          topFrentistaLitros: topFrentista?.litrosVendidos ?? 0,
        }
      : undefined,
    [kpis, ritmo, ritmoPrev, topFrentista],
  )

  // Mobile: tela própria (KPIs + ranking de frentistas).
  if (isMobile) return <ProdutividadeMobile />

  return (
    <div className="space-y-6">
      <PageHeaderTitle placement="header">
        <div className="flex items-center gap-2.5">
          <span className="h-7 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
          <BarChart3 className="h-5 w-5 shrink-0 text-[#1e3a5f] dark:text-gray-300" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">Produtividade</h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Desempenho de frentistas e vendedores
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      {hasEmpresa && visibleTabs.length > 0 && (
        <PageHeaderTitle>
          <TopBarTabs
            active={modo !== 'frentistas' ? 'visao' : prodTab}
            onChange={(id) => { if (modo === 'frentistas') setProdTab(id as SubTab) }}
            tabs={visibleTabs.map((t) => ({
              id: t.id,
              label: t.label,
              Icon: subTabByKey.get(t.id as SubTab)?.icon ?? BarChart3,
              // Só no modo Frentistas as sub-abas se aplicam; em Todos/Vendedores
              // ficam visíveis porém desabilitadas (sem projeção/meta de loja).
              disabled: modo !== 'frentistas' && t.id !== 'visao',
            }))}
          />
        </PageHeaderTitle>
      )}
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>
      {hasEmpresa && modo === 'frentistas' && (
        <HeaderTray>
          <ModuleSettings
            title="Produtividade"
            tabs={layoutTabs}
            toggleVisibility={toggleVisibility}
            moveUp={moveUp}
            moveDown={moveDown}
            reset={reset}
          />
        </HeaderTray>
      )}

      {!hasEmpresa && <SelectCompanyState />}

      {/* Alternador Frentistas (combustível) × Vendedores (conveniência) —
          centralizado abaixo do cabeçalho. */}
      {hasEmpresa && (
        <div className="flex justify-center">
          <div className="flex items-center gap-0.5 rounded-md border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
            {([
              { id: 'todos', label: 'Todos', Icon: LayoutGrid },
              { id: 'frentistas', label: 'Frentistas', Icon: Fuel },
              { id: 'vendedores', label: 'Vendedores', Icon: ShoppingBag },
            ] as const).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModo(m.id)}
                className={cn(
                  'flex h-7 items-center gap-1.5 whitespace-nowrap rounded px-4 text-xs font-medium transition-all',
                  modo === m.id
                    ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-gray-900 dark:text-gray-100'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                )}
              >
                <m.Icon className="h-3.5 w-3.5" />
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasEmpresa && modo === 'todos' && <ProdutividadeTodos />}

      {hasEmpresa && modo === 'vendedores' && <VendedoresConveniencia />}

      {hasEmpresa && modo === 'frentistas' && (
        showSkeleton ? (
          <TabFallback />
        ) : (
          <Suspense fallback={<TabFallback />}>
            <ProdutividadeTab
              frentistaRows={frentistaRows}
              frentistaRowsPrev={frentistaRowsPrev}
              abastecimentoRows={abastecimentoRows}
              abastecimentoRowsPrev={abastecimentoRowsPrev}
              abastComCusto={abastComCusto}
              descAcrByFrentista={descAcrByFrentista}
              isLoading={isLoading}
              topKpis={topKpis}
              active={prodTab}
            />
          </Suspense>
        )
      )}
    </div>
  )
}

export default Produtividade

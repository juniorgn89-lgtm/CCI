import { lazy, Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Warehouse, Package, ShoppingCart, Settings, LayoutDashboard, CalendarRange } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import ModuleSettings from '@/components/layout/ModuleSettings'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import HeaderTray from '@/components/layout/HeaderTray'
import TopBarTabs from '@/components/layout/TopBarTabs'
import useTabParam from '@/hooks/useTabParam'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import { useModuleTabSettings } from '@/hooks/usePersonalizedTabs'
import ProdutosEstoque from '@/pages/Estoques/components/abas/ProdutosEstoque'
import ComprarEstoque from '@/pages/Estoques/components/abas/ComprarEstoque'
import useEstoqueAnalytics from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import useSetorProduto from '@/pages/Estoques/hooks/useSetorProduto'
import type { AbrirProdutos } from '@/pages/Estoques/components/abas/EstoqueVisaoGeral'
import useIsMobile from '@/hooks/useIsMobile'
import EstoqueMobile from '@/pages/Estoques/EstoqueMobile'

const EstoqueVisaoGeral = lazy(() => import('@/pages/Estoques/components/abas/EstoqueVisaoGeral'))

const TAB_ICONS: Record<string, typeof Warehouse> = {
  visao: LayoutDashboard,
  produtos: Package,
  comprar: ShoppingCart,
}

/** Abas antigas (links/favoritos) → as novas: Estoque geral/Giro/Média viraram
 *  "Produtos"; Necessidade virou "Comprar". */
const ABA_ANTIGA: Record<string, string> = { geral: 'produtos', giro: 'produtos', mediaVendas: 'produtos', necessidade: 'comprar' }

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
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
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
  <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
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

/**
 * Página Estoques — três abas de UM posto (seletor em pílula): Visão Geral
 * (valor, risco, ruptura, Curva ABC, Giro × Margem, grupos — por setor),
 * Produtos (estoque e venda numa lista só) e Comprar (o que pedir). Os blocos
 * da Visão Geral abrem Produtos com o mesmo filtro.
 */
const Estoques = () => {
  const { tabs: layoutTabs, toggleVisibility, moveUp, moveDown, reset } = useModuleTabSettings('/estoques')
  const visibleTabs = layoutTabs.filter((t) => t.visible)
  // Aba controlada pela URL (?tab=) pro flyout/deep link. `activeTab` é derivado:
  // se a aba do ?tab= estiver escondida via engrenagem, cai na primeira visível
  // (sem mutar estado/URL no render).
  const [tabParamBruto, setActiveTab] = useTabParam<string>(
    'visao',
    (v): v is string => v != null && (layoutTabs.some((t) => t.id === v) || v in ABA_ANTIGA),
  )
  const tabParam = ABA_ANTIGA[tabParamBruto] ?? tabParamBruto
  const activeTab = visibleTabs.some((t) => t.id === tabParam) ? tabParam : (visibleTabs[0]?.id ?? tabParam)
  const [coberturaDias, setCoberturaDias] = useState(30)
  // Janela móvel (30/60/90 dias) que controla as métricas de volume: giro,
  // estoque médio, média de venda e a necessidade de reabastecimento derivada.
  const [janelaDias, setJanelaDias] = useState<30 | 60 | 90>(30)

  // Estoque é FÍSICO por posto: o módulo é gateado (moduleScope) e usa o posto
  // do seletor do cabeçalho. Sem exatamente um posto permitido → gate de escolha.
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas(), staleTime: 10 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const selectedCodigo = empresaCodigos.length === 1 && empresasPermitidas.some((e) => e.codigo === empresaCodigos[0])
    ? empresaCodigos[0]
    : null

  // Todas as abas são de UM posto (estoque é físico por posto).
  const { productAnalytics, categorias, isLoading: carregandoEstoque } = useEstoqueAnalytics(coberturaDias, janelaDias, selectedCodigo)
  const { setorDe, carregando: carregandoSetor } = useSetorProduto()
  const isLoading = carregandoEstoque || carregandoSetor
  // Bloco da Visão Geral → aba Produtos com o mesmo filtro (a key remonta a lista).
  const [filtroProdutos, setFiltroProdutos] = useState<{ f: AbrirProdutos; n: number } | null>(null)

  // Abas cuja métrica depende da janela e mostram o seletor NO PARENT.
  const showJanelaSelector = ['visao', 'produtos', 'comprar'].includes(activeTab)
  // Esqueleto SEMPRE que estiver carregando sem dados (não só na 1ª vez) — evita
  // mostrar cards zerados durante o (re)carregamento do estoque.
  // Esqueleto enquanto QUALQUER parte carrega: o saldo chega antes das vendas, e
  // mostrar a lista sem as vendas dava "Vendido 0 / Sem movimento: todos" (falso).
  const showSkeleton = isLoading
  const isMobile = useIsMobile()

  // Mobile: tela própria (Reposição / Estoque / Giro).
  if (isMobile) return <EstoqueMobile />
  // Sem posto disponível (nenhuma empresa permitida) → estado de seleção.
  if (selectedCodigo == null) return <SelectCompanyState />

  const abrirProdutos = (f: AbrirProdutos) => {
    setFiltroProdutos((v) => ({ f, n: (v?.n ?? 0) + 1 }))
    setActiveTab('produtos')
  }

  return (
    <div className="space-y-6">
      {visibleTabs.length > 0 && (
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


      {visibleTabs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
          <Settings className="mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Nenhuma aba visível. Use o botão ⚙️ para personalizar.</p>
        </div>
      ) : showSkeleton ? (
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
            <Suspense fallback={<TableSkeleton />}>
              <EstoqueVisaoGeral data={productAnalytics} setorDe={setorDe} coberturaDias={coberturaDias} janelaDias={janelaDias} onAbrirProdutos={abrirProdutos} />
            </Suspense>
          )}
          {activeTab === 'produtos' && <ProdutosEstoque key={filtroProdutos?.n ?? 0} data={productAnalytics} categorias={categorias} janelaDias={janelaDias} coberturaDias={coberturaDias} setorDe={setorDe} filtroInicial={filtroProdutos?.f} />}
          {activeTab === 'comprar' && (
            <ComprarEstoque
              data={productAnalytics}
              categorias={categorias}
              coberturaDias={coberturaDias}
              janelaDias={janelaDias}
              onCoberturaChange={setCoberturaDias}
              empresaCodigo={selectedCodigo}
            />
          )}
        </>
      )}
    </div>
  )
}

export default Estoques

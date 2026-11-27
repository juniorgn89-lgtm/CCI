import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Warehouse, Package, Settings } from 'lucide-react'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import ModuloAbas from '@/components/layout/ModuloAbas'
import useTabParam from '@/hooks/useTabParam'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import { useModuleTabSettings } from '@/hooks/usePersonalizedTabs'
import ProdutosEstoque from '@/pages/Estoques/components/abas/ProdutosEstoque'
import { JanelaCalculoBar, EstoqueTableSkeleton as TableSkeleton } from '@/pages/Estoques/components/JanelaCalculo'
import useEstoqueAnalytics from '@/pages/Estoques/hooks/useEstoqueAnalytics'
import useSetorProduto from '@/pages/Estoques/hooks/useSetorProduto'
import { SITUACOES, type AbrirProdutos } from '@/pages/Estoques/components/estoqueComum'
import type { SetorEstoque } from '@/pages/Estoques/hooks/useSetorProduto'
import useIsMobile from '@/hooks/useIsMobile'
import EstoqueMobile from '@/pages/Estoques/EstoqueMobile'

const TAB_ICONS: Record<string, typeof Warehouse> = {
  produtos: Package,
}

/** Abas antigas (links/favoritos) → as novas: Estoque geral/Giro/Média viraram
 *  "Produtos". Comprar (antes Necessidade) mudou para Compras › Análise de estoque. */
// A Visão de Estoques saiu (26/11/2026): Curva ABC, Giro × Margem e mais vendidos viraram situações da lista.
const ABA_ANTIGA: Record<string, string> = { geral: 'produtos', giro: 'produtos', mediaVendas: 'produtos', visao: 'produtos' }
const FOI_PARA_COMPRAS = new Set(['comprar', 'necessidade'])

/**
 * Página Estoques — três abas de UM posto (seletor em pílula): Visão Geral
 * (valor, risco, ruptura, Curva ABC, Giro × Margem, grupos — por setor),
 * Produtos (estoque e venda numa lista só). "Comprar" mudou para Compras › Análise de estoque para comprar. Os blocos
 * da Visão Geral abrem Produtos com o mesmo filtro.
 */
const Estoques = () => {
  const { tabs: layoutTabs } = useModuleTabSettings('/estoques')
  const visibleTabs = layoutTabs.filter((t) => t.visible)
  // Aba controlada pela URL (?tab=) pro flyout/deep link. `activeTab` é derivado:
  // se a aba do ?tab= estiver escondida via engrenagem, cai na primeira visível
  // (sem mutar estado/URL no render).
  const [tabParamBruto, setActiveTab] = useTabParam<string>(
    'produtos',
    (v): v is string => v != null && (layoutTabs.some((t) => t.id === v) || v in ABA_ANTIGA || FOI_PARA_COMPRAS.has(v)),
  )
  const tabParam = ABA_ANTIGA[tabParamBruto] ?? tabParamBruto
  const activeTab = visibleTabs.some((t) => t.id === tabParam) ? tabParam : (visibleTabs[0]?.id ?? tabParam)
  const [coberturaDias] = useState(30)
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
  // Link de outra tela (ex.: "Como fechar o mês ainda melhor?") → ?setor=&situacao= abre Produtos já filtrado.
  const [searchParams] = useSearchParams()
  const [filtroProdutos] = useState<{ f: AbrirProdutos; n: number } | null>(() => {
    const setor = searchParams.get('setor')
    const situacao = searchParams.get('situacao')
    const f: AbrirProdutos = {}
    if (setor === 'combustivel' || setor === 'automotivos' || setor === 'conveniencia') f.setor = setor as SetorEstoque
    if (situacao && SITUACOES.some((x) => x.v === situacao)) f.situacao = situacao as AbrirProdutos['situacao']
    return f.setor || f.situacao ? { f, n: 1 } : null
  })

  // Abas cuja métrica depende da janela e mostram o seletor NO PARENT.
  const showJanelaSelector = activeTab === 'produtos'
  // Esqueleto SEMPRE que estiver carregando sem dados (não só na 1ª vez) — evita
  // mostrar cards zerados durante o (re)carregamento do estoque.
  // Esqueleto enquanto QUALQUER parte carrega: o saldo chega antes das vendas, e
  // mostrar a lista sem as vendas dava "Vendido 0 / Sem movimento: todos" (falso).
  const showSkeleton = isLoading
  const isMobile = useIsMobile()

  // Link antigo da aba Comprar → Compras › Análise de estoque para comprar.
  if (FOI_PARA_COMPRAS.has(tabParamBruto)) return <Navigate to="/estoques?tab=produtos" replace />
  // Mobile: tela própria (Reposição / Estoque / Giro).
  if (isMobile) return <EstoqueMobile />
  // Sem posto disponível (nenhuma empresa permitida) → estado de seleção.
  if (selectedCodigo == null) return <SelectCompanyState />

  return (
    <div className="space-y-6">
      {/* Uma aba só (Produtos): sem a barra de abas. */}
      {visibleTabs.length > 1 && (
        <PageHeaderTitle>
          <ModuloAbas
            tabs={visibleTabs.map((t) => ({ id: t.id, label: t.label, Icon: TAB_ICONS[t.id] ?? Warehouse }))}
            active={activeTab}
            onChange={setActiveTab}
          />
        </PageHeaderTitle>
      )}
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
          {showJanelaSelector && <JanelaCalculoBar value={janelaDias} onChange={setJanelaDias} />}
          {activeTab === 'produtos' && <ProdutosEstoque key={filtroProdutos?.n ?? 0} data={productAnalytics} categorias={categorias} janelaDias={janelaDias} coberturaDias={coberturaDias} setorDe={setorDe} filtroInicial={filtroProdutos?.f} />}
        </>
      )}
    </div>
  )
}

export default Estoques

import { useMemo, useState } from 'react'
import { Wrench, Package, TrendingUp, TrendingDown, DollarSign, Layers, Search, HelpCircle, Trophy } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchProdutoEstoque } from '@/api/endpoints/estoques'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { Skeleton } from '@/components/ui/skeleton'
import BarCell from '@/components/tables/BarCell'
import CoberturaBadge, { diasEntreDatas } from '@/components/badges/CoberturaBadge'
import { cn } from '@/lib/utils'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import VendasNav from '@/pages/Comercial/Vendas/VendasNav'
import CategoriaDetalheModal, { type CategoriaData } from '@/pages/Comercial/Vendas/CategoriaDetalheModal'

/* ─── Helpers ─── */

const isPistaGroup = (nome: string): boolean => nome.startsWith('PS -')

/**
 * Categoriza um grupo PS- em uma "família" simplificada pro consultor:
 * filtros, lubrificantes, palhetas, aditivos, acessórios, baterias, serviços.
 */
const categoriaDoGrupo = (nome: string): string => {
  const u = nome.toUpperCase()
  if (u.includes('FILTRO')) return 'Filtros'
  if (u.includes('LUBRIFICANT')) return 'Lubrificantes'
  if (u.includes('PALHETA')) return 'Palhetas'
  if (u.includes('ADITIVO') || u.includes('FLUIDO')) return 'Aditivos / Fluidos'
  if (u.includes('ACESSORIO')) return 'Acessórios'
  if (u.includes('BATERIA')) return 'Baterias'
  if (u.includes('SERVICO') || u.includes('TROCA') || u.includes('CORTESIA')) return 'Serviços'
  return 'Outros'
}

const CATEGORIA_COLOR: Record<string, string> = {
  'Filtros': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/40',
  'Lubrificantes': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40',
  'Palhetas': 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40',
  'Aditivos / Fluidos': 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/40',
  'Acessórios': 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/40',
  'Baterias': 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/40',
  'Serviços': 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-900/40',
  'Outros': 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-900/40',
}

/**
 * Cabeçalho de coluna com ícone "?" — explica a métrica via tooltip no hover.
 * Mesmo helper usado em Combustivel.tsx; replicado aqui pra evitar import
 * cruzado entre páginas irmãs (poderia virar `@/components/tables/ThWithHelp`
 * quando uma terceira tela precisar).
 */
const ThWithHelp = ({
  label,
  help,
  align = 'right',
}: {
  label: string
  help: string
  align?: 'left' | 'right'
}) => (
  <th className={cn('px-4 py-2 font-medium', align === 'left' ? 'text-left' : 'text-right')}>
    <span className={cn('inline-flex items-center gap-1', align === 'left' ? '' : 'justify-end')}>
      {label}
      <span className="group relative inline-flex cursor-help">
        <HelpCircle className="h-3 w-3 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300" />
        <span
          className={cn(
            'pointer-events-none absolute top-full z-50 mt-1 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-[11px] font-normal normal-case leading-snug tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-gray-700',
            align === 'left' ? 'left-0' : 'right-0',
          )}
        >
          {help}
        </span>
      </span>
    </span>
  </th>
)

/* ─── KPI card (mesmo padrão da tela Combustível) ─── */

interface KpiCardProps {
  label: string
  value: string
  hint?: string
  Icon: typeof Package
  iconBg: string
  iconColor: string
  cardBg: string
  loading: boolean
}

const KpiCard = ({ label, value, hint, Icon, iconBg, iconColor, cardBg, loading }: KpiCardProps) => (
  <div className={cn('rounded-xl border border-gray-200 p-5 shadow-sm dark:border-gray-700', cardBg)}>
    <div className="flex items-center justify-between">
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
    </div>
    {loading ? (
      <Skeleton className="mt-2 h-8 w-32" />
    ) : (
      <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
    )}
    {hint && <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{hint}</p>}
  </div>
)

/* ─── Página ─── */

const ComercialVendasPista = () => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0
  const empresaNome = useEmpresaNome()

  // Filtros da tabela de produtos
  const [searchProduto, setSearchProduto] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas')
  // Modal de drill-down ao clicar numa categoria
  const [selectedCategoria, setSelectedCategoria] = useState<CategoriaData | null>(null)

  // Carrega produtos + grupos pra montar o mapa de produtos PS-.
  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100,
    ),
    staleTime: 30 * 60 * 1000,
  })

  const { data: gruposData } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => fetchAllPages(
      (p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100,
    ),
    staleTime: 30 * 60 * 1000,
  })

  // Saldo de estoque por produto — mesma queryKey de Conveniências pra
  // compartilhar a cache TanStack (uma fetch serve as 2 telas).
  const { data: estoqueRaw } = useQuery({
    queryKey: ['produtoEstoque', empresaCodigo],
    queryFn: () => fetchProdutoEstoque({
      empresaCodigo: empresaCodigo!,
      limite: 1000,
    }),
    enabled: hasEmpresa && empresaCodigo !== null,
    staleTime: 5 * 60 * 1000,
  })

  // Vendas do período
  const { data: vendaItens = [], isLoading: isLoadingVendas } = useQuery({
    queryKey: ['vendaItens-pista', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchAllPages(
      (p) => fetchVendaItens({
        empresaCodigo: empresaCodigo!,
        dataInicial,
        dataFinal,
        usaProdutoLmc: false,
        ultimoCodigo: p.ultimoCodigo,
        limite: p.limite,
      }),
      1000, 50,
    ),
    enabled: hasEmpresa && empresaCodigo !== null,
  })

  // Cruza tudo: pista produtos + vendas, agrupado por categoria
  const computed = useMemo(() => {
    if (!produtosData || !gruposData) return null

    // Mapa grupoCodigo → nome
    const grupoMap = new Map<number, string>()
    for (const g of gruposData) grupoMap.set(g.grupoCodigo, g.nome)

    // Set de produtoCodigo PS- (não combustível + grupo PS-)
    const pistaProdutos = new Map<number, { nome: string; grupoNome: string; categoria: string }>()
    for (const p of produtosData) {
      if (p.combustivel) continue
      const grupoNome = grupoMap.get(p.grupoCodigo)
      if (!grupoNome || !isPistaGroup(grupoNome)) continue
      pistaProdutos.set(p.produtoCodigo, {
        nome: p.nome,
        grupoNome,
        categoria: categoriaDoGrupo(grupoNome),
      })
    }

    // Agrega vendas por produto pista
    interface ProdutoAgg {
      produtoCodigo: number
      nome: string
      grupoNome: string
      categoria: string
      quantidade: number
      faturamento: number
      custo: number
    }
    const porProduto = new Map<number, ProdutoAgg>()
    for (const item of vendaItens) {
      const pista = pistaProdutos.get(item.produtoCodigo)
      if (!pista) continue
      const prev = porProduto.get(item.produtoCodigo) ?? {
        produtoCodigo: item.produtoCodigo,
        nome: pista.nome,
        grupoNome: pista.grupoNome,
        categoria: pista.categoria,
        quantidade: 0,
        faturamento: 0,
        custo: 0,
      }
      prev.quantidade += item.quantidade
      prev.faturamento += item.totalVenda
      prev.custo += item.totalCusto
      porProduto.set(item.produtoCodigo, prev)
    }

    // Lista plana de produtos com venda > 0
    const produtosVendidos = Array.from(porProduto.values())
      .filter((p) => p.faturamento > 0)
      .sort((a, b) => b.faturamento - a.faturamento)

    // Agrega por categoria
    interface CategoriaAgg {
      nome: string
      qtdProdutos: number
      qtdVendida: number
      faturamento: number
      custo: number
    }
    const porCategoria = new Map<string, CategoriaAgg>()
    for (const p of produtosVendidos) {
      const prev = porCategoria.get(p.categoria) ?? {
        nome: p.categoria,
        qtdProdutos: 0,
        qtdVendida: 0,
        faturamento: 0,
        custo: 0,
      }
      prev.qtdProdutos++
      prev.qtdVendida += p.quantidade
      prev.faturamento += p.faturamento
      prev.custo += p.custo
      porCategoria.set(p.categoria, prev)
    }
    const categorias = Array.from(porCategoria.values()).sort((a, b) => b.faturamento - a.faturamento)

    // Totais
    const totalQtd = produtosVendidos.reduce((s, p) => s + p.quantidade, 0)
    const totalFat = produtosVendidos.reduce((s, p) => s + p.faturamento, 0)
    const totalCusto = produtosVendidos.reduce((s, p) => s + p.custo, 0)
    const margemPct = totalFat > 0 ? ((totalFat - totalCusto) / totalFat) * 100 : 0

    return {
      produtosVendidos,
      categorias,
      kpis: {
        produtosDistintos: produtosVendidos.length,
        unidadesVendidas: totalQtd,
        faturamento: totalFat,
        margem: totalFat - totalCusto,
        margemPct,
      },
    }
  }, [produtosData, gruposData, vendaItens])

  // Aplica busca + filtro de categoria na lista de produtos.
  const produtosFiltrados = useMemo(() => {
    if (!computed) return []
    const q = searchProduto.trim().toLowerCase()
    return computed.produtosVendidos.filter((p) => {
      if (categoriaFiltro !== 'todas' && p.categoria !== categoriaFiltro) return false
      if (q && !p.nome.toLowerCase().includes(q)) return false
      return true
    })
  }, [computed, searchProduto, categoriaFiltro])

  // Tem filtro ativo? Define se mostramos top-20 ou todos os resultados.
  const hasProductFilter = searchProduto.trim() !== '' || categoriaFiltro !== 'todas'
  const produtosExibidos = hasProductFilter ? produtosFiltrados : produtosFiltrados.slice(0, 20)
  const categoriasDisponiveis = computed?.categorias.map((c) => c.nome) ?? []

  // Subconjunto pra alimentar o modal — produtos da categoria + vendas brutas
  // pra computar a distribuição diária dentro do modal.
  const produtosDaCategoria = useMemo(() => {
    if (!selectedCategoria || !computed) return []
    return computed.produtosVendidos.filter((p) => p.categoria === selectedCategoria.nome)
  }, [selectedCategoria, computed])

  const vendasDaCategoria = useMemo(() => {
    if (!selectedCategoria || produtosDaCategoria.length === 0) return []
    const codes = new Set(produtosDaCategoria.map((p) => p.produtoCodigo))
    return vendaItens.filter((v) => codes.has(v.produtoCodigo))
  }, [selectedCategoria, produtosDaCategoria, vendaItens])

  // Mapa produtoCodigo → saldo de estoque (soma de saldoEstoque[].quantidade
  // ou saldo do produto). Usado tanto no modal quanto na tabela Top 20.
  const estoquePorProduto = useMemo(() => {
    const map = new Map<number, number>()
    for (const e of estoqueRaw?.resultados ?? []) {
      const saldo = e.saldoEstoque
        ? e.saldoEstoque.reduce((s, x) => s + x.quantidade, 0)
        : e.saldo
      map.set(e.produtoCodigo, (map.get(e.produtoCodigo) ?? 0) + saldo)
    }
    return map
  }, [estoqueRaw])

  const diasPeriodo = useMemo(() => diasEntreDatas(dataInicial, dataFinal), [dataInicial, dataFinal])

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-900/30">
            <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                Vendas · Pista{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Filtros, óleos, palhetas, aditivos, baterias e acessórios
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      <VendasNav />

      {!hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        <>
          {/* KPIs principais — 4 cards ocupando a largura toda (estilo Combustível) */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label="Produtos vendidos"
              value={computed ? formatNumber(computed.kpis.produtosDistintos) : '—'}
              hint="SKUs distintos com venda > 0"
              Icon={Package}
              iconBg="bg-blue-100 dark:bg-blue-900/30"
              iconColor="text-blue-600 dark:text-blue-400"
              cardBg="bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900"
              loading={isLoadingVendas}
            />
            <KpiCard
              label="Unidades"
              value={computed ? formatNumber(computed.kpis.unidadesVendidas) : '—'}
              hint="Total de unidades vendidas"
              Icon={Layers}
              iconBg="bg-cyan-100 dark:bg-cyan-900/30"
              iconColor="text-cyan-600 dark:text-cyan-400"
              cardBg="bg-gradient-to-br from-cyan-50/60 to-white dark:from-cyan-950/20 dark:to-gray-900"
              loading={isLoadingVendas}
            />
            <KpiCard
              label="Faturamento"
              value={computed ? formatCurrency(computed.kpis.faturamento) : '—'}
              hint="Soma das vendas no período"
              Icon={DollarSign}
              iconBg="bg-emerald-100 dark:bg-emerald-900/30"
              iconColor="text-emerald-600 dark:text-emerald-400"
              cardBg="bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900"
              loading={isLoadingVendas}
            />
            <KpiCard
              label="Margem"
              value={
                computed
                  ? `${formatCurrency(computed.kpis.margem)} · ${computed.kpis.margemPct.toFixed(1).replace('.', ',')}%`
                  : '—'
              }
              hint="Lucro bruto e % sobre faturamento"
              Icon={TrendingUp}
              iconBg="bg-amber-100 dark:bg-amber-900/30"
              iconColor="text-amber-600 dark:text-amber-400"
              cardBg="bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900"
              loading={isLoadingVendas}
            />
          </div>

          {/* Por categoria — table com BarCells, tooltips, Trophy/Lanterna e Total */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Por categoria</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Performance agregada dos grupos PS- por família de produto
              </p>
            </div>
            {isLoadingVendas ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-md" />
                ))}
              </div>
            ) : !computed || computed.categorias.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-gray-400">
                Nenhuma venda de produto automotivo no período.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                    <tr>
                      <ThWithHelp align="left" label="Categoria" help="Família agregada dos grupos PS- (filtros, lubrificantes, palhetas, etc.)." />
                      <ThWithHelp label="SKUs" help="Quantidade de produtos distintos vendidos na categoria." />
                      <ThWithHelp label="Unidades" help="Total de unidades vendidas na categoria." />
                      <ThWithHelp label="Faturamento" help="Receita total da categoria (R$)." />
                      <ThWithHelp label="Lucro bruto" help="Lucro bruto total: faturamento − custo (R$)." />
                      <ThWithHelp label="Margem %" help="(Lucro bruto ÷ faturamento) × 100." />
                      <ThWithHelp label="% mix" help="Participação da categoria no faturamento total da pista." />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(() => {
                      const cats = computed.categorias
                      const maxSKUs = Math.max(...cats.map((c) => c.qtdProdutos), 0)
                      const maxUnidades = Math.max(...cats.map((c) => c.qtdVendida), 0)
                      const maxFat = Math.max(...cats.map((c) => c.faturamento), 0)
                      const maxLucro = Math.max(...cats.map((c) => c.faturamento - c.custo), 0)
                      const maxMargem = Math.max(...cats.map((c) => (c.faturamento > 0 ? ((c.faturamento - c.custo) / c.faturamento) * 100 : 0)), 0)
                      const totFat = cats.reduce((s, c) => s + c.faturamento, 0)
                      const totUnid = cats.reduce((s, c) => s + c.qtdVendida, 0)
                      const totSKUs = cats.reduce((s, c) => s + c.qtdProdutos, 0)
                      const totLucro = cats.reduce((s, c) => s + (c.faturamento - c.custo), 0)
                      const totMargemPct = totFat > 0 ? (totLucro / totFat) * 100 : 0
                      const maxMix = totFat > 0 ? Math.max(...cats.map((c) => (c.faturamento / totFat) * 100)) : 0
                      return (
                        <>
                          {cats.map((c, idx) => {
                            const lucro = c.faturamento - c.custo
                            const margemPct = c.faturamento > 0 ? (lucro / c.faturamento) * 100 : 0
                            const mixPct = totFat > 0 ? (c.faturamento / totFat) * 100 : 0
                            return (
                              <tr
                                key={c.nome}
                                className="cursor-pointer hover:bg-gray-50/60 dark:hover:bg-gray-800/30"
                                onClick={() => setSelectedCategoria(c)}
                              >
                                <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                                  <span className="flex items-center gap-2">
                                    <span
                                      className={cn(
                                        'inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium underline-offset-4 group-hover:underline',
                                        CATEGORIA_COLOR[c.nome] ?? CATEGORIA_COLOR['Outros'],
                                      )}
                                    >
                                      {c.nome}
                                    </span>
                                    {idx === 0 && cats.length > 1 && (
                                      <span
                                        className="inline-flex shrink-0"
                                        title="Categoria com maior faturamento"
                                        aria-label="Categoria com maior faturamento"
                                      >
                                        <Trophy className="h-3 w-3 text-amber-500" />
                                      </span>
                                    )}
                                    {idx === cats.length - 1 && cats.length > 1 && (
                                      <span
                                        className="inline-flex shrink-0"
                                        title="Categoria com menor faturamento"
                                        aria-label="Categoria com menor faturamento"
                                      >
                                        <TrendingDown className="h-3 w-3 text-red-500" />
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={c.qtdProdutos} max={maxSKUs} formatted={formatNumber(c.qtdProdutos)} color="blue" align="near" />
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={c.qtdVendida} max={maxUnidades} formatted={formatNumber(c.qtdVendida)} color="blue" align="near" />
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={c.faturamento} max={maxFat} formatted={formatCurrency(c.faturamento)} color="green" align="near" />
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={lucro} max={maxLucro} formatted={formatCurrency(lucro)} color="green" align="near" />
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={margemPct} max={maxMargem} formatted={`${margemPct.toFixed(1).replace('.', ',')}%`} color="amber" align="near" />
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={mixPct} max={maxMix} formatted={`${mixPct.toFixed(1).replace('.', ',')}%`} color="amber" align="near" />
                                </td>
                              </tr>
                            )
                          })}
                          {/* Linha Total */}
                          <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                            <td className="px-4 py-2.5">Total</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(totSKUs)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(totUnid)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totFat)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totLucro)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{totMargemPct.toFixed(1).replace('.', ',')}%</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">100,0%</td>
                          </tr>
                        </>
                      )
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Tabela de produtos com busca + filtro de categoria + BarCells */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {hasProductFilter ? 'Produtos' : 'Top 20 produtos'}
                </h2>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {hasProductFilter
                    ? `${produtosFiltrados.length} resultado${produtosFiltrados.length === 1 ? '' : 's'}`
                    : 'Produtos mais vendidos no período (por faturamento)'}
                </p>
              </div>
              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchProduto}
                    onChange={(e) => setSearchProduto(e.target.value)}
                    placeholder="Buscar produto..."
                    className="h-8 w-[180px] rounded-md border border-gray-200 bg-gray-50 pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  />
                </div>
                <select
                  value={categoriaFiltro}
                  onChange={(e) => setCategoriaFiltro(e.target.value)}
                  className="h-8 rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  <option value="todas">Todas as categorias</option>
                  {categoriasDisponiveis.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            {isLoadingVendas ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 rounded-md" />
                ))}
              </div>
            ) : produtosExibidos.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-gray-400">
                {hasProductFilter
                  ? 'Nenhum produto pros filtros aplicados.'
                  : 'Nenhum produto vendido no período.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                    <tr>
                      <ThWithHelp align="left" label="Produto" help="Nome do produto vendido." />
                      <ThWithHelp align="left" label="Categoria" help="Família PS- (filtros, lubrificantes, etc.)." />
                      <ThWithHelp label="Unidades" help="Quantidade total de unidades vendidas." />
                      <ThWithHelp label="Cobertura" help="Dias de estoque restantes: saldo atual ÷ venda diária média do período." />
                      <ThWithHelp label="Faturamento" help="Receita total do produto (R$)." />
                      <ThWithHelp label="Lucro bruto" help="Lucro bruto total: faturamento − custo (R$)." />
                      <ThWithHelp label="Margem %" help="(Lucro bruto ÷ faturamento) × 100." />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(() => {
                      const maxUnidades = Math.max(...produtosExibidos.map((p) => p.quantidade), 0)
                      const maxFat = Math.max(...produtosExibidos.map((p) => p.faturamento), 0)
                      const maxLucro = Math.max(...produtosExibidos.map((p) => p.faturamento - p.custo), 0)
                      const maxMargem = Math.max(...produtosExibidos.map((p) => (p.faturamento > 0 ? ((p.faturamento - p.custo) / p.faturamento) * 100 : 0)), 0)
                      const totUnid = produtosExibidos.reduce((s, p) => s + p.quantidade, 0)
                      const totFat = produtosExibidos.reduce((s, p) => s + p.faturamento, 0)
                      const totLucro = produtosExibidos.reduce((s, p) => s + (p.faturamento - p.custo), 0)
                      const totMargemPct = totFat > 0 ? (totLucro / totFat) * 100 : 0
                      return (
                        <>
                          {produtosExibidos.map((p) => {
                            const lucro = p.faturamento - p.custo
                            const margemPct = p.faturamento > 0 ? (lucro / p.faturamento) * 100 : 0
                            return (
                              <tr key={p.produtoCodigo}>
                                <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                                  <span className="block max-w-md truncate" title={p.nome}>{p.nome}</span>
                                </td>
                                <td className="px-4 py-2.5">
                                  <span
                                    className={cn(
                                      'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
                                      CATEGORIA_COLOR[p.categoria] ?? CATEGORIA_COLOR['Outros'],
                                    )}
                                  >
                                    {p.categoria}
                                  </span>
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={p.quantidade} max={maxUnidades} formatted={formatNumber(p.quantidade)} color="blue" align="near" />
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <CoberturaBadge
                                    saldo={estoquePorProduto.get(p.produtoCodigo)}
                                    quantidade={p.quantidade}
                                    diasPeriodo={diasPeriodo}
                                  />
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={p.faturamento} max={maxFat} formatted={formatCurrency(p.faturamento)} color="green" align="near" />
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={lucro} max={maxLucro} formatted={formatCurrency(lucro)} color="green" align="near" />
                                </td>
                                <td className="px-2 py-1">
                                  <BarCell value={margemPct} max={maxMargem} formatted={`${margemPct.toFixed(1).replace('.', ',')}%`} color="amber" align="near" />
                                </td>
                              </tr>
                            )
                          })}
                          {/* Linha Total */}
                          <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                            <td className="px-4 py-2.5">Total</td>
                            <td className="px-4 py-2.5" />
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(totUnid)}</td>
                            <td className="px-4 py-2.5" />
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totFat)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totLucro)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{totMargemPct.toFixed(1).replace('.', ',')}%</td>
                          </tr>
                        </>
                      )
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* Modal ao clicar numa linha da seção "Por categoria":
          indicadores + top produtos + distribuição diária da categoria. */}
      <CategoriaDetalheModal
        open={selectedCategoria !== null}
        onClose={() => setSelectedCategoria(null)}
        categoria={selectedCategoria}
        produtos={produtosDaCategoria}
        vendasDaCategoria={vendasDaCategoria}
        estoquePorProduto={estoquePorProduto}
        dataInicial={dataInicial}
        dataFinal={dataFinal}
        categoriaColorClass={
          selectedCategoria
            ? CATEGORIA_COLOR[selectedCategoria.nome] ?? CATEGORIA_COLOR['Outros']
            : ''
        }
      />
    </div>
  )
}

export default ComercialVendasPista

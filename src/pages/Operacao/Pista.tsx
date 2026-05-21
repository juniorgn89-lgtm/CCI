import { useMemo, useState } from 'react'
import { Wrench, Package, TrendingUp, DollarSign, Layers, Search } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import OperacaoNav from '@/pages/Operacao/OperacaoNav'

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

/* ─── Página ─── */

const OperacaoPista = () => {
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0
  const empresaNome = useEmpresaNome()

  // Filtros da tabela de produtos
  const [searchProduto, setSearchProduto] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas')

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

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30">
            <Wrench className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-gray-900 dark:text-gray-100">
              Pista{empresaNome ? ` · ${empresaNome}` : ' · Produtos Automotivos'}
            </h1>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              Filtros, óleos, palhetas, aditivos, baterias e acessórios
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {/* Switcher entre Combustível / Pista / Mix */}
      <OperacaoNav />

      {!hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Produtos vendidos"
              value={computed ? formatNumber(computed.kpis.produtosDistintos) : '—'}
              hint="SKUs distintos com venda > 0"
              Icon={Package}
              loading={isLoadingVendas}
            />
            <KpiCard
              label="Unidades"
              value={computed ? formatNumber(computed.kpis.unidadesVendidas) : '—'}
              hint="Total de unidades vendidas"
              Icon={Layers}
              loading={isLoadingVendas}
            />
            <KpiCard
              label="Faturamento"
              value={computed ? formatCurrency(computed.kpis.faturamento) : '—'}
              hint="Soma das vendas no período"
              Icon={DollarSign}
              loading={isLoadingVendas}
            />
            <KpiCard
              label="Margem"
              value={
                computed
                  ? `${formatCurrency(computed.kpis.margem)} · ${computed.kpis.margemPct.toFixed(1)}%`
                  : '—'
              }
              hint="Lucro bruto e % sobre faturamento"
              Icon={TrendingUp}
              loading={isLoadingVendas}
            />
          </div>

          {/* Por categoria */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Por categoria</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Performance agregada dos grupos PS- de cada família
              </p>
            </div>
            {isLoadingVendas ? (
              <div className="space-y-2 p-5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 rounded-md" />
                ))}
              </div>
            ) : !computed || computed.categorias.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-gray-400">
                Nenhuma venda de produto automotivo no período.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {computed.categorias.map((c) => {
                  const pct = computed.kpis.faturamento > 0
                    ? (c.faturamento / computed.kpis.faturamento) * 100
                    : 0
                  const margemPct = c.faturamento > 0
                    ? ((c.faturamento - c.custo) / c.faturamento) * 100
                    : 0
                  return (
                    <li key={c.nome} className="flex items-center gap-4 px-5 py-3">
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium',
                          CATEGORIA_COLOR[c.nome] ?? CATEGORIA_COLOR['Outros'],
                        )}
                      >
                        {c.nome}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatNumber(c.qtdProdutos)} {c.qtdProdutos === 1 ? 'SKU' : 'SKUs'} · {formatNumber(c.qtdVendida)} unidades · margem {margemPct.toFixed(1)}%
                        </p>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div
                            className="h-1.5 rounded-full bg-amber-500 transition-all"
                            style={{ width: `${Math.max(2, pct)}%` }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                          {formatCurrency(c.faturamento)}
                        </p>
                        <p className="text-[10px] tabular-nums text-gray-400">
                          {pct.toFixed(1)}% da pista
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* Tabela de produtos com busca + filtro de categoria */}
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
                  <thead className="border-b border-gray-100 bg-gray-50/50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Produto</th>
                      <th className="px-4 py-2 text-left font-medium">Categoria</th>
                      <th className="px-4 py-2 text-right font-medium">Unidades</th>
                      <th className="px-4 py-2 text-right font-medium">Faturamento</th>
                      <th className="px-4 py-2 text-right font-medium">Margem %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {produtosExibidos.map((p) => {
                      const margemPct = p.faturamento > 0
                        ? ((p.faturamento - p.custo) / p.faturamento) * 100
                        : 0
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
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                            {formatNumber(p.quantidade)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100">
                            {formatCurrency(p.faturamento)}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                            {margemPct.toFixed(1)}%
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

/* ─── KPI card ─── */

interface KpiCardProps {
  label: string
  value: string
  hint: string
  Icon: typeof Package
  loading: boolean
}

const KpiCard = ({ label, value, hint, Icon, loading }: KpiCardProps) => (
  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        {loading ? (
          <Skeleton className="mt-1.5 h-7 w-24" />
        ) : (
          <p className="mt-1.5 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {value}
          </p>
        )}
        <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">{hint}</p>
      </div>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/30">
        <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      </div>
    </div>
  </div>
)

export default OperacaoPista

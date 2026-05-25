import { useMemo, useState } from 'react'
import { Search, Trophy, TrendingDown, HelpCircle } from 'lucide-react'
import BarCell from '@/components/tables/BarCell'
import CoberturaBadge, { diasEntreDatas } from '@/components/badges/CoberturaBadge'
import { smoothedProjection } from '@/lib/projection'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type {
  CatalogProduct,
  GroupRow,
  DaySaleProduct,
} from '@/pages/Conveniencias/hooks/useConvenienceData'

/**
 * Visão Geral da Conveniência — espelho do layout da Pista:
 * "Por categoria" (Categoria, SKUs, Unidades, Faturamento, Projeção, Lucro
 * Bruto, Margem %, % Mix) + "Top 20 produtos" (Produto, Categoria, Unidades,
 * Cobertura, Faturamento, Lucro Bruto, Margem %).
 *
 * Aqui "categoria" = grupo do produto (vindo do cadastro). Como os grupos
 * variam por rede, a paleta de cores é cíclica baseada no índice de
 * aparição — não há mapeamento fixo como na Pista (PS-*).
 */

interface ConvenienciaVisaoGeralProps {
  catalogProducts: CatalogProduct[]
  groupTable: GroupRow[]
  /** salesByDay[yyyy-mm-dd] = DaySaleProduct[] daquele dia — usado pra projeção por categoria. */
  salesByDay: Record<string, DaySaleProduct[]>
  dataInicial: string
  dataFinal: string
}

/** 7 cores cíclicas pros badges de categoria (grupo da loja). */
const GROUP_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-900/40',
  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-900/40',
  'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-900/40',
  'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/40',
  'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/40',
  'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/40',
  'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-900/40',
]

const ThWithHelp = ({ label, help, align = 'right' }: { label: string; help: string; align?: 'left' | 'right' }) => (
  <th className={cn('px-4 py-2.5 font-medium', align === 'right' ? 'text-right' : 'text-left')}>
    <span className="inline-flex items-center gap-1">
      {label}
      <span title={help} className="cursor-help text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
        <HelpCircle className="h-3 w-3" />
      </span>
    </span>
  </th>
)

const ConvenienciaVisaoGeral = ({
  catalogProducts,
  groupTable,
  salesByDay,
  dataInicial,
  dataFinal,
}: ConvenienciaVisaoGeralProps) => {
  const diasPeriodo = useMemo(() => diasEntreDatas(dataInicial, dataFinal), [dataInicial, dataFinal])

  const [searchProduto, setSearchProduto] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas')
  const [estoqueFiltro, setEstoqueFiltro] = useState<'todos' | 'sem-estoque' | 'critico' | 'atencao' | 'ok' | 'sem-dados'>('todos')

  // grupoCodigo → cor (rotativo). Calculado uma vez com base na ordem
  // do groupTable (já vem ordenado por faturamento desc).
  const grupoColorMap = useMemo<Map<number, string>>(() => {
    const m = new Map<number, string>()
    groupTable.forEach((g, idx) => m.set(g.grupoCodigo, GROUP_COLORS[idx % GROUP_COLORS.length]))
    return m
  }, [groupTable])

  // Conta SKUs distintos por grupo
  const skusPorGrupo = useMemo<Map<number, number>>(() => {
    const m = new Map<number, number>()
    for (const p of catalogProducts) {
      if (p.faturamento > 0) m.set(p.grupoCodigo, (m.get(p.grupoCodigo) ?? 0) + 1)
    }
    return m
  }, [catalogProducts])

  // Projeção por grupo — usa salesByDay pra montar série diária e aplica
  // smoothedProjection com diasRestantes = dias até dataFinal após hoje.
  const projecaoPorGrupo = useMemo<Map<number, number>>(() => {
    const out = new Map<number, number>()
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const endTs = new Date(`${dataFinal}T00:00:00`).getTime()
    const todayTs = new Date(`${todayISO}T00:00:00`).getTime()
    const diasRestantes = Math.max(0, Math.floor((endTs - todayTs) / 86_400_000))

    // produtoCodigo → grupoCodigo
    const produtoGrupo = new Map<number, number>()
    for (const p of catalogProducts) produtoGrupo.set(p.produtoCodigo, p.grupoCodigo)

    // grupoCodigo → Map<day, fat>
    const serieByGrupo = new Map<number, Map<string, number>>()
    for (const [day, products] of Object.entries(salesByDay)) {
      for (const prod of products) {
        const gc = produtoGrupo.get(prod.produtoCodigo)
        if (gc === undefined) continue
        const serie = serieByGrupo.get(gc) ?? new Map<string, number>()
        serie.set(day, (serie.get(day) ?? 0) + prod.faturamento)
        serieByGrupo.set(gc, serie)
      }
    }

    for (const g of groupTable) {
      const serie = serieByGrupo.get(g.grupoCodigo) ?? new Map<string, number>()
      const projetado = smoothedProjection({
        realizado: g.faturamento,
        dailySeries: Array.from(serie.entries()).map(([data, value]) => ({ data, value })),
        diasRestantes,
        today: todayISO,
      }).projetado
      out.set(g.grupoCodigo, projetado)
    }
    return out
  }, [groupTable, catalogProducts, salesByDay, dataFinal])

  const isProjetada = useMemo(() => {
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    return dataFinal > todayISO
  }, [dataFinal])

  // Top 20 produtos por faturamento + filtros de busca/categoria
  const produtosOrdenados = useMemo(
    () => [...catalogProducts].filter((p) => p.faturamento > 0).sort((a, b) => b.faturamento - a.faturamento),
    [catalogProducts],
  )

  const categoriasDisponiveis = useMemo(() => {
    const set = new Set<string>()
    for (const p of produtosOrdenados) set.add(p.grupo)
    return Array.from(set).sort()
  }, [produtosOrdenados])

  /** Classifica o estoque de um produto nas mesmas faixas da CoberturaBadge. */
  const estoqueStatus = (
    saldo: number | undefined,
    qtd: number,
  ): 'sem-dados' | 'sem-estoque' | 'critico' | 'atencao' | 'ok' => {
    if (saldo === undefined) return 'sem-dados'
    if (saldo === 0) return 'sem-estoque'
    if (qtd <= 0) return 'ok' // tem saldo, sem vendas → cobertura grande
    const d = (saldo * diasPeriodo) / qtd
    if (d < 7) return 'critico'
    if (d < 30) return 'atencao'
    return 'ok'
  }

  const produtosFiltrados = useMemo(() => {
    const q = searchProduto.trim().toLowerCase()
    return produtosOrdenados.filter((p) => {
      if (categoriaFiltro !== 'todas' && p.grupo !== categoriaFiltro) return false
      if (q && !p.nome.toLowerCase().includes(q)) return false
      if (estoqueFiltro !== 'todos') {
        if (estoqueStatus(p.saldo, p.qtdVendida) !== estoqueFiltro) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produtosOrdenados, searchProduto, categoriaFiltro, estoqueFiltro, diasPeriodo])

  const hasProductFilter = searchProduto.trim() !== '' || categoriaFiltro !== 'todas' || estoqueFiltro !== 'todos'
  const produtosExibidos = hasProductFilter ? produtosFiltrados : produtosFiltrados.slice(0, 20)

  return (
    <div className="space-y-6">
      {/* ── Por categoria ── */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Por categoria</h2>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Performance agregada dos grupos de produtos da loja
          </p>
        </div>
        {groupTable.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            Sem vendas de produtos de conveniência no período.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                <tr>
                  <ThWithHelp align="left" label="Categoria" help="Grupo do produto (cadastrado no Quality)." />
                  <ThWithHelp label="SKUs" help="Quantidade de produtos distintos com venda na categoria." />
                  <ThWithHelp label="Unidades" help="Total de unidades vendidas na categoria." />
                  <ThWithHelp label="Faturamento" help="Receita total da categoria (R$)." />
                  <ThWithHelp label="Projeção" help="Estimativa de faturamento ao final do mês usando a média móvel dos últimos dias (suavizada). Igual ao Faturamento quando o período é fechado." />
                  <ThWithHelp label="Lucro bruto" help="Lucro bruto total: faturamento − custo (R$)." />
                  <ThWithHelp label="Margem %" help="(Lucro bruto ÷ faturamento) × 100." />
                  <ThWithHelp label="% mix" help="Participação da categoria no faturamento total da conveniência." />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(() => {
                  const cats = groupTable
                  const maxSKUs = Math.max(...cats.map((c) => skusPorGrupo.get(c.grupoCodigo) ?? 0), 0)
                  const maxUnidades = Math.max(...cats.map((c) => c.quantidade), 0)
                  const maxFat = Math.max(...cats.map((c) => c.faturamento), 0)
                  const maxProj = Math.max(...cats.map((c) => projecaoPorGrupo.get(c.grupoCodigo) ?? 0), 0)
                  const maxLucro = Math.max(...cats.map((c) => c.margemTotal), 0)
                  const maxMargem = Math.max(...cats.map((c) => c.margemPct), 0)
                  const totFat = cats.reduce((s, c) => s + c.faturamento, 0)
                  const totProj = cats.reduce((s, c) => s + (projecaoPorGrupo.get(c.grupoCodigo) ?? 0), 0)
                  const totUnid = cats.reduce((s, c) => s + c.quantidade, 0)
                  const totSKUs = cats.reduce((s, c) => s + (skusPorGrupo.get(c.grupoCodigo) ?? 0), 0)
                  const totLucro = cats.reduce((s, c) => s + c.margemTotal, 0)
                  const totMargemPct = totFat > 0 ? (totLucro / totFat) * 100 : 0
                  const maxMix = totFat > 0 ? Math.max(...cats.map((c) => (c.faturamento / totFat) * 100)) : 0
                  return (
                    <>
                      {cats.map((c, idx) => {
                        const skus = skusPorGrupo.get(c.grupoCodigo) ?? 0
                        const mixPct = totFat > 0 ? (c.faturamento / totFat) * 100 : 0
                        const projetado = projecaoPorGrupo.get(c.grupoCodigo) ?? c.faturamento
                        const colorCls = grupoColorMap.get(c.grupoCodigo) ?? GROUP_COLORS[0]
                        return (
                          <tr key={c.grupoCodigo} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                            <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                              <span className="flex items-center gap-2">
                                <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium', colorCls)}>
                                  {c.nome}
                                </span>
                                {idx === 0 && cats.length > 1 && (
                                  <span className="inline-flex shrink-0" title="Categoria com maior faturamento" aria-label="Categoria com maior faturamento">
                                    <Trophy className="h-3 w-3 text-amber-500" />
                                  </span>
                                )}
                                {idx === cats.length - 1 && cats.length > 1 && (
                                  <span className="inline-flex shrink-0" title="Categoria com menor faturamento" aria-label="Categoria com menor faturamento">
                                    <TrendingDown className="h-3 w-3 text-red-500" />
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-2 py-1">
                              <BarCell value={skus} max={maxSKUs} formatted={formatNumber(skus)} color="blue" align="near" />
                            </td>
                            <td className="px-2 py-1">
                              <BarCell value={c.quantidade} max={maxUnidades} formatted={formatNumber(c.quantidade)} color="blue" align="near" />
                            </td>
                            <td className="px-2 py-1">
                              <BarCell value={c.faturamento} max={maxFat} formatted={formatCurrency(c.faturamento)} color="green" align="near" />
                            </td>
                            <td className="px-2 py-1">
                              <BarCell value={projetado} max={maxProj} formatted={formatCurrency(projetado)} color={isProjetada ? 'blue' : 'green'} align="near" />
                            </td>
                            <td className="px-2 py-1">
                              <BarCell value={c.margemTotal} max={maxLucro} formatted={formatCurrency(c.margemTotal)} color="green" align="near" />
                            </td>
                            <td className="px-2 py-1">
                              <BarCell value={c.margemPct} max={maxMargem} formatted={`${c.margemPct.toFixed(1).replace('.', ',')}%`} color="amber" align="near" />
                            </td>
                            <td className="px-2 py-1">
                              <BarCell value={mixPct} max={maxMix} formatted={`${mixPct.toFixed(1).replace('.', ',')}%`} color="amber" align="near" />
                            </td>
                          </tr>
                        )
                      })}
                      {/* Total */}
                      <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                        <td className="px-4 py-2.5">Total</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(totSKUs)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(totUnid)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(totFat)}</td>
                        <td className={cn(
                          'px-4 py-2.5 text-right tabular-nums',
                          isProjetada && 'text-blue-700 dark:text-blue-400',
                        )}>
                          {formatCurrency(totProj)}
                        </td>
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

      {/* ── Top 20 produtos ── */}
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
            <select
              value={estoqueFiltro}
              onChange={(e) => setEstoqueFiltro(e.target.value as typeof estoqueFiltro)}
              className="h-8 rounded-md border border-gray-200 bg-gray-50 px-2 text-xs text-gray-700 focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              title="Filtra pela cobertura de estoque"
            >
              <option value="todos">Todos estoques</option>
              <option value="critico">🔴 Crítico (&lt; 7d)</option>
              <option value="atencao">🟠 Atenção (7–30d)</option>
              <option value="ok">🟢 OK (&gt; 30d)</option>
              <option value="sem-estoque">⚫ Sem estoque</option>
              <option value="sem-dados">— Sem dados</option>
            </select>
          </div>
        </div>
        {produtosExibidos.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            {hasProductFilter ? 'Nenhum produto pros filtros aplicados.' : 'Nenhum produto vendido no período.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                <tr>
                  <ThWithHelp align="left" label="Produto" help="Nome do produto vendido." />
                  <ThWithHelp align="left" label="Categoria" help="Grupo do produto (cadastrado no Quality)." />
                  <ThWithHelp label="Unidades" help="Quantidade total de unidades vendidas." />
                  <ThWithHelp label="Cobertura" help="Dias de estoque restantes: saldo atual ÷ venda diária média do período." />
                  <ThWithHelp label="Faturamento" help="Receita total do produto (R$)." />
                  <ThWithHelp label="Lucro bruto" help="Lucro bruto: (preço − custo) × quantidade (R$)." />
                  <ThWithHelp label="Margem %" help="(Lucro bruto ÷ faturamento) × 100." />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(() => {
                  const maxUnidades = Math.max(...produtosExibidos.map((p) => p.qtdVendida), 0)
                  const maxFat = Math.max(...produtosExibidos.map((p) => p.faturamento), 0)
                  const maxLucro = Math.max(...produtosExibidos.map((p) => (p.precoMedioVenda - p.custoMedio) * p.qtdVendida), 0)
                  const maxMargem = Math.max(...produtosExibidos.map((p) => p.margemPct), 0)
                  return produtosExibidos.map((p) => {
                    const lucro = (p.precoMedioVenda - p.custoMedio) * p.qtdVendida
                    const colorCls = grupoColorMap.get(p.grupoCodigo) ?? GROUP_COLORS[0]
                    return (
                      <tr key={p.produtoCodigo} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                        <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                          <span className="truncate" title={p.nome}>{p.nome}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium', colorCls)}>
                            {p.grupo}
                          </span>
                        </td>
                        <td className="px-2 py-1">
                          <BarCell value={p.qtdVendida} max={maxUnidades} formatted={formatNumber(p.qtdVendida)} color="blue" align="near" />
                        </td>
                        <td className="px-4 py-2.5">
                          <CoberturaBadge
                            saldo={p.saldo}
                            quantidade={p.qtdVendida}
                            diasPeriodo={diasPeriodo}
                            fallback="—"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <BarCell value={p.faturamento} max={maxFat} formatted={formatCurrency(p.faturamento)} color="green" align="near" />
                        </td>
                        <td className="px-2 py-1">
                          <BarCell value={lucro} max={maxLucro} formatted={formatCurrency(lucro)} color="green" align="near" />
                        </td>
                        <td className="px-2 py-1">
                          <BarCell value={p.margemPct} max={maxMargem} formatted={`${p.margemPct.toFixed(1).replace('.', ',')}%`} color="amber" align="near" />
                        </td>
                      </tr>
                    )
                  })
                })()}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

export default ConvenienciaVisaoGeral

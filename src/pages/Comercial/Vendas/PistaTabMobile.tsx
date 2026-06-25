import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Wrench, Percent, Ticket, ShoppingBag, Layers, Trophy } from 'lucide-react'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { fetchVendasCache, splitPeriodAtToday, type ApuracaoVendaRow } from '@/api/supabase/apuracao'
import { useTenantStore } from '@/store/tenant'
import { classifySetor } from '@/lib/setorClassification'
import { useFilterStore } from '@/store/filters'
import { offsetPeriod, todayLocal } from '@/lib/period'
import { projecaoAvancada, fimDoMesIso } from '@/lib/projection'
import { formatNumber } from '@/lib/formatters'
import { KpiCard, Section, MarginPill, ProgressBar, Badge } from '@/components/mobile/primitives'
import ProjecaoSection, { type ProjMetric } from '@/components/mobile/ProjecaoSection'
import { BarChartMobile } from '@/components/mobile/charts'
import { LoadingScreen, EmptyCard } from '@/components/mobile/states'
import { brl, brlShort, pct, periodoMes, variacaoPct } from '@/components/mobile/format'

/** Família simplificada do grupo PS- (mesma régua do Pista desktop). */
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

/**
 * Aba Pista (automotivos) — versão mobile. Mesma régua do Pista desktop
 * (tipoGrupo "Pista" e tipoProduto ≠ "C", cancelada="N"). Queries próprias
 * (produtos/grupos/venda itens current+prev) e cálculo agregado.
 */
const PistaTabMobile = () => {
  const { empresaCodigos, dataInicial, dataFinal, comparisonMode } = useFilterStore()
  const rede = useTenantStore((s) => s.rede)
  const cmpLabel = comparisonMode === 'prevYear' ? 'ano ant.' : 'mês ant.'
  const cmpOffset = comparisonMode === 'prevYear' ? 12 : 1
  const hoje = todayLocal()
  const fimEfetivo = dataFinal > hoje ? hoje : dataFinal
  const prevInicial = offsetPeriod(dataInicial, cmpOffset)
  const prevFinal = offsetPeriod(fimEfetivo, cmpOffset)
  const periodo = useMemo(() => periodoMes(dataInicial, dataFinal), [dataInicial, dataFinal])

  const { data: produtosData } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })
  const { data: gruposData } = useQuery({
    queryKey: ['grupos'],
    queryFn: () => fetchAllPages((p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })

  // Vendas CONSOLIDADAS via cache (apuracao_vendas, setor=automotivos). Rede-wide
  // (RLS) keyed só pelo range → posto re-agrega no cliente. Só dias fechados.
  const splitCur = splitPeriodAtToday(dataInicial, dataFinal)
  const curIni = splitCur.closedDays?.dataInicial ?? ''
  const curEnd = splitCur.closedDays?.dataFinal ?? ''
  const { data: cacheCur = [], isLoading } = useQuery({
    queryKey: ['pista-cache-vendas', rede?.id, curIni, curEnd],
    queryFn: () => fetchVendasCache({ dataInicial: curIni, dataFinal: curEnd }),
    enabled: !!rede && !!curIni && !!curEnd,
    staleTime: 5 * 60 * 1000,
  })
  const { data: cachePrev = [] } = useQuery({
    queryKey: ['pista-cache-vendas', rede?.id, prevInicial, prevFinal],
    queryFn: () => fetchVendasCache({ dataInicial: prevInicial, dataFinal: prevFinal }),
    enabled: !!rede && !!prevInicial && !!prevFinal,
    staleTime: 5 * 60 * 1000,
  })

  // Rows do cache (automotivos, posto selecionado) → itens agregados. Ticket
  // médio vem do `cupons` (distinto por empresa+dia+setor), dedup por dia.
  const match = (code: number) => empresaCodigos.length === 0 || empresaCodigos.includes(code)
  const toItens = (rows: ApuracaoVendaRow[]) =>
    rows
      .filter((r) => r.setor === 'automotivos' && match(r.empresa_codigo) && r.quantidade !== 0)
      .map((r) => ({ produtoCodigo: r.produto_codigo, quantidade: r.quantidade, totalVenda: r.total_venda, totalCusto: r.total_custo, dataMovimento: r.data }))
  const sumCupons = (rows: ApuracaoVendaRow[]): number => {
    const byDay = new Map<string, number>()
    for (const r of rows) {
      if (r.setor !== 'automotivos' || !match(r.empresa_codigo) || r.cupons <= 0) continue
      byDay.set(`${r.empresa_codigo}|${r.data}`, r.cupons)
    }
    let t = 0
    for (const v of byDay.values()) t += v
    return t
  }
  const vendaItens = useMemo(() => toItens(cacheCur), [cacheCur, empresaCodigos]) // eslint-disable-line react-hooks/exhaustive-deps
  const vendaItensPrev = useMemo(() => toItens(cachePrev), [cachePrev, empresaCodigos]) // eslint-disable-line react-hooks/exhaustive-deps
  const cuponsAtual = useMemo(() => sumCupons(cacheCur), [cacheCur, empresaCodigos]) // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(() => {
    if (!produtosData || !gruposData) return null
    const grupoMap = new Map<number, string>()
    const grupoTipo = new Map<number, string>()
    for (const g of gruposData) { grupoMap.set(g.grupoCodigo, g.nome); grupoTipo.set(g.grupoCodigo, g.tipoGrupo) }

    const pistaProdutos = new Map<number, { nome: string; categoria: string }>()
    for (const p of produtosData) {
      if (classifySetor(p.tipoProduto, grupoTipo.get(p.grupoCodigo)) !== 'automotivos') continue
      pistaProdutos.set(p.produtoCodigo, { nome: p.nome, categoria: categoriaDoGrupo(grupoMap.get(p.grupoCodigo) ?? '') })
    }

    const porProduto = new Map<number, { nome: string; categoria: string; quantidade: number; faturamento: number; custo: number }>()
    const fatDaily = new Map<string, number>()
    const lucroDaily = new Map<string, number>()
    for (const it of vendaItens) {
      const pista = pistaProdutos.get(it.produtoCodigo)
      if (!pista) continue
      const prev = porProduto.get(it.produtoCodigo) ?? { nome: pista.nome, categoria: pista.categoria, quantidade: 0, faturamento: 0, custo: 0 }
      prev.quantidade += it.quantidade
      prev.faturamento += it.totalVenda
      prev.custo += it.totalCusto
      porProduto.set(it.produtoCodigo, prev)
      const day = it.dataMovimento?.slice(0, 10)
      if (day) {
        fatDaily.set(day, (fatDaily.get(day) ?? 0) + it.totalVenda)
        lucroDaily.set(day, (lucroDaily.get(day) ?? 0) + (it.totalVenda - it.totalCusto))
      }
    }

    const produtosVendidos = Array.from(porProduto.entries())
      .map(([produtoCodigo, v]) => ({ produtoCodigo, ...v, margemPct: v.faturamento > 0 ? ((v.faturamento - v.custo) / v.faturamento) * 100 : 0 }))
      .filter((p) => p.faturamento > 0)
      .sort((a, b) => b.faturamento - a.faturamento)

    const porCategoria = new Map<string, { nome: string; faturamento: number; custo: number; qtd: number }>()
    for (const p of produtosVendidos) {
      const prev = porCategoria.get(p.categoria) ?? { nome: p.categoria, faturamento: 0, custo: 0, qtd: 0 }
      prev.faturamento += p.faturamento
      prev.custo += p.custo
      prev.qtd += p.quantidade
      porCategoria.set(p.categoria, prev)
    }
    const categorias = Array.from(porCategoria.values())
      .map((c) => ({ ...c, margemPct: c.faturamento > 0 ? ((c.faturamento - c.custo) / c.faturamento) * 100 : 0 }))
      .sort((a, b) => b.faturamento - a.faturamento)

    const totalFat = produtosVendidos.reduce((s, p) => s + p.faturamento, 0)
    const totalCusto = produtosVendidos.reduce((s, p) => s + p.custo, 0)
    const totalQtd = produtosVendidos.reduce((s, p) => s + p.quantidade, 0)
    const ticket = cuponsAtual > 0 ? totalFat / cuponsAtual : 0

    // Comparativo (mesma régua, período anterior).
    const prevSet = new Set([...pistaProdutos.keys()])
    let prevFat = 0
    for (const it of vendaItensPrev) {
      if (prevSet.has(it.produtoCodigo)) prevFat += it.totalVenda
    }

    // Projeção até o fechamento do mês.
    const today = todayLocal()
    const monthEnd = fimDoMesIso(dataInicial || today)
    const pf = projecaoAvancada({ dailySeries: Array.from(fatDaily.entries()).map(([d, value]) => ({ data: d, value })), today, dataFinal: monthEnd })
    const pl = projecaoAvancada({ dailySeries: Array.from(lucroDaily.entries()).map(([d, value]) => ({ data: d, value })), today, dataFinal: monthEnd })

    const dailyChart = Array.from(fatDaily.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([d, fat]) => ({ label: d.slice(8, 10), fat }))

    return {
      produtosVendidos, categorias, dailyChart,
      kpis: {
        faturamento: totalFat,
        margem: totalFat - totalCusto,
        margemPct: totalFat > 0 ? ((totalFat - totalCusto) / totalFat) * 100 : 0,
        unidades: totalQtd,
        produtosDistintos: produtosVendidos.length,
        ticket,
      },
      prevFat,
      proj: {
        fat: pf.esperado,
        lucro: pl.esperado,
        margemPct: pf.esperado > 0 ? (pl.esperado / pf.esperado) * 100 : 0,
      },
      maxCategoria: Math.max(...categorias.map((c) => c.faturamento), 0),
    }
  }, [produtosData, gruposData, vendaItens, vendaItensPrev, cuponsAtual, dataInicial])

  if (isLoading || !data) return <LoadingScreen message="Carregando pista…" />
  const { kpis: k } = data
  if (k.faturamento <= 0) return <EmptyCard title="Sem vendas de pista" desc="Não há vendas de automotivos (pista) no período e posto selecionados." />

  const projMetrics: ProjMetric[] = [
    { label: 'Faturamento', realizado: k.faturamento, proj: data.proj.fat, fmt: brlShort },
    { label: 'Lucro bruto', realizado: k.margem, proj: data.proj.lucro, fmt: brlShort },
    { label: 'Margem', realizado: k.margemPct, proj: data.proj.margemPct, fmt: (n) => pct(n), ratio: true },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <KpiCard span2 big label="Faturamento" tone="indigo" Icon={Wrench}
          value={brlShort(k.faturamento)} delta={variacaoPct(k.faturamento, data.prevFat)} deltaLabel={cmpLabel} />
        <KpiCard label="Margem" tone="emerald" Icon={Percent} value={pct(k.margemPct)} sub={brlShort(k.margem)} />
        <KpiCard label="Ticket médio" tone="violet" Icon={Ticket} value={brl(k.ticket)} />
        <KpiCard label="Unidades" tone="blue" Icon={ShoppingBag} value={formatNumber(k.unidades)} />
        <KpiCard label="Produtos" tone="amber" Icon={Layers} value={formatNumber(k.produtosDistintos)} />
      </div>

      <ProjecaoSection metrics={projMetrics} periodo={periodo} />

      {data.dailyChart.length > 0 && (
        <Section Icon={Wrench} title="Vendas por dia" accent="indigo">
          <BarChartMobile data={data.dailyChart} valueKey="fat" labelKey="label" />
        </Section>
      )}

      {data.categorias.length > 0 && (
        <Section Icon={Layers} title="Por categoria" flush>
          <div className="divide-y divide-gray-100 dark:divide-[#303030]">
            {data.categorias.map((c) => (
              <div key={c.nome} className="px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-800 dark:text-gray-200">{c.nome}</span>
                  <span className="shrink-0 text-[13px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{brlShort(c.faturamento)}</span>
                  <MarginPill value={c.margemPct} />
                </div>
                <div className="mt-1.5"><ProgressBar pct={data.maxCategoria > 0 ? (c.faturamento / data.maxCategoria) * 100 : 0} color="#4f46e5" /></div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {data.produtosVendidos.length > 0 && (
        <Section Icon={Trophy} title="Top produtos" flush>
          <div className="divide-y divide-gray-100 dark:divide-[#303030]">
            {data.produtosVendidos.slice(0, 8).map((p, i) => (
              <div key={p.produtoCodigo} className="flex items-center gap-2 px-3.5 py-2.5">
                <span className="w-4 shrink-0 text-center text-[12px] font-bold text-gray-400 dark:text-gray-500">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-gray-900 dark:text-gray-100">{p.nome}</p>
                  <p className="text-[10.5px] text-gray-400 dark:text-gray-500">{formatNumber(p.quantidade)} un · {p.categoria}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-[12.5px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{brlShort(p.faturamento)}</span>
                  <Badge tone="indigo">{pct(p.margemPct)}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

export default PistaTabMobile

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Droplet, TrendingUp, Percent, Gauge, ChevronDown, Store, Ticket, ShoppingBag, Layers, Trophy, CalendarRange } from 'lucide-react'
import useFuelVendaCacheAnalytics from '@/pages/Operacao/hooks/useFuelVendaCacheAnalytics'
import useConvenienceData from '@/pages/Conveniencias/hooks/useConvenienceData'
import { fetchApuracaoDiaria } from '@/api/supabase/apuracao'
import { useFilterStore } from '@/store/filters'
import { fimDoMesIso, projecaoAvancada } from '@/lib/projection'
import { offsetPeriod, todayLocal } from '@/lib/period'
import { formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { KpiCard, Section, MarginPill, ProgressBar, Badge } from '@/components/mobile/primitives'
import ProjecaoSection, { type ProjMetric } from '@/components/mobile/ProjecaoSection'
import { BarChartMobile, AreaChartMobile } from '@/components/mobile/charts'
import { LoadingScreen, EmptyCard, NoCostNote } from '@/components/mobile/states'
import { brlShort, brl, liters, litersShort, pct, periodoMes, variacaoPct } from '@/components/mobile/format'

/**
 * Abas mobile de vendas (por-posto) — Combustível e Conveniência. Compartilhadas
 * entre a Central (hub) e o VendasMobile legado. Pista vive em PistaTabMobile.
 */

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between">
    <span className="text-gray-500 dark:text-gray-400">{label}</span>
    <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{value}</span>
  </div>
)

export const CombustivelTab = () => {
  const fuel = useFuelVendaCacheAnalytics()
  const { empresaCodigos, dataInicial, dataFinal, comparisonMode } = useFilterStore()
  const cmpLabel = comparisonMode === 'prevYear' ? 'ano ant.' : 'mês ant.'
  const periodo = useMemo(() => periodoMes(dataInicial, dataFinal), [dataInicial, dataFinal])
  const [expanded, setExpanded] = useState<number | null>(null)

  // Evolução mensal (12m) — volume de combustível por mês (apuracao_diaria).
  const evoIni = useMemo(() => `${offsetPeriod(dataFinal, 11).substring(0, 7)}-01`, [dataFinal])
  const { data: evoRows = [] } = useQuery({
    queryKey: ['comb-evol', empresaCodigos.join(','), evoIni, dataFinal],
    queryFn: () => fetchApuracaoDiaria({ empresaCodigos, dataInicial: evoIni, dataFinal }),
    // Rede-wide quando []=Todos (fetchApuracaoDiaria sem `.in()` = rede via RLS).
    enabled: true,
    staleTime: 10 * 60 * 1000,
  })
  const evolucao = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of evoRows) m.set(r.data.slice(0, 7), (m.get(r.data.slice(0, 7)) ?? 0) + (r.fuel_litros ?? 0))
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, litros]) => ({ label: `${mes.slice(5, 7)}/${mes.slice(2, 4)}`, litros }))
  }, [evoRows])

  // Projeção pela NOSSA fórmula (projecaoAvancada — média móvel), igual ao desktop.
  const proj = useMemo(() => {
    const today = todayLocal()
    const monthEnd = fimDoMesIso(dataInicial)
    const serie = (key: 'faturamento' | 'litros' | 'lucroBruto') => fuel.dailyData.map((d) => ({ data: d.data, value: d[key] }))
    return {
      fat: projecaoAvancada({ dailySeries: serie('faturamento'), today, dataFinal: monthEnd }).esperado,
      lit: projecaoAvancada({ dailySeries: serie('litros'), today, dataFinal: monthEnd }).esperado,
      luc: projecaoAvancada({ dailySeries: serie('lucroBruto'), today, dataFinal: monthEnd }).esperado,
    }
  }, [fuel.dailyData, dataInicial])

  if (fuel.isLoading) return <LoadingScreen message="Carregando combustível…" />
  if (fuel.kpis.litros <= 0) return <EmptyCard />

  const k = fuel.kpis
  const semCusto = k.custo <= 0 && k.faturamento > 0
  const dailyChart = fuel.dailyData.map((d) => ({ label: d.data.slice(8, 10), litros: d.litros, margem: d.margemPct }))
  const projMargem = proj.fat > 0 ? (proj.luc / proj.fat) * 100 : k.margemPct
  const projLbLitro = proj.lit > 0 ? proj.luc / proj.lit : k.lbPorLitro

  const projMetrics: ProjMetric[] = [
    { label: 'Litros', realizado: k.litros, proj: proj.lit, fmt: litersShort },
    { label: 'Faturamento', realizado: k.faturamento, proj: proj.fat, fmt: brlShort },
    { label: 'Lucro bruto', realizado: k.lucroBruto, proj: proj.luc, fmt: brlShort },
    { label: 'Margem', realizado: k.margemPct, proj: projMargem, fmt: (n) => pct(n), ratio: true },
    { label: 'L.B./litro', realizado: k.lbPorLitro, proj: projLbLitro, fmt: (n) => brl(n), ratio: true },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="Litros" tone="blue" Icon={Droplet} value={litersShort(k.litros)} delta={variacaoPct(k.litros, fuel.cmp.litros)} deltaLabel={cmpLabel} />
        <KpiCard label="Lucro bruto" tone="teal" Icon={TrendingUp} value={brlShort(k.lucroBruto)} delta={variacaoPct(k.lucroBruto, fuel.cmp.lucroBruto)} deltaLabel={cmpLabel} />
        <KpiCard label="Margem" tone="rose" Icon={Percent} value={pct(k.margemPct)} delta={fuel.cmp.margemPct > 0 ? k.margemPct - fuel.cmp.margemPct : null} deltaLabel={cmpLabel} />
        <KpiCard label="L.B./litro" tone="indigo" Icon={Gauge} value={brl(k.lbPorLitro)} delta={variacaoPct(k.lbPorLitro, fuel.cmp.lbPorLitro)} deltaLabel={cmpLabel} />
      </div>

      {semCusto && <NoCostNote />}

      <ProjecaoSection metrics={projMetrics} periodo={periodo} />

      <Section Icon={Droplet} title="Volume por dia" accent="blue">
        <BarChartMobile data={dailyChart} valueKey="litros" labelKey="label" />
      </Section>
      <Section Icon={Percent} title="Margem por dia (%)" accent="violet">
        <AreaChartMobile data={dailyChart} valueKey="margem" labelKey="label" />
      </Section>

      {evolucao.length > 1 && (
        <Section Icon={CalendarRange} title="Volume mensal" accent="blue" right={<span className="text-[10.5px] text-gray-400">litros · 12m</span>}>
          <BarChartMobile data={evolucao} valueKey="litros" labelKey="label" />
        </Section>
      )}

      <Section Icon={Droplet} title="Por combustível" flush>
        <div className="divide-y divide-gray-100 dark:divide-[#303030]">
          {fuel.fuelTypeData.map((f) => {
            const open = expanded === f.produtoCodigo
            return (
              <div key={f.produtoCodigo}>
                <button type="button" onClick={() => setExpanded(open ? null : f.produtoCodigo)} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left active:bg-gray-50 dark:active:bg-white/5">
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', open && 'rotate-180')} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">{f.nome}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500">{liters(f.litros)}</p>
                  </div>
                  <span className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{brlShort(f.lucroBruto)}</span>
                  <MarginPill value={f.margem} />
                </button>
                {open && (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 bg-gray-50 px-3.5 pb-3 pt-1 text-[11.5px] dark:bg-[#1c1c1c]">
                    <Detail label="Faturamento" value={brl(f.faturamento)} />
                    <Detail label="Custo (CMV)" value={brl(f.custo)} />
                    <Detail label="Preço médio" value={brl(f.precoMedioVenda)} />
                    <Detail label="Custo médio" value={brl(f.precoCustoMedio)} />
                    <Detail label="L.B./litro" value={brl(f.lbPorLitro)} />
                    <Detail label="Participação" value={pct(f.participacao)} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Section>
    </div>
  )
}

export const ConvenienciaTab = () => {
  const conv = useConvenienceData()
  const { dataInicial, dataFinal } = useFilterStore()
  const periodo = useMemo(() => periodoMes(dataInicial, dataFinal), [dataInicial, dataFinal])
  const cmpLabel = conv.kpis?.comparisonMode === 'prevYear' ? 'ano ant.' : 'mês ant.'

  if (conv.isLoading) return <LoadingScreen message="Carregando conveniência…" />
  const k = conv.kpis
  if (!k || k.faturamento <= 0) return <EmptyCard />

  const { projecao, dailyData, groupTable, topSellers, revenueData } = conv
  const evolucao = revenueData.map((r) => ({ label: r.mes, fat: r.faturamento }))
  const dailyChart = dailyData.map((d) => ({ label: d.data.slice(8, 10), fat: d.faturamento }))
  const maxGrupo = Math.max(...groupTable.map((g) => g.faturamento), 0)

  const projMetrics: ProjMetric[] = [
    { label: 'Faturamento', realizado: k.faturamento, proj: projecao.faturamento, fmt: brlShort },
    { label: 'Lucro bruto', realizado: k.margem, proj: projecao.lucroBruto, fmt: brlShort },
    { label: 'Ticket médio', realizado: k.ticketMedio, proj: projecao.ticketMedio, fmt: (n) => brl(n), ratio: true },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <KpiCard span2 big label="Faturamento" tone="teal" Icon={Store}
          value={brlShort(k.faturamento)} delta={variacaoPct(k.faturamento, k.cmp.faturamento)} deltaLabel={cmpLabel} />
        <KpiCard label="Margem" tone="emerald" Icon={Percent} value={pct(k.margemPct)} sub={brlShort(k.margem)} />
        <KpiCard label="Ticket médio" tone="violet" Icon={Ticket} value={brl(k.ticketMedio)} />
        <KpiCard label="Itens vendidos" tone="blue" Icon={ShoppingBag} value={formatNumber(k.qtdItens)} sub={`${formatNumber(k.qtdCupons)} cupons`} />
        <KpiCard label="Produtos" tone="indigo" Icon={Layers} value={formatNumber(k.totalProdutos)} />
      </div>

      <ProjecaoSection metrics={projMetrics} periodo={periodo} />

      {dailyChart.length > 0 && (
        <Section Icon={Store} title="Vendas por dia" accent="teal">
          <BarChartMobile data={dailyChart} valueKey="fat" labelKey="label" />
        </Section>
      )}

      {evolucao.length > 1 && (
        <Section Icon={CalendarRange} title="Evolução mensal" accent="teal" right={<span className="text-[10.5px] text-gray-400">faturamento</span>}>
          <AreaChartMobile data={evolucao} valueKey="fat" labelKey="label" height={150} />
        </Section>
      )}

      {groupTable.length > 0 && (
        <Section Icon={Layers} title="Por grupo" flush>
          <div className="divide-y divide-gray-100 dark:divide-[#303030]">
            {groupTable.slice(0, 8).map((g) => (
              <div key={g.grupoCodigo} className="px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-800 dark:text-gray-200">{g.nome}</span>
                  <span className="shrink-0 text-[13px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{brlShort(g.faturamento)}</span>
                  <MarginPill value={g.margemPct} />
                </div>
                <div className="mt-1.5"><ProgressBar pct={maxGrupo > 0 ? (g.faturamento / maxGrupo) * 100 : 0} color="#0d9488" /></div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {topSellers.length > 0 && (
        <Section Icon={Trophy} title="Top produtos" flush>
          <div className="divide-y divide-gray-100 dark:divide-[#303030]">
            {topSellers.slice(0, 8).map((p, i) => (
              <div key={p.produtoCodigo} className="flex items-center gap-2 px-3.5 py-2.5">
                <span className="w-4 shrink-0 text-center text-[12px] font-bold text-gray-400 dark:text-gray-500">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-gray-900 dark:text-gray-100">{p.nome}</p>
                  <p className="text-[10.5px] text-gray-400 dark:text-gray-500">{formatNumber(p.quantidade)} un · {p.grupo}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-[12.5px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{brlShort(p.faturamento)}</span>
                  <Badge tone="teal">{pct(p.participacaoPct)}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}

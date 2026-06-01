import { useMemo, useState } from 'react'
import { Droplet, TrendingUp, Percent, Coins, ChevronDown } from 'lucide-react'
import useFuelVendaAnalytics from '@/pages/Operacao/hooks/useFuelVendaAnalytics'
import { useFilterStore } from '@/store/filters'
import { fimDoMesIso, projecaoAvancada } from '@/lib/projection'
import { todayLocal } from '@/lib/period'
import { cn } from '@/lib/utils'
import { ScrollTabs, KpiCard, Section, MarginPill } from '@/components/mobile/primitives'
import ProjecaoSection, { type ProjMetric } from '@/components/mobile/ProjecaoSection'
import { BarChartMobile, AreaChartMobile } from '@/components/mobile/charts'
import { LoadingScreen, EmptyCard, NoCostNote } from '@/components/mobile/states'
import { brlShort, brl, liters, litersShort, pct, periodoMes, variacaoPct } from '@/components/mobile/format'

const TABS = [
  { id: 'geral', label: 'Visão Geral' },
  { id: 'combustivel', label: 'Combustível' },
  { id: 'pista', label: 'Pista' },
  { id: 'conveniencia', label: 'Conveniência' },
]

const Detail = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between">
    <span className="text-gray-500 dark:text-gray-400">{label}</span>
    <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{value}</span>
  </div>
)

const CombustivelTab = () => {
  const fuel = useFuelVendaAnalytics()
  const { dataInicial, dataFinal, comparisonMode } = useFilterStore()
  const cmpLabel = comparisonMode === 'prevYear' ? 'ano ant.' : 'mês ant.'
  const periodo = useMemo(() => periodoMes(dataInicial, dataFinal), [dataInicial, dataFinal])
  const [expanded, setExpanded] = useState<number | null>(null)

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
  if (!fuel.hasEmpresa) return <EmptyCard title="Selecione um posto" desc="Escolha um posto no filtro pra ver os dados de combustível." />
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
        <KpiCard label="Lucro bruto" tone="emerald" Icon={TrendingUp} value={brlShort(k.lucroBruto)} delta={variacaoPct(k.lucroBruto, fuel.cmp.lucroBruto)} deltaLabel={cmpLabel} />
        <KpiCard label="Margem" tone="violet" Icon={Percent} value={pct(k.margemPct)} />
        <KpiCard label="L.B./litro" tone="amber" Icon={Coins} value={brl(k.lbPorLitro)} />
      </div>

      {semCusto && <NoCostNote />}

      <ProjecaoSection metrics={projMetrics} periodo={periodo} />

      <Section Icon={Droplet} title="Volume por dia" accent="blue">
        <BarChartMobile data={dailyChart} valueKey="litros" labelKey="label" />
      </Section>
      <Section Icon={Percent} title="Margem por dia (%)" accent="violet">
        <AreaChartMobile data={dailyChart} valueKey="margem" labelKey="label" />
      </Section>

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

/**
 * Vendas — versão mobile, abas roláveis. Aba Combustível pronta; demais entram
 * nas próximas fases (placeholder por enquanto).
 */
const VendasMobile = () => {
  const [tab, setTab] = useState('combustivel')
  return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Vendas</h1>
      <ScrollTabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'combustivel' ? (
        <CombustivelTab />
      ) : (
        <div className="py-8">
          <EmptyCard title={`${TABS.find((t) => t.id === tab)?.label} em breve`} desc="Esta aba mobile chega nas próximas atualizações." />
        </div>
      )}
    </div>
  )
}

export default VendasMobile

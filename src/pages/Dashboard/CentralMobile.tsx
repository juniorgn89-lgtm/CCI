import { useMemo } from 'react'
import { DollarSign, Droplet, Percent, TrendingUp, Layers, Trophy, Fuel, Wrench, Store } from 'lucide-react'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'
import { useFilterStore } from '@/store/filters'
import { todayLocal } from '@/lib/period'
import { KpiCard, Section, MarginPill, ProgressBar, DeltaBadge } from '@/components/mobile/primitives'
import ProjecaoSection, { type ProjMetric } from '@/components/mobile/ProjecaoSection'
import { LoadingScreen, EmptyCard } from '@/components/mobile/states'
import { brlShort, litersShort, liters, pct, variacaoPct } from '@/components/mobile/format'

/**
 * Central da Rede — versão mobile. Rede-wide, venda fiscal (useRedeSetores, já
 * alinhado ao BI). Sem barra de filtro de posto (visão consolidada).
 */
const CentralMobile = () => {
  const rede = useRedeSetores()
  const { dataInicial, dataFinal, comparisonMode } = useFilterStore()
  const cmpLabel = comparisonMode === 'prevYear' ? 'ano ant.' : 'mês ant.'

  // Período pra projeção (linear por dias decorridos — método da Central).
  const periodo = useMemo(() => {
    const today = todayLocal()
    const fim = dataFinal > today ? today : dataFinal
    const [y, m, d1] = dataInicial.split('-').map(Number)
    const diasNoMes = new Date(y, m, 0).getDate()
    const f = fim.split('-').map(Number)
    const sameMonth = f[0] === y && f[1] === m
    const dia = Math.min(sameMonth ? Math.max(1, f[2] - (d1 - 1)) : diasNoMes, diasNoMes)
    return { dia, dias: diasNoMes, frac: dia / diasNoMes }
  }, [dataInicial, dataFinal])

  const agg = useMemo(() => {
    const { combustivel, automotivos, conveniencia } = rede
    // Faturamento ano anterior existe no nível POSTO (não no setor) — agregamos por posto.
    const byPosto = new Map<number, { nome: string; fat: number; lucro: number; fatAA: number }>()
    for (const setor of [combustivel, automotivos, conveniencia]) {
      for (const p of setor.postos) {
        const cur = byPosto.get(p.empresaCodigo) ?? { nome: p.posto, fat: 0, lucro: 0, fatAA: 0 }
        cur.fat += p.faturamento
        cur.lucro += p.lucroBruto
        cur.fatAA += p.faturamentoAnoAnterior
        byPosto.set(p.empresaCodigo, cur)
      }
    }
    const postos = Array.from(byPosto.values())
      .map((p) => ({ ...p, margem: p.fat > 0 ? (p.lucro / p.fat) * 100 : 0 }))
      .sort((a, b) => b.fat - a.fat)
    const fatAA = postos.reduce((s, p) => s + p.fatAA, 0)
    return { fatAA, postos, maxFat: Math.max(...postos.map((p) => p.fat), 0) }
  }, [rede])

  if (rede.isLoading) return <LoadingScreen message="Carregando a rede…" />
  if (!rede.hasRede || rede.global.faturamento <= 0) return <EmptyCard />

  const { global, combustivel, automotivos, conveniencia } = rede
  const frac = periodo.frac || 1
  const projMetrics: ProjMetric[] = [
    { label: 'Faturamento', realizado: global.faturamento, proj: global.faturamento / frac, fmt: brlShort },
    { label: 'Lucro bruto', realizado: global.lucroBruto, proj: global.lucroBruto / frac, fmt: brlShort },
    { label: 'Litros', realizado: combustivel.qtd, proj: combustivel.qtd / frac, fmt: litersShort },
    { label: 'Margem', realizado: global.margem, proj: global.margem, fmt: (n) => pct(n), ratio: true },
  ]

  const setores = [
    { nome: 'Combustível', Icon: Fuel, sub: liters(combustivel.qtd), s: combustivel },
    { nome: 'Automotivos', Icon: Wrench, sub: `${automotivos.qtd.toLocaleString('pt-BR')} un`, s: automotivos },
    { nome: 'Conveniência', Icon: Store, sub: `${conveniencia.qtd.toLocaleString('pt-BR')} un`, s: conveniencia },
  ]

  return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Central da Rede</h1>

      <div className="grid grid-cols-2 gap-2">
        <KpiCard span2 big label="Faturamento" tone="navy" Icon={DollarSign}
          value={brlShort(global.faturamento)} delta={variacaoPct(global.faturamento, agg.fatAA)} deltaLabel={cmpLabel} />
        <KpiCard label="Lucro bruto" tone="emerald" Icon={TrendingUp}
          value={brlShort(global.lucroBruto)} delta={variacaoPct(global.lucroBruto, global.lucroBrutoAnoAnterior)} deltaLabel={cmpLabel} />
        <KpiCard label="Margem" tone="violet" Icon={Percent} value={pct(global.margem)} />
        <KpiCard label="Litros (comb.)" tone="blue" Icon={Droplet}
          value={litersShort(combustivel.qtd)} delta={variacaoPct(combustivel.qtd, combustivel.qtdAnoAnterior)} deltaLabel={cmpLabel} />
        <KpiCard label="Lucro conv." tone="teal" Icon={Store} value={brlShort(conveniencia.lucroBruto)} sub={`Margem ${pct(conveniencia.margem)}`} />
      </div>

      <ProjecaoSection metrics={projMetrics} periodo={periodo} />

      <Section Icon={Layers} title="Por setor">
        <div className="space-y-2.5">
          {setores.map(({ nome, Icon, sub, s }) => (
            <div key={nome} className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-[#303030]">
                <Icon className="h-[18px] w-[18px] text-gray-500 dark:text-gray-400" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-gray-900 dark:text-gray-100">{nome}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">{sub}</p>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{brlShort(s.faturamento)}</span>
                <MarginPill value={s.margem} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section Icon={Trophy} title="Ranking de postos" flush>
        <div className="divide-y divide-gray-100 dark:divide-[#303030]">
          {agg.postos.map((p, i) => (
            <div key={p.nome} className="px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-medium text-gray-800 dark:text-gray-200">
                  <span className="mr-1.5 font-bold text-gray-400 dark:text-gray-500">{i + 1}</span>{p.nome}
                </span>
                <MarginPill value={p.margem} />
              </div>
              <div className="mt-1.5"><ProgressBar pct={agg.maxFat > 0 ? (p.fat / agg.maxFat) * 100 : 0} /></div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[12px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{brlShort(p.fat)}</span>
                <DeltaBadge value={variacaoPct(p.fat, p.fatAA)} label={cmpLabel} small />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <p className="px-1 pb-1 text-center text-[10.5px] text-gray-400 dark:text-gray-500">
        Evolução mensal e formas de pagamento chegam nas próximas atualizações.
      </p>
    </div>
  )
}

export default CentralMobile

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DollarSign, Droplet, Percent, TrendingUp, Layers, Trophy, Fuel, Wrench, Store, CreditCard, Receipt } from 'lucide-react'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'
import { useFilterStore } from '@/store/filters'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchFormasPagamentoCache, fetchApuracaoDiaria } from '@/api/supabase/apuracao'
import { offsetPeriod, todayLocal } from '@/lib/period'
import { KpiCard, Section, MarginPill, ProgressBar, DeltaBadge, ScrollTabs } from '@/components/mobile/primitives'
import ProjecaoSection, { type ProjMetric } from '@/components/mobile/ProjecaoSection'
import { DonutMobile, AreaChartMobile } from '@/components/mobile/charts'
import { LoadingScreen, EmptyCard } from '@/components/mobile/states'
import { brl, brlShort, litersShort, liters, pct, variacaoPct } from '@/components/mobile/format'
import PistaTabMobile from '@/pages/Comercial/Vendas/PistaTabMobile'
import { CombustivelTab, ConvenienciaTab } from '@/pages/Comercial/Vendas/mobileTabs'

/**
 * Visão Geral da Central — versão mobile. Rede-wide, venda fiscal
 * (useRedeSetores). É a 1ª aba do hub mobile (ver CentralMobile abaixo).
 */
const CentralOverview = () => {
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

  // Empresas da rede (pra ler formas/evolução rede-wide do cache).
  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 10 * 60 * 1000,
  })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const codes = useMemo(() => empresasPermitidas.map((e) => e.codigo), [empresasPermitidas])
  // Início da janela de 12 meses (1º dia do mês 11 meses antes do fim).
  const evoIni = useMemo(() => `${offsetPeriod(dataFinal, 11).substring(0, 7)}-01`, [dataFinal])

  // Formas de pagamento (período, rede inteira) e evolução mensal (12m).
  const { data: formasRows = [] } = useQuery({
    queryKey: ['central-formas', codes.join(','), dataInicial, dataFinal],
    queryFn: () => fetchFormasPagamentoCache({ empresaCodigos: codes, dataInicial, dataFinal }),
    enabled: codes.length > 0,
    staleTime: 5 * 60 * 1000,
  })
  const { data: evoRows = [] } = useQuery({
    queryKey: ['central-evolucao', codes.join(','), evoIni, dataFinal],
    queryFn: () => fetchApuracaoDiaria({ empresaCodigos: codes, dataInicial: evoIni, dataFinal }),
    enabled: codes.length > 0,
    staleTime: 10 * 60 * 1000,
  })

  const formasDonut = useMemo(() => {
    const m = new Map<string, { nome: string; valor: number }>()
    for (const f of formasRows) {
      const tipo = f.tipo_forma_pagamento || 'OUTROS'
      const cur = m.get(tipo) ?? { nome: f.nome_forma_pagamento || tipo, valor: 0 }
      cur.valor += f.valor_pagamento
      m.set(tipo, cur)
    }
    const arr = [...m.values()].sort((a, b) => b.valor - a.valor)
    const top = arr.slice(0, 5)
    const resto = arr.slice(5).reduce((s, x) => s + x.valor, 0)
    if (resto > 0) top.push({ nome: 'Outros', valor: resto })
    return { data: top, total: arr.reduce((s, x) => s + x.valor, 0) }
  }, [formasRows])

  const evolucao = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of evoRows) m.set(r.data.slice(0, 7), (m.get(r.data.slice(0, 7)) ?? 0) + (r.vendas_total ?? 0))
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([mes, fat]) => ({ label: `${mes.slice(5, 7)}/${mes.slice(2, 4)}`, fat }))
  }, [evoRows])

  if (rede.isLoading) return <LoadingScreen message="Carregando a rede…" />
  if (!rede.hasRede || rede.global.faturamento <= 0) return <EmptyCard />

  const { global, combustivel, automotivos, conveniencia } = rede
  // Margem ano-anterior (pp) a partir do lucro/faturamento do ano anterior agregado por posto.
  const margemAnoAnterior = agg.fatAA > 0 ? (global.lucroBrutoAnoAnterior / agg.fatAA) * 100 : 0
  const margemDeltaPp = margemAnoAnterior > 0 ? global.margem - margemAnoAnterior : null
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
      <div className="grid grid-cols-2 gap-2">
        <KpiCard span2 big label="Faturamento da Rede" tone="emerald" Icon={DollarSign}
          value={brlShort(global.faturamento)} delta={variacaoPct(global.faturamento, agg.fatAA)} deltaLabel={cmpLabel}
          sub={`${agg.postos.length} postos · ${brl(global.faturamento)}`} />
        <KpiCard label="Litros" tone="blue" Icon={Droplet}
          value={litersShort(combustivel.qtd)} delta={variacaoPct(combustivel.qtd, combustivel.qtdAnoAnterior)} deltaLabel={cmpLabel} />
        <KpiCard label="Margem" tone="rose" Icon={Percent}
          value={pct(global.margem)} delta={margemDeltaPp} deltaLabel={cmpLabel} />
        <KpiCard label="Lucro Bruto" tone="teal" Icon={TrendingUp}
          value={brlShort(global.lucroBruto)} delta={variacaoPct(global.lucroBruto, global.lucroBrutoAnoAnterior)} deltaLabel={cmpLabel} />
        <KpiCard label="Ticket Médio" tone="amber" Icon={Receipt} value={brl(global.ticketMedio)} />
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

      {formasDonut.data.length > 0 && (
        <Section Icon={CreditCard} title="Formas de pagamento" accent="blue"
          right={<span className="text-[11px] tabular-nums text-gray-400">{brlShort(formasDonut.total)}</span>}>
          <DonutMobile data={formasDonut.data} centerTop={brlShort(formasDonut.total)} centerSub="total" />
        </Section>
      )}

      {evolucao.length > 1 && (
        <Section Icon={TrendingUp} title="Evolução mensal" accent="navy"
          right={<span className="text-[10.5px] text-gray-400">faturamento · 12m</span>}>
          <AreaChartMobile data={evolucao} valueKey="fat" labelKey="label" height={160} />
        </Section>
      )}
    </div>
  )
}

/* ── Hub mobile: Visão Geral (rede) + abas de vendas por-posto ── */

const CENTRAL_TABS = [
  { id: 'geral', label: 'Visão Geral' },
  { id: 'combustivel', label: 'Combustível' },
  { id: 'pista', label: 'Pista' },
  { id: 'conveniencia', label: 'Conveniência' },
]

/**
 * Central da Rede — hub mobile. Aba "Visão Geral" é rede-wide; Combustível/
 * Pista/Conveniência detalham UM posto (sob "Todos" pedem a seleção de um posto,
 * via o seletor exposto na barra de filtro do MobileShell).
 */
const CentralMobile = () => {
  const [tab, setTab] = useState('geral')
  return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Central da Rede</h1>
      <ScrollTabs tabs={CENTRAL_TABS} value={tab} onChange={setTab} />
      {tab === 'geral' ? (
        <CentralOverview />
      ) : tab === 'combustivel' ? (
        <CombustivelTab />
      ) : tab === 'pista' ? (
        <PistaTabMobile />
      ) : (
        <ConvenienciaTab />
      )}
    </div>
  )
}

export default CentralMobile

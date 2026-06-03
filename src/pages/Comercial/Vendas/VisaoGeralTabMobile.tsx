import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DollarSign, Percent, Droplet, Receipt, Fuel, Wrench, Store, Layers, PieChart } from 'lucide-react'
import useFuelVendaAnalytics from '@/pages/Operacao/hooks/useFuelVendaAnalytics'
import useConvenienceData from '@/pages/Conveniencias/hooks/useConvenienceData'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchVendaItens } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { classifySetor } from '@/lib/setorClassification'
import { useFilterStore } from '@/store/filters'
import useVendaCodigosAutorizados from '@/hooks/useVendaCodigosAutorizados'
import { todayLocal, offsetPeriod } from '@/lib/period'
import { projecaoAvancada, fimDoMesIso } from '@/lib/projection'
import { KpiCard, Section, MarginPill, ProgressBar } from '@/components/mobile/primitives'
import ProjecaoSection, { type ProjMetric } from '@/components/mobile/ProjecaoSection'
import { DonutMobile } from '@/components/mobile/charts'
import { LoadingScreen, EmptyCard } from '@/components/mobile/states'
import { brl, brlShort, litersShort, pct, periodoMes, variacaoPct } from '@/components/mobile/format'

const SEG_META = [
  { id: 'combustivel' as const, nome: 'Combustível', Icon: Fuel, color: '#1e3a5f' },
  { id: 'pista' as const, nome: 'Pista', Icon: Wrench, color: '#4f46e5' },
  { id: 'conveniencia' as const, nome: 'Conveniência', Icon: Store, color: '#0d9488' },
]

/**
 * Visão Geral (mix consolidado) — versão mobile. Combina os 3 setores:
 * combustível (useFuelVendaAnalytics), conveniência (useConvenienceData) e
 * pista (venda itens PS-, mesma régua). Mesmos números das abas individuais.
 */
const VisaoGeralTabMobile = () => {
  const { empresaCodigos, dataInicial, dataFinal, comparisonMode } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0
  const periodo = useMemo(() => periodoMes(dataInicial, dataFinal), [dataInicial, dataFinal])
  const cmpLabel = comparisonMode === 'prevYear' ? 'ano ant.' : 'mês ant.'

  // Período anterior (mesma janela de dias decorridos) pra comparar a PISTA.
  const cmpOffset = comparisonMode === 'prevYear' ? 12 : 1
  const fimEfetivo = useMemo(() => { const t = todayLocal(); return dataFinal > t ? t : dataFinal }, [dataFinal])
  const prevInicial = useMemo(() => offsetPeriod(dataInicial, cmpOffset), [dataInicial, cmpOffset])
  const prevFinal = useMemo(() => offsetPeriod(fimEfetivo, cmpOffset), [fimEfetivo, cmpOffset])

  const { kpis: vendaKpis, cmp: fuelCmp, dailyData: combDaily, isLoading: isLoadingComb } = useFuelVendaAnalytics()
  const { kpis: convKpis, dailyData: convDaily, isLoading: isLoadingConv } = useConvenienceData()
  const convCmp = convKpis?.cmp ?? { faturamento: 0, margem: 0, margemPct: 0, ticketMedio: 0, qtdItens: 0 }

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
  const { data: vendaItens = [], isLoading: isLoadingVendas } = useQuery({
    queryKey: ['vendaItens-pista', empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchAllPages((p) => fetchVendaItens({ empresaCodigo: empresaCodigo!, dataInicial, dataFinal, usaProdutoLmc: false, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    enabled: hasEmpresa && empresaCodigo !== null,
  })
  // Cruzamento /VENDA (situacao='A') — exclui cancelados da parte de pista.
  const { autorizados, isLoading: isLoadingAut } = useVendaCodigosAutorizados(empresaCodigos, dataInicial, dataFinal, hasEmpresa)

  // Pista do período anterior (pra delta consolidado do faturamento/margem).
  const { data: vendaItensPrev = [] } = useQuery({
    queryKey: ['vendaItens-pista-prev', empresaCodigo, prevInicial, prevFinal],
    queryFn: () => fetchAllPages((p) => fetchVendaItens({ empresaCodigo: empresaCodigo!, dataInicial: prevInicial, dataFinal: prevFinal, usaProdutoLmc: false, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    enabled: hasEmpresa && empresaCodigo !== null,
  })
  const { autorizados: autorizadosPrev } = useVendaCodigosAutorizados(empresaCodigos, prevInicial, prevFinal, hasEmpresa)

  const segmentos = useMemo(() => {
    const combFat = vendaKpis.faturamento
    const combLucro = vendaKpis.lucroBruto
    const convFat = convKpis?.faturamento ?? 0
    const convLucro = convKpis?.margem ?? 0

    let pistaFat = 0, pistaCusto = 0
    if (produtosData && gruposData) {
      const grupoTipo = new Map(gruposData.map((g) => [g.grupoCodigo, g.tipoGrupo]))
      const psCodigos = new Set(produtosData.filter((p) => classifySetor(p.tipoProduto, grupoTipo.get(p.grupoCodigo)) === 'automotivos').map((p) => p.produtoCodigo))
      for (const item of vendaItens) {
        if (!autorizados.has(item.vendaCodigo)) continue
        if (psCodigos.has(item.produtoCodigo)) { pistaFat += item.totalVenda; pistaCusto += item.totalCusto }
      }
    }
    const pistaLucro = pistaFat - pistaCusto
    return {
      combustivel: { faturamento: combFat, lucro: combLucro, margem: combFat > 0 ? (combLucro / combFat) * 100 : 0 },
      pista: { faturamento: pistaFat, lucro: pistaLucro, margem: pistaFat > 0 ? (pistaLucro / pistaFat) * 100 : 0 },
      conveniencia: { faturamento: convFat, lucro: convLucro, margem: convFat > 0 ? (convLucro / convFat) * 100 : 0 },
    }
  }, [vendaKpis, convKpis, produtosData, gruposData, vendaItens, autorizados])

  const total = useMemo(() => {
    const fat = segmentos.combustivel.faturamento + segmentos.pista.faturamento + segmentos.conveniencia.faturamento
    const lucro = segmentos.combustivel.lucro + segmentos.pista.lucro + segmentos.conveniencia.lucro
    return { faturamento: fat, lucro, margem: fat > 0 ? (lucro / fat) * 100 : 0 }
  }, [segmentos])

  // Cupons (vendas distintas autorizadas) do período → ticket médio consolidado.
  const ticketMedio = useMemo(() => {
    const cupons = new Set<number>()
    for (const it of vendaItens) if (autorizados.has(it.vendaCodigo)) cupons.add(it.vendaCodigo)
    return cupons.size > 0 ? total.faturamento / cupons.size : 0
  }, [vendaItens, autorizados, total.faturamento])

  // Comparação consolidada (comb.cmp + conv.cmp + pista do período anterior).
  const cmpTotal = useMemo(() => {
    let pistaFat = 0, pistaCusto = 0
    if (produtosData && gruposData) {
      const grupoTipo = new Map(gruposData.map((g) => [g.grupoCodigo, g.tipoGrupo]))
      const psCodigos = new Set(produtosData.filter((p) => classifySetor(p.tipoProduto, grupoTipo.get(p.grupoCodigo)) === 'automotivos').map((p) => p.produtoCodigo))
      for (const item of vendaItensPrev) {
        if (!autorizadosPrev.has(item.vendaCodigo)) continue
        if (psCodigos.has(item.produtoCodigo)) { pistaFat += item.totalVenda; pistaCusto += item.totalCusto }
      }
    }
    const fat = fuelCmp.faturamento + convCmp.faturamento + pistaFat
    const lucro = fuelCmp.lucroBruto + convCmp.margem + (pistaFat - pistaCusto)
    return { faturamento: fat, lucro, margem: fat > 0 ? (lucro / fat) * 100 : 0 }
  }, [vendaItensPrev, autorizadosPrev, produtosData, gruposData, fuelCmp, convCmp])
  const margemDeltaPp = cmpTotal.margem > 0 ? total.margem - cmpTotal.margem : null

  const proj = useMemo(() => {
    const today = todayLocal()
    const monthEnd = fimDoMesIso(dataInicial || today)
    const pistaFatDaily = new Map<string, number>()
    const pistaLucroDaily = new Map<string, number>()
    if (produtosData && gruposData) {
      const grupoTipo = new Map(gruposData.map((g) => [g.grupoCodigo, g.tipoGrupo]))
      const psCodigos = new Set(produtosData.filter((p) => classifySetor(p.tipoProduto, grupoTipo.get(p.grupoCodigo)) === 'automotivos').map((p) => p.produtoCodigo))
      for (const item of vendaItens) {
        if (!autorizados.has(item.vendaCodigo)) continue
        if (psCodigos.has(item.produtoCodigo) && item.dataMovimento) {
          const d = item.dataMovimento.substring(0, 10)
          pistaFatDaily.set(d, (pistaFatDaily.get(d) ?? 0) + item.totalVenda)
          pistaLucroDaily.set(d, (pistaLucroDaily.get(d) ?? 0) + (item.totalVenda - item.totalCusto))
        }
      }
    }
    // Série combinada (comb + pista + conv) → projeção total.
    const fatDaily = new Map<string, number>()
    const lucroDaily = new Map<string, number>()
    const addF = (d: string, v: number) => fatDaily.set(d, (fatDaily.get(d) ?? 0) + v)
    const addL = (d: string, v: number) => lucroDaily.set(d, (lucroDaily.get(d) ?? 0) + v)
    for (const d of combDaily) { addF(d.data, d.faturamento); addL(d.data, d.lucroBruto) }
    for (const [d, v] of pistaFatDaily) addF(d, v)
    for (const [d, v] of pistaLucroDaily) addL(d, v)
    for (const d of convDaily) { addF(d.data, d.faturamento); addL(d.data, d.margemRs) }
    const fatTotal = projecaoAvancada({ dailySeries: Array.from(fatDaily.entries()).map(([data, value]) => ({ data, value })), today, dataFinal: monthEnd })
    const lucroTotal = projecaoAvancada({ dailySeries: Array.from(lucroDaily.entries()).map(([data, value]) => ({ data, value })), today, dataFinal: monthEnd })
    return {
      fat: fatTotal.esperado,
      lucro: lucroTotal.esperado,
      margem: fatTotal.esperado > 0 ? (lucroTotal.esperado / fatTotal.esperado) * 100 : 0,
    }
  }, [combDaily, vendaItens, produtosData, gruposData, dataInicial, convDaily, autorizados])

  const isLoading = isLoadingComb || isLoadingConv || isLoadingVendas || isLoadingAut

  if (!hasEmpresa) return <EmptyCard title="Selecione um posto" desc="Escolha um posto no filtro pra ver o mix consolidado." />
  if (isLoading) return <LoadingScreen message="Carregando visão geral…" />
  if (total.faturamento <= 0) return <EmptyCard />

  const donut = SEG_META.map((s) => ({ nome: s.nome, valor: segmentos[s.id].faturamento })).filter((d) => d.valor > 0)
  const maxSeg = Math.max(...SEG_META.map((s) => segmentos[s.id].faturamento), 0)

  const projMetrics: ProjMetric[] = [
    { label: 'Faturamento', realizado: total.faturamento, proj: proj.fat, fmt: brlShort },
    { label: 'Lucro bruto', realizado: total.lucro, proj: proj.lucro, fmt: brlShort },
    { label: 'Margem', realizado: total.margem, proj: proj.margem, fmt: (n) => pct(n), ratio: true },
  ]

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <KpiCard span2 big label="Faturamento total" tone="emerald" Icon={DollarSign}
          value={brlShort(total.faturamento)} delta={variacaoPct(total.faturamento, cmpTotal.faturamento)} deltaLabel={cmpLabel}
          sub={brl(total.faturamento)} />
        <KpiCard label="Litros" tone="blue" Icon={Droplet}
          value={litersShort(vendaKpis.litros)} delta={variacaoPct(vendaKpis.litros, fuelCmp.litros)} deltaLabel={cmpLabel} />
        <KpiCard label="Margem" tone="rose" Icon={Percent}
          value={pct(total.margem)} delta={margemDeltaPp} deltaLabel={cmpLabel} />
        <KpiCard span2 label="Ticket médio" tone="amber" Icon={Receipt}
          value={brl(ticketMedio)} sub="Faturamento ÷ cupons do período" />
      </div>

      <ProjecaoSection metrics={projMetrics} periodo={periodo} />

      {donut.length > 0 && (
        <Section Icon={PieChart} title="Mix de faturamento" accent="blue">
          <DonutMobile data={donut} centerTop={brlShort(total.faturamento)} centerSub="total" />
        </Section>
      )}

      <Section Icon={Layers} title="Por setor" flush>
        <div className="divide-y divide-gray-100 dark:divide-[#303030]">
          {SEG_META.filter((s) => segmentos[s.id].faturamento > 0).map(({ id, nome, Icon }) => {
            const s = segmentos[id]
            return (
              <div key={id} className="px-3.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-[#303030]">
                    <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-gray-900 dark:text-gray-100">{nome}</p>
                    <p className="text-[10.5px] text-gray-400 dark:text-gray-500">{total.faturamento > 0 ? pct((s.faturamento / total.faturamento) * 100) : '—'} do total</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{brlShort(s.faturamento)}</span>
                    <MarginPill value={s.margem} />
                  </div>
                </div>
                <div className="mt-1.5"><ProgressBar pct={maxSeg > 0 ? (s.faturamento / maxSeg) * 100 : 0} /></div>
                <p className="mt-1 text-right text-[10.5px] tabular-nums text-gray-400 dark:text-gray-500">Lucro {brl(s.lucro)}</p>
              </div>
            )
          })}
        </div>
      </Section>
    </div>
  )
}

export default VisaoGeralTabMobile

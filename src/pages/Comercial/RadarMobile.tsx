import { useMemo, useState } from 'react'
import {
  Radar, Fuel, Info, CircleDollarSign, Gauge, Flame, Droplets, Calculator,
  Lightbulb, ShieldCheck, ShieldAlert, ShieldX, Zap, TrendingDown, TrendingUp,
  AlertTriangle, Target, Activity,
} from 'lucide-react'
import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import { useFilterStore } from '@/store/filters'
import { projecaoAvancada, fimDoMesIso } from '@/lib/projection'
import { todayLocal } from '@/lib/period'
import { formatCurrency, formatCurrencyInt, formatLiters, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { Section, ProgressBar, Badge } from '@/components/mobile/primitives'
import { LoadingScreen, EmptyCard } from '@/components/mobile/states'

/* ─── Referências de saúde de margem (mesmas do desktop) ─── */
const MARGEM_SAUDAVEL = 8
const MARGEM_ATENCAO = 5

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const pct1 = (v: number) => `${(v * 100).toFixed(2).replace('.', ',')}%`
const pctLabel = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2).replace('.', ',')}%`
const moneyL = (v: number) => `R$ ${v.toFixed(3).replace('.', ',')}`
const moneyLraw = (v: number) => v.toFixed(3).replace('.', ',')

type Tone = 'emerald' | 'amber' | 'red' | 'blue' | 'slate'
const TONE: Record<Tone, { pill: string; text: string; bar: string }> = {
  emerald: { pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' },
  amber: { pill: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' },
  red: { pill: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30', text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500' },
  blue: { pill: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:ring-blue-500/30', text: 'text-blue-600 dark:text-blue-400', bar: 'bg-blue-500' },
  slate: { pill: 'bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-700/40 dark:text-gray-300 dark:ring-gray-600/40', text: 'text-gray-500 dark:text-gray-400', bar: 'bg-gray-400' },
}

/* ── Delta inline (fração → +x,x%) ── */
const Delta = ({ value, goodWhenUp = true, label }: { value: number | undefined; goodWhenUp?: boolean; label?: string }) => {
  if (value === undefined) return null
  const up = value >= 0
  const good = goodWhenUp ? up : !up
  const Arrow = up ? TrendingUp : TrendingDown
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums', good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
      <Arrow className="h-2.5 w-2.5" />{pctLabel(value)}{label && <span className="font-medium text-gray-400 dark:text-gray-500"> {label}</span>}
    </span>
  )
}

/* ── KPI executivo (preço/L.B./custo/volume) ── */
const ExecCard = ({ Icon, tone, label, value, sub, delta, deltaGoodWhenUp, footer }: {
  Icon: typeof CircleDollarSign; tone: Tone; label: string; value: string; sub: string
  delta?: number; deltaGoodWhenUp?: boolean; footer?: string
}) => (
  <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm dark:border-[#3a3a3a] dark:bg-[#242424]">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{label}</span>
      <Icon className={cn('h-3.5 w-3.5', TONE[tone].text)} />
    </div>
    <div className="mt-1 text-[18px] font-bold tabular-nums tracking-[-0.01em] text-gray-900 dark:text-gray-100">{value}</div>
    <div className="mt-0.5 flex items-center gap-1.5">
      <span className="text-[10px] text-gray-400 dark:text-gray-500">{sub}</span>
      {delta !== undefined && <Delta value={delta} goodWhenUp={deltaGoodWhenUp} />}
    </div>
    {footer && <div className="mt-1 border-t border-gray-100 pt-1 text-[9.5px] leading-snug text-gray-400 dark:border-[#303030] dark:text-gray-500">{footer}</div>}
  </div>
)

/* ── Stat por litro do simulador ── */
const SimStat = ({ label, value, tone }: { label: string; value: string; tone?: Tone }) => (
  <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-2 dark:border-[#3a3a3a] dark:bg-[#242424]">
    <div className="text-[10px] text-gray-500 dark:text-gray-400">{label}</div>
    <div className={cn('mt-0.5 text-[15px] font-bold tabular-nums', tone ? TONE[tone].text : 'text-gray-900 dark:text-gray-100')}>{value}</div>
  </div>
)

/**
 * Radar de Preços — versão mobile. Porta fiel da matemática do GuerraPreco
 * desktop (mesmas fórmulas: série diária, projeção até o fechamento, WoW,
 * elasticidade, simulador e veredito). Reusa useAbastecimentosAnalytics.
 */
const RadarMobile = () => {
  const { rows, fuelTypeData, isLoading } = useAbastecimentosAnalytics()
  const dataInicial = useFilterStore((s) => s.dataInicial)
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)

  const fuelsByVolume = useMemo(
    () => [...fuelTypeData].filter((f) => f.litros > 0).sort((a, b) => b.litros - a.litros),
    [fuelTypeData],
  )
  const [fuelSel, setFuelSel] = useState<string | null>(null)
  const selectedFuel = fuelSel ?? fuelsByVolume[0]?.nome ?? ''
  const [reducao, setReducao] = useState(0.1)

  // Série diária do combustível selecionado (custo = fat − lucro).
  const serie = useMemo(() => {
    const byDay = new Map<string, { litros: number; fat: number; lucro: number }>()
    for (const r of rows) {
      if (r.combustivelNome !== selectedFuel) continue
      const day = (r.dataHora || '').substring(0, 10)
      if (day.length !== 10) continue
      const prev = byDay.get(day) ?? { litros: 0, fat: 0, lucro: 0 }
      prev.litros += r.litros
      prev.fat += r.valorTotal
      prev.lucro += r.lucroBruto
      byDay.set(day, prev)
    }
    return Array.from(byDay.entries())
      .map(([data, v]) => ({
        data,
        litros: v.litros,
        fat: v.fat,
        lucro: v.lucro,
        precoVenda: v.litros > 0 ? v.fat / v.litros : 0,
        precoCusto: v.litros > 0 ? (v.fat - v.lucro) / v.litros : 0,
        lbLitro: v.litros > 0 ? v.lucro / v.litros : 0,
        margem: v.fat > 0 ? (v.lucro / v.fat) * 100 : 0,
      }))
      .sort((a, b) => a.data.localeCompare(b.data))
  }, [rows, selectedFuel])

  const agg = useMemo(() => {
    const totLitros = serie.reduce((s, d) => s + d.litros, 0)
    const totFat = serie.reduce((s, d) => s + d.fat, 0)
    const totLucro = serie.reduce((s, d) => s + d.lucro, 0)
    const dias = serie.length
    return {
      totLitros, totLucro, dias,
      precoVendaMedio: totLitros > 0 ? totFat / totLitros : 0,
      precoCustoMedio: totLitros > 0 ? (totFat - totLucro) / totLitros : 0,
      lbLitro: totLitros > 0 ? totLucro / totLitros : 0,
      margem: totFat > 0 ? (totLucro / totFat) * 100 : 0,
      litrosDia: dias > 0 ? totLitros / dias : 0,
    }
  }, [serie])

  // Projeção até o fechamento do mês (projecaoAvancada = método do app).
  const proj = useMemo(() => {
    const today = todayLocal()
    const base = dataInicial || serie[0]?.data || today
    const monthEnd = fimDoMesIso(base)
    const fatP = projecaoAvancada({ dailySeries: serie.map((d) => ({ data: d.data, value: d.fat })), today, dataFinal: monthEnd })
    const litrosP = projecaoAvancada({ dailySeries: serie.map((d) => ({ data: d.data, value: d.litros })), today, dataFinal: monthEnd })
    const lucroP = projecaoAvancada({ dailySeries: serie.map((d) => ({ data: d.data, value: d.lucro })), today, dataFinal: monthEnd })
    const litrosRest = litrosP.esperado - litrosP.realizado
    const fatRest = fatP.esperado - fatP.realizado
    const lucroRest = lucroP.esperado - lucroP.realizado
    return {
      isProjetada: fatP.diasRestantes > 0,
      diasFechados: fatP.diasFechados, diasRestantes: fatP.diasRestantes,
      fat: fatP.esperado, litros: litrosP.esperado, lucro: lucroP.esperado,
      margem: fatP.esperado > 0 ? (lucroP.esperado / fatP.esperado) * 100 : 0,
      fatReal: fatP.realizado, litrosReal: litrosP.realizado, lucroReal: lucroP.realizado,
      litrosRest, fatRest, lucroRest,
      precoRest: litrosRest > 0 ? fatRest / litrosRest : agg.precoVendaMedio,
      lbRest: litrosRest > 0 ? lucroRest / litrosRest : agg.lbLitro,
    }
  }, [serie, dataInicial, agg])

  const horizonte = proj.isProjetada
    ? { label: 'até o fechamento', volVar: proj.litrosRest, preco: proj.precoRest, lb: proj.lbRest, fix: { fat: proj.fatReal, litros: proj.litrosReal, lucro: proj.lucroReal } }
    : { label: 'no período', volVar: agg.totLitros, preco: agg.precoVendaMedio, lb: agg.lbLitro, fix: { fat: 0, litros: 0, lucro: 0 } }

  const cenarioProj = useMemo(() => (r: number, g: number) => {
    const vol = horizonte.volVar * (1 + g)
    const fat = horizonte.fix.fat + (horizonte.preco - r) * vol
    const litros = horizonte.fix.litros + vol
    const lucro = horizonte.fix.lucro + (horizonte.lb - r) * vol
    return { fat, litros, lucro, margem: fat > 0 ? (lucro / fat) * 100 : 0 }
  }, [horizonte])

  // Comparação semana atual × anterior.
  const wow = useMemo(() => {
    const n = serie.length
    const w = Math.min(7, Math.floor(n / 2)) || 1
    const windowAgg = (arr: typeof serie) => {
      const litros = arr.reduce((s, d) => s + d.litros, 0)
      const fat = arr.reduce((s, d) => s + d.fat, 0)
      const lucro = arr.reduce((s, d) => s + d.lucro, 0)
      return {
        precoVenda: litros > 0 ? fat / litros : 0,
        precoCusto: litros > 0 ? (fat - lucro) / litros : 0,
        lbLitro: litros > 0 ? lucro / litros : 0,
        litrosDia: arr.length > 0 ? litros / arr.length : 0,
      }
    }
    const last = windowAgg(serie.slice(n - w))
    const prevArr = serie.slice(Math.max(0, n - 2 * w), n - w)
    const prev = windowAgg(prevArr)
    const d = (x: number, y: number) => (y > 0 ? x / y - 1 : 0)
    return {
      hasPrev: prevArr.length > 0, last,
      precoDelta: d(last.precoVenda, prev.precoVenda),
      custoDelta: d(last.precoCusto, prev.precoCusto),
      lbDelta: prev.lbLitro !== 0 ? last.lbLitro / prev.lbLitro - 1 : 0,
      volDelta: d(last.litrosDia, prev.litrosDia),
    }
  }, [serie])

  // Cortes de preço (dias com queda vs anterior).
  const cortes = useMemo(() => {
    const out: { data: string; queda: number; novoPreco: number; varLitros: number }[] = []
    for (let i = 1; i < serie.length; i++) {
      const queda = serie[i].precoVenda - serie[i - 1].precoVenda
      if (queda < -0.005) out.push({ data: serie[i].data, queda, novoPreco: serie[i].precoVenda, varLitros: serie[i - 1].litros > 0 ? serie[i].litros / serie[i - 1].litros - 1 : 0 })
    }
    return out
  }, [serie])

  const elasticidade = useMemo(() => {
    let num = 0, den = 0
    for (const c of cortes) {
      const cut = -c.queda
      if (cut <= 0.005) continue
      num += c.varLitros; den += cut
    }
    return den > 0 ? num / den : null
  }, [cortes])

  // Curva de elasticidade — pra cada corte, % de volume necessário pra empatar
  // o lucro (break-even) e o % estimado pela elasticidade observada.
  const elasticData = useMemo(() => {
    const cuts = [0.03, 0.05, 0.08, 0.1, 0.13, 0.15, 0.2]
    return cuts
      .filter((c) => agg.lbLitro - c > 0.001)
      .map((c) => ({
        label: `-${moneyLraw(c).slice(0, 4)}`,
        necessario: (agg.lbLitro / (agg.lbLitro - c) - 1) * 100,
        esperado: elasticidade != null ? Math.max(0, elasticidade * c) * 100 : null,
      }))
  }, [agg.lbLitro, elasticidade])

  const margemTone: Tone = agg.margem >= MARGEM_SAUDAVEL ? 'emerald' : agg.margem >= MARGEM_ATENCAO ? 'amber' : 'red'
  const margemLabel = margemTone === 'emerald' ? 'Saudável' : margemTone === 'amber' ? 'Atenção' : 'Crítica'
  const lbMinSustentavel = agg.precoVendaMedio * (MARGEM_ATENCAO / 100)
  const compRatio = agg.precoVendaMedio > 0 ? wow.last.precoVenda / agg.precoVendaMedio - 1 : 0
  const compTone: Tone = compRatio < -0.004 ? 'emerald' : compRatio > 0.004 ? 'red' : 'amber'
  const compLabel = compTone === 'emerald' ? 'Competitivo' : compTone === 'red' ? 'Acima da média' : 'Na média'

  const sim = useMemo(() => {
    const lbAtual = agg.lbLitro
    const novoLb = lbAtual - reducao
    const belowBreakeven = novoLb <= 0
    const novoPreco = agg.precoVendaMedio - reducao
    const breakEvenGrowth = belowBreakeven ? Infinity : lbAtual / novoLb - 1
    const expGrowth = elasticidade != null ? Math.max(0, elasticidade * reducao) : null
    const margemFinal = novoPreco > 0 ? (novoLb / novoPreco) * 100 : 0
    return {
      lbAtual, novoLb, belowBreakeven, novoPreco, breakEvenGrowth, expGrowth, margemFinal,
      baseline: cenarioProj(0, 0),
      semReacao: cenarioProj(reducao, 0),
      comElasticidade: expGrowth != null ? cenarioProj(reducao, expGrowth) : null,
    }
  }, [agg, reducao, elasticidade, cenarioProj])

  // Veredito de viabilidade.
  const viab = useMemo(() => {
    const refCut = Math.min(0.1, agg.lbLitro * 0.5)
    const breakEvenRef = agg.lbLitro - refCut > 0 ? agg.lbLitro / (agg.lbLitro - refCut) - 1 : Infinity
    const margemScore = clamp01((agg.margem - MARGEM_ATENCAO) / (MARGEM_SAUDAVEL * 1.6 - MARGEM_ATENCAO))
    const elasticScore = isFinite(breakEvenRef) ? clamp01(1 - breakEvenRef / 0.25) : 0
    const momentumScore = clamp01(0.5 + wow.volDelta * 3)
    const histScore = elasticidade != null ? clamp01((elasticidade * refCut) / Math.max(0.0001, breakEvenRef)) : 0.4
    const score = Math.round((0.34 * margemScore + 0.3 * elasticScore + 0.16 * momentumScore + 0.2 * histScore) * 100)
    const tone: Tone = score >= 66 ? 'emerald' : score >= 40 ? 'amber' : 'red'
    const verdict = score >= 66 ? 'Estratégia viável' : score >= 40 ? 'Viável com cautela' : 'Alto risco financeiro'
    const Icon = score >= 66 ? ShieldCheck : score >= 40 ? ShieldAlert : ShieldX
    const resumo = score >= 66
      ? 'Margem com folga e elasticidade favorável — há espaço pra competir no preço cobrindo a perda com volume.'
      : score >= 40
        ? `Dá pra reduzir, mas a margem é apertada: só compensa se o volume reagir bem (~${pct1(breakEvenRef)} pra um corte de ${moneyL(refCut)}).`
        : 'Margem perto do piso e/ou volume sem reação. Reduzir preço agora tende a corroer o lucro sem retorno.'
    return {
      score, tone, verdict, Icon, resumo,
      factors: [
        { label: 'Saúde da margem', value: margemScore, hint: `${agg.margem.toFixed(2).replace('.', ',')}%` },
        { label: 'Reação do volume', value: elasticScore, hint: isFinite(breakEvenRef) ? `+${pct1(breakEvenRef)}` : '—' },
        { label: 'Volume na semana', value: momentumScore, hint: wow.hasPrev ? pctLabel(wow.volDelta) : '—' },
        { label: 'Resposta a cortes', value: histScore, hint: elasticidade != null ? `${cortes.length} corte(s)` : 'sem histórico' },
      ],
    }
  }, [agg, wow, elasticidade, cortes.length])

  const alertas = useMemo(() => {
    const out: { tone: Tone; Icon: typeof Info; text: string }[] = []
    if (margemTone === 'red') out.push({ tone: 'red', Icon: ShieldX, text: `Margem crítica (${agg.margem.toFixed(2).replace('.', ',')}%) — abaixo do piso de ~${MARGEM_ATENCAO}%.` })
    else if (margemTone === 'amber') out.push({ tone: 'amber', Icon: ShieldAlert, text: 'A margem atual está próxima do limite mínimo saudável.' })
    if (wow.hasPrev && wow.custoDelta > 0.01) out.push({ tone: wow.custoDelta > 0.03 ? 'red' : 'amber', Icon: Flame, text: `O custo subiu ${pct1(wow.custoDelta)} nos últimos 7 dias — pressão sobre a margem.` })
    else if (wow.hasPrev && wow.custoDelta < -0.01) out.push({ tone: 'emerald', Icon: TrendingDown, text: `O custo caiu ${pct1(Math.abs(wow.custoDelta))} nos últimos 7 dias — abre espaço para preço.` })
    if (isFinite(sim.breakEvenGrowth) && sim.breakEvenGrowth > 0.15) out.push({ tone: 'amber', Icon: Zap, text: `A redução simulada exige volume agressivo (+${pct1(sim.breakEvenGrowth)}) só pra empatar.` })
    if (wow.hasPrev && wow.volDelta < -0.05) out.push({ tone: 'amber', Icon: TrendingDown, text: `Volume em queda (${pctLabel(wow.volDelta)}) na semana — cautela ao cortar preço.` })
    else if (wow.hasPrev && wow.volDelta > 0.05) out.push({ tone: 'emerald', Icon: TrendingUp, text: `Volume em alta (${pctLabel(wow.volDelta)}) na semana — momento favorável.` })
    if (elasticidade != null && elasticidade <= 0.05 && cortes.length > 0) out.push({ tone: 'amber', Icon: AlertTriangle, text: 'Cortes anteriores geraram pouco volume — elasticidade baixa.' })
    if (compTone === 'red') out.push({ tone: 'amber', Icon: Target, text: `Seu preço recente está ${pct1(compRatio)} acima da sua média do período.` })
    return out.slice(0, 5)
  }, [margemTone, agg.margem, wow, sim.breakEvenGrowth, elasticidade, cortes.length, compTone, compRatio])

  if (isLoading) return <LoadingScreen message="Carregando radar de preços…" />
  if (fuelsByVolume.length === 0) {
    // O Radar usa o ritmo de bomba POR POSTO (abastecimento físico), que só vem
    // com 1 posto selecionado — separa esse motivo do "sem vendas" de verdade.
    if (empresaCodigos.length !== 1) {
      return <EmptyCard title="Selecione um único posto" desc="O Radar de Preços analisa o ritmo de bomba por posto — escolha UM posto no filtro pra ver a simulação." />
    }
    return <EmptyCard title="Sem vendas de combustível" desc="Não há vendas de combustível no período pra analisar. Ajuste o período no filtro." />
  }

  const maxCut = Math.max(0.2, Math.ceil(agg.lbLitro * 100) / 100)
  const VIcon = viab.Icon

  return (
    <div className="space-y-3 pb-2">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#1e3a5f] to-[#2563eb]">
          <Radar className="h-4 w-4 text-white" />
        </span>
        <div>
          <h1 className="text-[17px] font-bold leading-tight text-gray-900 dark:text-gray-100">Radar de Preços</h1>
          <p className="text-[10.5px] text-gray-400 dark:text-gray-500">Preço, margem, elasticidade e risco da redução.</p>
        </div>
      </div>

      {/* Seletor de combustível */}
      <div className="-mx-0.5 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none]">
        {fuelsByVolume.map((f) => (
          <button
            key={f.nome}
            type="button"
            onClick={() => setFuelSel(f.nome)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-[11.5px] font-medium transition-colors',
              selectedFuel === f.nome
                ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-blue-700'
                : 'border border-gray-200 bg-white text-gray-600 dark:border-[#3a3a3a] dark:bg-[#242424] dark:text-gray-400',
            )}
          >
            <Fuel className="h-3 w-3" />{f.nome}
          </button>
        ))}
      </div>

      {serie.length < 2 ? (
        <EmptyCard title="A análise precisa de mais de 1 dia" desc="Amplie o período na barra de datas pra comparar a evolução do preço e da margem." />
      ) : (
        <>
          {/* Viabilidade */}
          <div className={cn('rounded-xl p-3.5 ring-1', TONE[viab.tone].pill)}>
            <div className="flex items-center gap-3">
              <VIcon className="h-8 w-8 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[15px] font-bold">{viab.verdict}</span>
                  <span className="text-[12px] font-semibold tabular-nums opacity-80">{viab.score}/100</span>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug opacity-90">{viab.resumo}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
              {viab.factors.map((f) => (
                <div key={f.label}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[10px] opacity-80">{f.label}</span>
                    <span className="text-[10px] font-semibold tabular-nums opacity-90">{f.hint}</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div className={cn('h-full rounded-full', TONE[viab.tone].bar)} style={{ width: `${Math.round(f.value * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Projeção até o fechamento (baseline) */}
          {proj.isProjetada && (
            <Section Icon={Activity} title="Projeção até o fechamento" accent="blue"
              right={<span className="text-[10.5px] text-gray-400">{proj.diasFechados}d feitos · {proj.diasRestantes}d restam</span>}>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { l: 'Faturamento', v: formatCurrencyInt(proj.fat) },
                  { l: 'Lucro bruto', v: formatCurrencyInt(proj.lucro) },
                  { l: 'Volume', v: formatLiters(proj.litros) },
                ].map((m) => (
                  <div key={m.l} className="rounded-lg bg-gray-50 px-2 py-2 dark:bg-[#1c1c1c]">
                    <div className="text-[15px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{m.v}</div>
                    <div className="text-[9.5px] text-gray-400 dark:text-gray-500">{m.l}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* KPIs executivos */}
          <div className="grid grid-cols-2 gap-2">
            <ExecCard Icon={CircleDollarSign} tone="blue" label="Preço de venda" value={moneyL(agg.precoVendaMedio)}
              sub="médio" delta={wow.hasPrev ? wow.precoDelta : undefined} deltaGoodWhenUp
              footer={`Competitividade: ${compLabel.toLowerCase()}`} />
            <ExecCard Icon={Gauge} tone={margemTone} label="L.B. / Litro" value={moneyL(agg.lbLitro)}
              sub={`Margem ${agg.margem.toFixed(2).replace('.', ',')}% · ${margemLabel}`}
              delta={wow.hasPrev ? wow.lbDelta : undefined} deltaGoodWhenUp
              footer={`Mín. sustentável ${moneyL(lbMinSustentavel)}`} />
            <ExecCard Icon={Flame} tone={wow.custoDelta > 0.005 ? 'red' : wow.custoDelta < -0.005 ? 'emerald' : 'slate'}
              label="Preço de custo" value={moneyL(agg.precoCustoMedio)} sub="piso da redução"
              delta={wow.hasPrev ? wow.custoDelta : undefined} deltaGoodWhenUp={false} />
            <ExecCard Icon={Droplets} tone="blue" label="Volume" value={`${formatNumber(agg.litrosDia)} L`}
              sub="litros/dia" delta={wow.hasPrev ? wow.volDelta : undefined} deltaGoodWhenUp
              footer={elasticidade != null ? `-R$0,10 ≈ +${pct1(Math.max(0, elasticidade * 0.1))} vol.` : undefined} />
          </div>

          {/* Simulador */}
          <Section Icon={Calculator} title="Simulador de corte" accent="navy">
            <div className="flex items-end justify-between">
              <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Reduzir o preço em</span>
              <span className="text-2xl font-bold tabular-nums text-[#1e3a5f] dark:text-blue-300">
                R$ {moneyLraw(reducao).slice(0, 4)}<span className="text-sm font-medium text-gray-400">/L</span>
              </span>
            </div>
            <input
              type="range" min={0} max={maxCut} step={0.01}
              value={Math.min(reducao, maxCut)}
              onChange={(e) => setReducao(Number(e.target.value))}
              className={cn(
                'mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500',
                '[&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#1e3a5f] [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md dark:[&::-webkit-slider-thumb]:border-blue-400',
                '[&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#1e3a5f] [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-md',
              )}
            />
            <div className="mt-1 flex justify-between text-[9.5px] tabular-nums text-gray-400">
              <span>R$ 0,00</span>
              <span>sem lucro a partir de {moneyL(agg.lbLitro).slice(3)}</span>
              <span>R$ {moneyLraw(maxCut).slice(0, 4)}</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {[0.03, 0.05, 0.1, 0.15].map((c) => (
                <button key={c} type="button" onClick={() => setReducao(c)}
                  className={cn('rounded-md px-2.5 py-1 text-[11px] font-medium tabular-nums transition-colors',
                    Math.abs(reducao - c) < 0.001 ? 'bg-[#1e3a5f] text-white dark:bg-blue-700' : 'border border-gray-200 bg-white text-gray-600 dark:border-[#3a3a3a] dark:bg-[#242424] dark:text-gray-400')}>
                  -R$ {moneyLraw(c).slice(0, 4)}
                </button>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <SimStat label="Novo preço" value={moneyL(sim.novoPreco)} />
              <SimStat label="Nova L.B./L" value={moneyL(sim.novoLb)} tone={sim.belowBreakeven ? 'red' : sim.novoLb < lbMinSustentavel ? 'amber' : 'emerald'} />
              <SimStat label="Margem / L" value={sim.novoPreco > 0 ? `${sim.margemFinal.toFixed(2).replace('.', ',')}%` : '—'} tone={sim.margemFinal >= MARGEM_SAUDAVEL ? 'emerald' : sim.margemFinal >= MARGEM_ATENCAO ? 'amber' : 'red'} />
              <SimStat label="Volume p/ empatar" value={sim.belowBreakeven ? '∞' : `+${pct1(sim.breakEvenGrowth)}`} tone={sim.belowBreakeven || sim.breakEvenGrowth > 0.2 ? 'red' : sim.breakEvenGrowth > 0.1 ? 'amber' : 'emerald'} />
            </div>

            {/* 3 projeções de fechamento */}
            <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 dark:border-[#3a3a3a]">
              <table className="w-full text-[11px]">
                <thead className="bg-gray-50 text-[9px] uppercase tracking-wide text-gray-500 dark:bg-[#1c1c1c] dark:text-gray-400">
                  <tr>
                    <th className="px-2.5 py-1.5 text-left font-medium">Proj. {horizonte.label}</th>
                    <th className="px-2 py-1.5 text-right font-medium">S/ alt.</th>
                    <th className="px-2 py-1.5 text-right font-medium text-amber-600 dark:text-amber-400">Corte</th>
                    <th className="px-2 py-1.5 text-right font-medium text-blue-600 dark:text-blue-400">+elast.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#303030]">
                  {[
                    { l: 'Faturamento', b: sim.baseline.fat, c: sim.semReacao.fat, e: sim.comElasticidade?.fat, fmt: formatCurrencyInt },
                    { l: 'Lucro bruto', b: sim.baseline.lucro, c: sim.semReacao.lucro, e: sim.comElasticidade?.lucro, fmt: formatCurrencyInt },
                    { l: 'Margem', b: sim.baseline.margem, c: sim.semReacao.margem, e: sim.comElasticidade?.margem, fmt: (v: number) => `${v.toFixed(2).replace('.', ',')}%` },
                    { l: 'Volume', b: sim.baseline.litros, c: sim.semReacao.litros, e: sim.comElasticidade?.litros, fmt: (v: number) => formatLiters(v) },
                  ].map((r) => (
                    <tr key={r.l}>
                      <td className="px-2.5 py-1.5 text-gray-600 dark:text-gray-300">{r.l}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{r.fmt(r.b)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-amber-600 dark:text-amber-400">{r.fmt(r.c)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-blue-600 dark:text-blue-400">{r.e != null ? r.fmt(r.e) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {sim.belowBreakeven ? (
              <p className={cn('mt-2.5 flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] ring-1', TONE.red.pill)}>
                <ShieldX className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Com esse corte o preço fica no/abaixo do custo ({moneyL(agg.precoCustoMedio)}) — qualquer volume só amplia o prejuízo.
              </p>
            ) : (
              <p className={cn('mt-2.5 flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] ring-1', TONE.amber.pill)}>
                <TrendingDown className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Sem reação de volume, o lucro {horizonte.label} cairia para <strong>{formatCurrency(sim.semReacao.lucro)}</strong> (vs. {formatCurrency(sim.baseline.lucro)} sem alteração).</span>
              </p>
            )}
            {!sim.belowBreakeven && sim.comElasticidade && sim.expGrowth != null && (
              <p className={cn('mt-1.5 flex items-start gap-2 rounded-lg px-3 py-2 text-[11px] ring-1', sim.comElasticidade.lucro >= sim.baseline.lucro ? TONE.emerald.pill : TONE.amber.pill)}>
                <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Com elasticidade estimada de +{pct1(sim.expGrowth)}, o lucro {sim.comElasticidade.lucro >= sim.baseline.lucro ? 'subiria' : 'ficaria'} em <strong>{formatCurrency(sim.comElasticidade.lucro)}</strong>.</span>
              </p>
            )}
          </Section>

          {/* Alertas */}
          <Section Icon={Lightbulb} title="Alertas inteligentes" accent="amber">
            <div className="space-y-2">
              {alertas.length === 0 ? (
                <div className={cn('flex items-center gap-2 rounded-lg px-3 py-2.5 text-[11.5px] ring-1', TONE.emerald.pill)}>
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  Nenhum alerta crítico — preço, margem e volume em equilíbrio.
                </div>
              ) : (
                alertas.map((a, i) => (
                  <div key={i} className={cn('flex items-start gap-2 rounded-lg px-3 py-2.5 text-[11.5px] ring-1', TONE[a.tone].pill)}>
                    <a.Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="leading-snug">{a.text}</span>
                  </div>
                ))
              )}
            </div>
            <p className="mt-2.5 border-t border-gray-100 pt-2 text-[9.5px] leading-snug text-gray-400 dark:border-[#303030]">
              Análise baseada nos dados da própria rede. Preços de concorrentes não estão integrados.
            </p>
          </Section>

          {/* Curva de elasticidade */}
          {elasticData.length > 0 && (
            <Section Icon={Zap} title="Volume extra por corte" accent="amber">
              <p className="mb-2 text-[10.5px] leading-snug text-gray-400 dark:text-gray-500">
                Volume a mais necessário pra bancar cada corte (break-even){elasticidade != null && ' · "est." = crescimento previsto pela elasticidade observada'}.
              </p>
              <div className="space-y-2">
                {elasticData.map((d) => {
                  const cor = d.necessario > 20 ? '#ef4444' : d.necessario > 10 ? '#f59e0b' : '#10b981'
                  return (
                    <div key={d.label}>
                      <div className="mb-1 flex items-baseline justify-between text-[11px]">
                        <span className="font-medium text-gray-600 dark:text-gray-300">corte {d.label}/L</span>
                        <span className="tabular-nums">
                          <span className="font-semibold" style={{ color: cor }}>+{d.necessario.toFixed(2).replace('.', ',')}%</span>
                          {d.esperado != null && <span className="ml-1.5 text-[10px] text-blue-600 dark:text-blue-400">est. +{d.esperado.toFixed(2).replace('.', ',')}%</span>}
                        </span>
                      </div>
                      <ProgressBar pct={Math.min(100, d.necessario)} color={cor} height={5} />
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          {/* Cortes de preço no período */}
          {cortes.length > 0 && (
            <Section Icon={TrendingDown} title="Cortes de preço no período" right={<Badge tone="rose">{cortes.length}</Badge>} flush>
              <div className="divide-y divide-gray-100 dark:divide-[#303030]">
                {[...cortes].reverse().map((c) => (
                  <div key={c.data} className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium text-gray-900 dark:text-gray-100">{c.data.slice(8, 10)}/{c.data.slice(5, 7)}</p>
                      <p className="text-[10.5px] text-gray-400 dark:text-gray-500">novo preço {moneyL(c.novoPreco)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="text-[12px] font-bold tabular-nums text-red-600 dark:text-red-400">{moneyL(c.queda)}</span>
                      <Delta value={c.varLitros} goodWhenUp label="vol." />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  )
}

export default RadarMobile

import { useMemo, useState, type ReactNode } from 'react'
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { Activity, PieChart as PieIcon, Trophy, Percent, TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import InfoHint from '@/components/ui/InfoHint'
import { useChartTheme } from '@/lib/chartTheme'
import { formatCurrencyInt, formatCurrencyShort, formatLiters, formatNumber } from '@/lib/formatters'
import useRedeSetores, { type RedeSetor } from '@/pages/Dashboard/hooks/useRedeSetores'

/**
 * Gráficos EXECUTIVOS da Visão Geral (modo "quero saber rápido como a rede está").
 *
 * Tudo deriva do que `useRedeSetores` JÁ carrega (totais, série diária e postos
 * por setor) — nenhuma consulta nova, nenhuma regra de cálculo nova: só
 * agregação de apresentação. O hook é o mesmo do painel de KPIs e da tabela de
 * Detalhamento (chaves iguais no React Query → uma leitura só).
 *
 * Fica MONTADO quando o usuário entra no modo de análise (o pai recolhe com
 * CollapseTransition), então trocar de modo não refaz nada aqui.
 */

type SetorKey = 'combustivel' | 'automotivos' | 'conveniencia'
const SETOR_COR: Record<SetorKey, string> = { combustivel: '#2563eb', conveniencia: '#10b981', automotivos: '#f59e0b' }
const SETOR_LABEL: Record<SetorKey, string> = { combustivel: 'Combustível', conveniencia: 'Conveniência', automotivos: 'Automotivos' }

type RankMetric = 'lucroBruto' | 'faturamento' | 'margem' | 'litros'
const RANK_TABS: { id: RankMetric; label: string }[] = [
  { id: 'lucroBruto', label: 'Lucro bruto' },
  { id: 'faturamento', label: 'Faturamento' },
  { id: 'margem', label: 'Margem' },
  { id: 'litros', label: 'Litros' },
]

const pct = (v: number, casas = 2) => `${v.toFixed(casas).replace('.', ',')}%`
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const varPct = (atual: number, anterior: number): number | null => (anterior > 0 ? ((atual - anterior) / anterior) * 100 : null)

/* ───────────────────────────── blocos visuais ───────────────────────────── */

const Card = ({ Icon, title, hint, right, children, className }: {
  Icon: LucideIcon
  title: string
  hint?: string
  right?: ReactNode
  children: ReactNode
  className?: string
}) => (
  <section className={cn('flex min-w-0 flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black', className)}>
    <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a5f]/[0.07] text-[#1e3a5f] dark:bg-white/10 dark:text-blue-300">
          <Icon className="h-4 w-4" />
        </span>
        {title}
        {hint && <InfoHint text={hint} />}
      </h3>
      {right}
    </header>
    {children}
  </section>
)

const Delta = ({ value, label }: { value: number | null; label: string }) => {
  if (value === null) return <span className="text-[11px] text-gray-400">sem base {label}</span>
  const up = value > 0.05, down = value < -0.05
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus
  return (
    <span className={cn('inline-flex items-center gap-1 text-[11.5px] font-semibold tabular-nums', up ? 'text-emerald-600 dark:text-emerald-400' : down ? 'text-red-600 dark:text-red-400' : 'text-gray-500')}>
      <Icon className="h-3.5 w-3.5" />
      {value > 0 ? '+' : ''}{pct(value)} <span className="font-normal text-gray-400">{label}</span>
    </span>
  )
}

/** Sparkline inline (SVG) — área suave da série diária; sem eixo, só a forma. */
const Sparkline = ({ serie, color, id }: { serie: number[]; color: string; id: string }) => {
  if (serie.length < 2) return <div className="h-12" />
  const max = Math.max(...serie), min = Math.min(...serie)
  const span = max - min || 1
  const pts = serie.map((v, i) => [(i / (serie.length - 1)) * 100, 30 - ((v - min) / span) * 26] as const)
  const linha = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `${linha} L100,32 L0,32 Z`
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-12 w-full" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={linha} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

const Donut = ({ title, dados, total, totalLabel, fmt }: {
  title: string
  dados: { id: SetorKey; valor: number }[]
  total: number
  totalLabel: string
  fmt: (v: number) => string
}) => {
  const ct = useChartTheme()
  const ordenados = [...dados].sort((a, b) => b.valor - a.valor)
  // Tooltip ativo → rótulo central some (senão um cobre o outro perto do centro).
  const [hover, setHover] = useState(false)
  return (
    <Card Icon={PieIcon} title={title}>
      <div className="flex items-center gap-5">
        <div className="relative h-[120px] w-[120px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={ordenados}
                dataKey="valor"
                nameKey="id"
                innerRadius={41}
                outerRadius={58}
                paddingAngle={1.5}
                stroke="none"
                isAnimationActive={false}
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
              >
                {ordenados.map((d) => <Cell key={d.id} fill={SETOR_COR[d.id]} />)}
              </Pie>
              <Tooltip
                formatter={((v: number, n: SetorKey) => [fmt(v), SETOR_LABEL[n]]) as never}
                contentStyle={{ fontSize: 12, borderRadius: 8, ...ct.tooltip }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className={cn('pointer-events-none absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-150', hover && 'opacity-0')}>
            <span className="text-[13.5px] font-extrabold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyShort(total)}</span>
            <span className="text-[9.5px] text-gray-400">{totalLabel}</span>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-2">
          {ordenados.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 text-[12px]">
              <span className="inline-flex min-w-0 items-center gap-2 text-gray-600 dark:text-gray-300">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: SETOR_COR[d.id] }} />
                <span className="truncate">{SETOR_LABEL[d.id]}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-bold tabular-nums text-gray-900 dark:text-gray-100">{total > 0 ? pct((d.valor / total) * 100, 1) : '—'}</span>
                <span className="block text-[10.5px] tabular-nums text-gray-400">{fmt(d.valor)}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

/* ───────────────────────────── componente ───────────────────────────── */

const VisaoGeralGraficos = () => {
  const rede = useRedeSetores()
  const ct = useChartTheme()
  const [rankMetric, setRankMetric] = useState<RankMetric>('lucroBruto')
  const cmpLabel = rede.comparisonMode === 'prevYear' ? 'vs AA' : 'vs MA'
  const cmpLongo = rede.comparisonMode === 'prevYear' ? 'mesmo período do ano anterior' : 'mês anterior'

  const setores: { id: SetorKey; obj: RedeSetor }[] = useMemo(() => [
    { id: 'combustivel', obj: rede.combustivel },
    { id: 'automotivos', obj: rede.automotivos },
    { id: 'conveniencia', obj: rede.conveniencia },
  ], [rede.combustivel, rede.automotivos, rede.conveniencia])

  // Evolução da rede: soma das séries diárias dos 3 setores por dia.
  const evolucao = useMemo(() => {
    const porDia = new Map<string, { fat: number; lb: number }>()
    for (const { obj } of setores) {
      for (const d of obj.daily) {
        const e = porDia.get(d.data) ?? { fat: 0, lb: 0 }
        e.fat += d.faturamento; e.lb += d.lucroBruto
        porDia.set(d.data, e)
      }
    }
    return [...porDia.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([data, v]) => ({ data, faturamento: v.fat, lucroBruto: v.lb, margem: v.fat > 0 ? (v.lb / v.fat) * 100 : 0 }))
  }, [setores])

  // Ranking por posto: LB e faturamento somam os 3 setores; margem = LB total ÷
  // faturamento total (NUNCA média de percentuais); litros = só combustível.
  const ranking = useMemo(() => {
    const porPosto = new Map<number, { posto: string; lucroBruto: number; faturamento: number; litros: number }>()
    for (const { id, obj } of setores) {
      for (const p of obj.postos) {
        const e = porPosto.get(p.empresaCodigo) ?? { posto: p.posto, lucroBruto: 0, faturamento: 0, litros: 0 }
        e.lucroBruto += p.lucroBruto
        e.faturamento += p.faturamento
        if (id === 'combustivel') e.litros += p.qtd
        porPosto.set(p.empresaCodigo, e)
      }
    }
    const linhas = [...porPosto.values()].map((p) => ({ ...p, margem: p.faturamento > 0 ? (p.lucroBruto / p.faturamento) * 100 : 0 }))
    const valor = (p: (typeof linhas)[number]) => p[rankMetric]
    const ordenadas = linhas.filter((p) => valor(p) > 0).sort((a, b) => valor(b) - valor(a))
    const max = ordenadas.length ? valor(ordenadas[0]) : 0
    const fmt = rankMetric === 'margem' ? (v: number) => pct(v) : rankMetric === 'litros' ? formatLiters : formatCurrencyInt
    return { linhas: ordenadas, max, fmt, valor }
  }, [setores, rankMetric])

  // Variação do período: litros = combustível; faturamento e lucro = consolidado.
  const variacao = useMemo(() => {
    const porDia = (pick: (d: { faturamento: number; lucroBruto: number; qtd: number }) => number, apenas?: SetorKey) => {
      const m = new Map<string, number>()
      for (const { id, obj } of setores) {
        if (apenas && id !== apenas) continue
        for (const d of obj.daily) m.set(d.data, (m.get(d.data) ?? 0) + pick(d))
      }
      return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v)
    }
    return [
      { id: 'litros', label: 'Litros vendidos', atual: rede.combustivel.qtd, anterior: rede.combustivel.qtdAnoAnterior, serie: porDia((d) => d.qtd, 'combustivel'), fmt: (v: number) => formatNumber(Math.round(v)), cor: '#10b981' },
      { id: 'fat', label: 'Faturamento', atual: rede.global.faturamento, anterior: rede.global.faturamentoAnoAnterior, serie: porDia((d) => d.faturamento), fmt: formatCurrencyInt, cor: '#2563eb' },
      { id: 'lb', label: 'Lucro bruto', atual: rede.global.lucroBruto, anterior: rede.global.lucroBrutoAnoAnterior, serie: porDia((d) => d.lucroBruto), fmt: formatCurrencyInt, cor: '#7c3aed' },
    ]
  }, [setores, rede.combustivel, rede.global])

  const margens = useMemo(
    () => setores.map(({ id, obj }) => ({ id, margem: obj.margem })).sort((a, b) => b.margem - a.margem),
    [setores],
  )
  const maxMargem = margens.length ? Math.max(...margens.map((m) => m.margem), 1) : 1

  const vazio = !rede.isLoading && evolucao.length === 0

  if (rede.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <Skeleton className="h-[320px] rounded-xl lg:col-span-2 xl:col-span-7" />
        <Skeleton className="h-[320px] rounded-xl xl:col-span-5" />
        <Skeleton className="h-[260px] rounded-xl xl:col-span-5" />
        <Skeleton className="h-[260px] rounded-xl xl:col-span-4" />
        <Skeleton className="h-[260px] rounded-xl xl:col-span-3" />
      </div>
    )
  }

  if (vazio) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
        Sem vendas apuradas no período selecionado.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
      {/* ── Evolução da rede ── */}
      <Card
        Icon={Activity}
        title="Evolução da rede"
        hint="Faturamento e lucro bruto por dia, somando os três setores. A linha é a margem bruta do dia (lucro bruto ÷ faturamento)."
        className="lg:col-span-2 xl:col-span-7"
        right={
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#2563eb]" />Faturamento</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />Lucro bruto</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3.5 rounded-full" style={{ background: ct.dark ? '#e5e7eb' : '#1e3a5f' }} />Margem (%)</span>
          </div>
        }
      >
        <p className="-mt-2 mb-2 text-[11px] text-gray-400">Faturamento e lucro bruto diário</p>
        {/* Ocupa a altura da linha (os dois donuts empilhados ao lado ditam a
            altura); nunca menos de 230px. */}
        <div className="min-h-[230px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={evolucao} margin={{ top: 6, right: 4, bottom: 0, left: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
            <XAxis dataKey="data" tickFormatter={ddmm} tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={18} />
            <YAxis yAxisId="rs" tickFormatter={formatCurrencyShort} tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} width={64} />
            <YAxis yAxisId="pct" orientation="right" tickFormatter={(v: number) => `${Math.round(v)}%`} tick={{ fontSize: 11, fill: ct.axis }} axisLine={false} tickLine={false} width={36} domain={[0, (max: number) => Math.max(20, Math.ceil(max / 5) * 5)]} />
            <Tooltip
              labelFormatter={((l: string) => ddmm(l)) as never}
              formatter={((v: number, name: string) => name === 'Margem' ? [pct(v), name] : [formatCurrencyInt(v), name]) as never}
              contentStyle={{ fontSize: 12, borderRadius: 8, ...ct.tooltip }}
            />
            <Bar yAxisId="rs" dataKey="faturamento" name="Faturamento" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Bar yAxisId="rs" dataKey="lucroBruto" name="Lucro bruto" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={18} isAnimationActive={false} />
            <Line yAxisId="pct" type="monotone" dataKey="margem" name="Margem" stroke={ct.dark ? '#e5e7eb' : '#1e3a5f'} strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: ct.dark ? '#e5e7eb' : '#1e3a5f' }} activeDot={{ r: 4 }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
        </div>
      </Card>

      {/* ── Participações (empilhadas: anel à esquerda, legenda com os nomes
          inteiros à direita; lado a lado o card ficava com ~250px e os nomes
          sumiam) ── */}
      <div className="grid grid-cols-1 gap-4 xl:col-span-5">
        <Donut
          title="Participação no faturamento"
          dados={setores.map(({ id, obj }) => ({ id, valor: obj.faturamento }))}
          total={rede.global.faturamento}
          totalLabel="Faturamento"
          fmt={formatCurrencyInt}
        />
        <Donut
          title="Participação no lucro bruto"
          dados={setores.map(({ id, obj }) => ({ id, valor: obj.lucroBruto }))}
          total={rede.global.lucroBruto}
          totalLabel="Lucro bruto"
          fmt={formatCurrencyInt}
        />
      </div>

      {/* ── Ranking por posto ── */}
      <Card
        Icon={Trophy}
        title={`Ranking por ${RANK_TABS.find((t) => t.id === rankMetric)!.label.toLowerCase()}`}
        hint="Lucro bruto e faturamento somam os três setores. Margem = lucro bruto total ÷ faturamento total do posto. Litros considera só combustível."
        className="xl:col-span-4"
        right={
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
            {RANK_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setRankMetric(t.id)}
                className={cn('rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors', rankMetric === t.id ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-blue-600' : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white')}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      >
        {ranking.linhas.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">Sem dados para esta métrica no período.</p>
        ) : (
          <ol className="max-h-[300px] space-y-2.5 overflow-y-auto pr-1">
            {ranking.linhas.map((p, i) => (
              <li key={p.posto} className="flex items-center gap-3 text-[12.5px]">
                <span className="w-4 shrink-0 text-right tabular-nums text-gray-400">{i + 1}</span>
                <span className="inline-flex w-[38%] min-w-0 shrink-0 items-center gap-1.5 font-medium text-gray-800 dark:text-gray-100">
                  <span className="truncate">{p.posto}</span>
                  {i === 0 && <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                </span>
                <span className="h-4 min-w-0 flex-1 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-800">
                  <span className="block h-full rounded-sm bg-gradient-to-r from-emerald-500 to-emerald-400 dark:from-emerald-500 dark:to-emerald-300" style={{ width: `${ranking.max > 0 ? Math.max(2, (ranking.valor(p) / ranking.max) * 100) : 0}%` }} />
                </span>
                <span className="w-[88px] shrink-0 text-right font-bold tabular-nums text-gray-900 dark:text-gray-100">{ranking.fmt(ranking.valor(p))}</span>
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* ── Variação do período ── */}
      <Card
        Icon={TrendingUp}
        title="Variação do período"
        hint={`Total do período selecionado comparado com o ${cmpLongo} (mesmos dias decorridos). Litros = combustível; faturamento e lucro bruto = rede consolidada. A linha é a série diária do período.`}
        className="xl:col-span-5"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {variacao.map((v) => (
            <div key={v.id} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
              <p className="text-[11px] text-gray-400">{v.label}</p>
              <p className="mt-0.5 text-[17px] font-extrabold tabular-nums tracking-tight text-gray-900 dark:text-gray-100">{v.fmt(v.atual)}</p>
              <Delta value={varPct(v.atual, v.anterior)} label={cmpLabel} />
              <div className="mt-1">
                <Sparkline serie={v.serie} color={v.cor} id={`spark-${v.id}`} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Margem por setor ── */}
      <Card Icon={Percent} title="Margem por setor" hint="Margem bruta de cada setor no período: lucro bruto ÷ faturamento." className="xl:col-span-3">
        <ul className="space-y-4 pt-1">
          {margens.map((m) => (
            <li key={m.id}>
              <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                <span className="font-medium text-gray-700 dark:text-gray-200">{SETOR_LABEL[m.id]}</span>
                <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">{pct(m.margem)}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, (m.margem / maxMargem) * 100)}%`, background: SETOR_COR[m.id] }} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

export default VisaoGeralGraficos

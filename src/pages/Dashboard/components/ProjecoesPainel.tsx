import { useMemo, useState, type MouseEvent } from 'react'
import { Droplets, Wrench, Store, Globe, LineChart, ArrowLeft } from 'lucide-react'
import { formatCurrency, formatCurrencyInt, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import InfoHint from '@/components/ui/InfoHint'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'
import { monthEndFactor } from '@/lib/projection'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const fmtPct = (v: number): string => `${v.toFixed(2).replace('.', ',')}%`
const pad = (n: number) => String(n).padStart(2, '0')

/** Teto "redondo" acima de `v` pra escala do eixo Y (5 ticks limpos). */
const niceCeil = (v: number): number => {
  if (v <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / mag
  const step = n <= 1 ? 1 : n <= 1.2 ? 1.2 : n <= 1.4 ? 1.4 : n <= 1.6 ? 1.6 : n <= 1.8 ? 1.8 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 7.5 ? 7.5 : 10
  return step * mag
}

interface SegmentCardProps {
  label: string
  Icon: typeof Droplets
  cardBg: string
  iconBg: string
  iconColor: string
  loading: boolean
  lucroBruto: number
  primary: { label: string; value: string }
  secondary: { label: string; value: string }
}

const SegmentCard = ({ label, Icon, cardBg, iconBg, iconColor, loading, lucroBruto, primary, secondary }: SegmentCardProps) => (
  <div className={cn('flex h-full w-full min-w-0 flex-col rounded-2xl border border-gray-200 p-5 text-left shadow-sm dark:border-gray-700', cardBg)}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{label}</p>
        <p className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
          Lucro bruto
          <InfoHint text="Faturamento − Custo dos produtos vendidos, somando todos os postos da rede. Não inclui despesas operacionais." />
        </p>
      </div>
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-[18px] w-[18px]', iconColor)} />
      </div>
    </div>
    {loading ? (
      <div className="mt-4 h-8 w-32 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
    ) : (
      <p className="mt-4 text-[26px] font-extrabold tabular-nums tracking-tight text-gray-900 dark:text-gray-100">{formatCurrencyInt(lucroBruto)}</p>
    )}
    <div className="mt-auto flex items-end justify-between gap-2 pt-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold tabular-nums text-gray-700 dark:text-gray-200">{primary.value}</p>
        <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{primary.label}</p>
      </div>
      <div className="min-w-0 text-right">
        <p className="truncate text-sm font-bold tabular-nums text-gray-700 dark:text-gray-200">{secondary.value}</p>
        <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">{secondary.label}</p>
      </div>
    </div>
  </div>
)

const ProjecoesPainel = () => {
  const dataInicial = useFilterStore((s) => s.dataInicial)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const { combustivel, automotivos, conveniencia, global, dailyLB, isLoading } = useRedeSetores()

  const [expanded, setExpanded] = useState(false)
  const [hoverDay, setHoverDay] = useState<number | null>(null)

  // Projeção fim do mês — extrapolação linear (rede-wide) por setor. Já existente.
  const f = monthEndFactor(dataInicial, dataFinal)
  const projLinhas = [
    { setor: 'Combustível', volume: combustivel.qtd * f, faturamento: combustivel.faturamento * f, lucroBruto: combustivel.lucroBruto * f, margem: combustivel.margem },
    { setor: 'Automotivos', volume: automotivos.qtd * f, faturamento: automotivos.faturamento * f, lucroBruto: automotivos.lucroBruto * f, margem: automotivos.margem },
    { setor: 'Conveniência', volume: conveniencia.qtd * f, faturamento: conveniencia.faturamento * f, lucroBruto: conveniencia.lucroBruto * f, margem: conveniencia.margem },
  ]
  const projTotal = {
    faturamento: projLinhas.reduce((s, r) => s + r.faturamento, 0),
    lucroBruto: projLinhas.reduce((s, r) => s + r.lucroBruto, 0),
    margem: global.margem,
  }

  /* ─── Régua de projeção (LB diário) ───
   * Realizado = cumulativo REAL do LB diário (dailyLB, mesma base do consolidado).
   * Projeção = ritmo por DIA-DA-SEMANA dos dias decorridos, dos dias restantes,
   * escalado pra fechar exatamente no projEnd da tabela (monthEndFactor) —
   * trajetória determinística, não previsão estatística. */
  const chart = useMemo(() => {
    const realizedEnd = global.lucroBruto
    const projEnd = realizedEnd * f
    const aRealizar = Math.max(0, projEnd - realizedEnd)

    const [y, m] = dataInicial.split('-').map(Number)
    const diasNoMes = new Date(y, m, 0).getDate()
    const mesLabel = MESES[m - 1] ?? ''
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    const fimReal = todayISO < dataFinal ? todayISO : dataFinal
    const isToday = fimReal === todayISO

    // Dias do mês/período com LB real (acumulado).
    const inMonth = dailyLB
      .filter((p) => { const [py, pm] = p.data.split('-').map(Number); return py === y && pm === m && p.data >= dataInicial && p.data <= fimReal })
      .sort((a, b) => a.data.localeCompare(b.data))
    let cum = 0
    const realPtsRaw: { d: number; v: number }[] = []
    for (const p of inMonth) { cum += p.lb; realPtsRaw.push({ d: Number(p.data.slice(8, 10)), v: cum }) }
    const diaIni = realPtsRaw.length ? realPtsRaw[0].d : (Number(dataInicial.slice(8, 10)) || 1)
    const hojeDia = realPtsRaw.length ? realPtsRaw[realPtsRaw.length - 1].d : diaIni
    const hasDaily = realPtsRaw.length > 0
    // Escala leve pro fim bater com o consolidado (arredondamento/escopo).
    const cumEnd = realPtsRaw.length ? realPtsRaw[realPtsRaw.length - 1].v : 0
    const scale = cumEnd > 0 ? realizedEnd / cumEnd : 1
    const realPts = realPtsRaw.map((p) => ({ d: p.d, v: p.v * scale }))

    // Projeção: ritmo por dia-da-semana → dias restantes, escalado pra fechar em projEnd.
    const wAcc = new Map<number, { sum: number; n: number }>()
    for (const p of inMonth) { const [py, pm, pd] = p.data.split('-').map(Number); const wd = new Date(py, pm - 1, pd).getDay(); const a = wAcc.get(wd) ?? { sum: 0, n: 0 }; a.sum += p.lb; a.n++; wAcc.set(wd, a) }
    const avgAll = inMonth.length ? inMonth.reduce((s, p) => s + p.lb, 0) / inMonth.length : 0
    const wAvg = (wd: number) => { const a = wAcc.get(wd); return a && a.n > 0 ? a.sum / a.n : avgAll }
    // Projeção ESPERADA do mês INTEIRO (dia 1 → fim): ritmo por dia-da-semana,
    // escalado pra fechar em projEnd no último dia. Cobre todo o período — o
    // realizado real (acima/abaixo dessa trajetória) mostra adiantado/atrasado.
    const allDays: number[] = []
    for (let d = 1; d <= diasNoMes; d++) allDays.push(d)
    const expInc = allDays.map((d) => wAvg(new Date(y, m - 1, d).getDay()))
    const expSum = expInc.reduce((s, v) => s + v, 0)
    const projPts: { d: number; v: number }[] = []
    let ec = 0
    for (let i = 0; i < allDays.length; i++) {
      ec += expSum > 0 ? expInc[i] * (projEnd / expSum) : projEnd / diasNoMes
      projPts.push({ d: allDays[i], v: ec })
    }

    // Geometria SVG (viewBox 0 0 1000 330).
    const x0 = 60, x1 = 980, yTop = 30, yBase = 280
    const denom = Math.max(1, diasNoMes - 1)
    const X = (d: number) => x0 + ((d - 1) / denom) * (x1 - x0)
    const maxY = niceCeil(projEnd * 1.05)
    const Y = (v: number) => yBase - (v / maxY) * (yBase - yTop)

    const linePath = realPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(p.d).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')
    const areaPath = realPts.length
      ? `M${X(diaIni).toFixed(1)},${yBase} ${realPts.map((p) => `L${X(p.d).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')} L${X(hojeDia).toFixed(1)},${yBase} Z`
      : ''
    const projPath = projPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${X(p.d).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')

    // Cumulativo preenchido por dia (tooltip) — carrega o último valor conhecido.
    const realFull = new Map<number, number>()
    { let last = 0; const mp = new Map(realPts.map((p) => [p.d, p.v])); for (let d = diaIni; d <= hojeDia; d++) { const v = mp.get(d); if (v != null) last = v; realFull.set(d, last) } }
    const projFull = new Map(projPts.map((p) => [p.d, p.v]))

    const tickLabel = (v: number) => v === 0 ? '0' : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(2).replace('.', ',')} mi` : `${Math.round(v / 1000)}k`
    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((fr) => { const v = maxY * fr; return { y: Y(v), ty: Y(v) + 4, label: tickLabel(v) } })
    const xDays = Array.from(new Set([1, 5, 10, 15, 20, hojeDia, diasNoMes].filter((d) => d >= 1 && d <= diasNoMes))).sort((a, b) => a - b)
    const xTicks = xDays.map((d) => ({ x: X(d), label: d === hojeDia ? 'hoje' : String(d), isHoje: d === hojeDia }))

    return {
      realizedEnd, projEnd, aRealizar, diasNoMes, hojeDia, diaIni, isToday, mesLabel, hasDaily,
      x0, x1, X, Y, maxY, realFull, projFull,
      linePath, areaPath, projPath, yTicks, xTicks,
      hojeX: X(hojeDia), hojeY: Y(realizedEnd), projX: X(diasNoMes), projY: Y(projEnd),
    }
  }, [global.lucroBruto, f, dataInicial, dataFinal, dailyLB])

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width) return
    const svgX = ((e.clientX - rect.left) / rect.width) * 1000
    let d = 1 + ((svgX - chart.x0) / (chart.x1 - chart.x0)) * (chart.diasNoMes - 1)
    d = Math.max(1, Math.min(chart.diasNoMes, Math.round(d)))
    if (d !== hoverDay) setHoverDay(d)
  }
  const onLeave = () => { if (hoverDay !== null) setHoverDay(null) }

  const hover = (() => {
    if (hoverDay == null) return null
    const inReal = hoverDay >= chart.diaIni && hoverDay <= chart.hojeDia
    const realV = chart.realFull.get(hoverDay)
    const projV = chart.projFull.get(hoverDay) ?? 0
    const pv = inReal ? (realV ?? projV) : projV // ponto na curva medida (real ≤ hoje, senão projeção)
    const sx = chart.X(hoverDay), sy = chart.Y(pv)
    const flip = hoverDay >= chart.diasNoMes - 5 ? '-90%' : hoverDay <= 3 ? '-10%' : '-50%'
    return {
      sx, sy, color: inReal ? '#60a5fa' : '#6ee7b7',
      leftPct: `${(sx / 1000 * 100).toFixed(2)}%`, topPct: `${(sy / 330 * 100).toFixed(2)}%`,
      transform: `translate(${flip}, calc(-100% - 14px))`,
      date: `${hoverDay} ${chart.mesLabel}${hoverDay === chart.hojeDia && chart.isToday ? ' · hoje' : ''}`,
      hasReal: inReal && realV != null,
      realValue: realV != null ? formatCurrencyInt(realV) : '',
      projValue: formatCurrencyInt(projV),
    }
  })()

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
      {!expanded && (
        <div className="md:col-span-2 xl:col-span-4">
          {/* Chave (estilo "legend") abraça SÓ os cartões de realizado — a Projeção
              fica de fora. O rótulo, cru, corta a linha no topo centralizado. */}
          <div className="relative mb-2 h-3 rounded-t-xl border-x border-t border-gray-200 dark:border-gray-700">
            <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap bg-gray-50 px-2.5 text-[11px] font-medium text-gray-400 dark:bg-gray-900 dark:text-gray-500">
              Realizado · Período Selecionado
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SegmentCard
            label="Combustível" Icon={Droplets} cardBg="bg-white dark:bg-gray-900"
            iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-600 dark:text-blue-400"
            loading={isLoading} lucroBruto={combustivel.lucroBruto}
            primary={{ label: 'Margem', value: fmtPct(combustivel.margem) }}
            secondary={{ label: 'L. bruto / litro', value: formatCurrency(combustivel.lucroPorUnidade) }}
          />
          <SegmentCard
            label="Automotivos" Icon={Wrench} cardBg="bg-white dark:bg-gray-900"
            iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600 dark:text-amber-400"
            loading={isLoading} lucroBruto={automotivos.lucroBruto}
            primary={{ label: 'Faturamento', value: formatCurrencyInt(automotivos.faturamento) }}
            secondary={{ label: 'Margem', value: fmtPct(automotivos.margem) }}
          />
          <SegmentCard
            label="Conveniência" Icon={Store} cardBg="bg-white dark:bg-gray-900"
            iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600 dark:text-emerald-400"
            loading={isLoading} lucroBruto={conveniencia.lucroBruto}
            primary={{ label: 'Faturamento', value: formatCurrencyInt(conveniencia.faturamento) }}
            secondary={{ label: 'Margem', value: fmtPct(conveniencia.margem) }}
          />
          <SegmentCard
            label="Global" Icon={Globe} cardBg="bg-gradient-to-br from-violet-50/60 to-white dark:from-violet-950/20 dark:to-gray-900"
            iconBg="bg-violet-100 dark:bg-violet-900/30" iconColor="text-violet-600 dark:text-violet-400"
            loading={isLoading} lucroBruto={global.lucroBruto}
            primary={{ label: 'Faturamento', value: formatCurrencyInt(global.faturamento) }}
            secondary={{ label: 'Margem', value: fmtPct(global.margem) }}
          />
          </div>
        </div>
      )}

      {/* Painel Projeção (navy) — col-span-2 (fechado) → col-span total (aberto). */}
      <div className={cn(
        'flex min-w-0 flex-col overflow-hidden rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#27496f] shadow-lg',
        expanded ? 'md:col-span-2 xl:col-span-6' : 'md:col-span-2 xl:col-span-2',
      )}>
        <div className="flex items-start justify-between gap-2.5 px-5 pb-3.5 pt-[18px]">
          <div>
            <p className="inline-flex items-center gap-1.5 text-[15px] font-bold text-white">
              Projeção
              <InfoHint
                text="Estimativa de fechamento do mês por setor: extrapolação linear do realizado (dias decorridos → dias totais do mês). É uma projeção, não o valor final."
                className="text-white/60 hover:text-white dark:text-white/60 dark:hover:text-white"
              />
            </p>
            <p className="mt-0.5 text-[11px] text-white/60">{expanded ? 'Evolução do lucro bruto' : 'Fim do mês'}</p>
          </div>
          <button
            type="button" onClick={() => setExpanded((v) => !v)}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-3 text-xs font-medium text-white/80 transition-colors hover:border-white/25 hover:bg-white/[0.12] hover:text-white"
          >
            {expanded ? <ArrowLeft className="h-3.5 w-3.5 text-white/70" /> : <LineChart className="h-3.5 w-3.5 text-white/70" />}
            {expanded ? 'Voltar' : 'Ver projeção'}
          </button>
        </div>

        {/* Tabela (fechado) */}
        {!expanded && (
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-white/15 text-left text-white/55">
                <th className="px-5 py-1 font-semibold uppercase tracking-wide">Setor</th>
                <th className="py-1 text-right font-semibold uppercase tracking-wide">Litros/Qtde</th>
                <th className="py-1 text-right font-semibold uppercase tracking-wide">Faturamento</th>
                <th className="py-1 text-right font-semibold uppercase tracking-wide">Lucro bruto</th>
                <th className="px-5 py-1 text-right font-semibold uppercase tracking-wide">Margem</th>
              </tr>
            </thead>
            <tbody className="text-white/90">
              {projLinhas.map((r) => (
                <tr key={r.setor} className="border-b border-white/10">
                  <td className="px-5 py-2.5">{r.setor}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatNumber(Math.round(r.volume))}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatCurrencyInt(r.faturamento)}</td>
                  <td className="py-2.5 text-right tabular-nums">{formatCurrencyInt(r.lucroBruto)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{fmtPct(r.margem)}</td>
                </tr>
              ))}
              <tr className="font-bold text-white">
                <td className="px-5 pt-2.5">Total</td>
                <td className="pt-2.5 text-right tabular-nums text-white/50">—</td>
                <td className="pt-2.5 text-right tabular-nums">{formatCurrencyInt(projTotal.faturamento)}</td>
                <td className="pt-2.5 text-right tabular-nums">{formatCurrencyInt(projTotal.lucroBruto)}</td>
                <td className="px-5 pt-2.5 text-right tabular-nums">{fmtPct(projTotal.margem)}</td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Régua (aberto) */}
        {expanded && (
          <div className="px-[22px] pb-5 pt-1" style={{ animation: 'chartIn .5s cubic-bezier(.4,0,.2,1) both' }}>
            <div className="mb-1.5 flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/55">Realizado · acumulado</p>
                  <p className="mt-0.5 text-[22px] font-extrabold tabular-nums text-white">{formatCurrencyInt(chart.realizedEnd)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/55">Projeção · fim do mês</p>
                  <p className="mt-0.5 text-[22px] font-extrabold tabular-nums text-[#6ee7b7]">{formatCurrencyInt(chart.projEnd)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/55">A realizar</p>
                  <p className="mt-0.5 text-[22px] font-extrabold tabular-nums text-white/85">{formatCurrencyInt(chart.aRealizar)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-white/75"><span className="h-[3px] w-4 rounded-sm bg-[#60a5fa]" />Realizado</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-white/75"><span className="h-0 w-4 border-t-2 border-dashed border-[#6ee7b7]" />Projeção</span>
              </div>
            </div>

            <div className="relative" onMouseMove={onMove} onMouseLeave={onLeave}>
              <svg viewBox="0 0 1000 330" preserveAspectRatio="none" className="block h-[300px] w-full">
                <defs>
                  <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {chart.yTicks.map((t, i) => (
                  <line key={`y${i}`} x1="60" y1={t.y} x2="980" y2={t.y} stroke="rgba(255,255,255,.1)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                ))}
                {chart.areaPath && <path d={chart.areaPath} fill="url(#projGrad)" opacity="0.5" />}
                <path d={chart.projPath} fill="none" stroke="#6ee7b7" strokeWidth="2.5" strokeDasharray="6 6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                {chart.linePath && <path d={chart.linePath} fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
                <circle cx={chart.hojeX} cy={chart.hojeY} r="5" fill="#60a5fa" stroke="#1e3a5f" strokeWidth="2" />
                <circle cx={chart.projX} cy={chart.projY} r="5" fill="#6ee7b7" stroke="#1e3a5f" strokeWidth="2" />
                {hover && (
                  <>
                    <line x1={hover.sx} y1="30" x2={hover.sx} y2="280" stroke="rgba(255,255,255,.4)" strokeWidth="1" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
                    <circle cx={hover.sx} cy={hover.sy} r="6" fill="#fff" stroke={hover.color} strokeWidth="3" />
                  </>
                )}
              </svg>
              {/* Rótulos de eixo em HTML (fora do SVG preserveAspectRatio=none,
                  que distorceria o texto). */}
              {chart.yTicks.map((t, i) => (
                <span key={`yl${i}`} className="pointer-events-none absolute text-[11px] tabular-nums text-white/45" style={{ top: `${(t.y / 330) * 100}%`, left: 0, width: '5%', textAlign: 'right', paddingRight: 6, transform: 'translateY(-50%)' }}>{t.label}</span>
              ))}
              {chart.xTicks.map((t, i) => (
                <span key={`xl${i}`} className={cn('pointer-events-none absolute text-[11px] tabular-nums', t.isHoje ? 'font-bold text-[#6ee7b7]' : 'text-white/45')} style={{ left: `${(t.x / 1000) * 100}%`, top: `${(322 / 330) * 100}%`, transform: 'translate(-50%, -50%)' }}>{t.label}</span>
              ))}
              {hover && (
                <div
                  className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg bg-white px-3 py-2 shadow-xl"
                  style={{ left: hover.leftPct, top: hover.topPct, transform: hover.transform }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{hover.date}</p>
                  {hover.hasReal && (
                    <div className="mt-1.5 flex items-center justify-between gap-4">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-blue-600"><span className="h-1.5 w-1.5 rounded-full bg-[#60a5fa]" />Realizado</span>
                      <span className="text-[13px] font-extrabold tabular-nums text-gray-900">{hover.realValue}</span>
                    </div>
                  )}
                  <div className="mt-1.5 flex items-center justify-between gap-4">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-[#6ee7b7]" />Projeção</span>
                    <span className="text-[13px] font-extrabold tabular-nums text-gray-900">{hover.projValue}</span>
                  </div>
                </div>
              )}
            </div>

            <p className="mt-2 text-[10.5px] leading-snug text-white/45">
              <strong className="font-semibold text-white/60">Realizado</strong> = lucro bruto diário real dos 3 setores (acumulado). <strong className="font-semibold text-white/60">Projeção</strong> = ritmo por dia-da-semana dos dias decorridos, escalado pro fechamento do mês — trajetória, não previsão estatística.
              {!chart.hasDaily && ' · sem série diária no período (só os endpoints).'}
            </p>
          </div>
        )}

        {/* Sem botão de rodapé — o toggle fica na pílula do topo. */}
        {!expanded && <div className="pb-4" />}
      </div>
    </div>
    </div>
  )
}

export default ProjecoesPainel

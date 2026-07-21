import { useMemo, useState } from 'react'
import {
  ArrowDownCircle, ArrowUpCircle, Wallet, Landmark, TrendingUp, TrendingDown,
  ChevronLeft, ChevronRight, Info,
} from 'lucide-react'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { cn } from '@/lib/utils'
import { useChartTheme } from '@/lib/chartTheme'
import { formatCurrency, formatCurrencyInt } from '@/lib/formatters'
import { todayLocal } from '@/lib/period'
import { Skeleton } from '@/components/ui/skeleton'
import InfoHint from '@/components/ui/InfoHint'
import useFinanceData from '@/pages/Financeiro/hooks/useFinanceData'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const pctLabel = (v: number) => `${v >= 0 ? '▲' : '▼'} ${Math.abs(v * 100).toFixed(1).replace('.', ',')}%`

/** Card de fluxo de caixa (entrada/saída/saldo/saldo atual). */
const FluxoCard = ({
  Icon, iconTint, label, value, foot, delta, deltaGoodWhenUp = true, dark = false, hint,
}: {
  Icon: typeof Wallet; iconTint: string; label: string; value: string; foot?: string
  delta?: number | null; deltaGoodWhenUp?: boolean; dark?: boolean; hint?: string
}) => {
  const good = delta == null ? null : (deltaGoodWhenUp ? delta >= 0 : delta <= 0)
  return (
    <div className={cn(
      'rounded-2xl border p-4 shadow-sm',
      dark
        ? 'border-[#1e3a5f] bg-gradient-to-br from-[#1e3a5f] to-[#24476f] text-white'
        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
    )}>
      <div className="flex items-center gap-2">
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', dark ? 'bg-white/15 text-white' : iconTint)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className={cn('flex items-center gap-1 text-[12px] font-medium', dark ? 'text-white/80' : 'text-gray-500 dark:text-gray-400')}>
          {label}{hint && <InfoHint text={hint} className={dark ? 'text-white/60 hover:text-white' : undefined} />}
        </span>
      </div>
      <p className={cn('mt-2 text-[26px] font-bold leading-none tracking-[-0.02em] tabular-nums', dark ? 'text-white' : 'text-gray-900 dark:text-gray-100')}>{value}</p>
      <div className="mt-1.5 flex items-center gap-2">
        {foot && <span className={cn('text-[11px]', dark ? 'text-white/60' : 'text-gray-400 dark:text-gray-500')}>{foot}</span>}
        {delta != null && (
          <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums',
            good ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
            {delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {pctLabel(delta)} <span className={cn('font-medium', dark ? 'text-white/50' : 'text-gray-400')}>vs mês anterior</span>
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Dashboard Mensal do Financeiro — visão consolidada de entradas, saídas e caixa
 * do mês selecionado. TUDO com dado REAL do movimento_conta (via useFinanceData);
 * onde não há fonte (resultado do exercício / DRE), o bloco DEGRADA em vez de
 * estimar (não há receita/EBIT na API). Seletor de mês/ano próprio.
 */
const DashboardMensal = () => {
  const ct = useChartTheme()
  const hoje = todayLocal()
  const [ano, setAno] = useState(() => Number(hoje.slice(0, 4)))
  const [mesSel, setMesSel] = useState(() => Number(hoje.slice(5, 7)) - 1)

  // Um fetch do ANO inteiro → agrega por mês (cards do mês selecionado + curva).
  const period = useMemo(() => ({ allPeriod: false, dataInicial: `${ano}-01-01`, dataFinal: `${ano}-12-31` }), [ano])
  const { cashFlowData, saldoEmCaixa, isLoading } = useFinanceData(period)

  const { byMonth, curva } = useMemo(() => {
    const bm = Array.from({ length: 12 }, () => ({ entradas: 0, saidas: 0 }))
    for (const r of cashFlowData) {
      const m = Number(r.data.slice(5, 7)) - 1
      if (m < 0 || m > 11) continue
      // Só realizado (movimento_conta) nos cards — previstas ficam de fora.
      bm[m].entradas += r.entradas
      bm[m].saidas += r.saidas
    }
    let acc = 0
    const mesAtual = ano === Number(hoje.slice(0, 4)) ? Number(hoje.slice(5, 7)) - 1 : 11
    const cv = bm.map((m, i) => {
      acc += m.entradas - m.saidas
      return { mes: MESES[i], acumulado: acc, futuro: i > mesAtual }
    })
    return { byMonth: bm, curva: cv }
  }, [cashFlowData, ano, hoje])

  const mes = byMonth[mesSel]
  const prev = mesSel > 0 ? byMonth[mesSel - 1] : null
  const saldoMes = mes.entradas - mes.saidas
  const saldoPrev = prev ? prev.entradas - prev.saidas : null
  const deltaOf = (cur: number, p: number | null | undefined) =>
    p != null && p !== 0 ? cur / p - 1 : null

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Cabeçalho + seletor de mês/ano ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Dashboard Mensal</h2>
          <p className="text-[12px] text-gray-500 dark:text-gray-400">Visão consolidada de entradas, saídas e resultado financeiro.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
            {MESES.map((m, i) => (
              <button key={m} type="button" onClick={() => setMesSel(i)}
                className={cn('rounded-md px-2 py-1 text-[11px] font-semibold transition-colors',
                  mesSel === i ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-blue-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200')}>
                {m}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-1 py-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
            <button type="button" onClick={() => setAno((a) => a - 1)} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronLeft className="h-4 w-4" /></button>
            <span className="px-1 text-[12px] font-bold tabular-nums text-gray-700 dark:text-gray-200">{ano}</span>
            <button type="button" onClick={() => setAno((a) => a + 1)} className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* ── Fluxo de caixa (REAL — movimento_conta) ── */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2563eb]" /> Fluxo de caixa · {MESES[mesSel]}/{ano}
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FluxoCard Icon={ArrowDownCircle} iconTint="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400"
            label="Entradas no mês" value={formatCurrency(mes.entradas)} delta={deltaOf(mes.entradas, prev?.entradas)} deltaGoodWhenUp
            hint="Soma das entradas realizadas no mês (movimento_conta). Não inclui previstas." />
          <FluxoCard Icon={ArrowUpCircle} iconTint="bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
            label="Saídas no mês" value={formatCurrency(mes.saidas)} delta={deltaOf(mes.saidas, prev?.saidas)} deltaGoodWhenUp={false}
            hint="Soma das saídas realizadas no mês (movimento_conta)." />
          <FluxoCard Icon={Wallet} iconTint="bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400"
            label="Saldo no mês" value={formatCurrency(saldoMes)} foot="entradas − saídas" delta={deltaOf(saldoMes, saldoPrev)} deltaGoodWhenUp />
          <FluxoCard Icon={Landmark} iconTint="" dark label="Saldo atual" value={formatCurrency(saldoEmCaixa)} foot="todas as contas"
            hint="Saldo atual somado de todas as contas ativas — é uma posição de HOJE, não do mês selecionado." />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* ── Resultado financeiro (DRE) — DEGRADADO: sem fonte na API ── */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Resultado financeiro (DRE)</h3>
            <InfoHint text="Da receita bruta ao resultado líquido. Exige receita/custos/despesas do período (lançamentos), que a API da Quality não expõe em GET — por isso o bloco fica indisponível em vez de mostrar número estimado." />
          </div>
          <div className="mt-8 flex flex-col items-center justify-center gap-2 py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
              <Info className="h-5 w-5" />
            </span>
            <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200">Sem fonte de resultado no período</p>
            <p className="mx-auto max-w-xs text-[11px] leading-snug text-gray-500 dark:text-gray-400">
              Receita bruta, EBIT e resultado líquido dependem dos lançamentos do período, que ainda não estão integrados. Preferimos deixar o bloco vazio a mostrar número ilustrativo.
            </p>
          </div>
        </section>

        {/* ── Saldo/fluxo acumulado no ano (REAL) ── */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Fluxo de caixa acumulado</h3>
              <InfoHint text="Soma acumulada de (entradas − saídas) do movimento_conta, mês a mês, ao longo do ano. É o RESULTADO de caixa acumulado (não o saldo das contas) — começa em zero em janeiro." />
            </div>
            <span className="text-[11px] font-semibold tabular-nums text-gray-500 dark:text-gray-400">
              {formatCurrencyInt(curva[Math.min(mesSel, 11)]?.acumulado ?? 0)}
            </span>
          </div>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={curva} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="fcAcum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} strokeOpacity={0.4} vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: ct.axis }} axisLine={false} tickLine={false} width={52}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  formatter={((v: number) => [formatCurrency(v), 'Acumulado']) as never}
                  contentStyle={{ fontSize: 11, borderRadius: 8, ...ct.tooltip }}
                />
                <Area type="monotone" dataKey="acumulado" stroke="#1e3a5f" strokeWidth={2} fill="url(#fcAcum)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <p className="text-[11px] leading-snug text-gray-400 dark:text-gray-500">
        Entradas, saídas e saldo vêm do fluxo de caixa real (movimento_conta). O resultado do exercício (DRE) depende dos lançamentos do período; onde não há fonte, o bloco fica indisponível em vez de estimar.
      </p>
    </div>
  )
}

export default DashboardMensal

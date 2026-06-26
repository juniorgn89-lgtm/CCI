import { useMemo, useState } from 'react'
import { TrendingUp, BarChart3, ArrowUp, ArrowDown, Droplet, Percent } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrencyShort, formatLitersShort } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import { Skeleton } from '@/components/ui/skeleton'
import useProjecaoLB, { type DiaLB } from '@/pages/Comercial/hooks/useProjecaoLB'

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const WD = [
  { wd: 1, label: 'Seg' }, { wd: 2, label: 'Ter' }, { wd: 3, label: 'Qua' },
  { wd: 4, label: 'Qui' }, { wd: 5, label: 'Sex' }, { wd: 6, label: 'Sáb' },
]
const weekdayOf = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}
const ddmm = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}` }
/** L.B./litro com 3 casas. */
const lbL = (v: number) => `R$ ${v.toFixed(3).replace('.', ',')}`
const pct1 = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
/** R$ com sinal explícito (+/−). */
const sgn = (v: number) => `${v >= 0 ? '+' : '−'}${formatCurrencyShort(Math.abs(v))}`

const DeltaTag = ({ v }: { v: number | null }) => {
  if (v == null) return null
  const up = v >= 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums', up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{pct1(v)}
    </span>
  )
}

const ProjecaoLB = () => {
  const data = useProjecaoLB()
  const [wd, setWd] = useState(2) // Terça default

  const mesNome = useMemo(() => MESES[Number(data.mesIni.split('-')[1]) - 1] ?? '', [data.mesIni])

  // Ocorrências do dia-da-semana selecionado (dias fechados), com Δ% vs anterior.
  const occ = useMemo(() => {
    const list = data.dailyCurr.filter((d) => weekdayOf(d.data) === wd)
    return list.map((d, i) => ({
      ...d,
      lbL: d.litros > 0 ? d.lb / d.litros : 0,
      deltaPct: i > 0 && list[i - 1].lb > 0 ? ((d.lb - list[i - 1].lb) / list[i - 1].lb) * 100 : null,
    }))
  }, [data.dailyCurr, wd])

  // Var. semanal (mesmo dia): última ocorrência vs anterior.
  const varSemanal = occ.length >= 2 ? occ[occ.length - 1].deltaPct : null
  // vs mês passado: média das ocorrências do mês vs média do mês anterior.
  const vsMesPassado = useMemo(() => {
    const cur = occ.map((o) => o.lb)
    const prev = data.dailyPrev.filter((d) => weekdayOf(d.data) === wd).map((d) => d.lb)
    if (cur.length === 0 || prev.length === 0) return null
    const ac = cur.reduce((s, v) => s + v, 0) / cur.length
    const ap = prev.reduce((s, v) => s + v, 0) / prev.length
    return ap > 0 ? ((ac - ap) / ap) * 100 : null
  }, [occ, data.dailyPrev, wd])

  // "De onde vem o ganho": decompõe a Δ da última ocorrência vs a anterior em
  // efeito VOLUME (Δlitros × margem anterior) + efeito MARGEM (Δmargem/L × litros
  // atual). Soma exata = ΔLB. Responde se o ganho veio de litro ou de R$/L.
  const decomp = useMemo(() => {
    if (occ.length < 2) return null
    const last = occ[occ.length - 1]
    const prev = occ[occ.length - 2]
    if (last.litros <= 0 || prev.litros <= 0) return null
    const mPrev = prev.lb / prev.litros
    const mLast = last.lb / last.litros
    const volEffect = (last.litros - prev.litros) * mPrev
    const margEffect = (mLast - mPrev) * last.litros
    const deltaLB = last.lb - prev.lb
    return { last, prev, mPrev, mLast, volEffect, margEffect, deltaLB }
  }, [occ])

  // "Quem puxou": última ocorrência por posto vs ocorrência anterior.
  const quemPuxou = useMemo(() => {
    if (occ.length < 1) return []
    const lastD = occ[occ.length - 1].data
    const prevD = occ.length >= 2 ? occ[occ.length - 2].data : null
    const byPostoLast = new Map<number, number>()
    const byPostoPrev = new Map<number, number>()
    for (const r of data.perPosto) {
      if (r.data === lastD) byPostoLast.set(r.empresaCodigo, (byPostoLast.get(r.empresaCodigo) ?? 0) + r.lb)
      if (prevD && r.data === prevD) byPostoPrev.set(r.empresaCodigo, (byPostoPrev.get(r.empresaCodigo) ?? 0) + r.lb)
    }
    return [...byPostoLast.entries()]
      .map(([code, lb]) => {
        const p = byPostoPrev.get(code) ?? 0
        return { code, nome: data.empresaNome.get(code) ?? `Posto ${code}`, lb, deltaPct: p > 0 ? ((lb - p) / p) * 100 : null }
      })
      .sort((a, b) => b.lb - a.lb)
  }, [occ, data.perPosto, data.empresaNome])

  if (data.isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /><Skeleton className="h-28 rounded-2xl" /></div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    )
  }
  if (!data.hasRede) {
    return <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900">Sem dados de combustível no período (o cache de apuração pode não ter fechado os dias ainda).</div>
  }

  const maxOcc = Math.max(...occ.map((o) => o.lb), 1)
  const maxDay = Math.max(...data.dailyCurr.map((d) => d.lb), 1)

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-transparent bg-gradient-to-br from-[#1e3a5f] to-[#27496f] p-4 text-white shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Quanto vou lucrar em {mesNome}?</p>
              <p className="text-[10px] text-white/50">Projeção LB · acum. até ontem</p>
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10"><TrendingUp className="h-4 w-4" /></span>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums">{formatCurrencyShort(data.projetadoLB)}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/60">
            estimativa · não inclui o dia em curso
            <InfoHint text="Projeção de fechamento do mês = LB realizado dos dias fechados + projeção dos dias que faltam (ritmo recente × sazonalidade do dia-da-semana). O dia corrente parcial não entra no realizado. É estimativa, não valor fechado." />
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Melhor que a semana passada?</p>
            <InfoHint text="Variação do LB do mesmo dia da semana: a última ocorrência vs a anterior (ex.: esta terça vs a terça passada). Comparar o mesmo dia neutraliza a sazonalidade." />
          </div>
          <p className="text-[10px] text-gray-400">var. semanal · mesmo dia</p>
          <p className={cn('mt-2 text-2xl font-bold tabular-nums', (varSemanal ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{varSemanal != null ? pct1(varSemanal) : '—'}</p>
          <p className="mt-1 text-[11px] text-gray-500">{occ.length >= 2 ? `${ddmm(occ[occ.length - 1].data)} vs ${ddmm(occ[occ.length - 2].data)}` : 'amostra insuficiente'}</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Minha margem/litro</p>
            <InfoHint text="Lucro bruto por litro nos dias fechados do mês (LB ÷ litros). É o R$ que sobra por litro vendido, já descontado o custo de reposição." />
          </div>
          <p className="text-[10px] text-gray-400">L.B. por litro · dias fechados</p>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{lbL(data.lbPorLitro)}<span className="text-sm font-medium text-gray-400">/L</span></p>
          <p className="mt-1 text-[11px] text-gray-500">{formatLitersShort(data.dailyCurr.reduce((s, d) => s + d.litros, 0))} no mês</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Melhor que o mês passado?</p>
            <InfoHint text="Compara a média do dia-da-semana selecionado neste mês com a média do mesmo dia no mês anterior." />
          </div>
          <p className="text-[10px] text-gray-400">{WD.find((w) => w.wd === wd)?.label}s · este mês vs anterior</p>
          <p className={cn('mt-2 text-2xl font-bold tabular-nums', (vsMesPassado ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{vsMesPassado != null ? pct1(vsMesPassado) : '—'}</p>
          <p className="mt-1 text-[11px] text-gray-500">média dos {WD.find((w) => w.wd === wd)?.label.toLowerCase()}s</p>
        </div>
      </div>

      {/* Barra realizado x projeção */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-2 flex items-center justify-between text-[12px]">
          <span className="font-medium text-gray-700 dark:text-gray-200">{mesNome.charAt(0).toUpperCase() + mesNome.slice(1)} vai bater a projeção?</span>
          <span className="tabular-nums text-gray-500">{formatCurrencyShort(data.realizadoLB)} / {formatCurrencyShort(data.projetadoLB)} · <span className="font-semibold text-emerald-600 dark:text-emerald-400">{Math.round(data.pctRealizado * 100)}%</span></span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" style={{ width: `${Math.min(100, data.pctRealizado * 100)}%` }} />
        </div>
      </div>

      {/* Evolução por dia-da-semana */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Projeção de LB por dia da semana</h3>
            <p className="text-[11px] text-gray-400">Comparar o mesmo dia ao longo do mês neutraliza a sazonalidade — assim se enxerga a evolução real.</p>
          </div>
          <div className="flex items-center gap-0.5 rounded-lg bg-gray-50 p-0.5 dark:bg-gray-800">
            {WD.map((w) => (
              <button key={w.wd} type="button" onClick={() => setWd(w.wd)}
                className={cn('rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors', wd === w.wd ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400')}>
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {occ.length === 0 ? (
          <p className="py-8 text-center text-[12px] text-gray-400">Sem ocorrências fechadas desse dia no mês.</p>
        ) : (
          <div className="mt-4 flex items-end gap-3" style={{ height: 200 }}>
            {occ.map((o) => (
              <div key={o.data} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[12px] font-bold tabular-nums text-gray-800 dark:text-gray-100">{formatCurrencyShort(o.lb)}</span>
                <DeltaTag v={o.deltaPct} />
                <div className="w-full rounded-t-md bg-gradient-to-t from-[#1e3a5f] to-[#3b82f6]" style={{ height: `${Math.max(4, (o.lb / maxOcc) * 130)}px` }} />
                <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">{ddmm(o.data)}</span>
                <span className="text-[10px] tabular-nums text-gray-400">{lbL(o.lbL)}/L</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* De onde vem o ganho — decomposição volume × margem (sustentabilidade) */}
      {decomp && (() => {
        const { volEffect, margEffect, deltaLB } = decomp
        const wdLabel = WD.find((w) => w.wd === wd)?.label.toLowerCase() ?? 'dia'
        const margemLed = deltaLB >= 0 && margEffect > volEffect
        const volumeLed = deltaLB >= 0 && volEffect > 0 && margEffect <= 0
        const reading = deltaLB < 0
          ? `LB caiu ${sgn(deltaLB)} vs a ${wdLabel} anterior — ${Math.abs(margEffect) >= Math.abs(volEffect) ? 'a margem' : 'o volume'} puxou pra baixo.`
          : margemLed
            ? 'Ganho puxado por MARGEM (melhor R$/L) — crescimento mais sustentável que volume puro.'
            : volumeLed
              ? 'Ganho veio de VOLUME; a margem recuou — monitore pra não trocar lucro por litro.'
              : 'Ganho misto — volume e margem somaram juntos.'
        return (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">De onde vem o ganho</h3>
                <InfoHint text="Decompõe a variação de LB entre as duas últimas ocorrências do dia em efeito VOLUME (mais/menos litros) e efeito MARGEM (melhor/pior R$/L). A soma dá a variação total — mostra se o ganho veio de litro ou de preço." />
              </div>
              <span className="text-[11px] text-gray-400">{ddmm(decomp.last.data)} vs {ddmm(decomp.prev.data)} · volume × margem</span>
            </div>
            <p className="mb-3 text-[12px] text-gray-500 dark:text-gray-400">
              Variação de LB de <span className="font-semibold tabular-nums">{sgn(deltaLB)}</span> — quanto veio de vender mais litro vs melhorar o R$/L.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-800/30">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  <Droplet className="h-3.5 w-3.5" /> Por volume
                </div>
                <p className={cn('mt-1 text-xl font-bold tabular-nums', volEffect >= 0 ? 'text-gray-900 dark:text-gray-100' : 'text-red-600 dark:text-red-400')}>{sgn(volEffect)}</p>
                <p className="text-[11px] text-gray-400">{formatLitersShort(decomp.last.litros)} vs {formatLitersShort(decomp.prev.litros)}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-800/30">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  <Percent className="h-3.5 w-3.5" /> Por margem
                </div>
                <p className={cn('mt-1 text-xl font-bold tabular-nums', margEffect >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{sgn(margEffect)}</p>
                <p className="text-[11px] text-gray-400">{lbL(decomp.mLast)} vs {lbL(decomp.mPrev)} /L</p>
              </div>
            </div>
            <p className={cn('mt-3 rounded-lg px-3 py-2 text-[12px] font-medium',
              margemLed ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300'
                : 'bg-amber-50 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300')}>
              {reading}
            </p>
          </div>
        )
      })()}

      {/* Barras diárias do mês (dia-da-semana destacado) */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">LB diário do mês</h3>
          <span className="text-[11px] text-gray-400">— {WD.find((w) => w.wd === wd)?.label}s destacados</span>
        </div>
        <div className="flex items-end gap-[3px]" style={{ height: 120 }}>
          {data.dailyCurr.map((d: DiaLB) => {
            const hl = weekdayOf(d.data) === wd
            return (
              <div key={d.data} title={`${ddmm(d.data)} · ${formatCurrencyShort(d.lb)}`}
                className={cn('flex-1 rounded-t-sm transition-colors', hl ? 'bg-[#2563eb]' : 'bg-gray-200 dark:bg-gray-700')}
                style={{ height: `${Math.max(2, (d.lb / maxDay) * 100)}%` }} />
            )
          })}
        </div>
      </div>

      {/* Quem puxou */}
      {quemPuxou.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Quem puxou o resultado da última {WD.find((w) => w.wd === wd)?.label.toLowerCase()}</h3>
              <InfoHint text="Contribuição de cada posto para o LB da última ocorrência do dia, e a variação vs a semana anterior. Ordenado pela contribuição." />
            </div>
            <span className="text-[11px] text-gray-400">contribuição por posto · vs semana anterior</span>
          </div>
          <div className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
            {quemPuxou.map((p) => {
              const max = Math.max(...quemPuxou.map((x) => x.lb), 1)
              return (
                <div key={p.code} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-700 dark:text-gray-200">{p.nome}</span>
                  <div className="hidden h-2 w-40 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800 sm:block">
                    <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${(p.lb / max) * 100}%` }} />
                  </div>
                  <span className="w-20 text-right text-[12px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyShort(p.lb)}</span>
                  <span className="w-14 text-right"><DeltaTag v={p.deltaPct} /></span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjecaoLB

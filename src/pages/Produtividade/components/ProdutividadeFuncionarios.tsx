import { useMemo, useState } from 'react'
import { Search, Wrench, Droplet, Fuel, Gauge, Receipt, Package, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatLiters, formatNumber } from '@/lib/formatters'
import { useFilterStore } from '@/store/filters'
import InfoHint from '@/components/ui/InfoHint'
import type { FrentistaProdData, FuncProdRow } from '@/pages/Produtividade/hooks/useFrentistaProdutividade'
import useAutomotivos12m, { type MesValor } from '@/pages/Produtividade/hooks/useAutomotivos12m'
import useGruposFuncionario, { type GrupoVenda, type EvolucaoFunc } from '@/pages/Produtividade/hooks/useGruposFuncionario'
import AnaliseSemanalLineCard from '@/pages/Comercial/Vendas/AnaliseSemanalLineCard'

interface Props {
  data: FrentistaProdData
  postoCodigo?: number | null
  /** Nome do posto — subtítulo do header do funcionário. */
  postoNome?: string
  /** Funcionário selecionado (controlado pelo index). */
  selId: number | null
  onSelect: (codigo: number) => void
}

const fmtR = (v: number) => formatCurrency(v)
const fmtRi = (v: number) => formatCurrencyInt(v)
const fmtL = (v: number) => formatLiters(v)
const fmtN = (v: number) => formatNumber(v)
const fmtMix = (v: number) => `${v.toFixed(1).replace('.', ',')}%`
const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?'
const mean = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0)

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const rangeLabel = (ini: string, fim: string): string => {
  if (!ini || !fim) return ''
  const [ya, ma, da] = ini.split('-').map(Number)
  const [yb, mb, db] = fim.split('-').map(Number)
  const p = (n: number) => String(n).padStart(2, '0')
  if (ya === yb && ma === mb) return `${p(da)}–${p(db)} ${MES[ma - 1]} ${yb}`
  if (ya === yb) return `${p(da)} ${MES[ma - 1]} – ${p(db)} ${MES[mb - 1]} ${yb}`
  return `${p(da)} ${MES[ma - 1]} ${ya} – ${p(db)} ${MES[mb - 1]} ${yb}`
}

/* ─── KPI com mini-barra + delta vs a média do posto ─── */
const KPI_ICON: Record<'green' | 'purple', { chip: string; icon: string }> = {
  green: { chip: 'bg-emerald-100 dark:bg-emerald-900/30', icon: 'text-emerald-600 dark:text-emerald-400' },
  purple: { chip: 'bg-violet-100 dark:bg-violet-900/30', icon: 'text-violet-600 dark:text-violet-400' },
}
const KpiCompar = ({ label, value, Icon, tone, val, avg, max, mode }: {
  label: string; value: string; Icon: typeof Wrench; tone: 'green' | 'purple'; val: number; avg: number; max: number; mode: 'pct' | 'pp'
}) => {
  const t = KPI_ICON[tone]
  const temMedia = avg > 0
  const above = val >= avg
  const barPct = max > 0 ? Math.min(100, (val / max) * 100) : 0
  const delta = temMedia
    ? mode === 'pp'
      ? `${above ? '+' : '−'}${Math.abs(val - avg).toFixed(1).replace('.', ',')} p.p.`
      : `${above ? '+' : '−'}${Math.abs(Math.round(((val - avg) / avg) * 100))}% vs média`
    : null
  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', t.chip)}>
          <Icon className={cn('h-3.5 w-3.5', t.icon)} />
        </div>
      </div>
      <p className="mt-1.5 text-[22px] font-bold leading-none tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
      {temMedia && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className={cn('h-full rounded-full', above ? 'bg-emerald-500' : 'bg-amber-400 dark:bg-amber-500')} style={{ width: `${Math.max(4, barPct)}%` }} />
          </div>
          <span className={cn('shrink-0 text-[10.5px] font-semibold tabular-nums', above ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>{delta}</span>
        </div>
      )}
    </div>
  )
}

/* ─── Desempenho diário: 1 card, seletor de métrica (reusa o card da rede) ─── */
type Metrica = 'litros' | 'aditivada' | 'automotivos'
const METRICAS: { id: Metrica; label: string; accent: string; unit: string; noun: string; plot: boolean }[] = [
  { id: 'litros', label: 'Litros', accent: '#2563eb', unit: 'litros', noun: 'volume', plot: false },
  { id: 'aditivada', label: 'Aditivada', accent: '#7c3aed', unit: 'litros', noun: 'volume', plot: false },
  { id: 'automotivos', label: 'Automotivos', accent: '#059669', unit: 'itens', noun: 'faturamento', plot: true },
]
const DesempenhoDiario = ({ evolucao, loading }: { evolucao?: EvolucaoFunc; loading?: boolean }) => {
  const [sel, setSel] = useState<Metrica>('litros')
  const cfg = METRICAS.find((m) => m.id === sel)!
  const serie = evolucao?.[sel]
  const seg = (
    <div className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
      {METRICAS.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => setSel(m.id)}
          className={cn('rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors', sel === m.id ? 'bg-white text-gray-900 shadow-sm dark:bg-[#2563eb] dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400')}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
  if (loading) return <div className="h-[360px] animate-pulse rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black" />
  if (!serie || serie.length < 2) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Desempenho diário</h3>
          {seg}
        </div>
        <p className="py-14 text-center text-[12px] text-gray-400">Poucos dias com movimento pra traçar a evolução.</p>
      </div>
    )
  }
  return (
    <AnaliseSemanalLineCard
      data={serie}
      title="Desempenho diário"
      noun={cfg.noun}
      unit={cfg.unit}
      plotFaturamento={cfg.plot}
      accent={cfg.accent}
      scope=""
      height={280}
      cardBg="bg-white dark:bg-gradient-to-b dark:from-gray-900 dark:to-black"
      headerExtra={seg}
    />
  )
}

/* ─── Combustíveis vendidos (nome + litros roxo + abast/fat + barra 3px) ─── */
const CombustivelTable = ({ combustiveis }: { combustiveis: FuncProdRow['combustiveis'] }) => {
  const max = Math.max(1, ...combustiveis.map((c) => c.litros))
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
      <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
        <Fuel className="h-4 w-4 text-gray-400" />
        <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Combustíveis vendidos</h3>
        <InfoHint text="Quebra dos abastecimentos do funcionário por combustível no período: litros, nº de abastecimentos e faturamento." />
        <span className="ml-auto text-[11px] text-gray-400">{combustiveis.length} {combustiveis.length === 1 ? 'produto' : 'produtos'}</span>
      </div>
      {combustiveis.length === 0 ? (
        <p className="px-4 py-8 text-center text-[12px] text-gray-400">Sem abastecimentos no período.</p>
      ) : (
        <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
          {combustiveis.map((c) => (
            <div key={c.produtoCodigo} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  <span className="text-[12.5px] font-medium text-gray-800 dark:text-gray-200">{c.nome}</span>{' '}
                  <span className="text-[12px] font-semibold tabular-nums text-violet-600 dark:text-violet-300">{fmtL(c.litros)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-[11px] tabular-nums text-gray-400">{fmtN(c.abastecimentos)}</span>
                  <span className="w-20 text-right text-[12px] font-semibold tabular-nums text-gray-700 dark:text-gray-300">{fmtRi(c.faturamento)}</span>
                </span>
              </div>
              <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div className="h-full rounded-full bg-violet-400 dark:bg-violet-500/70" style={{ width: `${Math.max(3, (c.litros / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Grupos de produto (nome + barra 5px + valor) ─── */
const GruposPanel = ({ grupos, loading }: { grupos?: GrupoVenda[]; loading?: boolean }) => {
  const top = (grupos ?? []).slice(0, 8)
  const max = Math.max(1, ...top.map((g) => g.faturamento))
  const total = (grupos ?? []).reduce((s, g) => s + g.faturamento, 0)
  const vazio = top.length === 0
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
      <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
        <Package className="h-4 w-4 text-gray-400" />
        <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Grupos de produto</h3>
        <InfoHint text="Faturamento de produtos automotivos de loja (setor Pista) do funcionário no período, por grupo. Ao vivo do /VENDA_ITEM, só vendas autorizadas. Aproxima-se do card Automotivos — que vem da apuração fechada; como os grupos são ao vivo, podem divergir no movimento de hoje." />
        {!loading && !vazio && <span className="ml-auto text-[11px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{fmtRi(total)}</span>}
      </div>
      {loading ? (
        <div className="space-y-2.5 p-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-7 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />)}
        </div>
      ) : vazio ? (
        <p className="px-4 py-8 text-center text-[12px] text-gray-400">Sem produtos automotivos no período.</p>
      ) : (
        <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
          {top.map((g, i) => {
            const best = i === 0
            const nome = g.grupo.replace(/^PS\s*-\s*/i, '')
            return (
              <div key={g.grupo} className="px-4 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('min-w-0 truncate text-[12.5px]', best ? 'font-bold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-600 dark:text-gray-300')} title={nome}>{nome}</span>
                  <span className={cn('shrink-0 text-[12px] font-semibold tabular-nums', best ? 'text-emerald-600 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-300')}>{fmtRi(g.faturamento)}</span>
                </div>
                <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className={cn('h-full rounded-full', best ? 'bg-emerald-500' : 'bg-emerald-300 dark:bg-emerald-500/50')} style={{ width: `${Math.max(3, (g.faturamento / max) * 100)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ─── Automotivos · 12 meses (barras: valor sobre cada mês, vazio = stub cinza,
       mês corrente destacado, pior mês em âmbar) ─── */
const Chart12m = ({ data, loading }: { data?: MesValor[]; loading?: boolean }) => {
  const pts = data ?? []
  const max = Math.max(1, ...pts.map((p) => p.valor))
  const total = pts.reduce((s, p) => s + p.valor, 0)
  const vazio = pts.length === 0 || pts.every((p) => p.valor === 0)
  const curI = pts.length - 1 // mês corrente (parcial) = último do range
  // "Pior mês" IGNORA o mês corrente: um acumulado parcial baixo não é
  // "vendeu pouco", é "o mês ainda não fechou".
  let worstI = -1, worstV = Infinity
  pts.forEach((p, i) => { if (i !== curI && p.valor > 0 && p.valor < worstV) { worstV = p.valor; worstI = i } })
  const curParcial = (pts[curI]?.valor ?? 0) > 0
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
      <div className="mb-3 flex items-center gap-1.5">
        <TrendingUp className="h-4 w-4 text-gray-400" />
        <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Automotivos · 12 meses</h3>
        {!loading && !vazio && <span className="ml-auto text-[11px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{fmtRi(total)} acumulado</span>}
      </div>
      {loading ? (
        <div className="h-36 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      ) : vazio ? (
        <p className="py-12 text-center text-[12px] text-gray-400">Sem histórico apurado.</p>
      ) : (
        <>
          <div className="flex h-36 items-end gap-1.5 pt-6">
            {pts.map((p, i) => {
              const h = (p.valor / max) * 82
              const zero = p.valor <= 0
              const isWorst = i === worstI
              const isCur = i === curI && p.valor > 0
              const barCls = zero
                ? 'bg-gray-200 dark:bg-gray-700'
                : isCur ? 'bg-emerald-500'
                  : isWorst ? 'bg-amber-400 dark:bg-amber-500'
                    : 'bg-emerald-300 dark:bg-emerald-500/40'
              return (
                <div key={p.ym} className="relative flex h-full min-w-0 flex-1 items-end" title={`${p.label}: ${fmtRi(p.valor)}`}>
                  {!zero && (
                    <span
                      className={cn('pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold leading-none tabular-nums', isWorst ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-300')}
                      style={{ bottom: `calc(${h}% + 3px)` }}
                    >
                      {fmtRi(p.valor)}
                    </span>
                  )}
                  <div className={cn('w-full rounded-t transition-all', barCls)} style={{ height: zero ? '2px' : `${Math.max(3, h)}%` }} />
                </div>
              )
            })}
          </div>
          <div className="mt-1 flex gap-1.5">
            {pts.map((p, i) => (
              <span key={p.ym} className={cn('flex-1 truncate text-center text-[9.5px]', i === curI ? 'font-semibold text-gray-500 dark:text-gray-300' : 'text-gray-400')}>{p.label}{i === curI && curParcial ? '*' : ''}</span>
            ))}
          </div>
          {curParcial && <p className="mt-1.5 text-[9.5px] text-gray-400 dark:text-gray-500">* {pts[curI].label} é o mês corrente — parcial, acumulado até hoje.</p>}
        </>
      )}
    </div>
  )
}

const ProdutividadeFuncionarios = ({ data, postoCodigo, postoNome, selId, onSelect }: Props) => {
  const { rows, kpis } = data
  const { dataInicial, dataFinal } = useFilterStore()
  const periodo = rangeLabel(dataInicial, dataFinal)
  const { byFunc: gruposByFunc, evolucaoByFunc, combByFunc, isLoading: loadingGrupos } = useGruposFuncionario(postoCodigo)
  const { byFunc: auto12m, isLoading: loading12m } = useAutomotivos12m(postoCodigo)
  const [busca, setBusca] = useState('')

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return q ? rows.filter((r) => r.nome.toLowerCase().includes(q)) : rows
  }, [rows, busca])

  const sel = useMemo(
    () => rows.find((r) => r.funcionarioCodigo === selId) ?? filtered[0] ?? rows[0] ?? null,
    [rows, filtered, selId],
  )

  // Médias do posto (derivadas das linhas — só apresentação, nada de fetch novo).
  const avg = useMemo(() => ({
    auto: mean(rows.filter((r) => r.automotivo > 0).map((r) => r.automotivo)),
    adit: mean(rows.filter((r) => r.aditivadaLitros > 0).map((r) => r.aditivadaLitros)),
    ticket: mean(rows.filter((r) => r.ticket > 0).map((r) => r.ticket)),
    mix: kpis.mixPct, // mix do posto = agregado (mesma base do KPI da Visão Geral)
    maxAuto: Math.max(1, ...rows.map((r) => r.automotivo)),
    maxAdit: Math.max(1, ...rows.map((r) => r.aditivadaLitros)),
    maxTicket: Math.max(1, ...rows.map((r) => r.ticket)),
    maxMix: Math.max(1, ...rows.map((r) => r.mixPct)),
  }), [rows, kpis.mixPct])

  const idx = sel ? rows.findIndex((r) => r.funcionarioCodigo === sel.funcionarioCodigo) : -1
  const go = (d: number) => { if (rows.length && idx >= 0) onSelect(rows[(idx + d + rows.length) % rows.length].funcionarioCodigo) }
  const rank = idx + 1
  const mixBaixo = sel ? sel.mixPct < kpis.mixPct : false

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* Lateral — lista de funcionários (busca fixa, lista rola, rail sticky) */}
      <div className="w-full shrink-0 lg:sticky lg:top-4 lg:w-64">
        <div className="flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
          <div className="border-b border-gray-100 p-2 dark:border-gray-800">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar funcionário…"
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-[12.5px] text-gray-700 placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb] dark:border-gray-800 dark:bg-[#0f0f0f] dark:text-gray-200"
              />
            </div>
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-[12px] text-gray-400">Nenhum funcionário.</p>
            ) : filtered.map((r) => {
              const active = sel?.funcionarioCodigo === r.funcionarioCodigo
              return (
                <button
                  key={r.funcionarioCodigo}
                  type="button"
                  onClick={() => onSelect(r.funcionarioCodigo)}
                  className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors', active ? 'bg-[#132033]' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40')}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: active ? '#1d4ed8' : '#152238' }}>
                    {iniciais(r.nome)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[11.5px] font-semibold', active ? 'text-white' : 'text-gray-800 dark:text-gray-200')}>{r.nome}</span>
                    <span className={cn('block truncate text-[10px] tabular-nums', active ? 'text-blue-200/80' : 'text-gray-400 dark:text-gray-500')}>{fmtR(r.automotivo)} · {fmtN(r.abastecimentos)} abast.</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Detalhe */}
      {sel ? (
        <div className="min-w-0 flex-1 space-y-4">
          {/* Header do funcionário */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl text-[16px] font-bold text-white" style={{ backgroundColor: '#1d4ed8' }}>{iniciais(sel.nome)}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[18px] font-bold leading-tight text-gray-900 dark:text-gray-100">{sel.nome}</h2>
                  {rank > 0 && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{rank}º em automotivos</span>}
                  {mixBaixo && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Mix abaixo da média</span>}
                </div>
                <p className="mt-0.5 truncate text-[11.5px] text-gray-500 dark:text-gray-400">
                  {[postoNome, periodo, `${fmtN(sel.abastecimentos)} abastecimentos`].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => go(-1)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/40">
                <ChevronLeft className="h-3.5 w-3.5" /> anterior
              </button>
              <button type="button" onClick={() => go(1)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/40">
                próximo <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* KPIs vs média do posto */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCompar label="Automotivos" value={fmtR(sel.automotivo)} Icon={Wrench} tone="green" val={sel.automotivo} avg={avg.auto} max={avg.maxAuto} mode="pct" />
            <KpiCompar label="Litros aditivada" value={fmtL(sel.aditivadaLitros)} Icon={Droplet} tone="purple" val={sel.aditivadaLitros} avg={avg.adit} max={avg.maxAdit} mode="pct" />
            <KpiCompar label="Mix aditivada" value={fmtMix(sel.mixPct)} Icon={Gauge} tone="purple" val={sel.mixPct} avg={avg.mix} max={avg.maxMix} mode="pp" />
            <KpiCompar label="Ticket automotivos" value={fmtR(sel.ticket)} Icon={Receipt} tone="green" val={sel.ticket} avg={avg.ticket} max={avg.maxTicket} mode="pct" />
          </div>

          {/* Desempenho diário (gráfico unificado com seletor) */}
          <DesempenhoDiario evolucao={evolucaoByFunc.get(sel.funcionarioCodigo)} loading={loadingGrupos} />

          {/* Combustíveis + Grupos lado a lado */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CombustivelTable combustiveis={combByFunc.get(sel.funcionarioCodigo) ?? []} />
            <GruposPanel grupos={gruposByFunc.get(sel.funcionarioCodigo)} loading={loadingGrupos} />
          </div>

          {/* Automotivos 12 meses */}
          <Chart12m data={auto12m.get(sel.funcionarioCodigo)} loading={loading12m} />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-300 py-16 text-center text-[13px] text-gray-400 dark:border-gray-800">
          Nenhum funcionário no período.
        </div>
      )}
    </div>
  )
}

export default ProdutividadeFuncionarios

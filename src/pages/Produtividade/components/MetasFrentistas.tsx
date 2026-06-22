import { useMemo, useState } from 'react'
import {
  BarChart3, DollarSign, Droplet, Target, Activity, Gauge, CheckCircle2,
  Trophy, AlertTriangle, Info, ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'
import { formatCurrencyInt, formatLiters, formatNumber, formatDate } from '@/lib/formatters'
import { useFilterStore } from '@/store/filters'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import TableSkeleton from '@/components/feedback/TableSkeleton'
import EmptyState from '@/components/feedback/EmptyState'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import useMetasFrentistas, { type MetricaMeta, type MetaRow } from '@/pages/Produtividade/hooks/useMetasFrentistas'

/* ── Métricas ── */
const METRICAS: { key: MetricaMeta; label: string; Icon: typeof BarChart3 }[] = [
  { key: 'abastecimentos', label: 'Abastecimentos', Icon: BarChart3 },
  { key: 'venda', label: 'Venda Bruta', Icon: DollarSign },
  { key: 'aditiv', label: 'Aditivada', Icon: Droplet },
]
const METRICA_LABEL: Record<MetricaMeta, string> = {
  abastecimentos: 'Abastecimentos', venda: 'Venda Bruta', aditiv: 'Aditivada',
}
const fmtVal = (v: number, m: MetricaMeta): string =>
  m === 'venda' ? formatCurrencyInt(v) : m === 'aditiv' ? formatLiters(v) : formatNumber(v)

/* ── Faixas de atingimento ── */
type Faixa = 'verde' | 'ambar' | 'vermelho' | 'sem'
const faixaDe = (pct: number | null): Faixa =>
  pct === null ? 'sem' : pct >= 100 ? 'verde' : pct >= 80 ? 'ambar' : 'vermelho'
const FAIXA: Record<Faixa, { fill: string; text: string; dot: string; badge: string }> = {
  verde: { fill: 'bg-[#22c55e]', text: 'text-[#15803d] dark:text-emerald-400', dot: 'bg-[#22c55e]', badge: 'bg-[#dcfce7] text-[#15803d] dark:bg-emerald-900/40 dark:text-emerald-300' },
  ambar: { fill: 'bg-[#f59e0b]', text: 'text-[#a16207] dark:text-amber-400', dot: 'bg-[#f59e0b]', badge: 'bg-[#fef9c3] text-[#a16207] dark:bg-amber-900/40 dark:text-amber-300' },
  vermelho: { fill: 'bg-[#ef4444]', text: 'text-[#b91c1c] dark:text-red-400', dot: 'bg-[#ef4444]', badge: 'bg-[#fee2e2] text-[#b91c1c] dark:bg-red-900/40 dark:text-red-300' },
  sem: { fill: 'bg-[#cbd5e1]', text: 'text-[#94a3b8]', dot: 'bg-[#cbd5e1]', badge: 'bg-[#f1f5f9] text-[#94a3b8] dark:bg-gray-800 dark:text-gray-400' },
}
const fmtPct = (pct: number | null): string =>
  pct === null ? 's/ meta' : `${pct.toFixed(1).replace('.', ',')}%`

type SortKey = 'pct' | 'realizado' | 'meta'
const SORT_LABEL: Record<SortKey, string> = { pct: '% atingimento', realizado: 'realizado', meta: 'meta' }

/* ── KPI card base ── */
const KpiBase = ({ navy, children }: { navy?: boolean; children: React.ReactNode }) => (
  <div className={cn(
    'flex flex-col rounded-2xl border p-5 shadow-sm',
    navy
      ? 'border-[#1e3a5f]/30 bg-gradient-to-br from-[#1e3a5f] to-[#27496f]'
      : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
  )}>
    {children}
  </div>
)
const Chip = ({ Icon, bg, color }: { Icon: typeof Target; bg: string; color: string }) => (
  <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', bg)}>
    <Icon className={cn('h-5 w-5', color)} />
  </div>
)

/* ── Barra de progresso (faixa) ── */
const ProgressBar = ({ pct, faixa, className }: { pct: number | null; faixa: Faixa; className?: string }) => {
  const w = pct === null ? 0 : Math.max(2, Math.min(100, pct))
  return (
    <div className={cn('h-2.5 flex-1 overflow-hidden rounded-full bg-[#f3f4f6] dark:bg-gray-800', className)}>
      <div className={cn('h-full rounded-full', FAIXA[faixa].fill)} style={{ width: `${w}%` }} />
    </div>
  )
}

const Th = ({ label, k, sortKey, sortDir, onClick, align = 'right', help }: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: 'asc' | 'desc'; onClick: () => void; align?: 'left' | 'right'; help?: string
}) => {
  const active = sortKey === k
  return (
    <th className={cn('whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400', align === 'left' ? 'text-left' : 'text-right')}>
      <span className={cn('inline-flex items-center gap-1', align === 'right' && 'justify-end')}>
        <button
          onClick={onClick}
          className={cn('inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200', align === 'right' && 'flex-row-reverse', active && 'text-gray-900 dark:text-gray-100')}
        >
          {label}
          {active ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
        </button>
        {help && <InfoHint text={help} />}
      </span>
    </th>
  )
}

const MetasFrentistas = () => {
  const [metrica, setMetrica] = useState<MetricaMeta>('abastecimentos')
  const [sortKey, setSortKey] = useState<SortKey>('pct')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const { dataInicial, dataFinal } = useFilterStore()
  const data = useMetasFrentistas(metrica)
  const { rows, metaTotal, realizadoTotal, pctGeral, comMeta, bateram, entre80e100, abaixo80, destaque, atencao, isLoading, hasEmpresa } = data

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(k); setSortDir('desc') }
  }

  const sorted = useMemo(() => {
    const arr = [...rows]
    arr.sort((a, b) => {
      // Sem meta sempre por último.
      const am = a.meta > 0, bm = b.meta > 0
      if (am !== bm) return am ? -1 : 1
      const val = (r: MetaRow) => sortKey === 'pct' ? (r.pct ?? -Infinity) : sortKey === 'realizado' ? r.realizado : r.meta
      return sortDir === 'desc' ? val(b) - val(a) : val(a) - val(b)
    })
    return arr
  }, [rows, sortKey, sortDir])

  const faixaGeral = faixaDe(pctGeral)
  const periodoLabel = `${formatDate(dataInicial)} – ${formatDate(dataFinal)}`

  /* ── Estados ── */
  if (!hasEmpresa) return <SelectCompanyState />
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)}
        </div>
        <TableSkeleton rows={8} showHeader />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Barra de controle: seletor + legenda ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
          {METRICAS.map((m) => {
            const active = metrica === m.key
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetrica(m.key)}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold transition-colors',
                  active ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
                )}
              >
                <m.Icon className="h-[15px] w-[15px]" />
                {m.label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#22c55e]" /> ≥ 100%</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#f59e0b]" /> 80–99%</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#ef4444]" /> &lt; 80%</span>
        </div>
      </div>

      {/* ── 4 KPI cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* 1 · Meta da equipe (navy) */}
        <KpiBase navy>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[13px] font-semibold text-white">Meta da equipe</p>
                <InfoHint text="Soma das metas individuais (só frentistas com meta cadastrada) na métrica selecionada." className="text-white/60 hover:text-white" />
              </div>
              <p className="text-[11px] uppercase tracking-wide text-white/60">{METRICA_LABEL[metrica]}</p>
            </div>
            <Chip Icon={Target} bg="bg-white/15" color="text-white/90" />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-white">{fmtVal(metaTotal, metrica)}</p>
          <div className="mt-auto border-t border-white/15 pt-3">
            <span className="text-[11px] text-white/60">{periodoLabel}</span>
          </div>
        </KpiBase>

        {/* 2 · Realizado */}
        <KpiBase>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Realizado</p>
                <InfoHint text="Total realizado pela equipe na métrica · pill = % de atingimento da equipe (vs. meta total)." />
              </div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">{METRICA_LABEL[metrica]}</p>
            </div>
            <Chip Icon={Activity} bg="bg-[#dbeafe] dark:bg-blue-900/30" color="text-[#2563eb] dark:text-blue-400" />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{fmtVal(realizadoTotal, metrica)}</p>
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
            <span className="text-[11px] text-gray-400">vs. meta total</span>
            {pctGeral !== null && (
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', FAIXA[faixaGeral].badge)}>
                {fmtPct(pctGeral)}
              </span>
            )}
          </div>
        </KpiBase>

        {/* 3 · Atingimento */}
        <KpiBase>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Atingimento</p>
                <InfoHint text="% geral da equipe = realizado ÷ meta. Só quem tem meta entra no cálculo. Cor pela faixa (≥100 verde · 80–99 âmbar · <80 vermelho)." />
              </div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Meta da equipe</p>
            </div>
            <Chip Icon={Gauge} bg="bg-[#ede9fe] dark:bg-violet-900/30" color="text-[#7c3aed] dark:text-violet-400" />
          </div>
          <p className={cn('mt-3 text-3xl font-bold tabular-nums', pctGeral === null ? 'text-gray-400' : FAIXA[faixaGeral].text)}>
            {pctGeral === null ? '—' : fmtPct(pctGeral)}
          </p>
          <div className="mt-auto pt-3">
            <ProgressBar pct={pctGeral} faixa={faixaGeral} />
          </div>
        </KpiBase>

        {/* 4 · Bateram a meta */}
        <KpiBase>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[13px] font-semibold text-gray-900 dark:text-gray-100">Bateram a meta</p>
                <InfoHint text="Quantos frentistas atingiram ≥ 100% da meta, sobre o total com meta cadastrada. Abaixo: quantos ficaram abaixo de 80%." />
              </div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400">Funcionários ≥ 100%</p>
            </div>
            <Chip Icon={CheckCircle2} bg="bg-[#dcfce7] dark:bg-emerald-900/30" color="text-[#16a34a] dark:text-emerald-400" />
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {bateram}<span className="text-lg font-semibold text-gray-400"> / {comMeta}</span>
          </p>
          <div className="mt-auto border-t border-gray-100 pt-3 dark:border-gray-800">
            <span className="text-[11px] text-gray-400">{abaixo80} abaixo de 80%</span>
          </div>
        </KpiBase>
      </div>

      {/* ── Tabela: Atingimento por frentista ── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
            Atingimento por frentista — {METRICA_LABEL[metrica]}
          </h3>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Meta individual vs. realizado · ordenado por {SORT_LABEL[sortKey]}
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#dbeafe] bg-[#eff6ff] px-3 py-2.5 dark:border-blue-900/40 dark:bg-blue-950/20">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb] dark:text-blue-400" />
            <p className="text-xs leading-relaxed text-[#1e40af] dark:text-blue-300">
              As metas são cadastradas no <strong>sistema de origem</strong> (cadastro de metas da apuração — Quality Automação).
              O Visor360 é somente leitura: ele apenas exibe os valores. Para definir ou alterar a meta de um frentista,
              ajuste no sistema de origem; a tela reflete o novo valor na próxima sincronização.
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="Sem dados no período" description="Não há realizado nem metas para os frentistas no período selecionado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#f3f4f6] dark:bg-gray-800/60">
                  <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">Frentista<InfoHint text="A bolinha indica a faixa de atingimento do frentista (verde/âmbar/vermelho/sem meta)." /></span>
                  </th>
                  <Th label="Meta" k="meta" sortKey={sortKey} sortDir={sortDir} onClick={() => handleSort('meta')} help="Meta individual cadastrada no sistema de origem para a métrica selecionada." />
                  <Th label="Realizado" k="realizado" sortKey={sortKey} sortDir={sortDir} onClick={() => handleSort('realizado')} help="Realizado do frentista no período na métrica selecionada." />
                  <th className="w-[320px] px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <button onClick={() => handleSort('pct')} className={cn('inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-200', sortKey === 'pct' && 'text-gray-900 dark:text-gray-100')}>
                        Atingimento
                        {sortKey === 'pct' ? (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
                      </button>
                      <InfoHint text="realizado ÷ meta × 100. Barra cheia em ≥ 100% (mostra o valor real). 's/ meta' = sem meta cadastrada." />
                    </span>
                  </th>
                  {metrica === 'aditiv' && (
                    <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center justify-end gap-1">Mix<InfoHint text="% de litros aditivados sobre o total de litros vendidos pelo frentista." /></span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => {
                  const faixa = faixaDe(r.pct)
                  return (
                    <tr
                      key={r.funcionarioCodigo}
                      className={cn(
                        'border-t border-gray-100 transition-colors hover:bg-[#eff6ff] dark:border-gray-800 dark:hover:bg-blue-950/20',
                        i % 2 === 1 && 'bg-[#f9fafb] dark:bg-gray-800/20',
                      )}
                    >
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={cn('h-2 w-2 shrink-0 rounded-full', FAIXA[faixa].dot)} />
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{r.nome}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{r.meta > 0 ? fmtVal(r.meta, metrica) : '—'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium text-gray-900 dark:text-gray-100">{fmtVal(r.realizado, metrica)}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <ProgressBar pct={r.pct} faixa={faixa} />
                          <span className={cn('w-[62px] shrink-0 text-right text-[13px] font-bold tabular-nums', FAIXA[faixa].text)}>{fmtPct(r.pct)}</span>
                        </div>
                      </td>
                      {metrica === 'aditiv' && (
                        <td className="px-4 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{r.mix !== null ? `${r.mix.toFixed(2).replace('.', ',')}%` : '—'}</td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-[#fafafa] font-bold dark:border-gray-700 dark:bg-gray-800/50">
                  <td className="px-5 py-2.5 text-gray-900 dark:text-gray-100">Total da equipe</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{fmtVal(metaTotal, metrica)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{fmtVal(realizadoTotal, metrica)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <ProgressBar pct={pctGeral} faixa={faixaGeral} />
                      <span className={cn('w-[62px] shrink-0 text-right text-[13px] font-bold tabular-nums', FAIXA[faixaGeral].text)}>{fmtPct(pctGeral)}</span>
                    </div>
                  </td>
                  {metrica === 'aditiv' && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Distribuição + Destaques ── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_1fr]">
        {/* Distribuição */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Distribuição da equipe</h3>
            <InfoHint text="Frentistas com meta divididos por faixa: bateram (≥100%), entre 80 e 100%, e abaixo de 80%." align="start" />
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Funcionários por faixa de atingimento</p>
          {comMeta === 0 ? (
            <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">Nenhum frentista com meta cadastrada no período.</p>
          ) : (
            <>
              <div className="mt-4 flex h-4 overflow-hidden rounded-lg">
                {bateram > 0 && <div className="bg-[#22c55e]" style={{ width: `${(bateram / comMeta) * 100}%` }} />}
                {entre80e100 > 0 && <div className="bg-[#f59e0b]" style={{ width: `${(entre80e100 / comMeta) * 100}%` }} />}
                {abaixo80 > 0 && <div className="bg-[#ef4444]" style={{ width: `${(abaixo80 / comMeta) * 100}%` }} />}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="border-l-[3px] border-[#22c55e] pl-3">
                  <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{bateram}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">bateram a meta</p>
                </div>
                <div className="border-l-[3px] border-[#f59e0b] pl-3">
                  <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{entre80e100}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">entre 80 e 100%</p>
                </div>
                <div className="border-l-[3px] border-[#ef4444] pl-3">
                  <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{abaixo80}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">abaixo de 80%</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Destaques */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center gap-1.5">
            <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Destaques</h3>
            <InfoHint text="Frentista com maior % de atingimento (destaque) e o menor (precisa de atenção), na métrica selecionada." align="start" />
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{METRICA_LABEL[metrica]} · maior e menor atingimento</p>
          <div className="mt-3 space-y-3">
            {destaque ? (
              <div className="flex items-center gap-3 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#dcfce7] dark:bg-emerald-900/40">
                  <Trophy className="h-4 w-4 text-[#16a34a] dark:text-emerald-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#16a34a] dark:text-emerald-400">Destaque do mês</p>
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{destaque.nome}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-bold tabular-nums text-[#15803d] dark:text-emerald-400">{fmtPct(destaque.pct)}</p>
                  <p className="text-[11px] tabular-nums text-gray-400">{fmtVal(destaque.realizado, metrica)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 dark:text-gray-500">Sem frentista com meta no período.</p>
            )}
            {atencao && atencao.funcionarioCodigo !== destaque?.funcionarioCodigo && (
              <div className="flex items-center gap-3 rounded-xl border border-[#fecaca] bg-[#fef2f2] p-3 dark:border-red-900/40 dark:bg-red-950/20">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fee2e2] dark:bg-red-900/40">
                  <AlertTriangle className="h-4 w-4 text-[#dc2626] dark:text-red-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#dc2626] dark:text-red-400">Precisa de atenção</p>
                  <p className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{atencao.nome}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-bold tabular-nums text-[#b91c1c] dark:text-red-400">{fmtPct(atencao.pct)}</p>
                  <p className="text-[11px] tabular-nums text-gray-400">{fmtVal(atencao.realizado, metrica)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default MetasFrentistas

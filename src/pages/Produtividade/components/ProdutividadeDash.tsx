import { useMemo, useState, type ReactNode } from 'react'
import { Search, Trophy, Wrench, Droplet, Fuel, Gauge, Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatLiters, formatNumber } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import BarCell from '@/components/tables/BarCell'
import type { FrentistaProdData, Podio } from '@/pages/Produtividade/hooks/useFrentistaProdutividade'

interface Props {
  data: FrentistaProdData
  /** Clique numa linha → abre esse funcionário na aba Funcionários. */
  onOpenFuncionario?: (codigo: number) => void
}

/* ─── KPI (cards tintados no estilo da Central) ─── */
interface KpiStyle { cardBg: string; iconBg: string; iconColor: string }
const KPI: Record<'emerald' | 'violet' | 'blue' | 'amber' | 'slate', KpiStyle> = {
  emerald: { cardBg: 'bg-gradient-to-br from-emerald-50/60 to-white dark:from-emerald-950/20 dark:to-gray-900', iconBg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-600 dark:text-emerald-400' },
  violet: { cardBg: 'bg-gradient-to-br from-violet-50/60 to-white dark:from-violet-950/20 dark:to-gray-900', iconBg: 'bg-violet-100 dark:bg-violet-900/30', iconColor: 'text-violet-600 dark:text-violet-400' },
  blue: { cardBg: 'bg-gradient-to-br from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900', iconBg: 'bg-blue-100 dark:bg-blue-900/30', iconColor: 'text-blue-600 dark:text-blue-400' },
  amber: { cardBg: 'bg-gradient-to-br from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900', iconBg: 'bg-amber-100 dark:bg-amber-900/30', iconColor: 'text-amber-600 dark:text-amber-400' },
  slate: { cardBg: 'bg-gradient-to-br from-slate-50/60 to-white dark:from-slate-900/20 dark:to-gray-900', iconBg: 'bg-slate-100 dark:bg-slate-800/40', iconColor: 'text-slate-600 dark:text-slate-400' },
}
const KpiCard = ({ label, value, Icon, style }: { label: string; value: string; Icon: typeof Wrench; style: KpiStyle }) => (
  <div className={cn('flex flex-col rounded-2xl border border-gray-200 p-4 shadow-sm dark:border-gray-800', style.cardBg)}>
    <div className="flex items-start justify-between gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}</p>
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', style.iconBg)}>
        <Icon className={cn('h-4 w-4', style.iconColor)} />
      </div>
    </div>
    <p className="mt-2 text-[22px] font-bold leading-none tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
  </div>
)

/* ─── Pódio (1º destacado + lista 2º–7º) ─── */
const PodiumCard = ({ title, Icon, items, fmt }: { title: string; Icon: typeof Wrench; items: Podio[]; fmt: (v: number) => string }) => {
  const [first, ...rest] = items
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
        <Icon className="h-4 w-4 text-gray-400" />
        <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">{title}</h3>
      </div>
      {!first ? (
        <p className="px-4 py-6 text-center text-[12px] text-gray-400">Sem dados no período.</p>
      ) : (
        <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
          <div className="flex items-center gap-2 bg-amber-50/70 px-4 py-2.5 dark:bg-amber-950/20">
            <Trophy className="h-4 w-4 shrink-0 text-amber-500" />
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-gray-900 dark:text-gray-100">{first.nome}</span>
            <span className="shrink-0 text-[13px] font-bold tabular-nums text-amber-700 dark:text-amber-400">{fmt(first.valor)}</span>
          </div>
          {rest.map((p, i) => (
            <div key={p.funcionarioCodigo} className="flex items-center gap-2 px-4 py-1.5">
              <span className="w-5 shrink-0 text-[11px] font-semibold tabular-nums text-gray-400">{i + 2}º</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-gray-600 dark:text-gray-300">{p.nome}</span>
              <span className="shrink-0 text-[12px] font-medium tabular-nums text-gray-700 dark:text-gray-300">{fmt(p.valor)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const Th = ({ children, hint, right }: { children: ReactNode; hint?: string; right?: boolean }) => (
  <th className={cn('whitespace-nowrap px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500', right ? 'text-right' : 'text-left')}>
    <span className={cn('inline-flex items-center gap-1', right && 'justify-end')}>
      {children}
      {hint && <InfoHint text={hint} />}
    </span>
  </th>
)

const fmtL = (v: number) => formatLiters(v)
const fmtN = (v: number) => formatNumber(v)
const fmtR = (v: number) => formatCurrency(v)
const TEND_HINT = 'Projeção de fim de mês: o realizado até agora no ritmo do mês (dias decorridos), estimando onde o funcionário deve fechar. Só projeta no mês corrente.'

const ProdutividadeDash = ({ data, onOpenFuncionario }: Props) => {
  const [busca, setBusca] = useState('')
  const { kpis, podios, rows } = data

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return q ? rows.filter((r) => r.nome.toLowerCase().includes(q)) : rows
  }, [rows, busca])

  const maxAuto = Math.max(1, ...rows.map((r) => r.automotivo))
  const maxAdit = Math.max(1, ...rows.map((r) => r.aditivadaLitros))
  const maxAbast = Math.max(1, ...rows.map((r) => r.abastecimentos))

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Faturamento automotivos" value={fmtR(kpis.automotivo)} Icon={Wrench} style={KPI.emerald} />
        <KpiCard label="Litros de aditivada" value={fmtL(kpis.aditivadaLitros)} Icon={Droplet} style={KPI.violet} />
        <KpiCard label="Mix de aditivada" value={`${kpis.mixPct.toFixed(1).replace('.', ',')}%`} Icon={Gauge} style={KPI.blue} />
        <KpiCard label="Abastecimentos" value={fmtN(kpis.abastecimentos)} Icon={Fuel} style={KPI.amber} />
        <KpiCard label="Ticket médio automotivos" value={fmtR(kpis.ticketMedio)} Icon={Receipt} style={KPI.slate} />
      </div>

      {/* Pódios */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <PodiumCard title="Vendas de automotivos" Icon={Wrench} items={podios.automotivo} fmt={fmtR} />
        <PodiumCard title="Venda de aditivada" Icon={Droplet} items={podios.aditivada} fmt={fmtL} />
        <PodiumCard title="Atendimentos" Icon={Fuel} items={podios.atendimentos} fmt={fmtN} />
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar funcionário…"
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-[13px] text-gray-700 placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb] dark:border-gray-800 dark:bg-[#0f0f0f] dark:text-gray-200"
        />
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-white/[0.02]">
        <table className="w-full min-w-[900px] text-[13px]">
          <thead className="border-b border-gray-100 dark:border-gray-800">
            <tr>
              <Th>Funcionário</Th>
              <Th right hint="Faturamento de produtos automotivos de loja (lubrificantes, óleo) do funcionário no período.">Automot.</Th>
              <Th right hint={TEND_HINT}>Tend.</Th>
              <Th right hint="Litros de gasolina aditivada (premium) abastecidos pelo funcionário.">L. aditiv.</Th>
              <Th right hint={TEND_HINT}>Tend.</Th>
              <Th right hint="Mix de aditivada = litros de aditivada ÷ litros de gasolina do funcionário.">Mix</Th>
              <Th right hint="Nº de abastecimentos (atendimentos) do funcionário no período.">Abast.</Th>
              <Th right hint={TEND_HINT}>Tend.</Th>
              <Th right hint="Ticket médio de automotivos: faturamento de loja ÷ cupons.">Ticket</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-[13px] text-gray-400">Nenhum funcionário encontrado.</td></tr>
            ) : filtered.map((r) => (
              <tr
                key={r.funcionarioCodigo}
                onClick={() => onOpenFuncionario?.(r.funcionarioCodigo)}
                title="Ver detalhe do funcionário"
                className={cn('hover:bg-gray-50/60 dark:hover:bg-gray-800/30', onOpenFuncionario && 'cursor-pointer')}
              >
                <td className="whitespace-nowrap px-3 py-1.5 font-medium text-gray-800 dark:text-gray-200">{r.nome}</td>
                <td className="px-2 py-1.5"><BarCell value={r.automotivo} max={maxAuto} formatted={fmtR(r.automotivo)} color="green" align="near" /></td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{fmtR(r.automotivoTend)}</td>
                <td className="px-2 py-1.5"><BarCell value={r.aditivadaLitros} max={maxAdit} formatted={fmtL(r.aditivadaLitros)} color="violet" align="near" /></td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{fmtL(r.aditivadaTend)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{r.mixPct.toFixed(1).replace('.', ',')}%</td>
                <td className="px-2 py-1.5"><BarCell value={r.abastecimentos} max={maxAbast} formatted={fmtN(r.abastecimentos)} color="amber" align="near" /></td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{fmtN(r.abastTend)}</td>
                <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{fmtR(r.ticket)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default ProdutividadeDash

import { ShieldAlert, AlertTriangle, Info } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/formatters'

/**
 * Header de KPIs da Qualidade dos Dados (Fase 1 do redesign).
 *
 * Herói navy com o TOTAL + barra de distribuição empilhada (críticos/atenção/
 * info) + 3 cards de severidade com acento de 3px no topo e mini-barra da fatia.
 * Tudo é leitura das contagens REAIS — a barra e as mini-barras são só fração
 * dos números (derivado honesto), nenhum dado novo.
 */

interface Props {
  /** null enquanto carrega. */
  total: number | null
  criticos: number
  atencao: number
  info: number
}

const pctOf = (n: number, total: number) => (total > 0 ? (n / total) * 100 : 0)

const SEV = {
  criticos: {
    accent: '#dc2626', tint: 'bg-red-50 dark:bg-red-900/20', icon: 'text-red-600 dark:text-red-400',
    value: 'text-red-700 dark:text-red-300', bar: 'bg-red-500', border: 'border-[#fecaca] dark:border-red-900/40',
    Icon: AlertTriangle, label: 'Críticos', desc: 'Quebram cálculos — corrigir já',
  },
  atencao: {
    accent: '#d97706', tint: 'bg-amber-50 dark:bg-amber-900/20', icon: 'text-amber-600 dark:text-amber-400',
    value: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-400', border: 'border-gray-200 dark:border-gray-700',
    Icon: AlertTriangle, label: 'Atenção', desc: 'Suspeitos — investigar e validar',
  },
  info: {
    accent: '#2563eb', tint: 'bg-blue-50 dark:bg-blue-900/20', icon: 'text-blue-600 dark:text-blue-400',
    value: 'text-blue-600 dark:text-blue-400', bar: 'bg-blue-400', border: 'border-gray-200 dark:border-gray-700',
    Icon: Info, label: 'Info', desc: 'Heads-up de qualidade — não bloqueia',
  },
} as const

const SeverityCard = ({ kind, value, total }: { kind: keyof typeof SEV; value: number | null; total: number }) => {
  const s = SEV[kind]
  return (
    <div className={cn('relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm dark:bg-gray-900', s.border)}>
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: s.accent }} />
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{s.label}</p>
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', s.tint)}>
          <s.Icon className={cn('h-4 w-4', s.icon)} />
        </span>
      </div>
      {value === null
        ? <Skeleton className="mt-1.5 h-8 w-14" />
        : <p className={cn('mt-1 text-3xl font-extrabold tabular-nums', s.value)}>{formatNumber(value)}</p>}
      <p className="mt-1 text-[11px] leading-tight text-gray-500 dark:text-gray-400">{s.desc}</p>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className={cn('h-full rounded-full', s.bar)} style={{ width: `${pctOf(value ?? 0, total)}%` }} />
      </div>
    </div>
  )
}

const QualidadeKpis = ({ total, criticos, atencao, info }: Props) => {
  const grand = total ?? 0
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_1fr]">
      {/* Herói — Total */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0f2740] to-[#1e3a5f] p-5 text-white shadow-sm">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Total de inconsistências</p>
          <ShieldAlert className="h-5 w-5 text-white/50" />
        </div>
        <div className="mt-1 flex items-end gap-2.5">
          {total === null
            ? <Skeleton className="h-12 w-24 bg-white/20" />
            : <span className="text-5xl font-extrabold leading-none tabular-nums">{formatNumber(total)}</span>}
          <span className="mb-1 text-[11px] leading-tight text-white/60">no período<br />exclui arquivados</span>
        </div>
        {/* Barra de distribuição empilhada (fração dos números reais) */}
        <div className="mt-4 flex h-2 w-full overflow-hidden rounded-full bg-white/15">
          <div className="h-full bg-red-500" style={{ width: `${pctOf(criticos, grand)}%` }} />
          <div className="h-full bg-amber-400" style={{ width: `${pctOf(atencao, grand)}%` }} />
          <div className="h-full bg-blue-400" style={{ width: `${pctOf(info, grand)}%` }} />
        </div>
        <div className="mt-2 flex items-center gap-4 text-[11px] tabular-nums">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-red-500" />Críticos <strong className="font-bold">{formatNumber(criticos)}</strong></span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-amber-400" />Atenção <strong className="font-bold">{formatNumber(atencao)}</strong></span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-blue-400" />Info <strong className="font-bold">{formatNumber(info)}</strong></span>
        </div>
      </div>

      <SeverityCard kind="criticos" value={total === null ? null : criticos} total={grand} />
      <SeverityCard kind="atencao" value={total === null ? null : atencao} total={grand} />
      <SeverityCard kind="info" value={total === null ? null : info} total={grand} />
    </div>
  )
}

export default QualidadeKpis

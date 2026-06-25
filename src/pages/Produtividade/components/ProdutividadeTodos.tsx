import {
  Fuel, Wrench, Store, Globe, Users, Trophy, ShoppingBag, TrendingUp, TrendingDown,
  Award, ArrowUpRight, ArrowDownRight, Lightbulb, Droplets, Gauge, Receipt, Ticket,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'
import { formatCurrency, formatCurrencyInt, formatLiters, formatNumber } from '@/lib/formatters'
import useProdutividadeTodos, {
  type SegmentoResumo, type InsightTodos,
} from '@/pages/Produtividade/hooks/useProdutividadeTodos'

/* ─────────────────────────────────────────────────────────────
 * Card de segmento (grande). Global em navy; demais em branco/dark.
 * ───────────────────────────────────────────────────────────── */
interface SegCardProps {
  label: string
  Icon: typeof Fuel
  iconBg: string
  iconColor: string
  resumo: SegmentoResumo
  cmpLabel: string
  loading: boolean
  navy?: boolean
  help?: string
}

const SegCard = ({ label, Icon, iconBg, iconColor, resumo, cmpLabel, loading, navy, help }: SegCardProps) => {
  const { faturamento, participacaoPct, variacaoPct } = resumo
  const positiva = (variacaoPct ?? 0) >= 0
  const Arrow = positiva ? TrendingUp : TrendingDown

  return (
    <div className={cn(
      'flex flex-col rounded-2xl border p-5 shadow-sm',
      navy
        ? 'border-[#1e3a5f]/30 bg-gradient-to-br from-[#1e3a5f] to-[#27496f]'
        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className={cn('text-sm font-semibold', navy ? 'text-white' : 'text-gray-900 dark:text-gray-100')}>{label}</p>
            {help && <InfoHint text={help} className={navy ? 'text-white/60 hover:text-white' : undefined} />}
          </div>
          <p className={cn('text-[11px] uppercase tracking-wide', navy ? 'text-white/60' : 'text-gray-500 dark:text-gray-400')}>Faturamento</p>
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', navy ? 'bg-white/15' : iconBg)}>
          <Icon className={cn('h-5 w-5', navy ? 'text-white/90' : iconColor)} />
        </div>
      </div>

      {loading ? (
        <Skeleton className="mt-4 h-9 w-36" />
      ) : (
        <p className={cn('mt-3 text-3xl font-bold tabular-nums', navy ? 'text-white' : 'text-gray-900 dark:text-gray-100')}>
          {formatCurrencyInt(faturamento)}
        </p>
      )}

      {!loading && (
        <div className={cn('mt-auto space-y-2 border-t pt-3', navy ? 'border-white/15' : 'border-gray-100 dark:border-gray-800')}>
          {/* Participação (todos menos Global) */}
          {!navy && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-gray-500 dark:text-gray-400">Participação</span>
              <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {participacaoPct.toFixed(0)}% do total
              </span>
            </div>
          )}

          {/* Tendência */}
          {variacaoPct != null ? (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className={navy ? 'text-white/60' : 'text-gray-500 dark:text-gray-400'}>vs {cmpLabel}</span>
              <span className={cn(
                'flex items-center gap-1 font-semibold tabular-nums',
                navy
                  ? (positiva ? 'text-emerald-300' : 'text-red-300')
                  : (positiva ? 'text-green-500' : 'text-red-500'),
              )}>
                <Arrow className="h-3.5 w-3.5" />
                {positiva ? '+' : ''}{variacaoPct.toFixed(1).replace('.', ',')}%
              </span>
            </div>
          ) : (
            <p className={cn('text-[11px]', navy ? 'text-white/50' : 'text-gray-400 dark:text-gray-500')}>Sem comparativo</p>
          )}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Card de Equipe (grande, mesmo grid dos segmentos).
 * ───────────────────────────────────────────────────────────── */
interface EquipeBigCardProps {
  total: number
  frentistas: number
  vendedores: number
  loading: boolean
}

const EquipeBigCard = ({ total, frentistas, vendedores, loading }: EquipeBigCardProps) => (
  <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Equipe</p>
          <InfoHint text="Colaboradores ativos no período: frentistas (pista) + vendedores (conveniência)." />
        </div>
        <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">Colaboradores</p>
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
        <Users className="h-5 w-5 text-slate-600 dark:text-slate-300" />
      </div>
    </div>

    {loading ? (
      <Skeleton className="mt-4 h-9 w-20" />
    ) : (
      <p className="mt-3 text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(total)}</p>
    )}

    {!loading && (
      <div className="mt-auto space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        <div className="flex items-center gap-1.5">
          <Fuel className="h-3.5 w-3.5 shrink-0 text-blue-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Frentistas</span>
          <span className="ml-auto text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(frentistas)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">Vendedores</span>
          <span className="ml-auto text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(vendedores)}</span>
        </div>
      </div>
    )}
  </div>
)

/* ─────────────────────────────────────────────────────────────
 * Card menor de operação (Litros, Abastecimentos, Cupons, Ticket).
 * ───────────────────────────────────────────────────────────── */
interface SmallStatCardProps {
  label: string
  sub: string
  Icon: typeof Droplets
  iconBg: string
  iconColor: string
  value: string
  loading: boolean
  help?: string
}

const SmallStatCard = ({ label, sub, Icon, iconBg, iconColor, value, loading, help }: SmallStatCardProps) => (
  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', iconBg)}>
      <Icon className={cn('h-4 w-4', iconColor)} />
    </div>
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
        {help && <InfoHint text={help} />}
      </div>
      {loading ? (
        <Skeleton className="mt-1 h-6 w-20" />
      ) : (
        <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
      )}
      <p className="text-[10px] text-gray-400 dark:text-gray-500">{sub}</p>
    </div>
  </div>
)

/* ─────────────────────────────────────────────────────────────
 * Cards de Destaque (3).
 * ───────────────────────────────────────────────────────────── */
interface HighlightCardProps {
  title: string
  Icon: typeof Trophy
  accent: string
  iconBg: string
  iconColor: string
  help?: string
  children: React.ReactNode
}

const HighlightCard = ({ title, Icon, accent, iconBg, iconColor, help, children }: HighlightCardProps) => (
  <div className={cn('rounded-2xl border bg-white p-5 shadow-sm dark:bg-gray-900', accent)}>
    <div className="flex items-center gap-2">
      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
      {help && <InfoHint text={help} />}
    </div>
    <div className="mt-3">{children}</div>
  </div>
)

const VarPill = ({ pct }: { pct: number }) => {
  const pos = pct >= 0
  const Arrow = pos ? ArrowUpRight : ArrowDownRight
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
      pos
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    )}>
      <Arrow className="h-3 w-3" />
      {pos ? '+' : ''}{pct.toFixed(1).replace('.', ',')}%
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Card de Insights automáticos.
 * ───────────────────────────────────────────────────────────── */
/** Agrupadores dos insights, na ordem de leitura: positivos → atenção → info. */
const INSIGHT_GROUPS: { type: InsightTodos['type']; label: string; dot: string; text: string }[] = [
  { type: 'positive', label: 'Positivos', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  { type: 'warning', label: 'Atenção', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  { type: 'info', label: 'Informações', dot: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
]

const InsightsCard = ({ insights }: { insights: InsightTodos[] }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
        <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Insights</p>
    </div>
    {insights.length === 0 ? (
      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">Sem insights para o período.</p>
    ) : (
      <div className="mt-3 space-y-4">
        {INSIGHT_GROUPS.map((g) => {
          const items = insights.filter((ins) => ins.type === g.type)
          if (items.length === 0) return null
          return (
            <div key={g.type}>
              <div className="flex items-center gap-1.5">
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', g.dot)} />
                <p className={cn('text-[11px] font-semibold uppercase tracking-wide', g.text)}>{g.label}</p>
              </div>
              <ul className="mt-1.5 space-y-1.5 pl-3">
                {items.map((ins, i) => (
                  <li key={i} className="text-sm leading-snug text-gray-700 dark:text-gray-300">{ins.text}</li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    )}
  </div>
)

/* ─────────────────────────────────────────────────────────────
 * Componente principal — modo "Todos".
 * ───────────────────────────────────────────────────────────── */
const ProdutividadeTodos = ({ empresaCodigo }: { empresaCodigo?: number | null } = {}) => {
  const data = useProdutividadeTodos(empresaCodigo)
  const {
    cmpLabel, global, combustivel, automotivos, conveniencia,
    totalColaboradores, qtdFrentistas, qtdVendedores,
    litrosTotais, totalAbastecimentos, totalCupons, ticketMedioLoja,
    campeaoFrentista, campeaoVendedor,
    insights, isLoading,
  } = data

  return (
    <div className="space-y-4">
      {/* ── 5 cards principais ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <SegCard
          label="Global" Icon={Globe} navy
          iconBg="" iconColor=""
          resumo={global} cmpLabel={cmpLabel} loading={isLoading}
          help="Faturamento total da operação no período: Combustível + Automotivos + Conveniência."
        />
        <SegCard
          label="Combustível" Icon={Fuel}
          iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-600 dark:text-blue-400"
          resumo={combustivel} cmpLabel={cmpLabel} loading={isLoading}
          help="Faturamento de combustível (pista) no período. Participação = % sobre o faturamento global."
        />
        <SegCard
          label="Automotivos" Icon={Wrench}
          iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600 dark:text-amber-400"
          resumo={automotivos} cmpLabel={cmpLabel} loading={isLoading}
          help="Faturamento de produtos automotivos (pista, grupo PS-) no período. Participação = % sobre o global."
        />
        <SegCard
          label="Conveniência" Icon={Store}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600 dark:text-emerald-400"
          resumo={conveniencia} cmpLabel={cmpLabel} loading={isLoading}
          help="Faturamento da loja de conveniência no período. Participação = % sobre o faturamento global."
        />
        <EquipeBigCard total={totalColaboradores} frentistas={qtdFrentistas} vendedores={qtdVendedores} loading={isLoading} />
      </div>

      {/* ── 4 cards menores de operação ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SmallStatCard
          label="Litros" sub="Combustível vendido" Icon={Droplets}
          iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-600 dark:text-blue-400"
          value={formatLiters(litrosTotais)} loading={isLoading}
          help="Litros de combustível vendidos na pista no período."
        />
        <SmallStatCard
          label="Abastecimentos" sub="Transações de pista" Icon={Gauge}
          iconBg="bg-cyan-100 dark:bg-cyan-900/30" iconColor="text-cyan-600 dark:text-cyan-400"
          value={formatNumber(totalAbastecimentos)} loading={isLoading}
          help="Número de abastecimentos (transações de pista) no período."
        />
        <SmallStatCard
          label="Cupons" sub="Conveniência" Icon={Receipt}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600 dark:text-emerald-400"
          value={formatNumber(totalCupons)} loading={isLoading}
          help="Número de cupons (vendas) da loja de conveniência no período."
        />
        <SmallStatCard
          label="Ticket médio" sub="Conveniência" Icon={Ticket}
          iconBg="bg-violet-100 dark:bg-violet-900/30" iconColor="text-violet-600 dark:text-violet-400"
          value={formatCurrency(ticketMedioLoja)} loading={isLoading}
          help="Ticket médio da conveniência = faturamento da loja ÷ nº de cupons."
        />
      </div>

      {/* ── 2 cards de destaque ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Frentista campeão */}
        <HighlightCard
          title="Frentista campeão" Icon={Trophy}
          accent="border-blue-200 dark:border-blue-900/40"
          iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-600 dark:text-blue-400"
          help="Frentista com maior faturamento (combustível) no período. Mostra litros e o campeão do mês anterior."
        >
          {campeaoFrentista ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-base font-bold text-gray-900 dark:text-gray-100">{campeaoFrentista.nome}</p>
                {campeaoFrentista.variacaoPct != null && <VarPill pct={campeaoFrentista.variacaoPct} />}
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(campeaoFrentista.faturamento)}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{formatLiters(campeaoFrentista.litros)}</span>
              </div>
              {campeaoFrentista.prevNome && (
                <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  Mês anterior: <span className="font-medium text-gray-700 dark:text-gray-300">{campeaoFrentista.prevNome}</span> · {formatLiters(campeaoFrentista.prevLitros)}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">Sem dados de frentistas no período.</p>
          )}
        </HighlightCard>

        {/* Vendedor campeão */}
        <HighlightCard
          title="Vendedor campeão" Icon={Award}
          accent="border-emerald-200 dark:border-emerald-900/40"
          iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600 dark:text-emerald-400"
          help="Vendedor com maior faturamento na conveniência no período. Mostra itens, ticket e o campeão do mês anterior."
        >
          {campeaoVendedor ? (
            <>
              <p className="truncate text-base font-bold text-gray-900 dark:text-gray-100">{campeaoVendedor.nome}</p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(campeaoVendedor.itens)} <span className="text-xs font-normal text-gray-500 dark:text-gray-400">itens</span></span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Ticket {formatCurrency(campeaoVendedor.ticketMedio)}</span>
              </div>
              {campeaoVendedor.prevNome && (
                <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  Mês anterior: <span className="font-medium text-gray-700 dark:text-gray-300">{campeaoVendedor.prevNome}</span> · {formatCurrencyInt(campeaoVendedor.prevFaturamento)}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">Sem dados de vendedores no período.</p>
          )}
        </HighlightCard>

      </div>

      {/* ── Insights ── */}
      <InsightsCard insights={insights} />
    </div>
  )
}

export default ProdutividadeTodos

import { useMemo, useState } from 'react'
import { Fuel, AlertTriangle, CheckCircle2, Clock, Loader2, TrendingDown, LayoutGrid, ClipboardList } from 'lucide-react'
import { formatLiters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'
import useReabastecimento from '@/pages/Dashboard/hooks/useReabastecimento'
import TanqueCard from '@/pages/Dashboard/components/TanqueCard'
import ReposicaoTabela from '@/pages/Dashboard/components/ReposicaoTabela'
import { aggregarPorProduto } from '@/pages/Dashboard/components/reposicao'

interface NivelTanquesCardProps {
  empresaCodigo: number
}

type FilterStatus = 'todos' | 'critico' | 'alerta' | 'ok'
type View = 'tanques' | 'resumo'

/**
 * Seção de reabastecimento do posto: stat cards (total/críticos/alerta/ok) +
 * necessidade total, e duas visões (switcher instantâneo): "Tanques" (cards) e
 * "Resumo" (relatório de reposição por combustível). Mesmo padrão da Central.
 *
 * Substituiu o módulo /reabastecimento — agora vive direto no Resumo do posto.
 */
const NivelTanquesCard = ({ empresaCodigo }: NivelTanquesCardProps) => {
  const { tanques, isLoading } = useReabastecimento({
    empresaCodigo,
    includeDetalhes: true,
  })

  const [view, setView] = useState<View>('tanques')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos')
  const [filterProduto, setFilterProduto] = useState<string>('todos')

  const produtosUnicos = useMemo(() => {
    const set = new Set<string>()
    for (const t of tanques) set.add(t.produtoNome)
    return Array.from(set).sort()
  }, [tanques])

  const resumo = useMemo(() => {
    let critico = 0, alerta = 0, ok = 0, totalNecessidade = 0
    for (const t of tanques) {
      if (t.nivel === 'critico') critico++
      else if (t.nivel === 'alerta') alerta++
      else ok++
      totalNecessidade += t.necessidadeFimDoMes
    }
    return { critico, alerta, ok, total: tanques.length, totalNecessidade }
  }, [tanques])

  // Filtro de status vale pras duas visões; produto só pros cards.
  const tanquesPorStatus = useMemo(
    () => tanques.filter((t) => filterStatus === 'todos' || t.nivel === filterStatus),
    [tanques, filterStatus],
  )
  const filtrados = useMemo(
    () => tanquesPorStatus.filter((t) => filterProduto === 'todos' || t.produtoNome === filterProduto),
    [tanquesPorStatus, filterProduto],
  )
  const linhasResumo = useMemo(() => aggregarPorProduto(tanquesPorStatus), [tanquesPorStatus])
  const totalSugestao = tanquesPorStatus.reduce((s, t) => s + t.necessidadeFimDoMes, 0)

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }

  if (tanques.length === 0) return null

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
          <Fuel className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Reabastecimento</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Estoque atual dos tanques · última compra · projeção até fim do mês
          </p>
        </div>
      </header>

      {/* Stat cards — sem borda externa, separados por divider só no desktop */}
      <div className="grid grid-cols-2 divide-gray-100 border-b border-gray-100 dark:divide-gray-800 dark:border-gray-800 md:grid-cols-4 md:divide-x">
        <StatCard label="Total de tanques" value={resumo.total} icon={Fuel} color="gray" hint="Quantidade de tanques de combustível do posto." />
        <StatCard label="Críticos" value={resumo.critico} sub="abaixo de 20%" icon={AlertTriangle} color="red" hint="Tanques abaixo de 20% da capacidade — risco de faltar combustível." />
        <StatCard label="Alerta" value={resumo.alerta} sub="entre 20% e 30%" icon={Clock} color="amber" hint="Tanques entre 20% e 30% da capacidade — atenção ao reabastecimento." />
        <StatCard label="OK" value={resumo.ok} sub="acima de 30%" icon={CheckCircle2} color="emerald" hint="Tanques acima de 30% da capacidade — nível saudável." />
      </div>

      {/* Necessidade total — strip azul destacado */}
      {resumo.totalNecessidade > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-b border-blue-100 bg-blue-50/60 px-5 py-3 dark:border-blue-900/40 dark:bg-blue-900/20">
          <TrendingDown className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-300">
              Necessidade total até fim do mês
            </p>
            <p className="text-lg font-bold tabular-nums text-blue-700 dark:text-blue-300">
              {formatLiters(resumo.totalNecessidade)}
            </p>
          </div>
          <p className="ml-auto text-[11px] text-blue-600/70 dark:text-blue-400/70">
            Projeção baseada no consumo médio diário do mês
          </p>
        </div>
      )}

      {/* Switcher de visão + filtro de status (vale pras duas visões) */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
          {(
            [
              { v: 'tanques', l: 'Tanques', Icon: LayoutGrid },
              { v: 'resumo', l: 'Resumo', Icon: ClipboardList },
            ] as { v: View; l: string; Icon: typeof LayoutGrid }[]
          ).map((opt) => (
            <button
              key={opt.v}
              onClick={() => setView(opt.v)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors',
                view === opt.v
                  ? 'bg-[#1e3a5f] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50',
              )}
            >
              <opt.Icon className="h-3.5 w-3.5" />
              {opt.l}
            </button>
          ))}
        </div>

        {/* Status — filtra cards e resumo */}
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
          {(
            [
              { v: 'todos', l: 'Todos' },
              { v: 'critico', l: 'Críticos' },
              { v: 'alerta', l: 'Alerta' },
              { v: 'ok', l: 'OK' },
            ] as { v: FilterStatus; l: string }[]
          ).map((opt) => (
            <button
              key={opt.v}
              onClick={() => setFilterStatus(opt.v)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                filterStatus === opt.v
                  ? 'bg-[#1e3a5f] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50',
              )}
            >
              {opt.l}
            </button>
          ))}
        </div>

        {/* Produto — só na visão Tanques */}
        {view === 'tanques' && produtosUnicos.length > 1 && (
          <div className="inline-flex flex-wrap items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
            {['todos', ...produtosUnicos].map((p) => (
              <button
                key={p}
                onClick={() => setFilterProduto(p)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  filterProduto === p
                    ? 'bg-[#1e3a5f] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50',
                )}
              >
                {p === 'todos' ? 'Todos os produtos' : p}
              </button>
            ))}
          </div>
        )}

        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
          {view === 'resumo' ? (
            <>
              Total a comprar:{' '}
              <span className="font-semibold tabular-nums text-blue-700 dark:text-blue-400">
                {formatLiters(totalSugestao)}
              </span>
            </>
          ) : (
            <>
              {filtrados.length} de {tanques.length} {tanques.length === 1 ? 'tanque' : 'tanques'}
            </>
          )}
        </span>
      </div>

      {view === 'resumo' ? (
        /* ── Visão Resumo: relatório de reposição por combustível ── */
        <div className="p-4">
          <ReposicaoTabela linhas={linhasResumo} />
        </div>
      ) : filtrados.length === 0 ? (
        <div className="p-8 text-center">
          <Fuel className="mx-auto h-7 w-7 text-gray-400" />
          <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Nenhum tanque pros filtros aplicados
          </p>
        </div>
      ) : (
        /* ── Visão Tanques: cards ── */
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtrados.map((t) => (
            <TanqueCard key={`${t.empresaCodigo}-${t.tanqueCodigo}`} t={t} />
          ))}
        </div>
      )}
    </section>
  )
}

interface StatCardProps {
  label: string
  value: number
  sub?: string
  icon: typeof Fuel
  color: 'gray' | 'red' | 'amber' | 'emerald'
  hint?: string
}

const StatCard = ({ label, value, sub, icon: Icon, color, hint }: StatCardProps) => {
  const colorClasses = {
    gray: { bg: 'bg-gray-100 dark:bg-gray-800', icon: 'text-gray-600 dark:text-gray-400' },
    red: { bg: 'bg-red-50 dark:bg-red-900/30', icon: 'text-red-600 dark:text-red-400' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-900/30', icon: 'text-amber-600 dark:text-amber-400' },
    emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/30', icon: 'text-emerald-600 dark:text-emerald-400' },
  }[color]
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', colorClasses.bg)}>
        <Icon className={cn('h-4 w-4', colorClasses.icon)} />
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {label}
          {hint && <InfoHint text={hint} />}
        </p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
          {value}
        </p>
        {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500">{sub}</p>}
      </div>
    </div>
  )
}

export default NivelTanquesCard

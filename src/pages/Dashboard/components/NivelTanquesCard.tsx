import { useMemo, useState } from 'react'
import { Fuel, AlertTriangle, CheckCircle2, Clock, Loader2, ShoppingCart, TrendingDown } from 'lucide-react'
import { formatCurrency, formatLiters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import useReabastecimento, { type ReabastTanque } from '@/pages/Dashboard/hooks/useReabastecimento'

interface NivelTanquesCardProps {
  empresaCodigo: number
}

type FilterStatus = 'todos' | 'critico' | 'alerta' | 'ok'

/** Formata data yyyy-MM-dd como dd/MM/yy curto. */
const fmtDateShort = (iso: string): string => {
  if (!iso || iso.length < 10) return iso
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y.slice(2)}`
}

/**
 * Seção de reabastecimento do posto: stat cards (total/críticos/alerta/ok),
 * necessidade total até fim do mês, filtros (status + produto) e lista de
 * tanques com nível + última compra + projeção.
 *
 * Substituiu o módulo /reabastecimento — agora vive direto no Resumo do posto
 * porque única tela faz mais sentido como continuação do resumo operacional.
 */
const NivelTanquesCard = ({ empresaCodigo }: NivelTanquesCardProps) => {
  const { tanques, isLoading } = useReabastecimento({
    empresaCodigo,
    includeDetalhes: true,
  })

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

  const filtrados = useMemo(() => {
    return tanques.filter((t) => {
      if (filterStatus !== 'todos' && t.nivel !== filterStatus) return false
      if (filterProduto !== 'todos' && t.produtoNome !== filterProduto) return false
      return true
    })
  }, [tanques, filterStatus, filterProduto])

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
        <StatCard label="Total de tanques" value={resumo.total} icon={Fuel} color="gray" />
        <StatCard label="Críticos" value={resumo.critico} sub="abaixo de 20%" icon={AlertTriangle} color="red" />
        <StatCard label="Alerta" value={resumo.alerta} sub="entre 20% e 30%" icon={Clock} color="amber" />
        <StatCard label="OK" value={resumo.ok} sub="acima de 30%" icon={CheckCircle2} color="emerald" />
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

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
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

        {produtosUnicos.length > 1 && (
          <select
            value={filterProduto}
            onChange={(e) => setFilterProduto(e.target.value)}
            className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 focus:border-blue-400 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="todos">Todos os produtos</option>
            {produtosUnicos.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}

        <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
          {filtrados.length} de {tanques.length} {tanques.length === 1 ? 'tanque' : 'tanques'}
        </span>
      </div>

      {/* Lista de tanques */}
      {filtrados.length === 0 ? (
        <div className="p-8 text-center">
          <Fuel className="mx-auto h-7 w-7 text-gray-400" />
          <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Nenhum tanque pros filtros aplicados
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {filtrados.map((t) => (
            <TanqueRow key={`${t.empresaCodigo}-${t.tanqueCodigo}`} t={t} />
          ))}
        </ul>
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
}

const StatCard = ({ label, value, sub, icon: Icon, color }: StatCardProps) => {
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
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {label}
        </p>
        <p className="mt-0.5 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
          {value}
        </p>
        {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500">{sub}</p>}
      </div>
    </div>
  )
}

const TanqueRow = ({ t }: { t: ReabastTanque }) => {
  const barColor =
    t.nivel === 'critico' ? 'bg-red-500' :
    t.nivel === 'alerta' ? 'bg-amber-500' :
    'bg-emerald-500'
  const textColor =
    t.nivel === 'critico' ? 'text-red-600 dark:text-red-400' :
    t.nivel === 'alerta' ? 'text-amber-700 dark:text-amber-400' :
    'text-emerald-700 dark:text-emerald-400'
  const badge =
    t.nivel === 'critico' ? { label: 'Crítico', bg: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' } :
    t.nivel === 'alerta' ? { label: 'Alerta', bg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' } :
    { label: 'OK', bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {t.tanqueNome}
          </p>
          <span className="text-xs text-gray-400">·</span>
          <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-300">
            {t.produtoNome}
          </p>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className={cn('h-1.5 rounded-full transition-all', barColor)}
              style={{ width: `${Math.max(2, Math.min(100, t.nivelPct))}%` }}
            />
          </div>
          <span className={cn('shrink-0 text-xs font-semibold tabular-nums', textColor)}>
            {t.nivelPct.toFixed(0)}%
          </span>
        </div>

        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
          {formatLiters(t.estoqueAtual)} de {formatLiters(t.capacidade)}
        </p>

        {(t.ultimaCompra || t.necessidadeFimDoMes > 0) && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-gray-100 pt-1.5 text-[11px] dark:border-gray-800">
            {t.ultimaCompra && (
              <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-400">
                <ShoppingCart className="h-3 w-3 text-gray-400" />
                <span>
                  Última compra:{' '}
                  <span className="font-medium tabular-nums text-gray-800 dark:text-gray-200">
                    {formatLiters(t.ultimaCompra.volume)}
                  </span>
                  {' '}em{' '}
                  <span className="tabular-nums">{fmtDateShort(t.ultimaCompra.data)}</span>
                  {t.ultimaCompra.valorEstimado > 0 && (
                    <> · <span className="tabular-nums" title="Estimado: volume × preço de custo do dia">
                      {formatCurrency(t.ultimaCompra.valorEstimado)}
                    </span></>
                  )}
                </span>
              </span>
            )}
            {t.necessidadeFimDoMes > 0 && (
              <span
                className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400"
                title="Projeção: consumo médio diário × dias restantes do mês − estoque atual"
              >
                <TrendingDown className="h-3 w-3" />
                <span>
                  Comprar até fim do mês:{' '}
                  <span className="font-semibold tabular-nums">
                    {formatLiters(t.necessidadeFimDoMes)}
                  </span>
                  {t.diasRestantes != null && (
                    <span className="ml-1 text-[10px] text-blue-600/70 dark:text-blue-400/70">
                      (estoque cobre ~{t.diasRestantes} {t.diasRestantes === 1 ? 'dia' : 'dias'})
                    </span>
                  )}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      <span
        className={cn(
          'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
          badge.bg,
        )}
      >
        {badge.label}
      </span>
    </li>
  )
}

export default NivelTanquesCard

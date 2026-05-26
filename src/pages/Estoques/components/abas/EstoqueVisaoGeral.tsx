import { useMemo } from 'react'
import {
  AlertTriangle, AlertCircle, RefreshCw, TrendingDown, Package, Layers,
  ShoppingCart, Boxes, Clock, Hourglass, DollarSign,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import type { ProductAnalyticsRow, EstoqueKpis } from '@/pages/Estoques/hooks/useEstoqueAnalytics'

interface Props {
  data: ProductAnalyticsRow[]
  categorias: string[]
  /** KPIs principais — renderizados como primeira seção (movidos do topo da página). */
  kpis: EstoqueKpis | null
  onNavigateTab?: (tab: string) => void
}

const fmtUnidades = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)

const necessidadeBadge = (status: ProductAnalyticsRow['necessidadeStatus']): { label: string; cls: string } => {
  switch (status) {
    case 'negativo': return { label: 'Negativo', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' }
    case 'critico': return { label: 'Crítico', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' }
    case 'baixo': return { label: 'Baixo', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' }
    case 'ok': return { label: 'OK', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' }
    case 'sem_movimento': return { label: 'Sem movimento', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' }
  }
}

const EstoqueVisaoGeral = ({ data, kpis, onNavigateTab }: Props) => {
  const stats = useMemo(() => {
    const negativos = data.filter((r) => r.saldoAtual < 0)
    const rupturas = data.filter((r) => r.saldoAtual === 0 && r.vendasUltimos6m > 0)
    const criticos = data.filter((r) => r.necessidadeStatus === 'critico' || r.necessidadeStatus === 'negativo')
    const semMovimento = data.filter((r) => r.necessidadeStatus === 'sem_movimento' && r.saldoAtual > 0)
    const giros = data.filter((r) => r.estoqueMedio > 0 && r.giro > 0).map((r) => r.giro)
    const giroMedio = giros.length > 0 ? giros.reduce((s, x) => s + x, 0) / giros.length : 0

    const topValor = [...data].sort((a, b) => b.valorEstoque - a.valorEstoque).slice(0, 10)
    const maxTopValor = Math.max(...topValor.map((p) => p.valorEstoque), 0)

    // Top necessidade crítica — prioriza negativo > critico > baixo. Ordenado
    // por menor cobertura primeiro (mais urgente). Filtra sem movimento porque
    // não tem sentido recomendar compra de produto parado.
    const ordenadosPorCobertura = [...data]
      .filter((r) => r.necessidadeStatus !== 'sem_movimento' && r.necessidadeStatus !== 'ok')
      .sort((a, b) => {
        const rank = (s: ProductAnalyticsRow['necessidadeStatus']) =>
          s === 'negativo' ? 0 : s === 'critico' ? 1 : 2
        const dr = rank(a.necessidadeStatus) - rank(b.necessidadeStatus)
        if (dr !== 0) return dr
        return a.diasCobertura - b.diasCobertura
      })
      .slice(0, 10)

    // Top 3 produtos prestes a zerar — projeção de ruptura baseada na média
    // diária de vendas. Exclui produtos já em ruptura (saldo ≤ 0, tratados em
    // outros KPIs) e sem movimento (cobertura infinita não faz sentido).
    const proximosZerar = [...data]
      .filter((r) =>
        r.saldoAtual > 0 &&
        r.mediaMensalVendas > 0 &&
        isFinite(r.diasCobertura) &&
        r.diasCobertura > 0,
      )
      .sort((a, b) => a.diasCobertura - b.diasCobertura)
      .slice(0, 3)

    // Por categoria — soma valor em estoque
    const catMap = new Map<string, { categoria: string; valor: number; produtos: number }>()
    for (const r of data) {
      const prev = catMap.get(r.categoria) ?? { categoria: r.categoria, valor: 0, produtos: 0 }
      prev.valor += r.valorEstoque
      prev.produtos += 1
      catMap.set(r.categoria, prev)
    }
    const porCategoria = Array.from(catMap.values())
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8)
    const totalValor = porCategoria.reduce((s, c) => s + c.valor, 0)
    const maxCat = Math.max(...porCategoria.map((c) => c.valor), 0)

    return {
      negativos,
      rupturas,
      criticos,
      semMovimento,
      giroMedio,
      topValor,
      maxTopValor,
      ordenadosPorCobertura,
      proximosZerar,
      porCategoria,
      totalValor,
      maxCat,
    }
  }, [data])

  return (
    <div className="space-y-4">
      {/* KPIs principais — movidos do topo da página */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-blue-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total de produtos</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatNumber(kpis?.totalProdutos ?? 0)}
          </p>
          <p className="text-xs text-gray-500">não-combustíveis com saldo ou movimentação</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-emerald-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Valor total em estoque</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatCurrency(kpis?.valorTotalEstoque ?? 0)}
          </p>
          <p className="text-xs text-gray-500">a custo médio dos últimos 6 meses</p>
        </div>
      </div>

      {/* Mini-KPIs operacionais — alarmes e indicadores agregados */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniKpi
          label="Saldo negativo"
          value={formatNumber(stats.negativos.length)}
          sub="produto(s) com saldo < 0"
          Icon={AlertCircle}
          tone={stats.negativos.length > 0 ? 'danger' : 'neutral'}
          onClick={onNavigateTab ? () => onNavigateTab('geral') : undefined}
        />
        <MiniKpi
          label="Ruptura"
          value={formatNumber(stats.rupturas.length)}
          sub="zerado com vendas no 6m"
          Icon={AlertTriangle}
          tone={stats.rupturas.length > 0 ? 'warning' : 'neutral'}
          onClick={onNavigateTab ? () => onNavigateTab('necessidade') : undefined}
        />
        <MiniKpi
          label="Necessidade crítica"
          value={formatNumber(stats.criticos.length)}
          sub="compra urgente"
          Icon={ShoppingCart}
          tone={stats.criticos.length > 0 ? 'danger' : 'neutral'}
          onClick={onNavigateTab ? () => onNavigateTab('necessidade') : undefined}
        />
        <MiniKpi
          label="Giro médio (6m)"
          value={stats.giroMedio.toFixed(2).replace('.', ',')}
          sub={`${formatNumber(stats.semMovimento.length)} sem movimento`}
          Icon={RefreshCw}
          tone="neutral"
          onClick={onNavigateTab ? () => onNavigateTab('giro') : undefined}
        />
      </div>

      {/* Projeção de ruptura — top 3 mais urgentes em cards horizontais */}
      {stats.proximosZerar.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Hourglass className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Vão zerar em breve
              </h3>
              <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                projeção pela média diária
              </span>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('necessidade')}
                className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Ver todos
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3">
            {stats.proximosZerar.map((p) => {
              const dias = Math.max(0, Math.round(p.diasCobertura))
              const vendaDiaria = p.mediaMensalVendas / 30
              // Tom: < 7d crítico (vermelho), < 15d alerta (âmbar), >= 15d neutro
              const tone: 'critical' | 'warning' | 'neutral' =
                dias < 7 ? 'critical' : dias < 15 ? 'warning' : 'neutral'
              return (
                <button
                  key={p.produtoCodigo}
                  type="button"
                  onClick={onNavigateTab ? () => onNavigateTab('necessidade') : undefined}
                  disabled={!onNavigateTab}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-all',
                    tone === 'critical'
                      ? 'border-red-200 bg-gradient-to-br from-red-50/70 to-white dark:border-red-900/50 dark:from-red-950/30 dark:to-gray-900'
                      : tone === 'warning'
                      ? 'border-amber-200 bg-gradient-to-br from-amber-50/70 to-white dark:border-amber-900/50 dark:from-amber-950/30 dark:to-gray-900'
                      : 'border-gray-200 bg-gray-50/50 dark:border-gray-700 dark:bg-gray-800/40',
                    onNavigateTab && 'hover:shadow-md',
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className={cn(
                      'text-[10px] font-semibold uppercase tracking-wider',
                      tone === 'critical' ? 'text-red-700 dark:text-red-300'
                        : tone === 'warning' ? 'text-amber-700 dark:text-amber-300'
                        : 'text-gray-500 dark:text-gray-400',
                    )}>
                      Vai zerar em
                    </p>
                    <Clock className={cn(
                      'h-3.5 w-3.5',
                      tone === 'critical' ? 'text-red-500'
                        : tone === 'warning' ? 'text-amber-500'
                        : 'text-gray-400',
                    )} />
                  </div>
                  <p className={cn(
                    'mt-1 text-2xl font-bold tabular-nums',
                    tone === 'critical' ? 'text-red-700 dark:text-red-300'
                      : tone === 'warning' ? 'text-amber-700 dark:text-amber-300'
                      : 'text-gray-900 dark:text-gray-100',
                  )}>
                    {dias}<span className="ml-0.5 text-base font-medium">d</span>
                  </p>
                  <p className="mt-1.5 truncate text-xs font-medium text-gray-900 dark:text-gray-100" title={p.produtoNome}>
                    {p.produtoNome}
                  </p>
                  <p className="mt-0.5 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
                    {fmtUnidades(p.saldoAtual)} un. · {vendaDiaria.toFixed(1).replace('.', ',')}/dia
                  </p>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* 2 colunas: top valor + top necessidade */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top valor em estoque */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Top 10 · Valor em Estoque</h3>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('geral')}
                className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Ver todos
              </button>
            )}
          </div>
          {stats.topValor.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-gray-400">Sem dados.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {stats.topValor.map((p) => {
                const barWidth = stats.maxTopValor > 0 ? (p.valorEstoque / stats.maxTopValor) * 100 : 0
                return (
                  <li key={p.produtoCodigo} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-gray-900 dark:text-gray-100" title={p.produtoNome}>
                        {p.produtoNome}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {formatCurrency(p.valorEstoque)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div
                          className="h-full rounded-full bg-blue-500/70"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[10px] tabular-nums text-gray-400">
                        {fmtUnidades(p.saldoAtual)} un.
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {/* Top necessidade crítica */}
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Top 10 · Necessidade Crítica</h3>
            </div>
            {onNavigateTab && (
              <button
                type="button"
                onClick={() => onNavigateTab('necessidade')}
                className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Ver todos
              </button>
            )}
          </div>
          {stats.ordenadosPorCobertura.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-gray-400">Tudo certo no estoque.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {stats.ordenadosPorCobertura.map((p) => {
                const badge = necessidadeBadge(p.necessidadeStatus)
                return (
                  <li key={p.produtoCodigo} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-gray-900 dark:text-gray-100" title={p.produtoNome}>
                        {p.produtoNome}
                      </span>
                      <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium', badge.cls)}>
                        {badge.label}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] tabular-nums text-gray-400">
                      Saldo {fmtUnidades(p.saldoAtual)} · cobertura {p.diasCobertura < 0 ? '— ' : ''}{Math.abs(Math.round(p.diasCobertura))}d
                      {p.necessidadeUnidades > 0 && (
                        <> · sugerido <span className="font-medium text-gray-600 dark:text-gray-300">{fmtUnidades(p.necessidadeUnidades)} un.</span></>
                      )}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Distribuição por categoria — barras horizontais */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Distribuição por Categoria</h3>
          </div>
          <span className="text-[11px] tabular-nums text-gray-400">
            Top 8 · {formatCurrency(stats.totalValor)}
          </span>
        </div>
        {stats.porCategoria.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-gray-400">Sem dados.</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {stats.porCategoria.map((c) => {
              const barWidth = stats.maxCat > 0 ? (c.valor / stats.maxCat) * 100 : 0
              const pct = stats.totalValor > 0 ? (c.valor / stats.totalValor) * 100 : 0
              return (
                <li key={c.categoria} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      <Boxes className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                      <span className="truncate font-medium text-gray-900 dark:text-gray-100" title={c.categoria}>
                        {c.categoria}
                      </span>
                      <span className="shrink-0 text-[10px] text-gray-400">· {formatNumber(c.produtos)} SKU</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                      {formatCurrency(c.valor)}
                      <span className="ml-1 text-[10px] font-normal text-gray-400">{pct.toFixed(1).replace('.', ',')}%</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-full rounded-full bg-purple-500/70"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

const MiniKpi = ({
  label, value, sub, Icon, tone, onClick,
}: {
  label: string
  value: string
  sub?: string
  Icon: typeof Package
  tone: 'danger' | 'warning' | 'neutral'
  onClick?: () => void
}) => {
  const interactive = !!onClick
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={cn(
        'rounded-xl border p-4 text-left shadow-sm transition-all',
        tone === 'danger'
          ? 'border-red-200 bg-gradient-to-br from-red-50/60 to-white dark:border-red-900/40 dark:from-red-950/20 dark:to-gray-900'
          : tone === 'warning'
          ? 'border-amber-200 bg-gradient-to-br from-amber-50/60 to-white dark:border-amber-900/40 dark:from-amber-950/20 dark:to-gray-900'
          : 'border-gray-200 bg-gradient-to-br from-gray-50/60 to-white dark:border-gray-700 dark:from-gray-800/40 dark:to-gray-900',
        interactive ? 'hover:shadow-md' : 'cursor-default',
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
        <div className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md',
          tone === 'danger' ? 'bg-red-100 dark:bg-red-900/30'
            : tone === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30'
            : 'bg-gray-100 dark:bg-gray-800',
        )}>
          <Icon className={cn(
            'h-3.5 w-3.5',
            tone === 'danger' ? 'text-red-600 dark:text-red-400'
              : tone === 'warning' ? 'text-amber-600 dark:text-amber-400'
              : 'text-gray-500',
          )} />
        </div>
      </div>
      <p className={cn(
        'mt-1.5 text-xl font-bold tabular-nums',
        tone === 'danger' ? 'text-red-600 dark:text-red-400'
          : tone === 'warning' ? 'text-amber-600 dark:text-amber-400'
          : 'text-gray-900 dark:text-gray-100',
      )}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">{sub}</p>}
    </button>
  )
}

export default EstoqueVisaoGeral

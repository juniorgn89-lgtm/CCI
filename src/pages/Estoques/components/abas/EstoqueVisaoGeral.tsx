import { useMemo, useState } from 'react'
import {
  AlertTriangle, AlertCircle, RefreshCw, Package,
  ShoppingCart, Boxes, Clock, Hourglass, DollarSign,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import type { ProductAnalyticsRow } from '@/pages/Estoques/hooks/useEstoqueAnalytics'

interface Props {
  data: ProductAnalyticsRow[]
  categorias: string[]
  janelaDias: number
  onNavigateTab?: (tab: string) => void
}

type SaldoFiltro = 'todos' | 'comSaldo' | 'zerado' | 'negativo'

const fmtUnidades = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)

const EstoqueVisaoGeral = ({ data: allData, janelaDias, onNavigateTab }: Props) => {
  const [saldoFiltro, setSaldoFiltro] = useState<SaldoFiltro>('todos')

  // Filtro local de saldo — TODOS os cartões/listas reagem. `data` (filtrado)
  // substitui o prop, então o restante do componente não muda.
  const data = useMemo(
    () => allData.filter((r) => {
      if (saldoFiltro === 'comSaldo' && !(r.saldoAtual > 0)) return false
      if (saldoFiltro === 'zerado' && r.saldoAtual !== 0) return false
      if (saldoFiltro === 'negativo' && !(r.saldoAtual < 0)) return false
      return true
    }),
    [allData, saldoFiltro],
  )

  const stats = useMemo(() => {
    const negativos = data.filter((r) => r.saldoAtual < 0)
    const rupturas = data.filter((r) => r.saldoAtual === 0 && r.vendasUltimos6m > 0)
    const criticos = data.filter((r) => r.necessidadeStatus === 'critico' || r.necessidadeStatus === 'negativo')
    const semMovimento = data.filter((r) => r.necessidadeStatus === 'sem_movimento' && r.saldoAtual > 0)
    const giros = data.filter((r) => r.estoqueMedioJanela > 0 && r.giroJanela > 0).map((r) => r.giroJanela)
    const giroMedio = giros.length > 0 ? giros.reduce((s, x) => s + x, 0) / giros.length : 0

    // Total de unidades + valor em estoque (reagem ao filtro local).
    const quantidadeTotal = data.reduce((s, r) => s + r.saldoAtual, 0)
    const valorTotal = data.reduce((s, r) => s + r.valorEstoque, 0)

    // Top 3 produtos prestes a zerar — projeção de ruptura baseada na média
    // diária de vendas. Exclui produtos já em ruptura (saldo ≤ 0, tratados em
    // outros KPIs) e sem movimento (cobertura infinita não faz sentido).
    const proximosZerar = [...data]
      .filter((r) =>
        r.saldoAtual > 0 &&
        r.mediaDiariaVendas > 0 &&
        isFinite(r.diasCobertura) &&
        r.diasCobertura > 0,
      )
      .sort((a, b) => a.diasCobertura - b.diasCobertura)
      .slice(0, 3)

    return {
      negativos,
      rupturas,
      criticos,
      semMovimento,
      giroMedio,
      quantidadeTotal,
      valorTotal,
      proximosZerar,
    }
  }, [data])

  return (
    <div className="space-y-4">
      {/* Filtro de saldo centralizado — os cartões/listas reagem a ele. */}
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Saldo
          <InfoHint text="Filtra os produtos pelo saldo atual: todos, só com saldo (>0), zerados ou negativos." />
        </span>
        <Segmented
          value={saldoFiltro}
          onChange={setSaldoFiltro}
          options={[
            { value: 'todos', label: 'Todo saldo' },
            { value: 'comSaldo', label: 'Com saldo' },
            { value: 'zerado', label: 'Zerados' },
            { value: 'negativo', label: 'Negativos' },
          ]}
        />
      </div>

      {/* KPIs principais — movidos do topo da página */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-blue-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total de produtos</span>
              <InfoHint text="Nº de produtos não-combustíveis com saldo atual ou venda nos últimos 6 meses (no filtro de saldo selecionado)." />
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatNumber(data.length)}
          </p>
          <p className="text-xs text-gray-500">não-combustíveis com saldo ou movimentação</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-indigo-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Quantidade em estoque</span>
              <InfoHint text="Soma do saldo atual (em unidades) de todos os produtos do filtro. Não inclui combustível (medido em litros)." />
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <Boxes className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {fmtUnidades(stats.quantidadeTotal)}
          </p>
          <p className="text-xs text-gray-500">soma do saldo de todos os produtos</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-emerald-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-emerald-950/20 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Valor total em estoque</span>
              <InfoHint text="Saldo atual × custo médio (últimos 6 meses) de cada produto, somado. Quanto de capital está parado em estoque." />
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatCurrency(stats.valorTotal)}
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
          hint="Produtos com saldo menor que zero — quase sempre erro de lançamento ou baixa indevida. Corrigir antes de comprar."
          Icon={AlertCircle}
          tone={stats.negativos.length > 0 ? 'danger' : 'neutral'}
          onClick={onNavigateTab ? () => onNavigateTab('geral') : undefined}
        />
        <MiniKpi
          label="Ruptura"
          value={formatNumber(stats.rupturas.length)}
          sub="zerado com vendas no 6m"
          hint="Produtos zerados que tiveram venda nos últimos 6 meses — ou seja, estão deixando de vender por falta de estoque."
          Icon={AlertTriangle}
          tone={stats.rupturas.length > 0 ? 'warning' : 'neutral'}
          onClick={onNavigateTab ? () => onNavigateTab('necessidade') : undefined}
        />
        <MiniKpi
          label="Necessidade crítica"
          value={formatNumber(stats.criticos.length)}
          sub="compra urgente"
          hint="Produtos que precisam de compra urgente: saldo zerado com venda, ou cobertura abaixo de metade dos dias-alvo."
          Icon={ShoppingCart}
          tone={stats.criticos.length > 0 ? 'danger' : 'neutral'}
          onClick={onNavigateTab ? () => onNavigateTab('necessidade') : undefined}
        />
        <MiniKpi
          label={`Giro médio (${janelaDias}d)`}
          value={stats.giroMedio.toFixed(2).replace('.', ',')}
          sub={`${formatNumber(stats.semMovimento.length)} sem movimento`}
          hint={`Quantas vezes, em média, o estoque girou nos últimos ${janelaDias} dias (unidades vendidas ÷ estoque médio). Alto = produto rodando; baixo = capital parado.`}
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
              <InfoHint text="Top 3 produtos mais perto de zerar, projetado pela média diária de vendas (saldo atual ÷ venda/dia). Vermelho < 7 dias." />
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
              const vendaDiaria = p.mediaDiariaVendas
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

    </div>
  )
}

/** Segmented control (pills) — usado nos filtros centralizados do topo. */
const Segmented = <T extends string>({
  value, onChange, options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) => (
  <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={cn(
          'h-7 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-all',
          value === o.value
            ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-gray-900 dark:text-gray-100'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
        )}
      >
        {o.label}
      </button>
    ))}
  </div>
)

const MiniKpi = ({
  label, value, sub, hint, Icon, tone, onClick,
}: {
  label: string
  value: string
  sub?: string
  hint?: string
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
        <span className="flex items-center gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</span>
          {hint && <InfoHint text={hint} />}
        </span>
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

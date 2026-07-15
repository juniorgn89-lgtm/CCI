import { useMemo, useState } from 'react'
import {
  AlertTriangle, AlertCircle, RefreshCw, Package, ShoppingCart, Boxes,
  DollarSign, Hourglass, BarChart3, ChevronRight, CalendarRange, TrendingUp, TrendingDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import type { ProductAnalyticsRow, EstoqueValorMensal } from '@/pages/Estoques/hooks/useEstoqueAnalytics'

interface Props {
  data: ProductAnalyticsRow[]
  categorias: string[]
  valorMensal: EstoqueValorMensal[]
  janelaDias: number
  onJanelaChange: (v: 30 | 60 | 90) => void
  onNavigateTab?: (tab: string) => void
}

type SaldoFiltro = 'todos' | 'comSaldo' | 'zerado' | 'negativo'

const fmtUnidades = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
const fmtPct = (v: number) => `${v.toFixed(0)}%`

const fmtJanelaPeriodo = (janelaDias: number): string => {
  const fim = new Date()
  const ini = new Date()
  ini.setDate(ini.getDate() - (janelaDias - 1))
  const f = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
  return `${f(ini)} a ${f(fim)}`
}

const CAT_PALETTE = ['#1e3a5f', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#cbd5e1']

/* ── Sparkline (6 meses) ── */
const Sparkline = ({ values, color = '#93c5fd' }: { values: number[]; color?: string }) => {
  const W = 120, H = 32, pad = 3
  const max = Math.max(...values)
  const min = Math.min(...values)
  const range = max - min || 1
  const coords = values
    .map((v, i) => {
      const x = values.length > 1 ? (i / (values.length - 1)) * (W - 2 * pad) + pad : W / 2
      const y = H - pad - ((v - min) / range) * (H - 2 * pad)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-full" preserveAspectRatio="none">
      <polyline points={coords} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const EstoqueVisaoGeral = ({ data: allData, valorMensal, janelaDias, onJanelaChange, onNavigateTab }: Props) => {
  const [saldoFiltro, setSaldoFiltro] = useState<SaldoFiltro>('todos')

  const data = useMemo(
    () => allData.filter((r) => {
      if (saldoFiltro === 'comSaldo' && !(r.saldoAtual > 0)) return false
      if (saldoFiltro === 'zerado' && r.saldoAtual !== 0) return false
      if (saldoFiltro === 'negativo' && !(r.saldoAtual < 0)) return false
      return true
    }),
    [allData, saldoFiltro],
  )

  // Seções analíticas só fazem sentido com saldo positivo no escopo.
  const showSecoes = saldoFiltro === 'todos' || saldoFiltro === 'comSaldo'

  const stats = useMemo(() => {
    const negativos = data.filter((r) => r.saldoAtual < 0).length
    const rupturas = data.filter((r) => r.saldoAtual === 0 && r.vendasUltimos6m > 0).length
    const criticos = data.filter((r) => r.necessidadeStatus === 'critico' || r.necessidadeStatus === 'negativo').length
    const semMovimento = data.filter((r) => r.necessidadeStatus === 'sem_movimento' && r.saldoAtual > 0).length
    const giros = data.filter((r) => r.estoqueMedioJanela > 0 && r.giroJanela > 0).map((r) => r.giroJanela)
    const giroMedio = giros.length > 0 ? giros.reduce((s, x) => s + x, 0) / giros.length : 0
    const unidades = data.reduce((s, r) => s + r.saldoAtual, 0)
    const valorTotal = data.reduce((s, r) => s + r.valorEstoque, 0)

    const proximosZerar = [...data]
      .filter((r) => r.saldoAtual > 0 && r.mediaDiariaVendas > 0 && isFinite(r.diasCobertura) && r.diasCobertura > 0)
      .sort((a, b) => a.diasCobertura - b.diasCobertura)
      .slice(0, 3)

    return { negativos, rupturas, criticos, semMovimento, giroMedio, unidades, valorTotal, proximosZerar }
  }, [data])

  // ── Curva ABC (concentração de valor) ──
  const abc = useMemo(() => {
    const items = data.filter((r) => r.valorEstoque > 0).sort((a, b) => b.valorEstoque - a.valorEstoque)
    const total = items.reduce((s, r) => s + r.valorEstoque, 0)
    const classes = { A: { prod: 0, valor: 0 }, B: { prod: 0, valor: 0 }, C: { prod: 0, valor: 0 } }
    let acc = 0
    for (const r of items) {
      const pctAntes = total > 0 ? (acc / total) * 100 : 0
      const cls = pctAntes < 80 ? 'A' : pctAntes < 95 ? 'B' : 'C'
      classes[cls].prod++
      classes[cls].valor += r.valorEstoque
      acc += r.valorEstoque
    }
    return { total, classes, count: items.length }
  }, [data])

  // ── Capital girando / lento / parado ──
  const capital = useMemo(() => {
    let girando = 0, lento = 0, parado = 0
    for (const r of data) {
      if (r.valorEstoque <= 0) continue
      if (r.necessidadeStatus === 'sem_movimento') parado += r.valorEstoque
      else if (r.giroJanela >= 1) girando += r.valorEstoque
      else lento += r.valorEstoque
    }
    return { girando, lento, parado, total: girando + lento + parado }
  }, [data])

  // ── Valor por categoria (top 5 + Outros) ──
  const categoria = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of data) if (r.valorEstoque > 0) m.set(r.categoria, (m.get(r.categoria) ?? 0) + r.valorEstoque)
    const all = [...m].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor)
    const total = all.reduce((s, c) => s + c.valor, 0)
    const top = all.slice(0, 5)
    const outros = all.slice(5).reduce((s, c) => s + c.valor, 0)
    const rows = outros > 0 ? [...top, { nome: 'Outros', valor: outros }] : top
    return { rows, total, max: Math.max(...rows.map((r) => r.valor), 0) }
  }, [data])

  // ── Tendência (sparkline) ──
  const trend = useMemo(() => {
    const pts = valorMensal ?? []
    const validos = pts.filter((p) => p.valor > 0).length
    const last = pts[pts.length - 1]?.valor ?? 0
    const prev = pts[pts.length - 2]?.valor ?? 0
    const variacao = prev > 0 ? ((last - prev) / prev) * 100 : null
    return { values: pts.map((p) => p.valor), show: validos >= 3, variacao }
  }, [valorMensal])

  return (
    <div className="space-y-4">
      {/* ── Controles: Saldo (esq.) + Janela (dir.) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2">
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
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            <CalendarRange className="h-3.5 w-3.5" /> Janela
          </span>
          <Segmented
            value={janelaDias as 30 | 60 | 90}
            onChange={(v) => onJanelaChange(v)}
            options={[
              { value: 30, label: '30 dias' },
              { value: 60, label: '60 dias' },
              { value: 90, label: '90 dias' },
            ]}
          />
          <span className="text-[11px] tabular-nums text-gray-400/80 dark:text-gray-500/80">{fmtJanelaPeriodo(janelaDias)}</span>
        </div>
      </div>

      {/* ── 4 KPI cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Hero navy — valor em estoque */}
        <div className="flex flex-col rounded-2xl border border-[#1e3a5f]/30 bg-gradient-to-br from-[#1e3a5f] to-[#27496f] p-5 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-[13px] font-semibold text-white">
                Valor em estoque
                <InfoHint text="Saldo atual × custo de cadastro (fallback custo médio 6m) somado. Capital parado em estoque." className="text-white/60 hover:text-white" />
              </p>
              <p className="text-[11px] uppercase tracking-wide text-white/60">Capital parado</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <DollarSign className="h-5 w-5 text-white/90" />
            </div>
          </div>
          <p className="mt-3 text-3xl font-bold tabular-nums text-white">{formatCurrency(stats.valorTotal)}</p>
          {showSecoes && trend.show && (
            <div className="mt-2 flex items-end gap-2">
              <div className="min-w-0 flex-1"><Sparkline values={trend.values} /></div>
              {trend.variacao !== null && (
                <span className={cn(
                  'mb-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                  trend.variacao >= 0 ? 'bg-emerald-400/20 text-[#6ee7b7]' : 'bg-red-400/20 text-red-300',
                )}>
                  {trend.variacao >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {trend.variacao >= 0 ? '+' : ''}{trend.variacao.toFixed(1).replace('.', ',')}%
                </span>
              )}
            </div>
          )}
          <div className="mt-auto border-t border-white/15 pt-3">
            <span className="text-[11px] text-white/60">a custo médio · 6 meses · vs mês anterior</span>
          </div>
        </div>

        <KpiCard label="Produtos" sub="não-combustíveis" value={formatNumber(data.length)} Icon={Package}
          chipBg="bg-[#dbeafe] dark:bg-blue-900/30" chipColor="text-[#2563eb] dark:text-blue-400"
          footer="com saldo ou movimentação"
          hint="Nº de produtos não-combustíveis com saldo atual ou venda nos últimos 6 meses (no filtro de saldo)." />
        <KpiCard label="Unidades" sub="Saldo somado" value={fmtUnidades(stats.unidades)} Icon={Boxes}
          chipBg="bg-[#e0e7ff] dark:bg-indigo-900/30" chipColor="text-[#4f46e5] dark:text-indigo-400"
          footer="total de itens em estoque"
          hint="Soma do saldo atual (unidades) de todos os produtos do filtro. Não inclui combustível." />
        <KpiCard label="Giro médio" sub={`Janela ${janelaDias}d`} value={stats.giroMedio.toFixed(2).replace('.', ',')} Icon={RefreshCw}
          chipBg="bg-[#dcfce7] dark:bg-emerald-900/30" chipColor="text-[#16a34a] dark:text-emerald-400"
          footer={`${formatNumber(stats.semMovimento)} sem movimento`}
          hint={`Quantas vezes o estoque girou na janela de ${janelaDias} dias (unidades vendidas ÷ estoque médio).`} />
      </div>

      {/* ── Alarmes (3, clicáveis) ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <AlarmCard label="Saldo negativo" value={formatNumber(stats.negativos)} sub="produto(s) com saldo < 0"
          Icon={AlertCircle} tone={stats.negativos > 0 ? 'danger' : 'neutral'}
          hint="Saldo menor que zero — quase sempre erro de lançamento. Corrigir antes de comprar."
          onClick={onNavigateTab ? () => onNavigateTab('geral') : undefined} />
        <AlarmCard label="Ruptura" value={formatNumber(stats.rupturas)} sub="zerado com vendas no 6m"
          Icon={AlertTriangle} tone={stats.rupturas > 0 ? 'warning' : 'neutral'}
          hint="Produtos zerados que venderam nos últimos 6 meses — deixando de vender por falta de estoque."
          onClick={onNavigateTab ? () => onNavigateTab('necessidade') : undefined} />
        <AlarmCard label="Necessidade crítica" value={formatNumber(stats.criticos)} sub="compra urgente"
          Icon={ShoppingCart} tone={stats.criticos > 0 ? 'danger' : 'neutral'}
          hint="Compra urgente: zerado com venda, ou cobertura abaixo de metade dos dias-alvo."
          onClick={onNavigateTab ? () => onNavigateTab('necessidade') : undefined} />
      </div>

      {/* ── Curva ABC + Capital em estoque ── */}
      {showSecoes && abc.count > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Curva ABC */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-[#1e3a5f] dark:text-gray-300" />
              <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Curva ABC</h3>
              <InfoHint text="Concentração do valor de estoque por classe: A = até 80% do valor, B = até 95%, C = o resto. Poucos produtos (A) costumam concentrar a maior parte do capital." align="start" />
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Concentração do valor de estoque por classe</p>
            <div className="mt-4 flex h-3 overflow-hidden rounded-md">
              {(['A', 'B', 'C'] as const).map((c, i) => {
                const w = abc.total > 0 ? (abc.classes[c].valor / abc.total) * 100 : 0
                return w > 0 ? <div key={c} style={{ width: `${w}%`, backgroundColor: ['#1e3a5f', '#3b82f6', '#93c5fd'][i] }} /> : null
              })}
            </div>
            <div className="mt-4 space-y-2.5">
              {(['A', 'B', 'C'] as const).map((c, i) => {
                const cl = abc.classes[c]
                const pctProd = abc.count > 0 ? (cl.prod / abc.count) * 100 : 0
                const pctValor = abc.total > 0 ? (cl.valor / abc.total) * 100 : 0
                return (
                  <div key={c} className="flex items-center gap-3 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: ['#1e3a5f', '#3b82f6', '#93c5fd'][i] }} />
                    <span className="w-16 shrink-0 font-semibold text-gray-900 dark:text-gray-100">Classe {c}</span>
                    <span className="flex-1 text-xs text-gray-500 dark:text-gray-400">{formatNumber(cl.prod)} produtos · {fmtPct(pctProd)}</span>
                    <span className="shrink-0 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(cl.valor)}</span>
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums text-gray-400">{fmtPct(pctValor)}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Capital em estoque */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center gap-1.5">
              <RefreshCw className="h-4 w-4 text-[#16a34a]" />
              <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Capital em estoque</h3>
              <InfoHint text="Quanto do valor parado está girando (giro ≥ 1 na janela), com giro baixo (lento) ou sem nenhum movimento (parado)." align="start" />
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Quanto do valor está girando vs. parado</p>
            <div className="mt-4 flex h-3 overflow-hidden rounded-md">
              {([['girando', '#16a34a'], ['lento', '#f59e0b'], ['parado', '#ef4444']] as const).map(([k, color]) => {
                const w = capital.total > 0 ? (capital[k] / capital.total) * 100 : 0
                return w > 0 ? <div key={k} style={{ width: `${w}%`, backgroundColor: color }} /> : null
              })}
            </div>
            <div className="mt-4 space-y-2.5">
              {([
                ['girando', '#16a34a', 'Girando', 'giro saudável'],
                ['lento', '#f59e0b', 'Lento', 'giro baixo'],
                ['parado', '#ef4444', 'Parado', 'sem movimento'],
              ] as const).map(([k, color, label, sub]) => {
                const pct = capital.total > 0 ? (capital[k] / capital.total) * 100 : 0
                return (
                  <div key={k} className="flex items-center gap-3 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                    <span className="w-16 shrink-0 font-semibold text-gray-900 dark:text-gray-100">{label}</span>
                    <span className="flex-1 text-xs text-gray-500 dark:text-gray-400">{sub}</span>
                    <span className="shrink-0 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(capital[k])}</span>
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums text-gray-400">{fmtPct(pct)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Vão zerar + Valor por categoria ── */}
      {showSecoes && (stats.proximosZerar.length > 0 || categoria.rows.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Vão zerar em breve */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center gap-1.5">
              <Hourglass className="h-4 w-4 text-red-500" />
              <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Vão zerar em breve</h3>
              <InfoHint text="Projeção pela média diária de vendas (saldo atual ÷ venda/dia). Vermelho < 7 dias, âmbar < 15." align="start" />
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Projeção pela média diária de vendas · saldo ÷ venda/dia</p>
            {stats.proximosZerar.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">Nenhum produto em risco de zerar no curto prazo. 🎉</p>
            ) : (
              <div className="mt-3 space-y-2">
                {stats.proximosZerar.map((p) => {
                  const dias = Math.max(0, Math.round(p.diasCobertura))
                  const tone = dias < 7 ? 'text-[#b91c1c] dark:text-red-400' : dias < 15 ? 'text-[#b45309] dark:text-amber-400' : 'text-gray-700 dark:text-gray-300'
                  const barColor = dias < 7 ? 'bg-[#ef4444]' : dias < 15 ? 'bg-[#f59e0b]' : 'bg-gray-400'
                  const w = Math.min(100, (dias / 30) * 100)
                  return (
                    <button
                      key={p.produtoCodigo}
                      type="button"
                      onClick={onNavigateTab ? () => onNavigateTab('necessidade') : undefined}
                      disabled={!onNavigateTab}
                      className={cn('flex w-full items-center gap-3 rounded-lg border border-gray-100 p-2.5 text-left dark:border-gray-800', onNavigateTab && 'transition-colors hover:bg-[#eff6ff] dark:hover:bg-blue-950/20')}
                    >
                      <div className="shrink-0 text-center">
                        <p className={cn('text-xl font-bold tabular-nums leading-none', tone)}>{dias}</p>
                        <p className="text-[9px] uppercase tracking-wide text-gray-400">dias</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-gray-900 dark:text-gray-100" title={p.produtoNome}>{p.produtoNome}</p>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div className={cn('h-full rounded-full', barColor)} style={{ width: `${w}%` }} />
                        </div>
                        <p className="mt-1 text-[10px] tabular-nums text-gray-400">{fmtUnidades(p.saldoAtual)} un. · {p.mediaDiariaVendas.toFixed(1).replace('.', ',')}/dia</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Valor por categoria */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-4 w-4 text-[#2563eb]" />
              <h3 className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">Valor por categoria</h3>
              <InfoHint text="Maiores categorias por capital em estoque (saldo × custo). Top 5 + Outros." align="start" />
            </div>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Onde o capital está parado · maiores categorias</p>
            {categoria.rows.length === 0 ? (
              <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">Sem valor por categoria no escopo.</p>
            ) : (
              <div className="mt-4 space-y-2.5">
                {categoria.rows.map((c, i) => {
                  const w = categoria.max > 0 ? (c.valor / categoria.max) * 100 : 0
                  const pct = categoria.total > 0 ? (c.valor / categoria.total) * 100 : 0
                  return (
                    <div key={c.nome}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-gray-700 dark:text-gray-300" title={c.nome}>{c.nome}</span>
                        <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
                          {formatCurrency(c.valor)} <span className="text-gray-400">· {fmtPct(pct)}</span>
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                        <div className="h-full rounded-full" style={{ width: `${w}%`, backgroundColor: CAT_PALETTE[Math.min(i, CAT_PALETTE.length - 1)] }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── KPI card sólido ── */
const KpiCard = ({ label, sub, value, footer, Icon, chipBg, chipColor, hint }: {
  label: string; sub: string; value: string; footer: string
  Icon: typeof Package; chipBg: string; chipColor: string; hint?: string
}) => (
  <div className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-[13px] font-semibold text-gray-900 dark:text-gray-100">
          {label}
          {hint && <InfoHint text={hint} />}
        </p>
        <p className="text-[11px] uppercase tracking-wide text-gray-400">{sub}</p>
      </div>
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', chipBg)}>
        <Icon className={cn('h-5 w-5', chipColor)} />
      </div>
    </div>
    <p className="mt-3 text-3xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
    <div className="mt-auto border-t border-gray-100 pt-3 dark:border-gray-800">
      <span className="text-[11px] text-gray-400">{footer}</span>
    </div>
  </div>
)

/* ── Alarme horizontal clicável ── */
const AlarmCard = ({ label, value, sub, Icon, tone, hint, onClick }: {
  label: string; value: string; sub: string; Icon: typeof Package
  tone: 'danger' | 'warning' | 'neutral'; hint?: string; onClick?: () => void
}) => {
  const interactive = !!onClick
  const toneCls = tone === 'danger'
    ? { border: 'border-[#fecaca] dark:border-red-900/40', chip: 'bg-[#fee2e2] dark:bg-red-900/30', icon: 'text-[#dc2626] dark:text-red-400', value: 'text-[#b91c1c] dark:text-red-400' }
    : tone === 'warning'
      ? { border: 'border-[#fde68a] dark:border-amber-900/40', chip: 'bg-[#fef3c7] dark:bg-amber-900/30', icon: 'text-[#d97706] dark:text-amber-400', value: 'text-[#b45309] dark:text-amber-400' }
      : { border: 'border-gray-200 dark:border-gray-700', chip: 'bg-gray-100 dark:bg-gray-800', icon: 'text-gray-500', value: 'text-gray-900 dark:text-gray-100' }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={cn('flex items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition-all dark:bg-gray-900', toneCls.border, interactive ? 'hover:border-gray-300 hover:shadow-md dark:hover:border-gray-600' : 'cursor-default')}
    >
      <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', toneCls.chip)}>
        <Icon className={cn('h-5 w-5', toneCls.icon)} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {label}{hint && <InfoHint text={hint} />}
        </span>
        <p className={cn('text-[26px] font-bold leading-tight tabular-nums', toneCls.value)}>{value}</p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">{sub}</p>
      </div>
      {interactive && <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />}
    </button>
  )
}

/* ── Segmented control ── */
const Segmented = <T extends string | number>({
  value, onChange, options,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) => (
  <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
    {options.map((o) => (
      <button
        key={String(o.value)}
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

export default EstoqueVisaoGeral

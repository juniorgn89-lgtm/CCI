import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  PieChart, Pie, Cell,
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import {
  AlertTriangle, CalendarClock, CalendarDays, Hash, Wallet, Banknote,
  Truck, ListOrdered, Landmark, HelpCircle, Sparkles, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyShort } from '@/lib/formatters'
import type { PayableRow } from '@/pages/Financeiro/hooks/useFinanceData'
import FornecedorPagarModal from '@/pages/Financeiro/components/FornecedorPagarModal'

interface Props {
  /** Snapshot de TODOS os títulos a pagar em aberto (vencido + a vencer). */
  data: PayableRow[]
  /** Saldo atual em caixa/banco (contas ativas). */
  saldoEmCaixa: number
}

const todayISO = () => new Date().toISOString().split('T')[0]
const addDaysISO = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}
const onlyDate = (s: string) => (s ?? '').split('T')[0]
const brDate = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—')
const nomeForn = (r: PayableRow) => r.nomeFornecedor?.trim() || `Fornecedor ${r.fornecedorCodigo}`
const getStr = (r: PayableRow, k: string) => (r as unknown as Record<string, unknown>)[k] as string | undefined
const centroCusto = (r: PayableRow) => getStr(r, 'centroCustoDescricao')?.trim() || '—'
const categoria = (r: PayableRow) => getStr(r, 'planoContaGerencialDescricao')?.trim() || '—'
const numTitulo = (r: PayableRow) => getStr(r, 'numeroTitulo')?.trim() || `#${(r as unknown as { tituloPagarCodigo?: number }).tituloPagarCodigo ?? ''}`

const DONUT_CORES = ['#2563eb', '#7c3aed', '#0891b2', '#ea580c', '#16a34a', '#9ca3af']

const Hint = ({ text }: { text: string }) => (
  <span title={text} className="inline-flex cursor-help text-gray-300 transition-colors hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-300">
    <HelpCircle className="h-3.5 w-3.5" />
  </span>
)

type Aba = 'atraso' | 'fornecedor' | 'vencimento'

/**
 * Contas a Pagar — Centro de Inteligência de Pagamentos e Fornecedores. Tudo de
 * dado real do /TITULO_PAGAR (em aberto) + saldo do /CONTA. Comparações vs mês
 * anterior são omitidas (sem histórico de saldo na API).
 */
const PayablesIntel = ({ data, saldoEmCaixa }: Props) => {
  const hoje = todayISO()
  const [aba, setAba] = useState<Aba>('atraso')
  const [showAnalise, setShowAnalise] = useState(false)
  const [detalhe, setDetalhe] = useState<{ codigo: number; nome: string } | null>(null)

  const m = useMemo(() => {
    // 3 baldes DISJUNTOS por data de vencimento (igual webPosto): vencido (<hoje),
    // hoje (=hoje) e a vencer (>hoje). Antes "a vencer" incluía hoje e duplicava.
    const pend = data.filter((r) => r.statusTag === 'vencido' || r.statusTag === 'a-vencer')
    const vencidos = pend.filter((r) => onlyDate(r.vencimento) < hoje)
    const hojeTitulos = pend.filter((r) => onlyDate(r.vencimento) === hoje)
    const aVencer = pend.filter((r) => onlyDate(r.vencimento) > hoje)

    const totalVencido = vencidos.reduce((s, r) => s + r.saldoRestante, 0)
    const totalAVencer = aVencer.reduce((s, r) => s + r.saldoRestante, 0)
    const totalHoje = hojeTitulos.reduce((s, r) => s + r.saldoRestante, 0)
    const totalPagar = totalVencido + totalHoje + totalAVencer

    const fornVencidos = new Set(vencidos.map((r) => r.fornecedorCodigo))
    const proximoVenc = aVencer.map((r) => onlyDate(r.vencimento)).sort()[0] ?? null

    const fornHoje = new Set(hojeTitulos.map((r) => r.fornecedorCodigo))

    // Janelas (vencimento, pendentes — inclui vencidos? não: compromisso futuro = a partir de hoje).
    const win = (dias: number) => {
      const fim = addDaysISO(hoje, dias)
      return pend.reduce((s, r) => {
        const v = onlyDate(r.vencimento)
        return v >= hoje && v <= fim ? s + r.saldoRestante : s
      }, 0)
    }
    const heatmap = [
      { faixa: 'Hoje', valor: totalHoje },
      { faixa: '7 dias', valor: win(7) },
      { faixa: '15 dias', valor: win(15) },
      { faixa: '30 dias', valor: win(30) },
      { faixa: '60 dias', valor: win(60) },
    ]

    // Por fornecedor (agregado).
    const fMap = new Map<number, { codigo: number; nome: string; total: number; vencido: number; aVencer: number; qtd: number }>()
    for (const r of pend) {
      const g = fMap.get(r.fornecedorCodigo) ?? { codigo: r.fornecedorCodigo, nome: nomeForn(r), total: 0, vencido: 0, aVencer: 0, qtd: 0 }
      g.total += r.saldoRestante
      g.qtd += 1
      const v = onlyDate(r.vencimento)
      if (v < hoje) g.vencido += r.saldoRestante
      else if (v > hoje) g.aVencer += r.saldoRestante // hoje fica só no total
      fMap.set(r.fornecedorCodigo, g)
    }
    const fornecedores = Array.from(fMap.values()).sort((a, b) => b.total - a.total)
    const topAVencer = [...fornecedores].sort((a, b) => b.aVencer - a.aVencer).filter((f) => f.aVencer > 0).slice(0, 8)
      .map((f) => ({ nome: f.nome, valor: f.aVencer }))

    // Donut participação (top 5 + outros).
    const top5 = fornecedores.slice(0, 5).map((f) => ({ nome: f.nome, valor: f.total }))
    const outros = fornecedores.slice(5).reduce((s, f) => s + f.total, 0)
    const participacao = outros > 0 ? [...top5, { nome: 'Outros', valor: outros }] : top5

    // Calendário de desembolsos (30 dias por dia).
    const d30 = addDaysISO(hoje, 30)
    const byDay = new Map<string, number>()
    for (const r of pend) {
      const v = onlyDate(r.vencimento)
      if (v >= hoje && v <= d30) byDay.set(v, (byDay.get(v) ?? 0) + r.saldoRestante)
    }
    const desembolsos: { dia: string; valor: number }[] = []
    for (let i = 0; i <= 30; i++) { const dia = addDaysISO(hoje, i); desembolsos.push({ dia, valor: byDay.get(dia) ?? 0 }) }

    // Concentração.
    let acc = 0; let nConc = 0
    for (const f of fornecedores) { acc += f.total; nConc += 1; if (acc >= totalPagar * 0.6) break }
    const concentracao = totalPagar > 0
      ? { fornecedores: nConc, pct: (acc / totalPagar) * 100, nomes: fornecedores.slice(0, nConc).map((f) => f.nome) }
      : null

    return {
      totalVencido, totalAVencer, totalPagar,
      qtdVencidos: vencidos.length, qtdAVencer: aVencer.length, qtdPend: pend.length,
      fornVencidos: fornVencidos.size, totalHoje, qtdHoje: hojeTitulos.length, fornHoje: fornHoje.size,
      proximoVenc, prev7: win(7), prev30: win(30),
      heatmap, fornecedores, topAVencer, participacao, desembolsos, concentracao,
      pctVencidos: pend.length > 0 ? (vencidos.length / pend.length) * 100 : 0,
    }
  }, [data, hoje])

  // Impacto no caixa.
  const saldoProjetado = saldoEmCaixa - m.totalPagar
  const caixaBand = saldoProjetado < 0 ? 'critico' : saldoProjetado < saldoEmCaixa * 0.2 ? 'atencao' : 'saudavel'
  const CAIXA = {
    saudavel: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', label: 'Saudável' },
    atencao: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', label: 'Atenção' },
    critico: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', label: 'Crítico' },
  }[caixaBand]

  // Análise automática.
  const analise: string[] = []
  if (m.concentracao) analise.push(`Concentração: ${m.concentracao.fornecedores} fornecedor${m.concentracao.fornecedores > 1 ? 'es' : ''} (${m.concentracao.nomes.slice(0, 3).join(', ')}) somam ${m.concentracao.pct.toFixed(0)}% das obrigações em aberto.`)
  if (m.totalVencido > 0) analise.push(`${formatCurrency(m.totalVencido)} já estão vencidos (${m.qtdVencidos} título${m.qtdVencidos > 1 ? 's' : ''}, ${m.fornVencidos} fornecedor${m.fornVencidos > 1 ? 'es' : ''}).`)
  if (m.prev7 > 0) analise.push(`${formatCurrency(m.prev7)} vencem nos próximos 7 dias — pressão imediata no caixa.`)
  analise.push(`Saldo projetado após pagamentos: ${formatCurrency(saldoProjetado)} (caixa ${CAIXA.label.toLowerCase()}).`)
  const recomendacao = m.concentracao
    ? `Recomendação: negocie prazo/condição com ${m.concentracao.nomes.slice(0, 2).join(' e ')} — concentram ${m.concentracao.pct.toFixed(0)}% do total a pagar.`
    : 'Recomendação: obrigações pulverizadas, sem concentração relevante.'

  // Tabela.
  const titulosAba = useMemo(() => {
    const pend = data.filter((r) => r.statusTag === 'vencido' || r.statusTag === 'a-vencer')
    if (aba === 'atraso') return pend.filter((r) => r.statusTag === 'vencido').sort((a, b) => b.diasAtraso - a.diasAtraso)
    if (aba === 'vencimento') return [...pend].sort((a, b) => onlyDate(a.vencimento).localeCompare(onlyDate(b.vencimento)))
    return [...pend].sort((a, b) => nomeForn(a).localeCompare(nomeForn(b)))
  }, [data, aba])

  return (
    <div className="space-y-3">
      {/* Cabeçalho + análise */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Inteligência de Pagamentos</h2>
        <button onClick={() => setShowAnalise((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700">
          <Sparkles className="h-3.5 w-3.5" />{showAnalise ? 'Fechar análise' : 'Analisar contas a pagar'}
        </button>
      </div>

      {showAnalise && (
        <section className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm dark:border-indigo-900/50 dark:from-indigo-950/30 dark:to-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />Análise de pagamentos
              <Hint text="Análise automática gerada por regras sobre os seus dados reais (não usa IA externa)." />
            </h3>
            <button onClick={() => setShowAnalise(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X className="h-4 w-4" /></button>
          </div>
          <ul className="space-y-1.5">
            {analise.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />{t}
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm font-medium leading-relaxed text-indigo-900 shadow-sm dark:bg-gray-800/60 dark:text-indigo-200">{recomendacao}</p>
        </section>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <ExecCard title="Em atraso" Icon={AlertTriangle} tone="red" hint="Soma dos títulos a pagar já vencidos e em aberto (saldo restante)."
          value={formatCurrency(m.totalVencido)} sub={`${m.qtdVencidos} título${m.qtdVencidos !== 1 ? 's' : ''} · ${m.fornVencidos} fornecedor${m.fornVencidos !== 1 ? 'es' : ''}`} />
        <ExecCard title="A pagar hoje" Icon={CalendarClock} tone="orange" hint="Títulos a pagar com vencimento hoje."
          value={formatCurrency(m.totalHoje)} sub={`${m.qtdHoje} título${m.qtdHoje !== 1 ? 's' : ''} · ${m.fornHoje} fornecedor${m.fornHoje !== 1 ? 'es' : ''}`} />
        <ExecCard title="A vencer" Icon={CalendarDays} tone="blue" hint="Títulos a pagar em aberto com vencimento futuro. 'Próx.' = próximo vencimento."
          value={formatCurrency(m.totalAVencer)} sub={`${m.qtdAVencer} títulos · próx. ${m.proximoVenc ? brDate(m.proximoVenc) : '—'}`} />
        <ExecCard title="Qtde vencidos" Icon={Hash} tone="rose" hint="Quantidade de títulos vencidos e seu peso sobre a carteira em aberto."
          value={String(m.qtdVencidos)} sub={`${m.pctVencidos.toFixed(0)}% da carteira`} />
        <ExecCard title="Compromisso 7 dias" Icon={Wallet} tone="amber" hint="Total que sairá do caixa nos próximos 7 dias (vencimentos pendentes)."
          value={formatCurrency(m.prev7)} sub="Próximos 7 dias" />
        <ExecCard title="Compromisso 30 dias" Icon={Banknote} tone="violet" hint="Total previsto para pagamento nos próximos 30 dias."
          value={formatCurrency(m.prev30)} sub="Próximos 30 dias" />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ChartCard title="A vencer por fornecedor" Icon={Truck} hint="Fornecedores que mais consomem caixa futuro (a vencer), top 8.">
          {m.topAVencer.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={m.topAVencer} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="nome" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={50} tickFormatter={(s: string) => (s.length > 12 ? s.slice(0, 11) + '…' : s)} />
                <YAxis tickFormatter={(v: number) => formatCurrencyShort(v)} tick={{ fontSize: 10 }} width={52} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="valor" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Calendário de desembolsos (30 dias)" Icon={CalendarDays} hint="Quanto sairá do caixa por dia nos próximos 30 dias (vencimentos pendentes).">
          {m.prev30 <= 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={m.desembolsos} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs><linearGradient id="desGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="dia" tickFormatter={(d: string) => d.slice(8, 10)} tick={{ fontSize: 10 }} interval={2} />
                <YAxis tickFormatter={(v: number) => formatCurrencyShort(v)} tick={{ fontSize: 10 }} width={52} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} labelFormatter={(d) => String(d).split('-').reverse().join('/')} />
                <Area type="monotone" dataKey="valor" stroke="#ef4444" strokeWidth={2} fill="url(#desGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Participação dos fornecedores" Icon={Truck} hint="Peso de cada fornecedor no total a pagar (top 5 + outros).">
          {m.totalPagar <= 0 ? <Empty /> : (
            <div className="flex items-center gap-3">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={m.participacao} dataKey="valor" nameKey="nome" cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={2}>
                    {m.participacao.map((_, i) => <Cell key={i} fill={DONUT_CORES[i % DONUT_CORES.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex-1 space-y-1 text-[11px]">
                {m.participacao.map((f, i) => (
                  <li key={f.nome} className="flex items-center justify-between gap-1">
                    <span className="flex min-w-0 items-center gap-1.5 text-gray-600 dark:text-gray-400">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: DONUT_CORES[i % DONUT_CORES.length] }} />
                      <span className="truncate" title={f.nome}>{f.nome}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-gray-800 dark:text-gray-200">{((f.valor / m.totalPagar) * 100).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>
      </div>

      {/* Maiores fornecedores · Impacto no caixa · Heatmap */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-2 flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Maiores fornecedores</h3>
            <Hint text="Ranking de fornecedores por valor em aberto e participação no total a pagar." />
          </div>
          {m.fornecedores.length === 0 ? <Empty /> : (
            <ol className="space-y-2">
              {m.fornecedores.slice(0, 5).map((f, i) => (
                <li key={f.codigo} className="flex items-center gap-2.5">
                  <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold', i === 0 ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400')}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-gray-800 dark:text-gray-200" title={f.nome}>{f.nome}</p>
                    <p className="text-[11px] text-gray-400">{m.totalPagar > 0 ? ((f.total / m.totalPagar) * 100).toFixed(0) : 0}% do total{f.vencido > 0 ? ` · ${formatCurrencyShort(f.vencido)} vencido` : ''}</p>
                  </div>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyShort(f.total)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex items-center gap-2">
            <Landmark className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Impacto no caixa</h3>
            <Hint text="Saldo atual das contas ativas (/CONTA) menos o total a pagar em aberto = saldo projetado." />
          </div>
          <div className="space-y-2 text-sm">
            <Row label="Saldo atual" value={formatCurrency(saldoEmCaixa)} />
            <Row label="Pagamentos programados" value={`− ${formatCurrency(m.totalPagar)}`} valueClass="text-red-600 dark:text-red-400" />
            <div className="border-t border-gray-200 pt-2 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-700 dark:text-gray-300">Saldo projetado</span>
                <span className={cn('text-lg font-bold tabular-nums', CAIXA.text)}>{formatCurrency(saldoProjetado)}</span>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold">
                <span className={cn('h-2 w-2 rounded-full', CAIXA.dot)} /><span className={CAIXA.text}>{CAIXA.label}</span>
              </p>
            </div>
          </div>
        </section>

        <ChartCard title="Heatmap de vencimentos" Icon={CalendarClock} hint="Pressão futura no caixa acumulada por janela: hoje, 7, 15, 30 e 60 dias.">
          <ul className="space-y-2 py-1">
            {m.heatmap.map((h) => {
              const max = Math.max(...m.heatmap.map((x) => x.valor), 1)
              return (
                <li key={h.faixa}>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-medium text-gray-600 dark:text-gray-400">{h.faixa}</span>
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(h.valor)}</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div className="h-full rounded-full bg-red-500/70" style={{ width: `${(h.valor / max) * 100}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </ChartCard>
      </div>

      {/* Tabela com abas */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-2.5 dark:border-gray-700">
          <div className="flex items-center gap-1">
            {([['atraso', 'Em atraso'], ['fornecedor', 'Por fornecedor'], ['vencimento', 'Por vencimento']] as [Aba, string][]).map(([v, label]) => (
              <button key={v} onClick={() => setAba(v)} className={cn('rounded-md px-3 py-1 text-xs font-medium transition-colors', aba === v ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800')}>{label}</button>
            ))}
          </div>
          <span className="text-xs text-gray-400">{aba === 'fornecedor' ? `${m.fornecedores.length} fornecedores` : `${titulosAba.length} títulos`}</span>
        </div>
        <div className="max-h-[460px] overflow-auto">
          {aba === 'fornecedor' ? (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800/80">
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="px-4 py-2 font-medium">Fornecedor</th>
                  <th className="px-4 py-2 text-right font-medium">Títulos</th>
                  <th className="px-4 py-2 text-right font-medium">Vencido</th>
                  <th className="px-4 py-2 text-right font-medium">A vencer</th>
                  <th className="px-4 py-2 text-right font-medium">Total</th>
                  <th className="px-4 py-2 text-right font-medium">Participação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {m.fornecedores.map((f) => (
                  <tr key={f.codigo} onClick={() => setDetalhe({ codigo: f.codigo, nome: f.nome })} className="cursor-pointer hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                    <td className="max-w-[280px] truncate px-4 py-2 font-medium text-gray-800 dark:text-gray-200" title={f.nome}>{f.nome}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{f.qtd}</td>
                    <td className={cn('px-4 py-2 text-right tabular-nums', f.vencido > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-400')}>{f.vencido > 0 ? formatCurrency(f.vencido) : '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{f.aVencer > 0 ? formatCurrency(f.aVencer) : '—'}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(f.total)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{m.totalPagar > 0 ? ((f.total / m.totalPagar) * 100).toFixed(1) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800/80">
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2 font-medium">Fornecedor</th>
                  <th className="px-3 py-2 font-medium">Documento</th>
                  <th className="px-3 py-2 font-medium">Emissão</th>
                  <th className="px-3 py-2 font-medium">Vencimento</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                  <th className="px-3 py-2 text-right font-medium">Dias atraso</th>
                  <th className="px-3 py-2 font-medium">Centro de custo</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {titulosAba.map((r) => (
                  <tr key={r.codigo} onClick={() => setDetalhe({ codigo: r.fornecedorCodigo, nome: nomeForn(r) })} className="cursor-pointer hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                    <td className="max-w-[200px] truncate px-3 py-2 font-medium text-gray-800 dark:text-gray-200" title={nomeForn(r)}>{nomeForn(r)}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-500 dark:text-gray-400">{numTitulo(r)}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-500 dark:text-gray-400">{brDate(onlyDate(r.dataMovimento))}</td>
                    <td className={cn('px-3 py-2 tabular-nums', r.statusTag === 'vencido' ? 'font-medium text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300')}>{brDate(onlyDate(r.vencimento))}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(r.saldoRestante)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{r.diasAtraso > 0 ? `${r.diasAtraso}d` : '—'}</td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-gray-500 dark:text-gray-400" title={centroCusto(r)}>{centroCusto(r)}</td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-gray-500 dark:text-gray-400" title={categoria(r)}>{categoria(r)}</td>
                    <td className="px-3 py-2 text-center"><StatusBadge r={r} hoje={hoje} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {detalhe && (
        <FornecedorPagarModal
          open={!!detalhe}
          onClose={() => setDetalhe(null)}
          nome={detalhe.nome}
          titulos={data.filter((r) => r.fornecedorCodigo === detalhe.codigo && (r.statusTag === 'vencido' || r.statusTag === 'a-vencer'))}
        />
      )}
    </div>
  )
}

const StatusBadge = ({ r, hoje }: { r: PayableRow; hoje: string }) => {
  const venc = onlyDate(r.vencimento)
  if (r.statusTag === 'vencido') return <Badge cls="border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">Em atraso</Badge>
  if (venc === hoje) return <Badge cls="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-400">Vence hoje</Badge>
  if (venc <= addDaysISO(hoje, 7)) return <Badge cls="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Vence em breve</Badge>
  return <Badge cls="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Em dia</Badge>
}
const Badge = ({ cls, children }: { cls: string; children: React.ReactNode }) => (
  <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold', cls)}>{children}</span>
)

const Row = ({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) => (
  <div className="flex items-center justify-between">
    <span className="text-gray-600 dark:text-gray-400">{label}</span>
    <span className={cn('font-semibold tabular-nums text-gray-900 dark:text-gray-100', valueClass)}>{value}</span>
  </div>
)

const TONES = {
  red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
}

const ExecCard = ({ title, Icon, tone, value, sub, hint }: {
  title: string; Icon: typeof Wallet; tone: keyof typeof TONES; value: string; sub: string; hint?: string
}) => (
  <section className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-center justify-between gap-2">
      <p className="flex min-w-0 items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
        <span className="truncate">{title}</span>{hint && <Hint text={hint} />}
      </p>
      <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', TONES[tone])}><Icon className="h-3.5 w-3.5" /></div>
    </div>
    <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
    <p className="text-[10px] text-gray-400">{sub}</p>
  </section>
)

const ChartCard = ({ title, Icon, hint, children }: { title: string; Icon: typeof Wallet; hint?: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="mb-2 flex items-center gap-2">
      <Icon className="h-4 w-4 text-gray-400" />
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {hint && <Hint text={hint} />}
    </div>
    {children}
  </section>
)

const Empty = ({ text = 'Sem dados para exibir.' }: { text?: string }) => (
  <p className="py-12 text-center text-sm text-gray-400">{text}</p>
)

export default PayablesIntel

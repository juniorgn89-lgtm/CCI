import { Fragment, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell,
  ScatterChart, Scatter, ZAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { AlertTriangle, CalendarClock, CalendarDays, Percent, CreditCard, ChevronRight } from 'lucide-react'
import { useFilterStore } from '@/store/filters'
import { fetchCartao } from '@/api/endpoints/financeiro'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyShort } from '@/lib/formatters'
import type { Cartao } from '@/api/types/financeiro'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import InfoHint from '@/components/ui/InfoHint'

type Modalidade = 'Crédito' | 'Débito' | 'PIX' | 'Carteira Digital'
const MODALIDADES: Modalidade[] = ['Crédito', 'Débito', 'PIX', 'Carteira Digital']
const MOD_COR: Record<Modalidade, string> = {
  'Crédito': '#2563eb', 'Débito': '#60a5fa', 'PIX': '#ea580c', 'Carteira Digital': '#1e3a5f',
}
const CARD_BRAND_RE = /VISA|MASTERCARD|MASTER|ELO|MAESTRO|AMERICAN EXPRESS|AMEX|HIPERCARD|HIPER|DINERS|CABAL|SOROCRED|BANESCARD/
const modalidade = (admin: string): Modalidade => {
  const u = (admin ?? '').toUpperCase()
  if (u.includes('CRED')) return 'Crédito'
  if (u.includes('DEB') || u.includes('MAESTRO')) return 'Débito'
  if (u.includes('PIX')) return 'PIX'
  if (CARD_BRAND_RE.test(u)) return 'Crédito'
  return 'Carteira Digital'
}

const todayISO = () => new Date().toISOString().split('T')[0]
const onlyDate = (s: string) => (s ?? '').split('T')[0]
const brDate = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—')
const adminNome = (c: Cartao) => c.adiministradoraDescricao?.trim() || 'Outros'
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Presets do seletor de período (em meses pra trás a partir de hoje). */
const PERIODO_OPCOES: { value: number; label: string }[] = [
  { value: 3, label: 'Últimos 3 meses' },
  { value: 6, label: 'Últimos 6 meses' },
  { value: 12, label: 'Últimos 12 meses' },
  { value: 24, label: 'Últimos 24 meses' },
]
const DEFAULT_MESES = 6

type Aba = 'atraso' | 'vencer' | 'liquidados' | 'analise'

/**
 * Cartões — análise de recebíveis de cartão (/CARTAO), espelhando o webPosto:
 * KPIs (em atraso / hoje / em aberto / taxa média), curva de taxa média por
 * modalidade (12m) e painel com recebíveis em atraso/a vencer/liquidados + análise.
 * Puxa 12 meses de cartões só quando a aba abre (query isolada).
 */
const CartoesIntel = () => {
  const { empresaCodigos } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0
  const hoje = todayISO()
  const [mesesJanela, setMesesJanela] = useState<number>(DEFAULT_MESES)
  const inicioWin = useMemo(() => {
    const d = new Date(`${hoje}T00:00:00`); d.setMonth(d.getMonth() - mesesJanela)
    return d.toISOString().split('T')[0]
  }, [hoje, mesesJanela])

  const [aba, setAba] = useState<Aba>('atraso')

  // Janela configurável (default 6m). maxPages alto pra NÃO truncar antes dos
  // pendentes (mais recentes / código maior) — senão os KPIs zeram (só vinham os
  // liquidados antigos). queryKey inclui inicioWin → recarrega ao trocar o período.
  const { data: cartoes = [], isLoading } = useQuery({
    queryKey: ['cartaoAnalytics', empresaCodigo, inicioWin, hoje],
    queryFn: () => fetchAllPages(
      (p) => fetchCartao({ empresaCodigo: empresaCodigo ?? undefined, dataInicial: inicioWin, dataFinal: hoje, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 120,
    ),
    enabled: hasEmpresa,
  })

  const m = useMemo(() => {
    const pend = cartoes.filter((c) => c.pendente)
    const emAtraso = pend.filter((c) => onlyDate(c.vencimento) < hoje)
    const hojeArr = pend.filter((c) => onlyDate(c.vencimento) === hoje)
    const aVencer = pend.filter((c) => onlyDate(c.vencimento) > hoje)
    const liquidados = cartoes.filter((c) => !c.pendente)

    const sum = (arr: Cartao[]) => arr.reduce((s, c) => s + c.valor, 0)
    const totalAtraso = sum(emAtraso)
    const totalHoje = sum(hojeArr)
    const totalAberto = sum(aVencer)

    // Taxa média ponderada por valor (sobre recebíveis pendentes).
    const baseTaxa = pend
    const somaValor = baseTaxa.reduce((s, c) => s + c.valor, 0)
    const taxaMedia = somaValor > 0 ? baseTaxa.reduce((s, c) => s + c.taxaPercentual * c.valor, 0) / somaValor : 0

    // Curva de taxa média por mês (12m) e modalidade — ponderada por valor.
    const base = new Date(`${hoje}T00:00:00`)
    const meses: { key: string; label: string }[] = []
    for (let i = mesesJanela - 1; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
      meses.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MESES_ABREV[d.getMonth()] })
    }
    // acumuladores [mesKey][modalidade] = {wsum, vsum}
    const acc = new Map<string, Map<Modalidade, { w: number; v: number }>>()
    for (const c of cartoes) {
      const mk = onlyDate(c.dataMovimento).slice(0, 7)
      if (!mk) continue
      const mod = modalidade(c.adiministradoraDescricao)
      const byMod = acc.get(mk) ?? new Map<Modalidade, { w: number; v: number }>()
      const cur = byMod.get(mod) ?? { w: 0, v: 0 }
      cur.w += c.taxaPercentual * c.valor; cur.v += c.valor
      byMod.set(mod, cur); acc.set(mk, byMod)
    }
    const taxaSerie = meses.map(({ key, label }) => {
      const byMod = acc.get(key)
      const row: Record<string, number | string> = { mes: label }
      for (const mod of MODALIDADES) {
        const x = byMod?.get(mod)
        row[mod] = x && x.v > 0 ? Math.round((x.w / x.v) * 100) / 100 : 0
      }
      return row
    })

    // --- Análise gráfica (todos os cartões da janela): volume, custo de taxa, taxa média ---
    const admAgg = new Map<string, { mod: Modalidade; volume: number; custo: number }>()
    const modAgg = new Map<Modalidade, { volume: number; custo: number }>()
    for (const c of cartoes) {
      const mod = modalidade(c.adiministradoraDescricao)
      const nome = adminNome(c)
      const custo = c.valor * c.taxaPercentual / 100
      const a = admAgg.get(nome) ?? { mod, volume: 0, custo: 0 }
      a.volume += c.valor; a.custo += custo; admAgg.set(nome, a)
      const md = modAgg.get(mod) ?? { volume: 0, custo: 0 }
      md.volume += c.valor; md.custo += custo; modAgg.set(mod, md)
    }
    const modalResumo = MODALIDADES.filter((mod) => modAgg.has(mod)).map((mod) => {
      const x = modAgg.get(mod)!
      return { mod, volume: x.volume, custo: x.custo, taxa: x.volume > 0 ? (x.custo / x.volume) * 100 : 0 }
    })
    const adminsArr = Array.from(admAgg, ([nome, x]) => ({ nome, mod: x.mod, volume: x.volume, custo: x.custo, taxa: x.volume > 0 ? (x.custo / x.volume) * 100 : 0 }))
    const custoPorAdmin = [...adminsArr].sort((a, b) => b.custo - a.custo).slice(0, 10)
    const taxaPorAdmin = [...adminsArr].filter((a) => a.volume > 0).sort((a, b) => b.volume - a.volume).slice(0, 10)
    const scatter = adminsArr.filter((a) => a.volume > 0)

    return { emAtraso, hojeArr, aVencer, liquidados, totalAtraso, totalHoje, totalAberto, taxaMedia, taxaSerie, modalResumo, custoPorAdmin, taxaPorAdmin, scatter }
  }, [cartoes, hoje, mesesJanela])

  if (!hasEmpresa) return null
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Seletor de período */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 dark:text-gray-300">
          <CreditCard className="h-4 w-4 text-gray-400" />
          Recebíveis de cartão
        </h2>
        <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          Período
          <select
            value={mesesJanela}
            onChange={(e) => setMesesJanela(Number(e.target.value))}
            className="h-7 rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            aria-label="Período de análise"
          >
            {PERIODO_OPCOES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ExecCard title="Em atraso" Icon={AlertTriangle} tone="red" value={formatCurrency(m.totalAtraso)}
          sub={`${m.emAtraso.length} recebíveis`} hint="Recebíveis de cartão pendentes com vencimento anterior a hoje." />
        <ExecCard title="Recebíveis hoje" Icon={CalendarClock} tone="orange" value={formatCurrency(m.totalHoje)}
          sub={`${m.hojeArr.length} recebíveis`} hint="Recebíveis de cartão com vencimento hoje." />
        <ExecCard title="Em aberto" Icon={CalendarDays} tone="blue" value={formatCurrency(m.totalAberto)}
          sub={`${m.aVencer.length} a vencer`} hint="Recebíveis de cartão pendentes com vencimento futuro." />
        <ExecCard title="Taxa média" Icon={Percent} tone="violet" value={`${m.taxaMedia.toFixed(2)}%`}
          sub="Ponderada por valor (pendentes)" hint="Média das taxas das administradoras, ponderada pelo valor dos recebíveis pendentes." />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Taxa média de recebimentos (12m) */}
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-1 flex items-center gap-2">
            <Percent className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Taxa média de recebimentos</h3>
            <InfoHint text="Oscilação da taxa média (ponderada por valor) no período selecionado, separada por modalidade de recebimento." />
          </div>
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Últimos {mesesJanela} meses, por modalidade</p>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={m.taxaSerie} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 10 }} width={44} />
              <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {MODALIDADES.map((mod) => (
                <Line key={mod} type="monotone" dataKey={mod} stroke={MOD_COR[mod]} strokeWidth={2} dot={{ r: 2 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </section>

        {/* Painel com abas */}
        <section className="flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 px-3 py-2 dark:border-gray-700">
            {([['atraso', `Em atraso (${m.emAtraso.length})`], ['vencer', `A vencer (${m.aVencer.length})`], ['liquidados', `Liquidados (${m.liquidados.length})`], ['analise', 'Análise']] as [Aba, string][]).map(([v, label]) => (
              <button key={v} onClick={() => setAba(v)} className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors', aba === v ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800')}>{label}</button>
            ))}
          </div>
          <div className="max-h-[440px] min-h-[400px] overflow-auto">
            {aba === 'analise' ? (
              m.scatter.length === 0 ? <Empty /> : (
                <div className="space-y-5 p-3">
                  {/* Comparativo por modalidade */}
                  <div>
                    <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Comparativo por modalidade</h4>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400">
                          <th className="py-1 pr-3 font-medium">Modalidade</th>
                          <th className="px-3 py-1 text-right font-medium">Volume</th>
                          <th className="px-3 py-1 text-right font-medium">Taxa média</th>
                          <th className="px-3 py-1 text-right font-medium">Custo de taxa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {m.modalResumo.map((r) => (
                          <tr key={r.mod}>
                            <td className="py-1.5 pr-3"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: MOD_COR[r.mod] }} />{r.mod}</span></td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(r.volume)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{r.taxa.toFixed(2)}%</td>
                            <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-red-600 dark:text-red-400">{formatCurrency(r.custo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Custo de taxa por bandeira */}
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Custo de taxa por bandeira</h4>
                    <p className="mb-1.5 text-[10px] text-gray-400">Quanto foi pago de taxa em cada administradora (top 10)</p>
                    <ResponsiveContainer width="100%" height={Math.max(160, m.custoPorAdmin.length * 26)}>
                      <BarChart data={m.custoPorAdmin} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v: number) => formatCurrencyShort(v)} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 9 }} tickFormatter={(s: string) => (s.length > 20 ? s.slice(0, 19) + '…' : s)} />
                        <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                        <Bar dataKey="custo" radius={[0, 4, 4, 0]}>
                          {m.custoPorAdmin.map((a) => <Cell key={a.nome} fill={MOD_COR[a.mod]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Taxa média por bandeira */}
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Taxa média (%) por bandeira</h4>
                    <p className="mb-1.5 text-[10px] text-gray-400">Maiores volumes (top 10)</p>
                    <ResponsiveContainer width="100%" height={Math.max(160, m.taxaPorAdmin.length * 26)}>
                      <BarChart data={m.taxaPorAdmin} layout="vertical" margin={{ top: 4, right: 36, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                        <XAxis type="number" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 9 }} tickFormatter={(s: string) => (s.length > 20 ? s.slice(0, 19) + '…' : s)} />
                        <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} />
                        <Bar dataKey="taxa" radius={[0, 4, 4, 0]}>
                          {m.taxaPorAdmin.map((a) => <Cell key={a.nome} fill={MOD_COR[a.mod]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Volume × taxa — onde negociar */}
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Volume × taxa — onde negociar</h4>
                    <p className="mb-1.5 text-[10px] text-gray-400">Canto superior direito = alto volume e alta taxa (prioridade)</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <ScatterChart margin={{ top: 8, right: 16, left: 4, bottom: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" dataKey="volume" name="Volume" tickFormatter={(v: number) => formatCurrencyShort(v)} tick={{ fontSize: 10 }}>
                        </XAxis>
                        <YAxis type="number" dataKey="taxa" name="Taxa" unit="%" tick={{ fontSize: 10 }} width={40} />
                        <ZAxis type="number" dataKey="custo" range={[40, 400]} name="Custo" />
                        <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v, n) => (n === 'Taxa' ? `${Number(v).toFixed(2)}%` : formatCurrency(Number(v)))} labelFormatter={() => ''} />
                        <Scatter data={m.scatter} fill="#2563eb">
                          {m.scatter.map((a) => <Cell key={a.nome} fill={MOD_COR[a.mod]} fillOpacity={0.7} />)}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            ) : (
              <CartaoTreeTable
                rows={aba === 'atraso' ? m.emAtraso : aba === 'vencer' ? m.aVencer : m.liquidados}
                modo={aba}
              />
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

/** Tabela em árvore: Tipo (modalidade) → Administradora. Clicar na administradora abre modal. */
const CartaoTreeTable = ({ rows, modo }: { rows: Cartao[]; modo: Aba }) => {
  const [expMod, setExpMod] = useState<Set<Modalidade>>(() => new Set(MODALIDADES))
  const [detalhe, setDetalhe] = useState<{ nome: string; itens: Cartao[] } | null>(null)

  const liquid = modo === 'liquidados'
  const agg = (itens: Cartao[]) => {
    const bruto = itens.reduce((s, c) => s + c.valor, 0)
    const taxa = itens.reduce((s, c) => s + c.valor * c.taxaPercentual / 100, 0)
    return { bruto, taxa, liquido: bruto - taxa, efetiva: bruto > 0 ? (taxa / bruto) * 100 : 0 }
  }

  const tree = useMemo(() => {
    const byMod = new Map<Modalidade, Map<string, Cartao[]>>()
    for (const c of rows) {
      const mod = modalidade(c.adiministradoraDescricao)
      const adm = byMod.get(mod) ?? new Map<string, Cartao[]>()
      const nome = adminNome(c)
      const arr = adm.get(nome) ?? []
      arr.push(c); adm.set(nome, arr); byMod.set(mod, adm)
    }
    const sortKey = (c: Cartao) => (liquid ? onlyDate(c.dataPagamento) : onlyDate(c.vencimento))
    return MODALIDADES.filter((mod) => byMod.has(mod)).map((mod) => {
      const adm = byMod.get(mod)!
      const admins = Array.from(adm, ([nome, itens]) => ({
        nome,
        ...agg(itens),
        itens: [...itens].sort((a, b) => sortKey(b).localeCompare(sortKey(a))),
      })).sort((a, b) => b.bruto - a.bruto)
      return { mod, ...agg(admins.flatMap((a) => a.itens)), admins }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, liquid])

  if (rows.length === 0) return <Empty />

  const toggleMod = (mod: Modalidade) => setExpMod((p) => { const n = new Set(p); n.has(mod) ? n.delete(mod) : n.add(mod); return n })

  return (
    <>
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800/80">
          <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <th className="px-3 py-2 font-medium">{liquid ? 'Modo recebimento / bandeira' : 'Administradora e bandeira'}</th>
            {liquid ? (
              <>
                <th className="px-3 py-2 text-right font-medium">Valor bruto</th>
                <th className="px-3 py-2 text-right font-medium">Valor líquido</th>
                <th className="px-3 py-2 text-right font-medium">Valor taxa</th>
                <th className="px-3 py-2 text-right font-medium">Taxa efetiva</th>
              </>
            ) : (
              <th className="px-3 py-2 text-right font-medium">Valor</th>
            )}
          </tr>
        </thead>
        <tbody>
          {tree.map((g) => {
            const modOpen = expMod.has(g.mod)
            return (
              <Fragment key={g.mod}>
                {/* Tipo (modalidade) */}
                <tr className="border-t border-gray-100 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-800/50">
                  <td className="px-3 py-1.5">
                    <button onClick={() => toggleMod(g.mod)} className="flex items-center gap-1.5 font-semibold text-gray-800 dark:text-gray-200">
                      <ChevronRight className={cn('h-3.5 w-3.5 text-gray-400 transition-transform', modOpen && 'rotate-90')} />
                      {g.mod}
                    </button>
                  </td>
                  {liquid ? (
                    <td className="px-3 py-1.5 text-right text-gray-400" colSpan={4} />
                  ) : (
                    <td className="px-3 py-1.5 text-right font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(g.bruto)}</td>
                  )}
                </tr>
                {modOpen && (
                  <>
                    {g.admins.map((a) => (
                      <tr key={`${g.mod}|${a.nome}`} className="cursor-pointer hover:bg-blue-50/60 dark:hover:bg-blue-900/20" onClick={() => setDetalhe({ nome: a.nome, itens: a.itens })}>
                        <td className="px-3 py-1.5">
                          <span className="flex items-center gap-1.5 pl-4 font-medium text-gray-700 dark:text-gray-300">
                            <span className="truncate" title={a.nome}>{a.nome}</span>
                            <span className="text-[10px] text-gray-400">({a.itens.length})</span>
                          </span>
                        </td>
                        {liquid ? (
                          <>
                            <td className="px-3 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(a.bruto)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(a.liquido)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-red-600 dark:text-red-400">{formatCurrency(a.taxa)}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{a.efetiva.toFixed(2)}%</td>
                          </>
                        ) : (
                          <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(a.bruto)}</td>
                        )}
                      </tr>
                    ))}
                    {liquid && (
                      <tr className="border-t border-gray-200 bg-gray-50/50 font-semibold dark:border-gray-700 dark:bg-gray-800/30">
                        <td className="px-3 py-1.5 pl-9 text-gray-500 dark:text-gray-400">Total</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(g.bruto)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(g.liquido)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-red-600 dark:text-red-400">{formatCurrency(g.taxa)}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{g.efetiva.toFixed(2)}%</td>
                      </tr>
                    )}
                  </>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>

      {detalhe && (
        <CartaoDetalheModal open={!!detalhe} onClose={() => setDetalhe(null)} nome={detalhe.nome} itens={detalhe.itens} modo={modo} />
      )}
    </>
  )
}

/** Modal com os cartões individuais de uma administradora. */
const CartaoDetalheModal = ({ open, onClose, nome, itens, modo }: { open: boolean; onClose: () => void; nome: string; itens: Cartao[]; modo: Aba }) => {
  const total = itens.reduce((s, c) => s + c.valor, 0)
  const totalTaxa = itens.reduce((s, c) => s + c.valor * c.taxaPercentual / 100, 0)
  const taxaEfetiva = total > 0 ? (totalTaxa / total) * 100 : 0
  // nº de colunas antes de "Taxa %" (pra alinhar o rótulo "Total" no rodapé).
  const leadCols = modo === 'liquidados' ? 5 : 4
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{nome}</DialogTitle>
          <DialogDescription>{itens.length} cartões · {formatCurrency(total)} · taxa {formatCurrency(totalTaxa)} ({taxaEfetiva.toFixed(2)}%)</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/60">
              <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Autorização</th>
                <th className="px-3 py-2 font-medium">Data venda</th>
                <th className="px-3 py-2 font-medium">Bom para</th>
                {modo === 'liquidados' && <th className="px-3 py-2 font-medium">Pagamento</th>}
                <th className="px-3 py-2 text-right font-medium">Taxa %</th>
                <th className="px-3 py-2 text-right font-medium">Taxa R$</th>
                <th className="px-3 py-2 text-right font-medium">Valor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {itens.map((c) => (
                <tr key={c.cartaoCodigo} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                  <td className="max-w-[180px] truncate px-3 py-1.5 text-gray-700 dark:text-gray-300" title={c.clienteRazao || ''}>{c.clienteRazao?.trim() || '—'}</td>
                  <td className="px-3 py-1.5 tabular-nums text-gray-500 dark:text-gray-400">{c.autorizacao || '—'}</td>
                  <td className="px-3 py-1.5 tabular-nums text-gray-500 dark:text-gray-400">{brDate(onlyDate(c.dataMovimento))}</td>
                  <td className="px-3 py-1.5 tabular-nums text-gray-700 dark:text-gray-300">{brDate(onlyDate(c.vencimento))}</td>
                  {modo === 'liquidados' && <td className="px-3 py-1.5 tabular-nums text-emerald-600 dark:text-emerald-400">{brDate(onlyDate(c.dataPagamento))}</td>}
                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{c.taxaPercentual.toFixed(2)}%</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-red-600 dark:text-red-400">{formatCurrency(c.valor * c.taxaPercentual / 100)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(c.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/80">
              <tr className="font-semibold">
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400" colSpan={leadCols}>Total</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{taxaEfetiva.toFixed(2)}%</td>
                <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{formatCurrency(totalTaxa)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const TONES = {
  red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
}

const ExecCard = ({ title, Icon, tone, value, sub, hint }: {
  title: string; Icon: typeof CreditCard; tone: keyof typeof TONES; value: string; sub: string; hint?: string
}) => (
  <section className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-center justify-between gap-2">
      <p className="flex min-w-0 items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
        <span className="truncate">{title}</span>{hint && <InfoHint text={hint} />}
      </p>
      <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', TONES[tone])}><Icon className="h-3.5 w-3.5" /></div>
    </div>
    <p className="mt-1 text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
    <p className="text-[10px] text-gray-400">{sub}</p>
  </section>
)

const Empty = () => <p className="py-16 text-center text-sm text-gray-400">Sem registros.</p>

export default CartoesIntel

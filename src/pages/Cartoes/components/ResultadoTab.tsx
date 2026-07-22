import { Fragment, useState } from 'react'
import { Sparkles, TriangleAlert, CircleCheck, Clock, CircleAlert, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatNumber, formatDate } from '@/lib/formatters'
import HeaderHint from '@/components/tables/HeaderHint'
import BarCell from '@/components/tables/BarCell'
import type { CartoesResult, CartoesView, StatusKind, AdminDiaRow } from '@/pages/Cartoes/hooks/useCartoesConciliacao'

const fmtPct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`
const fmtSigned = (v: number) => `${v < 0 ? '−' : '+'}${formatCurrency(Math.abs(v))}`
const gStart = 'border-l border-gray-200 dark:border-gray-700'

/** Cabeçalho de GRUPO (linha superior do thead) — agrupa colunas por tema. */
const GroupTh = ({ label, colSpan, first }: { label: string; colSpan: number; first?: boolean }) => (
  <th colSpan={colSpan} className={cn('bg-gray-100/60 px-2 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:bg-transparent dark:text-gray-500', !first && gStart)}>
    {label}
  </th>
)

const STATUS: Record<StatusKind, { label: string; cls: string; dot: string }> = {
  conciliado: { label: 'Conciliado', cls: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  a_creditar: { label: 'Vinculado · a creditar', cls: 'text-teal-700 dark:text-teal-400', dot: 'bg-teal-500' },
  valor_divergente: { label: 'Valor divergente', cls: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  sem_repasse: { label: 'Sem repasse', cls: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  repasse_sem_venda: { label: 'Repasse sem venda', cls: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  aguardando: { label: 'Aguardando', cls: 'text-amber-700 dark:text-amber-500', dot: 'bg-amber-500' },
}

const ResultadoTab = ({ coverage, view, empresaNome, isLoading, tratadosCount, onRowClick }: { coverage?: CartoesResult['coverage']; view?: CartoesView; empresaNome: Map<number, string>; isLoading: boolean; tratadosCount: number; onRowClick?: (empresaCodigo: number, bandeira: string, dia: string) => void }) => {
  const nomePosto = (c: number) => empresaNome.get(c) || `Posto ${c}`
  // "A resolver" abre primeiro (é o que precisa de ação). "A receber" = futuro
  // (aguardando, bom-para lá na frente) — separado pra não assustar com previsão.
  const [subTab, setSubTab] = useState<'resolver' | 'receber' | 'conc'>('resolver')
  // Guarda os postos ABERTOS (começa vazio → tudo colapsado no refresh; o usuário
  // expande o posto que quer olhar).
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  if (isLoading && !view) {
    return (
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}
        </div>
      </div>
    )
  }
  if (!view || !coverage) return <p className="px-5 py-12 text-center text-sm text-gray-400">Selecione um período pra conciliar.</p>

  const { kpis, adminDia } = view
  // 3 baldes por TEMPO/estado: A resolver (problema presente) · A receber (futuro,
  // aguardando/a creditar) · Conciliado (já recebido).
  const RESOLVER: StatusKind[] = ['sem_repasse', 'valor_divergente', 'repasse_sem_venda']
  const resolver = adminDia.filter((r) => RESOLVER.includes(r.status))
  const receber = adminDia.filter((r) => r.status === 'aguardando' || r.status === 'a_creditar')
  const conc = adminDia.filter((r) => r.status === 'conciliado')
  const rows = subTab === 'conc' ? conc : subTab === 'receber' ? receber : resolver

  // Agrupa por POSTO (colapsável) com subtotais — igual à conciliação do WebPosto.
  const toggleGrupo = (cod: number) => setExpanded((prev) => {
    const n = new Set(prev)
    if (n.has(cod)) n.delete(cod); else n.add(cod)
    return n
  })
  const grupos = (() => {
    const m = new Map<number, AdminDiaRow[]>()
    for (const r of rows) { const arr = m.get(r.empresaCodigo); if (arr) arr.push(r); else m.set(r.empresaCodigo, [r]) }
    return [...m.entries()]
      .map(([empresaCodigo, rs]) => {
        const somaBruto = rs.reduce((s, r) => s + r.brutoSistema, 0)
        const somaRepasse = rs.reduce((s, r) => s + r.brutoRepasse, 0)
        const somaLiquido = rs.reduce((s, r) => s + r.liquido, 0)
        const somaDelta = rs.reduce((s, r) => s + r.delta, 0)
        const taxaPct = somaRepasse > 0 ? ((somaRepasse - somaLiquido) / somaRepasse) * 100 : 0
        return { empresaCodigo, rows: rs, somaBruto, somaRepasse, somaLiquido, somaDelta, taxaPct }
      })
      .sort((a, b) => b.somaBruto - a.somaBruto)
  })()
  const maxBruto = Math.max(1, ...grupos.map((g) => g.somaBruto))
  const maxDeltaAbs = Math.max(1, ...grupos.map((g) => Math.abs(g.somaDelta)))
  // "Maior diferença" só faz sentido no A resolver (onde Δ importa).
  const postoPiorDelta = subTab === 'resolver' && grupos.length > 0
    ? grupos.reduce((mx, g) => (Math.abs(g.somaDelta) > Math.abs(mx.somaDelta) ? g : mx)).empresaCodigo
    : -1
  const tot = {
    bruto: grupos.reduce((s, g) => s + g.somaBruto, 0),
    repasse: grupos.reduce((s, g) => s + g.somaRepasse, 0),
    liquido: grupos.reduce((s, g) => s + g.somaLiquido, 0),
    delta: grupos.reduce((s, g) => s + g.somaDelta, 0),
  }
  const totTaxa = tot.repasse > 0 ? ((tot.repasse - tot.liquido) / tot.repasse) * 100 : 0
  const subChip = subTab === 'conc'
    ? { label: 'Conciliado', cls: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' }
    : subTab === 'receber'
      ? { label: 'A receber', cls: 'text-amber-700 dark:text-amber-500', dot: 'bg-amber-500' }
      : { label: 'A resolver', cls: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' }

  return (
    <div className="space-y-4">
      {/* Faixa Analista IA */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f] text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Analista IA
            <span className="rounded bg-white/70 px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-500 dark:bg-gray-800/70 dark:text-gray-400">
              base: /CARTAO × /CARTAO_REMESSA
            </span>
          </p>
          <p className="mt-0.5 text-[13px] leading-relaxed text-gray-600 dark:text-gray-300">
            Conciliação de cartão — <strong>sistema × repasse do adquirente</strong>. A IA cruza cada venda de cartão com o lote de repasse da adquirente (por bandeira e dia), confere valor e prazo, e destaca o que não fechou. Diagnóstico, não ação — o lançamento é do gestor no ERP.
          </p>
        </div>
      </div>

      {/* Strip de cobertura do EDI */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/15">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[13px] text-amber-800 dark:text-amber-300">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            {coverage.ediUpTo ? (
              <>Repasse (EDI) carregado até <strong>{formatDate(coverage.ediUpTo)}</strong> — os dias após isso estão <strong>aguardando repasse</strong>, não são divergência.</>
            ) : (
              <>Nenhum repasse (EDI) carregado no período — tudo <strong>aguardando</strong> ou pendente, nada é marcado como divergência.</>
            )}
          </span>
          <span className="text-[11px] font-semibold tabular-nums text-amber-700 dark:text-amber-400">{coverage.pctPeriodo}% do período coberto</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-amber-200/50 dark:bg-amber-900/30">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${coverage.pctPeriodo}%` }} />
        </div>
      </div>

      {/* 3 KPIs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Conciliado (hero navy) */}
        <div className="rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#27496f] p-5 text-white shadow-lg">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/70">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Conciliado
          </p>
          <p className="mt-2 text-[32px] font-extrabold tabular-nums leading-none">{formatCurrencyInt(kpis.conciliado.valor)}</p>
          <p className="mt-2 text-[13px] text-white/75">
            <span className="tabular-nums">{formatNumber(kpis.conciliado.registros)}</span> registros · <span className="font-semibold text-emerald-300">{fmtPct(kpis.pctConciliavel)}</span> do conciliável
          </p>
          <div className="mt-3 flex h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div className="h-full bg-emerald-400" style={{ width: `${kpis.pctConciliavel}%` }} />
            <div className="h-full bg-red-400" style={{ width: `${100 - kpis.pctConciliavel}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-white/50">
            <span>Conciliado</span><span>Sem conciliar</span>
          </div>
        </div>

        {/* Sem conciliar (topo vermelho) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="h-1 w-full rounded-full bg-red-500" />
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
            <CircleAlert className="h-3.5 w-3.5" /> Sem conciliar
          </p>
          <p className="mt-2 text-[28px] font-extrabold tabular-nums leading-none text-gray-900 dark:text-gray-100">{formatCurrencyInt(kpis.semConciliar.valor)}</p>
          <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">
            <span className="tabular-nums">{formatNumber(kpis.semConciliar.registros)}</span> registros · <span className="font-medium text-red-600 dark:text-red-400">precisam de lançamento</span>
          </p>
          {tratadosCount > 0 && (
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              · <span className="font-semibold text-gray-500 dark:text-gray-400">{tratadosCount}</span> já tratados (marcados como lançados no ERP)
            </p>
          )}
        </div>

        {/* Aguardando repasse (topo âmbar) */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="h-1 w-full rounded-full bg-amber-500" />
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-500">
            <Clock className="h-3.5 w-3.5" /> Aguardando / a creditar
          </p>
          <p className="mt-2 text-[28px] font-extrabold tabular-nums leading-none text-gray-900 dark:text-gray-100">{formatCurrencyInt(kpis.aguardando.valor)}</p>
          <p className="mt-2 text-[13px] text-gray-500 dark:text-gray-400">
            <span className="tabular-nums">{formatNumber(kpis.aguardando.registros)}</span> registros · <span className="font-medium text-amber-600 dark:text-amber-500">vinculado ou EDI não creditou ainda</span>
          </p>
        </div>
      </div>

      {/* Tabela administradora × dia */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        <div className="border-b border-gray-100 px-5 py-3.5 dark:border-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
                <CircleCheck className="h-4 w-4 text-gray-400" /> Resumo por administradora × dia
              </h3>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">Cada lote do adquirente cruzado com as vendas do sistema.</p>
            </div>
            <div className="inline-flex items-center gap-0.5 self-start rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-[#0f0f0f]">
              {([['resolver', 'A resolver', resolver.length], ['receber', 'A receber', receber.length], ['conc', 'Conciliado', conc.length]] as const).map(([id, label, n]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSubTab(id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors',
                    subTab === id
                      ? id === 'conc' ? 'bg-emerald-600 text-white' : id === 'receber' ? 'bg-amber-600 text-white' : 'bg-[#1e3a5f] text-white'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200',
                  )}
                >
                  {label}
                  <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', subTab === id ? 'bg-white/20' : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300')}>{n}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <GroupTh first label="Posto" colSpan={1} />
                <GroupTh label="Sistema" colSpan={1} />
                <GroupTh label="Adquirente" colSpan={3} />
                <GroupTh label="Conciliação" colSpan={2} />
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <HeaderHint align="left" className="px-5" label="Posto / bandeira" help="Agrupado por posto (como o WebPosto concilia). Clique num posto pra abrir os lotes." />
                <HeaderHint className={gStart} label="Bruto" help="Soma dos recebíveis do sistema (/CARTAO) que liquidam, por posto." />
                <HeaderHint className={gStart} label="Repasse" help="Bruto repassado pelo adquirente (/CARTAO_REMESSA)." />
                <HeaderHint label="Líquido" help="Valor líquido creditado pelo adquirente (bruto − taxa)." />
                <HeaderHint label="Taxa %" help="Taxa efetiva do repasse (taxa em R$ ÷ bruto repassado)." />
                <HeaderHint className={gStart} label="Δ" help="Diferença sistema − repasse. Zero (dentro de centavos) = conciliado." />
                <HeaderHint align="left" className="px-5" label="Situação" help="A resolver (problema) · A receber (aguardando, futuro) · Conciliado. Ao abrir o posto, aparece o status detalhado de cada lote." />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">
                  {adminDia.length === 0 ? 'Sem vendas de cartão no período.' : subTab === 'resolver' ? 'Nada a resolver — tudo conciliado ou a receber.' : subTab === 'receber' ? 'Nada a receber no futuro neste período.' : 'Nada conciliado ainda neste período.'}
                </td></tr>
              )}
              {grupos.map((g) => {
                const aberto = expanded.has(g.empresaCodigo)
                const pior = g.empresaCodigo === postoPiorDelta
                const zero = Math.abs(g.somaDelta) < 0.005
                return (
                  <Fragment key={g.empresaCodigo}>
                    {/* Linha-resumo do POSTO (padrão Central: barra, subtotal, badge) */}
                    <tr onClick={() => toggleGrupo(g.empresaCodigo)} className="cursor-pointer bg-gray-50/60 hover:bg-gray-100/70 dark:bg-gray-800/40 dark:hover:bg-gray-800/70">
                      <td className="px-5 py-2">
                        <span className="flex items-center gap-2 text-[13px] font-semibold text-gray-800 dark:text-gray-100">
                          <ChevronRight className={cn('h-4 w-4 shrink-0 text-gray-400 transition-transform', aberto && 'rotate-90')} />
                          {nomePosto(g.empresaCodigo)}
                          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-300">{g.rows.length} {g.rows.length === 1 ? 'lote' : 'lotes'}</span>
                          {pior && !zero && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-600 dark:bg-red-950/40 dark:text-red-400">
                              <TriangleAlert className="h-3 w-3" /> Maior diferença
                            </span>
                          )}
                        </span>
                      </td>
                      <td className={cn('px-1.5 py-1', gStart)}><BarCell value={g.somaBruto} max={maxBruto} formatted={formatCurrencyInt(g.somaBruto)} color="blue" align="near" /></td>
                      <td className={cn('px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300', gStart)}>{g.somaRepasse > 0 ? formatCurrencyInt(g.somaRepasse) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{g.somaLiquido > 0 ? formatCurrencyInt(g.somaLiquido) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{g.somaRepasse > 0 ? fmtPct(g.taxaPct) : '—'}</td>
                      {zero
                        ? <td className={cn('px-3 py-2 text-right tabular-nums text-gray-400', gStart)}>R$ 0,00</td>
                        : <td className={cn('px-1.5 py-1', gStart, pior && 'ring-1 ring-inset ring-red-300/70 dark:ring-red-500/40')}><BarCell value={Math.abs(g.somaDelta)} max={maxDeltaAbs} formatted={fmtSigned(g.somaDelta)} color="red" align="near" /></td>}
                      <td className="px-5 py-2">
                        <span className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium', subChip.cls)}>
                          <span className={cn('h-1.5 w-1.5 rounded-full', subChip.dot)} /> {subChip.label}
                        </span>
                      </td>
                    </tr>
                    {aberto && g.rows.map((r) => {
                      const s = STATUS[r.status]
                      const clicavel = !!onRowClick && (r.status === 'sem_repasse' || r.status === 'valor_divergente' || r.status === 'repasse_sem_venda')
                      const dz = Math.abs(r.delta) < 0.005
                      return (
                        <tr
                          key={r.key}
                          onClick={clicavel ? () => onRowClick!(r.empresaCodigo, r.bandeira, r.dia) : undefined}
                          title={clicavel ? 'Ver no Detalhamento' : undefined}
                          className={cn('text-gray-700 dark:text-gray-300', clicavel ? 'cursor-pointer hover:bg-blue-50/60 dark:hover:bg-blue-900/15' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40')}
                        >
                          <td className="py-2 pl-9 pr-3">
                            <span className="flex items-center gap-2">
                              <span className="flex h-6 w-9 shrink-0 items-center justify-center rounded bg-gray-100 text-[9px] font-bold uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">{r.bandeira.slice(0, 4)}</span>
                              <span>
                                <span className="block font-medium text-gray-900 dark:text-gray-100">{r.bandeira}</span>
                                <span className="block text-[11px] text-gray-400">{r.tipo ? `${r.tipo} · ` : ''}{formatDate(r.dia)}</span>
                              </span>
                            </span>
                          </td>
                          <td className={cn('px-3 py-2 text-right tabular-nums', gStart)}>{formatCurrency(r.brutoSistema)}</td>
                          <td className={cn('px-3 py-2 text-right tabular-nums', gStart)}>{r.brutoRepasse > 0 ? formatCurrency(r.brutoRepasse) : '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{r.liquido > 0 ? formatCurrency(r.liquido) : '—'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{r.brutoRepasse > 0 ? `${r.taxaPct.toFixed(2).replace('.', ',')}%` : '—'}</td>
                          <td className={cn('px-3 py-2 text-right tabular-nums', gStart, dz ? 'text-gray-400' : 'font-semibold text-red-600 dark:text-red-400')}>{formatCurrency(r.delta)}</td>
                          <td className="px-5 py-2">
                            <span className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium', s.cls)}>
                              <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} /> {s.label}
                            </span>
                            {r.revisao && (
                              <span className="ml-1.5 rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" title="Conciliado pela revisão automática (lote adjacente).">
                                revisão
                              </span>
                            )}
                            {clicavel && <ChevronRight className="ml-1.5 inline h-3.5 w-3.5 align-text-bottom text-gray-300 dark:text-gray-600" />}
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                )
              })}
              {grupos.length > 0 && (
                <tr className="border-t-2 border-gray-200 bg-gray-50/70 text-[13px] font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-100">
                  <td className="px-5 py-2.5">Total</td>
                  <td className={cn('px-3 py-2.5 text-right tabular-nums', gStart)}>{formatCurrencyInt(tot.bruto)}</td>
                  <td className={cn('px-3 py-2.5 text-right tabular-nums', gStart)}>{tot.repasse > 0 ? formatCurrencyInt(tot.repasse) : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{tot.liquido > 0 ? formatCurrencyInt(tot.liquido) : '—'}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{tot.repasse > 0 ? fmtPct(totTaxa) : '—'}</td>
                  <td className={cn('px-3 py-2.5 text-right tabular-nums', gStart, Math.abs(tot.delta) < 0.005 ? 'text-gray-400' : 'text-red-600 dark:text-red-400')}>{fmtSigned(tot.delta)}</td>
                  <td className="px-5 py-2.5" />
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-gray-100 px-5 py-2.5 text-[11px] text-gray-400 dark:border-gray-800 dark:text-gray-500">
          Fonte: /CARTAO (sistema) × /CARTAO_REMESSA (adquirente/EDI) via GET. Taxa exibida é a APLICADA (fato do EDI); divergência de taxa contratada fica fora desta fase. Read-only — o lançamento é feito no ERP pelo gestor.
        </p>
      </div>
    </div>
  )
}

export default ResultadoTab

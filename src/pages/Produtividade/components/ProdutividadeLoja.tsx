import { useMemo, useState } from 'react'
import { Search, Wallet, Percent, Receipt, ShoppingCart, ChevronLeft, ChevronRight, Trophy, TrendingUp, Package } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatNumber } from '@/lib/formatters'
import { useFilterStore } from '@/store/filters'
import InfoHint from '@/components/ui/InfoHint'
import ProjTend from '@/pages/Produtividade/components/ProjTend'
import AnaliseSemanalLineCard from '@/pages/Comercial/Vendas/AnaliseSemanalLineCard'
import useVendedoresConveniencia, { type VendedorRow, type VendedorDiaPonto } from '@/pages/Produtividade/hooks/useVendedoresConveniencia'
import useAutomotivos12m, { type MesValor } from '@/pages/Produtividade/hooks/useAutomotivos12m'
import useGruposFuncionario, { type GrupoVenda } from '@/pages/Produtividade/hooks/useGruposFuncionario'
import type { LojaVendedorRow } from '@/pages/Produtividade/hooks/useLojaRedeWide'

interface Props {
  /** LISTA rede-wide: vendedores de TODOS os postos do filtro, cada row com
   *  `empresaCodigo`+`postoNome` — a lista lateral agrupa por posto. */
  listRows: LojaVendedorRow[]
  /** Posto do detalhe/vendedor selecionado. */
  postoCodigo?: number | null
  /** Nome do posto — subtítulo do header do vendedor. */
  postoNome?: string
  /** Vendedor selecionado (funcionarioCodigo dentro de `postoCodigo`). */
  selId: number | null
  /** Seleciona pessoa+posto: identidade composta (empresaCodigo, funcionarioCodigo). */
  onSelect: (empresaCodigo: number, funcionarioCodigo: number) => void
}

const fmtR = (v: number) => formatCurrency(v)
const fmtRi = (v: number) => formatCurrencyInt(v)
const fmtN = (v: number) => formatNumber(v)
const fmtPct = (v: number) => `${v.toFixed(1).replace('.', ',')}%`
const iniciais = (nome: string) => nome.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase() || '?'
const mean = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0)

const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const rangeLabel = (ini: string, fim: string): string => {
  if (!ini || !fim) return ''
  const [ya, ma, da] = ini.split('-').map(Number)
  const [yb, mb, db] = fim.split('-').map(Number)
  const p = (n: number) => String(n).padStart(2, '0')
  if (ya === yb && ma === mb) return `${p(da)}–${p(db)} ${MES[ma - 1]} ${yb}`
  if (ya === yb) return `${p(da)} ${MES[ma - 1]} – ${p(db)} ${MES[mb - 1]} ${yb}`
  return `${p(da)} ${MES[ma - 1]} ${ya} – ${p(db)} ${MES[mb - 1]} ${yb}`
}

/* ─── KPI com mini-barra + delta vs a média do posto (mesma pegada da Pista) ─── */
const KPI_ICON: Record<'green' | 'blue' | 'amber', { chip: string; icon: string }> = {
  green: { chip: 'bg-emerald-100 dark:bg-emerald-900/30', icon: 'text-emerald-600 dark:text-emerald-400' },
  blue: { chip: 'bg-blue-100 dark:bg-blue-900/30', icon: 'text-blue-600 dark:text-blue-400' },
  amber: { chip: 'bg-amber-100 dark:bg-amber-900/30', icon: 'text-amber-600 dark:text-amber-400' },
}
const KpiCompar = ({ label, value, Icon, tone, val, avg, max, mode, hint, proj }: {
  label: string; value: string; Icon: typeof Wallet; tone: 'green' | 'blue' | 'amber'; val: number; avg: number; max: number; mode: 'pct' | 'pp'; hint?: string; proj?: string
}) => {
  const t = KPI_ICON[tone]
  const temMedia = avg > 0
  const above = val >= avg
  const barPct = max > 0 ? Math.min(100, (val / max) * 100) : 0
  const delta = temMedia
    ? mode === 'pp'
      ? `${above ? '+' : '−'}${Math.abs(val - avg).toFixed(1).replace('.', ',')} p.p.`
      : `${above ? '+' : '−'}${Math.abs(Math.round(((val - avg) / avg) * 100))}% vs média`
    : null
  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white px-4 py-3.5 shadow-sm dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{label}{hint && <InfoHint text={hint} />}</p>
        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', t.chip)}>
          <Icon className={cn('h-3.5 w-3.5', t.icon)} />
        </div>
      </div>
      <p className="mt-1.5 text-[22px] font-bold leading-none tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
      {proj && <div className="mt-1"><ProjTend value={proj} /></div>}
      {temMedia && (
        <div className="mt-2.5 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className={cn('h-full rounded-full', above ? 'bg-emerald-500' : 'bg-amber-400 dark:bg-amber-500')} style={{ width: `${Math.max(4, barPct)}%` }} />
          </div>
          <span className={cn('shrink-0 text-[10.5px] font-semibold tabular-nums', above ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>{delta}</span>
        </div>
      )}
    </div>
  )
}

/* ─── Desempenho diário: 1 card, seletor de métrica (reusa o card da rede,
       mesma pegada da Pista — Faturamento plota o R$; Cupons plota a contagem) ─── */
type MetricaLoja = 'faturamento' | 'cupons'
const METRICAS_LOJA: { id: MetricaLoja; label: string; accent: string; unit: string; noun: string; plot: boolean }[] = [
  { id: 'faturamento', label: 'Faturamento', accent: '#0d9488', unit: 'cupons', noun: 'faturamento', plot: true },
  { id: 'cupons', label: 'Cupons', accent: '#2563eb', unit: 'cupons', noun: 'cupons', plot: false },
]
const DesempenhoDiarioLoja = ({ serie, loading }: { serie?: VendedorDiaPonto[]; loading?: boolean }) => {
  const [sel, setSel] = useState<MetricaLoja>('faturamento')
  const cfg = METRICAS_LOJA.find((m) => m.id === sel)!
  // O card espera { data, litros, faturamento? }; aqui `litros` carrega a contagem
  // de cupons (métrica Cupons plota isso; Faturamento plota o R$ e mostra os cupons
  // como linha secundária no tooltip).
  const chartData = useMemo(
    () => (serie ?? []).map((p) => ({ data: p.data, litros: p.cupons, faturamento: p.faturamento })),
    [serie],
  )
  const seg = (
    <div className="flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
      {METRICAS_LOJA.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => setSel(m.id)}
          className={cn('rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors', sel === m.id ? 'bg-white text-gray-900 shadow-sm dark:bg-[#2563eb] dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400')}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
  if (loading) return <div className="h-[360px] animate-pulse rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black" />
  if (chartData.length < 2) {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Desempenho diário <InfoHint text="Evolução dia a dia do vendedor no período. Troque a métrica no seletor." /></h3>
          {seg}
        </div>
        <p className="py-14 text-center text-[12px] text-gray-400">Poucos dias com movimento pra traçar a evolução.</p>
      </div>
    )
  }
  return (
    <AnaliseSemanalLineCard
      data={chartData}
      title="Desempenho diário"
      noun={cfg.noun}
      unit={cfg.unit}
      plotFaturamento={cfg.plot}
      accent={cfg.accent}
      scope=""
      height={280}
      cardBg="bg-white dark:bg-gradient-to-b dark:from-gray-900 dark:to-black"
      headerExtra={<>{seg}<InfoHint text="Evolução dia a dia do vendedor no período. Troque a métrica no seletor." /></>}
    />
  )
}

/* ─── Últimos 12 meses (barras: valor sobre cada mês, vazio = stub cinza,
       mês corrente destacado, pior mês em âmbar — mesma pegada da Pista) ─── */
const Chart12mLoja = ({ data, loading }: { data?: MesValor[]; loading?: boolean }) => {
  const pts = data ?? []
  const max = Math.max(1, ...pts.map((p) => p.valor))
  const total = pts.reduce((s, p) => s + p.valor, 0)
  const vazio = pts.length === 0 || pts.every((p) => p.valor === 0)
  const curI = pts.length - 1 // mês corrente (parcial) = último do range
  // "Pior mês" IGNORA o mês corrente: um acumulado parcial baixo não é
  // "vendeu pouco", é "o mês ainda não fechou".
  let worstI = -1, worstV = Infinity
  pts.forEach((p, i) => { if (i !== curI && p.valor > 0 && p.valor < worstV) { worstV = p.valor; worstI = i } })
  const curParcial = (pts[curI]?.valor ?? 0) > 0
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
      <div className="mb-3 flex items-center gap-1.5">
        <TrendingUp className="h-4 w-4 text-gray-400" />
        <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Últimos 12 meses</h3>
        <InfoHint text="Faturamento de conveniência do vendedor mês a mês, da apuração fechada. O mês atual é parcial (acumulado até hoje); meses sem apuração vêm zerados." />
        {!loading && !vazio && <span className="ml-auto text-[11px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{fmtRi(total)} acumulado</span>}
      </div>
      {loading ? (
        <div className="h-36 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
      ) : vazio ? (
        <p className="py-12 text-center text-[12px] text-gray-400">Sem histórico apurado.</p>
      ) : (
        <>
          <div className="flex h-36 items-end gap-1.5 pt-6">
            {pts.map((p, i) => {
              const h = (p.valor / max) * 82
              const zero = p.valor <= 0
              const isWorst = i === worstI
              const isCur = i === curI && p.valor > 0
              const barCls = zero
                ? 'bg-gray-200 dark:bg-gray-700'
                : isCur ? 'bg-emerald-500'
                  : isWorst ? 'bg-amber-400 dark:bg-amber-500'
                    : 'bg-emerald-300 dark:bg-emerald-500/40'
              return (
                <div key={p.ym} className="relative flex h-full min-w-0 flex-1 items-end" title={`${p.label}: ${fmtRi(p.valor)}`}>
                  {!zero && (
                    <span
                      className={cn('pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold leading-none tabular-nums', isWorst ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-gray-300')}
                      style={{ bottom: `calc(${h}% + 3px)` }}
                    >
                      {fmtRi(p.valor)}
                    </span>
                  )}
                  <div className={cn('w-full rounded-t transition-all', barCls)} style={{ height: zero ? '2px' : `${Math.max(3, h)}%` }} />
                </div>
              )
            })}
          </div>
          <div className="mt-1 flex gap-1.5">
            {pts.map((p, i) => (
              <span key={p.ym} className={cn('flex-1 truncate text-center text-[9.5px]', i === curI ? 'font-semibold text-gray-500 dark:text-gray-300' : 'text-gray-400')}>{p.label}{i === curI && curParcial ? '*' : ''}</span>
            ))}
          </div>
          {curParcial && <p className="mt-1.5 text-[9.5px] text-gray-400 dark:text-gray-500">* {pts[curI].label} é o mês corrente — parcial, acumulado até hoje.</p>}
        </>
      )}
    </div>
  )
}

/* ─── Mix por produto (grupos de conveniência: nome + faturamento/itens + barra
       de participação — mesma pegada da lista de grupos da Pista) ─── */
const MixProdutoPanel = ({ grupos, loading }: { grupos?: GrupoVenda[]; loading?: boolean }) => {
  const top = (grupos ?? []).slice(0, 8)
  const max = Math.max(1, ...top.map((g) => g.faturamento))
  const total = (grupos ?? []).reduce((s, g) => s + g.faturamento, 0)
  const vazio = top.length === 0
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
      <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
        <Package className="h-4 w-4 text-gray-400" />
        <h3 className="text-[13px] font-semibold text-gray-800 dark:text-gray-200">Mix por produto</h3>
        <InfoHint text="Faturamento de conveniência do vendedor no período, por grupo de produto. Ao vivo do /VENDA_ITEM, só vendas autorizadas — pode divergir do card no movimento de hoje, que ainda não fechou." />
        {!loading && !vazio && <span className="ml-auto text-[11px] font-medium tabular-nums text-emerald-600 dark:text-emerald-400">{fmtRi(total)}</span>}
      </div>
      {loading ? (
        <div className="space-y-2.5 p-4">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-7 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />)}
        </div>
      ) : vazio ? (
        <p className="px-4 py-8 text-center text-[12px] text-gray-400">Sem vendas de conveniência no período.</p>
      ) : (
        <div className="divide-y divide-gray-50 dark:divide-gray-800/60">
          {top.map((g, i) => {
            const best = i === 0
            return (
              <div key={g.grupo} className="px-4 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('min-w-0 truncate text-[12.5px]', best ? 'font-bold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-600 dark:text-gray-300')} title={g.grupo}>{g.grupo}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-[11px] tabular-nums text-gray-400">{fmtN(g.itens)} {g.itens === 1 ? 'item' : 'itens'}</span>
                    <span className={cn('w-20 text-right text-[12px] font-semibold tabular-nums', best ? 'text-emerald-600 dark:text-emerald-300' : 'text-gray-700 dark:text-gray-300')}>{fmtRi(g.faturamento)}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className={cn('h-full rounded-full', best ? 'bg-emerald-500' : 'bg-emerald-300 dark:bg-emerald-500/50')} style={{ width: `${Math.max(3, (g.faturamento / max) * 100)}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Produtividade dos VENDEDORES da LOJA (setor conveniência) — lista lateral +
 * detalhe por vendedor. Enxuta: faturamento, margem, ticket médio e cupons (loja
 * não tem litros/mix/abastecimento). Quem entra é definido pelo que a pessoa
 * VENDEU (venda de conveniência no cache `apuracao_vendas_funcionario`), não pelo
 * cargo — pode aparecer também na aba Pista se também vendeu combustível/
 * automotivos. Ranqueada por faturamento. Ver [[project_vendedores_conveniencia]].
 */
const ProdutividadeLoja = ({ listRows, postoCodigo, postoNome, selId, onSelect }: Props) => {
  const { rows, dailyByFunc, projFactor, isLoading } = useVendedoresConveniencia('conveniencia', postoCodigo)
  // 12 meses do CACHE (setor conveniência) + Mix AO VIVO do /VENDA_ITEM (grupos de
  // conveniência), ambos por funcionário — espelham os blocos da Pista.
  const { byFunc: conv12m, isLoading: loading12m } = useAutomotivos12m(postoCodigo, 'conveniencia')
  const { convByFunc, isLoading: loadingMix } = useGruposFuncionario(postoCodigo)
  const { dataInicial, dataFinal } = useFilterStore()
  const periodo = rangeLabel(dataInicial, dataFinal)
  const [busca, setBusca] = useState('')

  // Lista lateral REDE-WIDE agrupada por posto. A busca filtra todos os grupos;
  // dentro do grupo, ordenado por faturamento (como já vem de useLojaRedeWide).
  const groups = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const src = q ? listRows.filter((r) => r.nome.toLowerCase().includes(q)) : listRows
    const m = new Map<number, { empresaCodigo: number; postoNome?: string; rows: LojaVendedorRow[] }>()
    for (const r of src) {
      let g = m.get(r.empresaCodigo)
      if (!g) { g = { empresaCodigo: r.empresaCodigo, postoNome: r.postoNome, rows: [] }; m.set(r.empresaCodigo, g) }
      g.rows.push(r)
    }
    return [...m.values()]
  }, [listRows, busca])
  const listaVazia = groups.length === 0

  // Campeões da REDE (1º de cada categoria) — troféu na lista. Identidade composta
  // (posto, funcionário) porque o código colide entre postos.
  const champ = useMemo(() => {
    const ck = (r: LojaVendedorRow) => `${r.empresaCodigo}:${r.funcionarioCodigo}`
    const top = (sel: (r: LojaVendedorRow) => number) =>
      listRows.reduce<LojaVendedorRow | null>((best, r) => (sel(r) > 0 && (!best || sel(r) > sel(best)) ? r : best), null)
    const f = top((r) => r.faturamento), c = top((r) => r.cupons), t = top((r) => r.ticketMedio)
    return { fat: f ? ck(f) : '', cup: c ? ck(c) : '', tick: t ? ck(t) : '' }
  }, [listRows])

  // Detalhe: o vendedor selecionado vem SEMPRE do detalhe per-posto (`rows` do
  // posto `postoCodigo`). O realce/identidade na lista é composto (posto+código).
  const sel = useMemo(
    () => rows.find((r: VendedorRow) => r.funcionarioCodigo === selId) ?? rows[0] ?? null,
    [rows, selId],
  )

  // Médias do posto (só apresentação — nada de fetch novo).
  const avg = useMemo(() => ({
    fat: mean(rows.filter((r) => r.faturamento > 0).map((r) => r.faturamento)),
    margem: mean(rows.filter((r) => r.faturamento > 0).map((r) => r.margemPct)),
    ticket: mean(rows.filter((r) => r.ticketMedio > 0).map((r) => r.ticketMedio)),
    cupons: mean(rows.filter((r) => r.cupons > 0).map((r) => r.cupons)),
    maxFat: Math.max(1, ...rows.map((r) => r.faturamento)),
    maxMargem: Math.max(1, ...rows.map((r) => r.margemPct)),
    maxTicket: Math.max(1, ...rows.map((r) => r.ticketMedio)),
    maxCupons: Math.max(1, ...rows.map((r) => r.cupons)),
  }), [rows])

  const idx = sel ? rows.findIndex((r) => r.funcionarioCodigo === sel.funcionarioCodigo) : -1
  // Anterior/próximo navega DENTRO do posto atual (o detalhe é per-posto).
  const go = (d: number) => { if (rows.length && idx >= 0 && postoCodigo != null) onSelect(postoCodigo, rows[(idx + d + rows.length) % rows.length].funcionarioCodigo) }
  const rank = idx + 1
  const margemBaixa = sel ? sel.margemPct < avg.margem && avg.margem > 0 : false
  // Projeção de fim de mês só na janela mês-a-data e depois de ~1/3 do mês (mesma
  // regra da Pista) — e só nos acumuláveis (faturamento, cupons), nunca em
  // razão (Margem, Ticket), onde extrapolar linearmente enganaria.
  const showProj = projFactor > 1 && projFactor <= 3

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      {/* Lateral — lista de vendedores (busca fixa, lista rola, rail sticky) */}
      <div className="w-full shrink-0 lg:sticky lg:top-4 lg:w-64">
        <div className="flex max-h-[calc(100vh-6rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black">
          <div className="border-b border-gray-100 p-2 dark:border-gray-800">
            <div className="mb-1.5 flex items-center gap-1 px-0.5">
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Quem vendeu no período</span>
              <InfoHint text="A lista traz só os vendedores que registraram venda de conveniência no período (dias apurados). Quem não vendeu — folga, férias, admissão nova — não aparece aqui." />
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar vendedor…"
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-[12.5px] text-gray-700 placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none focus:ring-1 focus:ring-[#2563eb] dark:border-gray-800 dark:bg-[#0f0f0f] dark:text-gray-200"
              />
            </div>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto p-1.5">
            {listaVazia ? (
              <p className="px-3 py-6 text-center text-[12px] text-gray-400">Nenhum vendedor.</p>
            ) : groups.map((g) => (
              <div key={g.empresaCodigo} className="space-y-0.5">
                {/* Cabeçalho de grupo = nome do posto (fantasia) + contagem. */}
                <div className="flex items-center gap-1.5 px-2 pt-0.5">
                  <span className="min-w-0 truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{g.postoNome ?? 'Posto'}</span>
                  <span className="text-[9.5px] tabular-nums text-gray-300 dark:text-gray-600">{g.rows.length}</span>
                </div>
                {g.rows.map((r) => {
                  const active = g.empresaCodigo === postoCodigo && r.funcionarioCodigo === sel?.funcionarioCodigo
                  const ckey = `${g.empresaCodigo}:${r.funcionarioCodigo}`
                  return (
                    <button
                      key={`${g.empresaCodigo}:${r.funcionarioCodigo}`}
                      type="button"
                      onClick={() => onSelect(g.empresaCodigo, r.funcionarioCodigo)}
                      className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors', active ? 'bg-[#132033]' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40')}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: active ? '#1d4ed8' : '#152238' }}>
                        {iniciais(r.nome)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1">
                          <span className={cn('min-w-0 truncate text-[11.5px] font-semibold', active ? 'text-white' : 'text-gray-800 dark:text-gray-200')}>{r.nome}</span>
                          {ckey === champ.fat && <span title="1º em faturamento (rede)" className="shrink-0"><Trophy className="h-3 w-3 text-amber-500" /></span>}
                          {ckey === champ.cup && <span title="1º em cupons (rede)" className="shrink-0"><Trophy className="h-3 w-3 text-blue-500" /></span>}
                          {ckey === champ.tick && <span title="1º em ticket médio (rede)" className="shrink-0"><Trophy className="h-3 w-3 text-violet-500" /></span>}
                        </span>
                        <span className={cn('block truncate text-[10px] tabular-nums', active ? 'text-blue-200/80' : 'text-gray-400 dark:text-gray-500')}>{fmtR(r.faturamento)} · {fmtN(r.cupons)} cupons</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detalhe (per-posto do vendedor selecionado) */}
      {isLoading && !sel ? (
        <div className="min-w-0 flex-1 space-y-4">
          <div className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />)}
          </div>
        </div>
      ) : sel ? (
        <div className="min-w-0 flex-1 space-y-4">
          {/* Header do vendedor */}
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gradient-to-b dark:from-gray-900 dark:to-black sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl text-[16px] font-bold text-white" style={{ backgroundColor: '#1d4ed8' }}>{iniciais(sel.nome)}</span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[18px] font-bold leading-tight text-gray-900 dark:text-gray-100">{sel.nome}</h2>
                  {rank > 0 && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">{rank}º em faturamento</span>}
                  {margemBaixa && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Margem abaixo da média</span>}
                </div>
                <p className="mt-0.5 truncate text-[11.5px] text-gray-500 dark:text-gray-400">
                  {[postoNome, periodo, `${fmtN(sel.cupons)} cupons`, `${fmtN(sel.itens)} itens`].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => go(-1)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/40">
                <ChevronLeft className="h-3.5 w-3.5" /> anterior
              </button>
              <button type="button" onClick={() => go(1)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800/40">
                próximo <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* KPIs vs média do posto */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCompar label="Faturamento" value={fmtR(sel.faturamento)} Icon={Wallet} tone="green" val={sel.faturamento} avg={avg.fat} max={avg.maxFat} mode="pct" hint="Faturamento de conveniência do vendedor no período. Comparado com a média do posto." proj={showProj ? fmtR(sel.faturamentoTend) : undefined} />
            <KpiCompar label="Margem" value={fmtPct(sel.margemPct)} Icon={Percent} tone="blue" val={sel.margemPct} avg={avg.margem} max={avg.maxMargem} mode="pp" hint="Margem bruta = (faturamento − custo) ÷ faturamento. Comparada com a média do posto." />
            <KpiCompar label="Ticket médio" value={fmtR(sel.ticketMedio)} Icon={Receipt} tone="green" val={sel.ticketMedio} avg={avg.ticket} max={avg.maxTicket} mode="pct" hint="Faturamento ÷ cupons. Comparado com a média do posto." />
            <KpiCompar label="Cupons" value={fmtN(sel.cupons)} Icon={ShoppingCart} tone="amber" val={sel.cupons} avg={avg.cupons} max={avg.maxCupons} mode="pct" hint="Nº de cupons de conveniência do vendedor no período. Comparado com a média do posto." proj={showProj ? fmtN(sel.cuponsTend) : undefined} />
          </div>

          {/* Desempenho diário (gráfico unificado com seletor Faturamento/Cupons) */}
          <DesempenhoDiarioLoja serie={dailyByFunc.get(sel.funcionarioCodigo)} loading={isLoading} />

          {/* Últimos 12 meses (cache) + Mix por produto (ao vivo /VENDA_ITEM) */}
          <Chart12mLoja data={conv12m.get(sel.funcionarioCodigo)} loading={loading12m} />
          <MixProdutoPanel grupos={convByFunc.get(sel.funcionarioCodigo)} loading={loadingMix} />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-gray-300 py-16 text-center text-[13px] text-gray-400 dark:border-gray-800">
          Nenhum vendedor de loja no período.
        </div>
      )}
    </div>
  )
}

export default ProdutividadeLoja

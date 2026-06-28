import { Fragment, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { AlertTriangle, Clock, Percent, CreditCard, ChevronRight, TrendingDown, TrendingUp } from 'lucide-react'
import { useFilterStore } from '@/store/filters'
import { fetchCartao } from '@/api/endpoints/financeiro'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatCurrencyShort } from '@/lib/formatters'
import type { Cartao } from '@/api/types/financeiro'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  IntelHeader, AnalisePanel, KpiHero, KpiCard, ChartCard, IntelTabs, Badge,
} from '@/pages/Financeiro/components/shared/financeIntel'

/**
 * Flags dos cards bloqueados por DADO INDISPONÍVEL no /CARTAO (não inventar nº):
 *  - ANTECIPAÇÃO: o antecipável (Σ a vencer) é real, mas o /CARTAO não traz a
 *    TAXA DE ANTECIPAÇÃO contratada (% a.m.) nem prazo. Sem ela, líquido/custo
 *    seriam inventados → card OCULTO. Quando o comercial informar a taxa real,
 *    preencher `ANTECIPACAO_TAXA_AM` (% ao mês) e o card liga sozinho.
 *  - CONCILIAÇÃO: exige valor PAGO × PREVISTO; o /CARTAO expõe só um `valor`
 *    (sem o realizado divergente) → genuinamente underivável. Reabrir só se
 *    surgir um endpoint de conciliação com os dois valores.
 */
const ANTECIPACAO_TAXA_AM: number | null = null
const FEATURE_CONCILIACAO = false

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

const PERIODO_OPCOES = [
  { value: 3, label: 'Últimos 3 meses' },
  { value: 6, label: 'Últimos 6 meses' },
  { value: 12, label: 'Últimos 12 meses' },
  { value: 24, label: 'Últimos 24 meses' },
]
const DEFAULT_MESES = 6

type Aba = 'atraso' | 'vencer' | 'liquidados'

/**
 * Cartões — Inteligência de recebíveis de cartão (/CARTAO), na mesma anatomia
 * das abas Receber/Pagar (blocos de `shared/financeIntel`). KPIs (com delta da
 * taxa), curva de taxa por modalidade, custo por bandeira (selo RENEGOCIAR) e
 * painel com árvore Modalidade→Administradora. Read-only.
 */
const CartoesIntel = () => {
  const { empresaCodigos } = useFilterStore()
  // "Todos" ([]) = postos PERMITIDOS, não a rede inteira retornada pela Quality.
  const { data: empresasDataPerm } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas(), staleTime: 10 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasDataPerm?.resultados ?? [])
  const permittedCodes = useMemo(() => new Set(empresasPermitidas.map((e) => e.codigo)), [empresasPermitidas])
  const hoje = todayISO()
  const [mesesJanela, setMesesJanela] = useState<number>(DEFAULT_MESES)
  const [aba, setAba] = useState<Aba>('atraso')
  const [showAnalise, setShowAnalise] = useState(false)

  const inicioWin = useMemo(() => {
    const d = new Date(`${hoje}T00:00:00`); d.setMonth(d.getMonth() - mesesJanela)
    return d.toISOString().split('T')[0]
  }, [hoje, mesesJanela])

  // Postos a buscar: seleção explícita, ou todos os PERMITIDOS quando "Todos".
  const scopeCodes = useMemo(
    () => (empresaCodigos.length > 0 ? empresaCodigos : [...permittedCodes]),
    [empresaCodigos, permittedCodes],
  )

  // Busca POR EMPRESA em paralelo. Motivo: a busca rede-wide única (sem
  // empresaCodigo) estourava o teto de paginação — a rede gera ~1.7k cartões/dia,
  // e 120k registros cobrem só ~71 dias. Numa janela de 6 meses, o balde enchia em
  // ~março e os meses recentes vinham VAZIOS (taxa caindo a 0%, fora do BI).
  // O /CARTAO honra empresaCodigo (limite máx. da API = 2000), então cada posto
  // pagina sozinho bem abaixo do teto. `dataFiltro: 'MOVIMENTO'` casa a janela com
  // o agrupamento mensal por dataMovimento.
  const { data: cartoes = [], isLoading } = useQuery({
    queryKey: ['cartaoAnalytics', 'porEmpresa', inicioWin, hoje, [...scopeCodes].sort((a, b) => a - b)],
    queryFn: async () => {
      const lotes = await Promise.all(scopeCodes.map((code) => fetchAllPages(
        (p) => fetchCartao({ dataInicial: inicioWin, dataFinal: hoje, empresaCodigo: code, dataFiltro: 'MOVIMENTO', ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
        2000, 300,
      )))
      return lotes.flat()
    },
    enabled: scopeCodes.length > 0,
    staleTime: 5 * 60 * 1000,
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

    // Taxa média + custo dos PENDENTES (ponderada por valor).
    const somaValor = pend.reduce((s, c) => s + c.valor, 0)
    const taxaMedia = somaValor > 0 ? pend.reduce((s, c) => s + c.taxaPercentual * c.valor, 0) / somaValor : 0
    const custoPendente = pend.reduce((s, c) => s + c.valor * c.taxaPercentual / 100, 0)

    // Série mensal por modalidade + GERAL — ponderada por valor.
    const base = new Date(`${hoje}T00:00:00`)
    const meses: { key: string; label: string }[] = []
    for (let i = mesesJanela - 1; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
      meses.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MESES_ABREV[d.getMonth()] })
    }
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
    // Série GERAL (todas as modalidades juntas) — base do delta de tendência.
    const serieGeral = meses.map(({ key }) => {
      const byMod = acc.get(key)
      let w = 0, v = 0
      if (byMod) for (const x of byMod.values()) { w += x.w; v += x.v }
      return { mesKey: key, taxa: v > 0 ? w / v : null }
    })
    const comTaxa = serieGeral.filter((s) => s.taxa != null) as { mesKey: string; taxa: number }[]
    const deltaTaxa = comTaxa.length >= 2 ? comTaxa[comTaxa.length - 1].taxa - comTaxa[0].taxa : null
    const primeiroMesTaxa = comTaxa[0] ? MESES_ABREV[parseInt(comTaxa[0].mesKey.slice(5, 7), 10) - 1] : null

    // Por modalidade + por administradora (volume/taxa/custo).
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
    const bandeiras = Array.from(admAgg, ([nome, x]) => ({ nome, mod: x.mod, volume: x.volume, custo: x.custo, taxa: x.volume > 0 ? (x.custo / x.volume) * 100 : 0 }))
      .sort((a, b) => b.custo - a.custo).slice(0, 8)

    return {
      emAtraso, hojeArr, aVencer, liquidados,
      totalAtraso, totalHoje, totalAberto, taxaMedia, custoPendente,
      taxaSerie, deltaTaxa, primeiroMesTaxa, modalResumo, bandeiras,
      antecipavel: totalAberto, // Σ a vencer — dado real (o custo é que falta).
    }
  }, [cartoes, hoje, mesesJanela])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  const pendenteTotal = m.totalAtraso + m.totalHoje + m.totalAberto
  const delta = m.deltaTaxa
  const deltaBom = delta != null && delta <= 0 // queda de taxa = bom

  // Análise automática (regras sobre o dado real).
  const analise: string[] = []
  analise.push(`A receber em cartão: ${formatCurrency(pendenteTotal)} pendentes — ${formatCurrency(m.totalAtraso)} em atraso e ${formatCurrency(m.totalAberto)} a vencer.`)
  analise.push(`Taxa média ${m.taxaMedia.toFixed(2)}% (custo ${formatCurrency(m.custoPendente)} sobre os pendentes).`)
  if (delta != null) analise.push(`A taxa média ${deltaBom ? 'caiu' : 'subiu'} ${Math.abs(delta).toFixed(2)}pp desde ${m.primeiroMesTaxa} — ${deltaBom ? 'tendência favorável' : 'atenção ao custo'}.`)
  if (m.bandeiras[0]) analise.push(`Maior custo: ${m.bandeiras[0].nome} (${formatCurrency(m.bandeiras[0].custo)} em taxa, ${m.bandeiras[0].taxa.toFixed(2)}%).`)
  const recomendacao = m.bandeiras.length >= 2
    ? `Recomendação: priorize renegociar ${m.bandeiras[0].nome} e ${m.bandeiras[1].nome} — juntas concentram o maior custo de taxa do período.`
    : 'Recomendação: sem concentração relevante de custo de taxa no momento.'

  const periodoSelect = (
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
  )

  const abaRows = aba === 'atraso' ? m.emAtraso : aba === 'vencer' ? m.aVencer : m.liquidados
  const maxModoVol = Math.max(...m.modalResumo.map((r) => r.volume), 0)
  const maxBandCusto = Math.max(...m.bandeiras.map((b) => b.custo), 0)

  return (
    <div className="space-y-4">
      <IntelHeader title="Recebíveis de cartão" actionLabel="Analisar recebíveis" open={showAnalise} onToggle={() => setShowAnalise((v) => !v)} extra={periodoSelect} />
      {showAnalise && <AnalisePanel title="Análise de recebíveis" insights={analise} recomendacao={recomendacao} onClose={() => setShowAnalise(false)} />}

      {/* KPIs: hero + 3 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiHero
          label="A receber em cartão" sub="Recebíveis pendentes" Icon={CreditCard}
          value={formatCurrency(pendenteTotal)}
          lines={[
            { label: 'Em atraso', value: formatCurrency(m.totalAtraso), valueClass: 'text-[#fca5a5]' },
            { label: 'A vencer', value: formatCurrency(m.totalAberto) },
          ]}
          band={{ text: `Taxa média ${m.taxaMedia.toFixed(2)}% · custo ${formatCurrencyShort(m.custoPendente)}`, dotClass: 'bg-blue-400', textClass: 'text-blue-200' }}
        />
        <KpiCard
          title="Em atraso" sub="Vencidos" Icon={AlertTriangle} iconClass="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
          value={formatCurrency(m.totalAtraso)} valueClass="text-[#b91c1c] dark:text-red-400" borderClass="border-[#fecaca] dark:border-red-900/40"
          hint="Recebíveis de cartão pendentes com vencimento anterior a hoje."
          footer={`${m.emAtraso.length} recebíve${m.emAtraso.length === 1 ? 'l' : 'is'}`}
        />
        <KpiCard
          title="Recebíveis hoje" sub="Vence hoje" Icon={Clock} iconClass="bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          value={formatCurrency(m.totalHoje)} valueClass="text-[#c2410c] dark:text-orange-400" borderClass="border-[#fed7aa] dark:border-orange-900/40"
          hint="Recebíveis de cartão com vencimento hoje."
          footer={`${m.hojeArr.length} recebíve${m.hojeArr.length === 1 ? 'l' : 'is'}`}
        />
        <KpiCard
          title="Taxa média" sub="Ponderada por valor" Icon={Percent} iconClass="bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
          value={`${m.taxaMedia.toFixed(2).replace('.', ',')}%`} valueClass="text-[#6d28d9] dark:text-violet-400" borderClass="border-[#e9d5ff] dark:border-violet-900/40"
          hint="Média das taxas das administradoras, ponderada pelo valor dos recebíveis pendentes. O delta compara o início e o fim do período."
        >
          <div className="mt-2 flex items-center gap-1.5 text-[11px]">
            {delta != null ? (
              <>
                <span className={cn('inline-flex items-center gap-0.5 font-semibold', deltaBom ? 'text-[#15803d] dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                  {deltaBom ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                  {Math.abs(delta).toFixed(2).replace('.', ',')}pp
                </span>
                <span className="text-gray-400">{deltaBom ? 'caindo' : 'subindo'} desde {m.primeiroMesTaxa}</span>
              </>
            ) : <span className="text-gray-400">sem histórico suficiente</span>}
          </div>
        </KpiCard>
      </div>

      {/* Antecipação + Conciliação — OCULTOS (dado indisponível no /CARTAO). */}
      {(ANTECIPACAO_TAXA_AM !== null || FEATURE_CONCILIACAO) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
          {ANTECIPACAO_TAXA_AM !== null && (
            <section className="rounded-2xl border border-[#a7f3d0] bg-gradient-to-br from-[#ecfdf5] to-white p-5 shadow-sm dark:border-emerald-900/40 dark:from-emerald-950/20 dark:to-gray-900">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#059669] dark:text-emerald-400">Antecipação disponível</p>
              <p className="mt-1 text-[22px] font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {formatCurrency(m.antecipavel)} <span className="text-sm font-medium text-gray-500">líquido {formatCurrency(m.antecipavel * (1 - (ANTECIPACAO_TAXA_AM / 100)))}</span>
              </p>
              <p className="mt-1 text-[11px] text-gray-400">{m.aVencer.length} recebíveis a vencer · custo {ANTECIPACAO_TAXA_AM}% a.m.</p>
            </section>
          )}
          {FEATURE_CONCILIACAO && (
            <section className="rounded-2xl border border-[#fde68a] bg-white p-5 shadow-sm dark:border-amber-900/40 dark:bg-gray-900">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#d97706] dark:text-amber-400">Conciliação</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Requer endpoint com valor pago × previsto.</p>
            </section>
          )}
        </div>
      )}

      {/* Curva de taxa + Por modalidade */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
        <ChartCard title="Taxa média de recebimentos" Icon={Percent} hint="Oscilação da taxa média (ponderada por valor) por modalidade no período.">
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Últimos {mesesJanela} meses, por modalidade</p>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={m.taxaSerie} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 10 }} width={44} />
              <Tooltip formatter={(v) => `${Number(v).toFixed(2)}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {MODALIDADES.map((mod) => <Line key={mod} type="monotone" dataKey={mod} stroke={MOD_COR[mod]} strokeWidth={2} dot={{ r: 2 }} />)}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Por modalidade" Icon={CreditCard} hint="Volume, taxa média e custo de taxa por modalidade de recebimento.">
          {m.modalResumo.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Sem registros.</p> : (
            <ul className="space-y-3">
              {m.modalResumo.map((r) => {
                const w = maxModoVol > 0 ? (r.volume / maxModoVol) * 100 : 0
                return (
                  <li key={r.mod}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5 font-medium text-gray-700 dark:text-gray-300"><span className="h-2 w-2 rounded-full" style={{ background: MOD_COR[r.mod] }} />{r.mod}</span>
                      <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyShort(r.volume)}</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full rounded-full" style={{ width: `${w}%`, backgroundColor: MOD_COR[r.mod] }} /></div>
                    <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                      <span>taxa {r.taxa.toFixed(2).replace('.', ',')}%</span>
                      <span className="text-red-500">custo {formatCurrencyShort(r.custo)}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </ChartCard>
      </div>

      {/* Custo de taxa por bandeira (full-width, selo RENEGOCIAR nos 2 maiores) */}
      <ChartCard title="Custo de taxa por bandeira" Icon={Percent} hint="Quanto foi pago de taxa em cada administradora/bandeira no período. As 2 de maior custo recebem o selo de renegociação.">
        {m.bandeiras.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Sem registros.</p> : (
          <ul className="space-y-2.5">
            {m.bandeiras.map((b, i) => {
              const w = maxBandCusto > 0 ? (b.custo / maxBandCusto) * 100 : 0
              return (
                <li key={b.nome} className="flex items-center gap-3 text-xs">
                  <span className="flex w-48 shrink-0 items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: MOD_COR[b.mod] }} />
                    <span className="truncate text-gray-700 dark:text-gray-300" title={b.nome}>{b.nome}</span>
                    {i < 2 && <Badge cls="border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">🔴 Renegociar</Badge>}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full rounded-full bg-red-500/70" style={{ width: `${w}%` }} /></div>
                  <span className="w-16 shrink-0 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatCurrencyShort(b.volume)}</span>
                  <span className="w-14 shrink-0 text-right tabular-nums text-gray-500 dark:text-gray-400">{b.taxa.toFixed(2).replace('.', ',')}%</span>
                  <span className="w-16 shrink-0 text-right font-semibold tabular-nums text-red-600 dark:text-red-400">{formatCurrencyShort(b.custo)}</span>
                </li>
              )
            })}
          </ul>
        )}
      </ChartCard>

      {/* Painel com abas + árvore */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <IntelTabs<Aba>
          tabs={[{ id: 'atraso', label: 'Em atraso' }, { id: 'vencer', label: 'A vencer' }, { id: 'liquidados', label: 'Liquidados' }]}
          active={aba}
          onChange={setAba}
          right={<span className="text-xs text-gray-400">{abaRows.length} recebíve{abaRows.length === 1 ? 'l' : 'is'}</span>}
        />
        <div className="max-h-[460px] overflow-auto">
          <CartaoTreeTable rows={abaRows} modo={aba} />
        </div>
      </section>
    </div>
  )
}

/** Tabela em árvore: Modalidade → Administradora. Clicar na administradora abre modal. */
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
            <th className="px-3 py-2 font-medium">Modalidade / administradora</th>
            <th className="px-3 py-2 text-right font-medium">Bruto</th>
            <th className="px-3 py-2 text-right font-medium">Taxa</th>
            <th className="px-3 py-2 text-right font-medium">Líquido</th>
            <th className="px-3 py-2 text-right font-medium">Taxa efetiva</th>
          </tr>
        </thead>
        <tbody>
          {tree.map((g) => {
            const modOpen = expMod.has(g.mod)
            return (
              <Fragment key={g.mod}>
                <tr className="border-t border-gray-100 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-800/50">
                  <td className="px-3 py-1.5">
                    <button onClick={() => toggleMod(g.mod)} className="flex items-center gap-1.5 font-semibold text-gray-800 dark:text-gray-200">
                      <ChevronRight className={cn('h-3.5 w-3.5 text-gray-400 transition-transform', modOpen && 'rotate-90')} />
                      <span className="h-2 w-2 rounded-full" style={{ background: MOD_COR[g.mod] }} />
                      {g.mod}
                    </button>
                  </td>
                  <td className="px-3 py-1.5 text-right font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(g.bruto)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-red-600 dark:text-red-400">{formatCurrencyInt(g.taxa)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrencyInt(g.liquido)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{g.efetiva.toFixed(2).replace('.', ',')}%</td>
                </tr>
                {modOpen && g.admins.map((a) => (
                  <tr key={`${g.mod}|${a.nome}`} className="cursor-pointer hover:bg-[#eff6ff] dark:hover:bg-blue-900/20" onClick={() => setDetalhe({ nome: a.nome, itens: a.itens })}>
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-1.5 pl-6 font-medium text-gray-700 dark:text-gray-300">
                        <span className="truncate" title={a.nome}>{a.nome}</span>
                        <span className="text-[10px] text-gray-400">({a.itens.length})</span>
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(a.bruto)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-red-600 dark:text-red-400">{formatCurrencyInt(a.taxa)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrencyInt(a.liquido)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{a.efetiva.toFixed(2).replace('.', ',')}%</td>
                  </tr>
                ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
      {detalhe && <CartaoDetalheModal open={!!detalhe} onClose={() => setDetalhe(null)} nome={detalhe.nome} itens={detalhe.itens} modo={modo} />}
    </>
  )
}

/** Modal com os cartões individuais de uma administradora. */
const CartaoDetalheModal = ({ open, onClose, nome, itens, modo }: { open: boolean; onClose: () => void; nome: string; itens: Cartao[]; modo: Aba }) => {
  const total = itens.reduce((s, c) => s + c.valor, 0)
  const totalTaxa = itens.reduce((s, c) => s + c.valor * c.taxaPercentual / 100, 0)
  const taxaEfetiva = total > 0 ? (totalTaxa / total) * 100 : 0
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
                  <td className="px-3 py-1.5 text-right tabular-nums text-red-600 dark:text-red-400">{formatCurrencyInt(c.valor * c.taxaPercentual / 100)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(c.valor)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 border-t border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/80">
              <tr className="font-semibold">
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400" colSpan={leadCols}>Total</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{taxaEfetiva.toFixed(2)}%</td>
                <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{formatCurrencyInt(totalTaxa)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const Empty = () => <p className="py-16 text-center text-sm text-gray-400">Sem registros.</p>

export default CartoesIntel

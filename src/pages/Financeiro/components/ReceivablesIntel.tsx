import { useMemo, useState } from 'react'
import {
  AlertTriangle, CalendarClock, Timer, Percent, Wallet, Users,
  RotateCcw, ArrowUp, ArrowDown, Sparkles, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatCurrencyShort } from '@/lib/formatters'
import type { ReceivableRow, DuplicataRow } from '@/pages/Financeiro/hooks/useFinanceData'
import type { TituloReceber } from '@/api/types/financeiro'
import NotasPrazoNaoFaturadas from '@/pages/Financeiro/components/NotasPrazoNaoFaturadas'
import ClienteRiscoModal from '@/pages/Financeiro/components/ClienteRiscoModal'
import InfoHint from '@/components/ui/InfoHint'

interface Props {
  /** Snapshot de TODOS os títulos a receber em aberto (vencido + a vencer). */
  data: ReceivableRow[]
  /** Duplicatas em aberto (/DUPLICATA não baixadas). */
  duplicatas: DuplicataRow[]
  /** Títulos pagos nos últimos 6 meses (base de score/recuperação). */
  pagos: TituloReceber[]
  /** PMR geral (dias) — fallback. */
  pmr: number | null
}

const META_INADIMPLENCIA = 5 // meta da empresa (%)

const todayISO = () => new Date().toISOString().split('T')[0]
const addDaysISO = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}
const onlyDate = (s: string) => (s ?? '').split('T')[0]
const nomeCli = (r: { nomeCliente?: string; clienteCodigo: number }) => r.nomeCliente?.trim() || `Cliente ${r.clienteCodigo}`
const brDate = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—')
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']


interface ClienteAgg {
  codigo: number
  nome: string
  totalAberto: number
  totalVencido: number
  maxDiasAtraso: number
  qtdTitulos: number
  ultimoPagamento: string | null
  paidCount: number
  lateCount: number
  score: number
}

/** Score 0–100 a partir de sinais reais: atraso atual + histórico de pontualidade + recorrência. */
const scoreCliente = (c: Omit<ClienteAgg, 'score'>): number => {
  let s = 100
  const d = c.maxDiasAtraso
  if (d > 90) s -= 45
  else if (d > 60) s -= 35
  else if (d > 30) s -= 22
  else if (d > 0) s -= 10
  const lateRatio = c.paidCount > 0 ? c.lateCount / c.paidCount : 0
  s -= Math.round(lateRatio * 25)
  if (c.paidCount === 0) s -= 8 // sem histórico de pagamento conhecido
  return Math.max(0, Math.min(100, Math.round(s)))
}
const scoreBand = (s: number) => (s >= 70 ? 'baixo' : s >= 40 ? 'medio' : 'alto') as 'baixo' | 'medio' | 'alto'
const SCORE_STYLE = {
  baixo: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', label: 'Baixo' },
  medio: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', label: 'Atenção' },
  alto: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', label: 'Crítico' },
}

/**
 * Contas a Receber — Centro de Inteligência de Cobrança. Tudo de dado real do
 * /TITULO_RECEBER (em aberto + pagos 6m). Métricas sem fonte na API (limite de
 * crédito, bloqueio, vendedor, histórico de saldo/inadimplência) são omitidas.
 */
const ReceivablesIntel = ({ data, duplicatas, pagos, pmr }: Props) => {
  const hoje = todayISO()

  // Separação espelhando a Visão Geral (saldo EM ABERTO):
  //  - Não faturadas: a receber em aberto com convertido=false.
  //  - Duplicatas em aberto: /DUPLICATA não baixadas.
  //  - Títulos a receber em aberto (faturados): pendentes com convertido≠false.
  const separacao = useMemo(() => {
    const pend = data.filter((r) => r.pendente)
    const naoFat = pend.filter((r) => (r as unknown as { convertido?: boolean | null }).convertido === false)
    const faturados = pend.filter((r) => (r as unknown as { convertido?: boolean | null }).convertido !== false)
    return {
      naoFatTotal: naoFat.reduce((s, r) => s + r.valor, 0),
      naoFatCount: naoFat.length,
      dupTotal: duplicatas.reduce((s, d) => s + d.saldoRestante, 0),
      dupCount: duplicatas.length,
      fatTotal: faturados.reduce((s, r) => s + r.valor, 0),
      fatCount: faturados.length,
    }
  }, [data, duplicatas])

  const m = useMemo(() => {
    const pend = data.filter((r) => r.pendente)
    const vencidos = pend.filter((r) => r.statusTag === 'vencido')
    const aVencer = pend.filter((r) => r.statusTag === 'a-vencer')

    const totalVencido = vencidos.reduce((s, r) => s + r.valor, 0)
    const totalAVencer = aVencer.reduce((s, r) => s + r.valor, 0)
    const carteira = totalVencido + totalAVencer
    const inadimplencia = carteira > 0 ? (totalVencido / carteira) * 100 : 0

    const proximoVenc = aVencer.map((r) => onlyDate(r.dataVencimento)).filter((d) => d >= hoje).sort()[0] ?? null

    // Janelas de previsão / heatmap (a vencer).
    const win = (dias: number) => {
      const fim = addDaysISO(hoje, dias)
      return aVencer.reduce((s, r) => {
        const v = onlyDate(r.dataVencimento)
        return v >= hoje && v <= fim ? s + r.valor : s
      }, 0)
    }
    const prevHoje = aVencer.reduce((s, r) => (onlyDate(r.dataVencimento) === hoje ? s + r.valor : s), 0)
    const heatmap = [
      { faixa: 'Hoje', valor: prevHoje },
      { faixa: '7 dias', valor: win(7) },
      { faixa: '15 dias', valor: win(15) },
      { faixa: '30 dias', valor: win(30) },
      { faixa: '60 dias', valor: win(60) },
    ]

    // Faixa de atraso (donut).
    const faixas = [
      { nome: 'A vencer', valor: totalAVencer },
      { nome: '1–30 dias', valor: 0 },
      { nome: '31–60 dias', valor: 0 },
      { nome: '61–90 dias', valor: 0 },
      { nome: '+90 dias', valor: 0 },
    ]
    for (const r of vencidos) {
      const d = r.diasAtraso
      if (d <= 30) faixas[1].valor += r.valor
      else if (d <= 60) faixas[2].valor += r.valor
      else if (d <= 90) faixas[3].valor += r.valor
      else faixas[4].valor += r.valor
    }

    // ---- Histórico de pagamentos (pagos 6m) ----
    const histByCli = new Map<number, { paid: number; late: number; ultimo: string | null }>()
    let recMes = 0; let recPrev = 0; let pagosOnTime = 0; let pagosTotal = 0
    const d30 = addDaysISO(hoje, -30); const d60 = addDaysISO(hoje, -60)
    const d90 = addDaysISO(hoje, -90); const d180 = addDaysISO(hoje, -180)
    const pmrRecent: number[] = []; const pmrPrev: number[] = []
    const mesRec = new Map<string, number>()
    for (const t of pagos) {
      const pag = onlyDate(t.dataPagamento)
      if (!pag) continue
      const venc = onlyDate(t.dataVencimento)
      const late = venc && pag > venc
      const h = histByCli.get(t.clienteCodigo) ?? { paid: 0, late: 0, ultimo: null }
      h.paid += 1
      if (late) h.late += 1
      if (!h.ultimo || pag > h.ultimo) h.ultimo = pag
      histByCli.set(t.clienteCodigo, h)
      // Recuperação 30d / prev 30d
      if (pag > d30) recMes += t.valor
      else if (pag > d60) recPrev += t.valor
      // Taxa de recebimento no prazo
      pagosTotal += 1
      if (!late) pagosOnTime += 1
      // Atraso médio (vencimento → pagamento); negativo = pago adiantado.
      if (venc) {
        const dias = Math.round((new Date(pag).getTime() - new Date(venc).getTime()) / 86400000)
        if (dias >= -3650 && dias <= 3650) {
          if (pag > d90) pmrRecent.push(dias)
          else if (pag > d180) pmrPrev.push(dias)
        }
      }
      // Série mensal de recebimento
      const mk = pag.slice(0, 7)
      mesRec.set(mk, (mesRec.get(mk) ?? 0) + t.valor)
    }
    const avg = (a: number[]) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null)
    const pmrAtual = avg(pmrRecent) ?? pmr
    const pmrAnterior = avg(pmrPrev)
    const taxaPrazo = pagosTotal > 0 ? (pagosOnTime / pagosTotal) * 100 : null
    const recVar = recPrev > 0 ? ((recMes - recPrev) / recPrev) * 100 : null

    // Série mensal (últimos 6 meses).
    const serieMensal: { mes: string; valor: number }[] = []
    const base = new Date(`${hoje}T00:00:00`)
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      serieMensal.push({ mes: MESES_ABREV[d.getMonth()], valor: mesRec.get(mk) ?? 0 })
    }

    // ---- Agregação por cliente (carteira em aberto) ----
    const cliMap = new Map<number, ClienteAgg>()
    for (const r of pend) {
      const c = cliMap.get(r.clienteCodigo) ?? {
        codigo: r.clienteCodigo, nome: nomeCli(r),
        totalAberto: 0, totalVencido: 0, maxDiasAtraso: 0, qtdTitulos: 0,
        ultimoPagamento: null, paidCount: 0, lateCount: 0, score: 0,
      }
      c.totalAberto += r.valor
      if (r.statusTag === 'vencido') { c.totalVencido += r.valor; c.maxDiasAtraso = Math.max(c.maxDiasAtraso, r.diasAtraso) }
      c.qtdTitulos += 1
      cliMap.set(r.clienteCodigo, c)
    }
    for (const c of cliMap.values()) {
      const h = histByCli.get(c.codigo)
      if (h) { c.paidCount = h.paid; c.lateCount = h.late; c.ultimoPagamento = h.ultimo }
      c.score = scoreCliente(c)
    }
    const clientes = Array.from(cliMap.values())
    const clientesVencidos = clientes.filter((c) => c.totalVencido > 0)
    const clientes90 = clientesVencidos.filter((c) => c.maxDiasAtraso > 90).length
    const atrasoRecorrente = clientes.filter((c) => c.lateCount >= 2).length

    // Score da carteira (média ponderada pelo valor em aberto).
    const somaPeso = clientes.reduce((s, c) => s + c.totalAberto, 0)
    const scoreCarteira = somaPeso > 0
      ? Math.round(clientes.reduce((s, c) => s + c.score * c.totalAberto, 0) / somaPeso)
      : 100

    // Top devedores + ranking de risco (por exposição vencida).
    const porVencido = [...clientesVencidos].sort((a, b) => b.totalVencido - a.totalVencido)
    const topDevedores = porVencido.slice(0, 8).map((c) => ({ nome: c.nome, valor: c.totalVencido }))
    const ranking = porVencido.slice(0, 5)

    // Concentração (clientes que somam ~40% do vencido).
    let acc = 0; let nConc = 0
    for (const c of porVencido) { acc += c.totalVencido; nConc += 1; if (acc >= totalVencido * 0.4) break }
    const concentracao = totalVencido > 0
      ? { clientes: nConc, pct: (acc / totalVencido) * 100, nomes: porVencido.slice(0, nConc).map((c) => c.nome) }
      : null
    const maiorAtraso = porVencido.reduce<ClienteAgg | null>((mx, c) => (!mx || c.maxDiasAtraso > mx.maxDiasAtraso ? c : mx), null)

    // Tabela: por exposição total em aberto.
    const tabela = [...clientes].sort((a, b) => b.totalAberto - a.totalAberto)

    return {
      totalVencido, totalAVencer, carteira, inadimplencia,
      qtdVencidos: vencidos.length, qtdAVencer: aVencer.length,
      clientesVencidos: clientesVencidos.length, clientes90, atrasoRecorrente,
      proximoVenc, prevHoje, prev7: win(7), prev15: win(15), prev30: win(30),
      heatmap, faixas, topDevedores, ranking, serieMensal,
      recMes, recVar, pmrAtual, pmrAnterior, taxaPrazo, scoreCarteira,
      concentracao, maiorAtraso, tabela,
    }
  }, [data, pagos, pmr, hoje])

  const [showAnalise, setShowAnalise] = useState(false)
  const [detalhe, setDetalhe] = useState<{ codigo: number; nome: string; score: number } | null>(null)
  // Subabas das duas tabelas detalhadas (notas a prazo × carteira por cliente).
  const [subTab, setSubTab] = useState<'notas' | 'carteira'>('notas')

  const inadColor = m.inadimplencia >= META_INADIMPLENCIA
    ? 'text-red-600 dark:text-red-400'
    : m.inadimplencia >= META_INADIMPLENCIA * 0.6
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-emerald-600 dark:text-emerald-400'

  const pmrTrend = m.pmrAtual != null && m.pmrAnterior != null ? m.pmrAtual - m.pmrAnterior : null
  const carteiraBand = scoreBand(m.scoreCarteira)

  // Análise automática da carteira (regras sobre dados reais) — botão "Analisar carteira".
  const analise: string[] = []
  analise.push(`Saúde da carteira: score ${m.scoreCarteira}/100 (${SCORE_STYLE[carteiraBand].label.toLowerCase()} risco). ${formatCurrency(m.totalVencido)} estão vencidos de ${formatCurrency(m.carteira)} em aberto (inadimplência ${m.inadimplencia.toFixed(2)}%).`)
  if (m.concentracao) analise.push(`Concentração de risco: ${m.concentracao.clientes} cliente${m.concentracao.clientes > 1 ? 's' : ''} (${m.concentracao.nomes.slice(0, 3).join(', ')}) respondem por ${m.concentracao.pct.toFixed(2)}% do valor vencido.`)
  if (m.maiorAtraso) analise.push(`Cliente mais crítico: ${m.maiorAtraso.nome}, com ${m.maiorAtraso.maxDiasAtraso} dias de atraso (${formatCurrency(m.maiorAtraso.totalVencido)}).`)
  if (m.clientes90 > 0) analise.push(`${m.clientes90} cliente${m.clientes90 > 1 ? 's' : ''} acima de 90 dias — risco elevado de não recebimento.`)
  if (m.recVar != null) analise.push(`Recuperação ${m.recVar >= 0 ? 'subiu' : 'caiu'} ${Math.abs(m.recVar).toFixed(2)}% no último mês (${formatCurrency(m.recMes)} recebidos).`)
  if (m.taxaPrazo != null) analise.push(`Histórico: ${m.taxaPrazo.toFixed(2)}% dos títulos foram pagos no prazo nos últimos 6 meses.`)
  const recomendacao = m.concentracao
    ? `Recomendação: priorize a cobrança de ${m.concentracao.nomes.slice(0, 2).join(' e ')} — responsáveis por ${m.concentracao.pct.toFixed(2)}% do valor vencido. ${m.prev7 > 0 ? `Antecipe contato dos ${formatCurrency(m.prev7)} que vencem em 7 dias.` : ''}`
    : 'Recomendação: carteira saudável, sem concentração relevante de vencidos no momento.'

  return (
    <div className="space-y-3">
      {/* Separação por saldo em aberto — espelha a Visão Geral */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <SepCard
          title="Notas a prazo não faturadas"
          subtitle="A receber em aberto · convertido = não"
          total={separacao.naoFatTotal}
          count={separacao.naoFatCount}
          tone="indigo"
        />
        <SepCard
          title="Duplicatas em aberto"
          subtitle="Duplicatas não baixadas"
          total={separacao.dupTotal}
          count={separacao.dupCount}
          tone="blue"
        />
        <SepCard
          title="Títulos a receber faturados"
          subtitle="Em aberto · já convertidos"
          total={separacao.fatTotal}
          count={separacao.fatCount}
          tone="emerald"
        />
      </div>

      {/* Cabeçalho + ação de análise */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Inteligência de Cobrança</h2>
        <button
          onClick={() => setShowAnalise((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {showAnalise ? 'Fechar análise' : 'Analisar carteira'}
        </button>
      </div>

      {showAnalise && (
        <section className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm dark:border-indigo-900/50 dark:from-indigo-950/30 dark:to-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Análise da carteira
              <InfoHint text="Análise automática gerada por regras sobre os seus dados reais (não usa IA externa)." />
            </h3>
            <button onClick={() => setShowAnalise(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="space-y-1.5">
            {analise.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />{t}
              </li>
            ))}
          </ul>
          <p className="mt-3 rounded-lg bg-white/70 p-3 text-sm font-medium leading-relaxed text-indigo-900 shadow-sm dark:bg-gray-800/60 dark:text-indigo-200">
            {recomendacao}
          </p>
        </section>
      )}
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        <ExecCard title="Títulos em atraso" Icon={AlertTriangle} tone="red"
          value={formatCurrency(m.totalVencido)}
          hint="Soma dos títulos a receber já vencidos (vencimento < hoje) e ainda em aberto. Inclui nº de clientes e de títulos."
          sub={`${m.clientesVencidos} cliente${m.clientesVencidos !== 1 ? 's' : ''} · ${m.qtdVencidos} título${m.qtdVencidos !== 1 ? 's' : ''}`} />
        <ExecCard title="Títulos a vencer" Icon={CalendarClock} tone="blue"
          value={formatCurrency(m.totalAVencer)}
          hint="Soma dos títulos a receber em aberto com vencimento futuro (≥ hoje). 'Próx.' = data do próximo vencimento."
          sub={`${m.qtdAVencer} títulos · próx. ${m.proximoVenc ? brDate(m.proximoVenc) : '—'}`} />
        <ExecCard title="PMR · atraso médio" Icon={Timer} tone="violet"
          value={m.pmrAtual != null ? `${m.pmrAtual} dias` : '—'}
          hint="Média de dias entre vencimento e pagamento dos títulos pagos nos últimos 90 dias (negativo = pago adiantado). A tendência compara com o trimestre anterior."
          sub={pmrTrend == null ? 'Pagamento − vencimento (90d)' : `${pmrTrend <= 0 ? '↓' : '↑'} ${Math.abs(pmrTrend)}d vs trimestre ant.`}
          subClass={pmrTrend == null ? undefined : pmrTrend <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'} />
        <ExecCard title="Índice de inadimplência" Icon={Percent} tone="amber"
          value={`${m.inadimplencia.toFixed(2)}%`} valueClass={inadColor}
          hint={`Valor vencido ÷ carteira em aberto (vencido + a vencer). A barra mostra o índice; o traço marca a meta de ${META_INADIMPLENCIA}%.`}
          sub={`${formatCurrencyShort(m.totalVencido)} de ${formatCurrencyShort(m.carteira)} · meta ${META_INADIMPLENCIA}%`}>
          <div className="relative mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div className={cn('h-full rounded-full', m.inadimplencia >= META_INADIMPLENCIA ? 'bg-red-500' : m.inadimplencia >= META_INADIMPLENCIA * 0.6 ? 'bg-amber-500' : 'bg-emerald-500')}
              style={{ width: `${Math.min(100, m.inadimplencia)}%` }} />
            <div className="absolute top-0 h-full w-px bg-gray-500/70" style={{ left: `${META_INADIMPLENCIA}%` }} title={`Meta ${META_INADIMPLENCIA}%`} />
          </div>
        </ExecCard>
        <ExecCard title="Previsão de recebimento" Icon={Wallet} tone="emerald"
          value={formatCurrency(m.prev30)} sub="Próximos 30 dias"
          hint="Soma dos títulos a vencer com vencimento dentro de cada janela (hoje, 7, 15 e 30 dias).">
          <div className="mt-1.5 grid grid-cols-3 gap-1 text-[10px] text-gray-500 dark:text-gray-400">
            <span>Hoje<br /><b className="text-gray-700 dark:text-gray-200">{formatCurrencyShort(m.prevHoje)}</b></span>
            <span>7d<br /><b className="text-gray-700 dark:text-gray-200">{formatCurrencyShort(m.prev7)}</b></span>
            <span>15d<br /><b className="text-gray-700 dark:text-gray-200">{formatCurrencyShort(m.prev15)}</b></span>
          </div>
        </ExecCard>
        <ExecCard title="Clientes em risco" Icon={Users} tone="rose"
          value={String(m.clientesVencidos)}
          hint="Clientes com algum título vencido. '+90d' = com atraso acima de 90 dias; 'recorrentes' = pagaram atrasado 2 ou mais vezes no histórico (6 meses)."
          sub={`${m.clientes90} acima de 90d · ${m.atrasoRecorrente} recorrente${m.atrasoRecorrente !== 1 ? 's' : ''}`} />
        <ExecCard title="Recuperação de crédito" Icon={RotateCcw} tone="teal"
          value={formatCurrency(m.recMes)} sub="Recebido nos últimos 30 dias"
          hint="Total recebido (títulos pagos) nos últimos 30 dias. A variação compara com os 30 dias anteriores."
          badge={m.recVar == null ? undefined : { up: m.recVar >= 0, text: `${m.recVar >= 0 ? '+' : ''}${m.recVar.toFixed(2)}%` }} />
      </div>

      {/* Subabas: Notas a prazo não faturadas × Carteira por cliente */}
      <div className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {([
          { id: 'notas', label: 'Notas a prazo não faturadas' },
          { id: 'carteira', label: 'Carteira por cliente · score de risco' },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              subTab === t.id
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Notas a prazo não faturadas — potencial de faturamento futuro */}
      {subTab === 'notas' && <NotasPrazoNaoFaturadas data={data} />}

      {/* Tabela — risco por cliente */}
      {subTab === 'carteira' && (
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">
            Carteira por cliente · score de risco
            <InfoHint text="Um cliente por linha: valor em aberto, vencido, maior atraso, último pagamento (6m), score (0–100) e status. Score = atraso atual + histórico de pontualidade + recorrência. Ordenado por valor em aberto." />
          </h3>
          <span className="text-xs text-gray-400">{m.tabela.length} clientes</span>
        </div>
        <div className="max-h-[480px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800/80">
              <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="px-4 py-2 font-medium">Cliente</th>
                <th className="px-4 py-2 text-right font-medium">Em aberto</th>
                <th className="px-4 py-2 text-right font-medium">Vencido</th>
                <th className="px-4 py-2 text-right font-medium">Dias atraso</th>
                <th className="px-4 py-2 text-center font-medium">Últ. pagamento</th>
                <th className="px-4 py-2 text-center font-medium">Score</th>
                <th className="px-4 py-2 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {m.tabela.map((c) => {
                const band = scoreBand(c.score)
                const st = SCORE_STYLE[band]
                return (
                  <tr
                    key={c.codigo}
                    onClick={() => setDetalhe({ codigo: c.codigo, nome: c.nome, score: c.score })}
                    className="cursor-pointer hover:bg-gray-50/70 dark:hover:bg-gray-800/40"
                  >
                    <td className="max-w-[260px] truncate px-4 py-2 font-medium text-gray-800 dark:text-gray-200" title={c.nome}>{c.nome}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrencyInt(c.totalAberto)}</td>
                    <td className={cn('px-4 py-2 text-right tabular-nums', c.totalVencido > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-400')}>{c.totalVencido > 0 ? formatCurrencyInt(c.totalVencido) : '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{c.maxDiasAtraso > 0 ? `${c.maxDiasAtraso}d` : '—'}</td>
                    <td className="px-4 py-2 text-center tabular-nums text-gray-500 dark:text-gray-400">{c.ultimoPagamento ? brDate(c.ultimoPagamento) : '—'}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={cn('inline-flex items-center gap-1 font-bold tabular-nums', st.text)}>
                        <span className={cn('h-1.5 w-1.5 rounded-full', st.dot)} />{c.score}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <StatusBadge dias={c.maxDiasAtraso} vencido={c.totalVencido > 0} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {detalhe && (
        <ClienteRiscoModal
          open={!!detalhe}
          onClose={() => setDetalhe(null)}
          nome={detalhe.nome}
          score={detalhe.score}
          titulos={data.filter((r) => r.clienteCodigo === detalhe.codigo)}
          pagos={pagos.filter((p) => p.clienteCodigo === detalhe.codigo)}
        />
      )}
    </div>
  )
}

const StatusBadge = ({ dias, vencido }: { dias: number; vencido: boolean }) => {
  if (!vencido) return <Badge cls="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">Em dia</Badge>
  if (dias <= 30) return <Badge cls="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400">Até 30d</Badge>
  if (dias <= 90) return <Badge cls="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-400">31–90d</Badge>
  return <Badge cls="border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">+90d</Badge>
}
const Badge = ({ cls, children }: { cls: string; children: React.ReactNode }) => (
  <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold', cls)}>{children}</span>
)

const TONES = {
  red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  teal: 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400',
}

const ExecCard = ({
  title, Icon, tone, value, sub, valueClass, subClass, badge, hint, children,
}: {
  title: string
  Icon: typeof Wallet
  tone: keyof typeof TONES
  value: string
  sub: string
  valueClass?: string
  subClass?: string
  badge?: { up: boolean; text: string }
  hint?: string
  children?: React.ReactNode
}) => (
  <section className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-center justify-between gap-2">
      <p className="flex min-w-0 items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
        <span className="truncate">{title}</span>
        {hint && <InfoHint text={hint} />}
      </p>
      <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', TONES[tone])}>
        <Icon className="h-3.5 w-3.5" />
      </div>
    </div>
    <div className="mt-1 flex items-center gap-1.5">
      <p className={cn('text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100', valueClass)}>{value}</p>
      {badge && (
        <span className={cn('flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold', badge.up ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300')}>
          {badge.up ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}{badge.text}
        </span>
      )}
    </div>
    <p className={cn('text-[10px] text-gray-400', subClass)}>{sub}</p>
    {children}
  </section>
)


const SEP_TONE = {
  indigo: { ring: 'border-indigo-200 dark:border-indigo-900/50', value: 'text-indigo-700 dark:text-indigo-300' },
  blue: { ring: 'border-blue-200 dark:border-blue-900/50', value: 'text-blue-700 dark:text-blue-300' },
  emerald: { ring: 'border-emerald-200 dark:border-emerald-900/50', value: 'text-emerald-700 dark:text-emerald-300' },
}

const SepCard = ({
  title, subtitle, total, count, tone,
}: {
  title: string
  subtitle: string
  total: number
  count: number
  tone: keyof typeof SEP_TONE
}) => {
  const st = SEP_TONE[tone]
  return (
    <section className={cn('rounded-xl border bg-white p-4 shadow-sm dark:bg-gray-900', st.ring)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</p>
      <p className="mt-0.5 text-[11px] text-gray-400">{subtitle}</p>
      <p className={cn('mt-2 text-xl font-bold tabular-nums', st.value)}>{formatCurrency(total)}</p>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        {count} {count === 1 ? 'título em aberto' : 'títulos em aberto'}
      </p>
    </section>
  )
}

export default ReceivablesIntel

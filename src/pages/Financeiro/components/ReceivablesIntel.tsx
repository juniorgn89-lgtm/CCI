import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, Percent, Users } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import type { ReceivableRow, DuplicataRow } from '@/pages/Financeiro/hooks/useFinanceData'
import type { TituloReceber } from '@/api/types/financeiro'
import ReceberCalendario from '@/pages/Financeiro/components/ReceberCalendario'
import {
  IntelHeader, AnalisePanel, KpiHero, KpiCard,
} from '@/pages/Financeiro/components/shared/financeIntel'

interface Props {
  /** Snapshot de TODOS os títulos a receber em aberto (vencido + a vencer). */
  data: ReceivableRow[]
  /** Duplicatas em aberto — composição vive na Visão Geral; aqui não é usada. */
  duplicatas?: DuplicataRow[]
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

/** Score 0–100: atraso atual + histórico de pontualidade + recorrência. */
const scoreCliente = (c: Omit<ClienteAgg, 'score'>): number => {
  let s = 100
  const d = c.maxDiasAtraso
  if (d > 90) s -= 45
  else if (d > 60) s -= 35
  else if (d > 30) s -= 22
  else if (d > 0) s -= 10
  const lateRatio = c.paidCount > 0 ? c.lateCount / c.paidCount : 0
  s -= Math.round(lateRatio * 25)
  if (c.paidCount === 0) s -= 8
  return Math.max(0, Math.min(100, Math.round(s)))
}
const scoreBand = (s: number) => (s >= 70 ? 'baixo' : s >= 40 ? 'medio' : 'alto') as 'baixo' | 'medio' | 'alto'
const SCORE_STYLE = {
  baixo: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', label: 'Baixo' },
  medio: { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', label: 'Atenção' },
  alto: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', label: 'Crítico' },
}

const ICON_TONE = {
  red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
}
/**
 * Contas a Receber — Inteligência de Cobrança. Mesma anatomia da aba Pagar
 * (blocos de `shared/financeIntel`); muda só a semântica (cliente, verde/azul-
 * receber, score/cobrar). Tudo de dado real do /TITULO_RECEBER (aberto + pagos 6m).
 */
const ReceivablesIntel = ({ data, pagos, pmr }: Props) => {
  const hoje = todayISO()
  const [showAnalise, setShowAnalise] = useState(false)

  const m = useMemo(() => {
    const pend = data.filter((r) => r.pendente)
    const vencidos = pend.filter((r) => r.statusTag === 'vencido')
    const aVencer = pend.filter((r) => r.statusTag === 'a-vencer')

    const totalVencido = vencidos.reduce((s, r) => s + r.valor, 0)
    const totalAVencer = aVencer.reduce((s, r) => s + r.valor, 0)
    const carteira = totalVencido + totalAVencer
    const inadimplencia = carteira > 0 ? (totalVencido / carteira) * 100 : 0
    const proximoVenc = aVencer.map((r) => onlyDate(r.dataVencimento)).filter((d) => d >= hoje).sort()[0] ?? null

    // Janelas acumuladas (a vencer).
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

    // Faixa de atraso (stacked).
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

    // ── Gráfico 1: a vencer POR CLIENTE (recorte do mesmo `aVencer`, não fonte nova) ──
    const aVencerCliMap = new Map<number, { nome: string; valor: number }>()
    for (const r of aVencer) {
      const g = aVencerCliMap.get(r.clienteCodigo) ?? { nome: nomeCli(r), valor: 0 }
      g.valor += r.valor
      aVencerCliMap.set(r.clienteCodigo, g)
    }
    const topAVencerCli = Array.from(aVencerCliMap.values()).sort((a, b) => b.valor - a.valor).slice(0, 8)

    // ── Gráfico 2: previsão diária 30d (recorte diário do mesmo `aVencer`) ──
    const d30 = addDaysISO(hoje, 30)
    const byDay = new Map<string, number>()
    for (const r of aVencer) {
      const v = onlyDate(r.dataVencimento)
      if (v >= hoje && v <= d30) byDay.set(v, (byDay.get(v) ?? 0) + r.valor)
    }
    const previsaoDiaria: { dia: string; valor: number }[] = []
    for (let i = 0; i <= 30; i++) { const dia = addDaysISO(hoje, i); previsaoDiaria.push({ dia, valor: byDay.get(dia) ?? 0 }) }

    // ── Histórico de pagamentos (pagos 6m) — score, recuperação, PMR ──
    const histByCli = new Map<number, { paid: number; late: number; ultimo: string | null }>()
    let recMes = 0; let recPrev = 0; let pagosOnTime = 0; let pagosTotal = 0
    const dd30 = addDaysISO(hoje, -30); const dd60 = addDaysISO(hoje, -60)
    const dd90 = addDaysISO(hoje, -90); const dd180 = addDaysISO(hoje, -180)
    const pmrRecent: number[] = []; const pmrPrev: number[] = []
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
      if (pag > dd30) recMes += t.valor
      else if (pag > dd60) recPrev += t.valor
      pagosTotal += 1
      if (!late) pagosOnTime += 1
      if (venc) {
        const dias = Math.round((new Date(pag).getTime() - new Date(venc).getTime()) / 86400000)
        if (dias >= -3650 && dias <= 3650) {
          if (pag > dd90) pmrRecent.push(dias)
          else if (pag > dd180) pmrPrev.push(dias)
        }
      }
    }
    const avg = (a: number[]) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null)
    const pmrAtual = avg(pmrRecent) ?? pmr
    const pmrAnterior = avg(pmrPrev)
    const taxaPrazo = pagosTotal > 0 ? (pagosOnTime / pagosTotal) * 100 : null
    const recVar = recPrev > 0 ? ((recMes - recPrev) / recPrev) * 100 : null

    // ── Agregação por cliente (carteira em aberto) ──
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

    const somaPeso = clientes.reduce((s, c) => s + c.totalAberto, 0)
    const scoreCarteira = somaPeso > 0
      ? Math.round(clientes.reduce((s, c) => s + c.score * c.totalAberto, 0) / somaPeso)
      : 100

    const porVencido = [...clientesVencidos].sort((a, b) => b.totalVencido - a.totalVencido)
    const ranking = porVencido.slice(0, 5)

    let acc = 0; let nConc = 0
    for (const c of porVencido) { acc += c.totalVencido; nConc += 1; if (acc >= totalVencido * 0.4) break }
    const concentracao = totalVencido > 0
      ? { clientes: nConc, pct: (acc / totalVencido) * 100, nomes: porVencido.slice(0, nConc).map((c) => c.nome) }
      : null
    const maiorAtraso = porVencido.reduce<ClienteAgg | null>((mx, c) => (!mx || c.maxDiasAtraso > mx.maxDiasAtraso ? c : mx), null)

    const tabela = [...clientes].sort((a, b) => b.totalAberto - a.totalAberto)

    return {
      totalVencido, totalAVencer, carteira, inadimplencia,
      qtdVencidos: vencidos.length, qtdAVencer: aVencer.length,
      clientesVencidos: clientesVencidos.length, clientes90, atrasoRecorrente,
      proximoVenc, heatmap, faixas, topAVencerCli, previsaoDiaria,
      recMes, recVar, pmrAtual, pmrAnterior, taxaPrazo, scoreCarteira,
      concentracao, maiorAtraso, ranking, tabela,
    }
  }, [data, pagos, pmr, hoje])

  // Band de inadimplência pro hero.
  const inadAtencao = m.inadimplencia >= META_INADIMPLENCIA
  const heroBand = {
    text: `Inadimplência ${m.inadimplencia.toFixed(1).replace('.', ',')}% · ${inadAtencao ? 'em atenção' : 'saudável'}`,
    dotClass: inadAtencao ? 'bg-amber-400' : 'bg-emerald-400',
    textClass: inadAtencao ? 'text-amber-300' : 'text-emerald-300',
  }
  const inadColor = m.inadimplencia >= META_INADIMPLENCIA
    ? 'text-[#b91c1c] dark:text-red-400'
    : m.inadimplencia >= META_INADIMPLENCIA * 0.6
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-emerald-600 dark:text-emerald-400'

  // Aging do vencido (1–30 / 31–60 / 60d+) pro slot do KPI de inadimplência.
  const aging = [m.faixas[1].valor, m.faixas[2].valor, m.faixas[3].valor + m.faixas[4].valor]

  // Análise automática.
  const carteiraBand = scoreBand(m.scoreCarteira)
  const analise: string[] = []
  analise.push(`Saúde da carteira: score ${m.scoreCarteira}/100 (${SCORE_STYLE[carteiraBand].label.toLowerCase()} risco). ${formatCurrency(m.totalVencido)} estão vencidos de ${formatCurrency(m.carteira)} em aberto (inadimplência ${m.inadimplencia.toFixed(2)}%).`)
  if (m.concentracao) analise.push(`Concentração de risco: ${m.concentracao.clientes} cliente${m.concentracao.clientes > 1 ? 's' : ''} (${m.concentracao.nomes.slice(0, 3).join(', ')}) respondem por ${m.concentracao.pct.toFixed(2)}% do valor vencido.`)
  if (m.maiorAtraso) analise.push(`Cliente mais crítico: ${m.maiorAtraso.nome}, com ${m.maiorAtraso.maxDiasAtraso} dias de atraso (${formatCurrency(m.maiorAtraso.totalVencido)}).`)
  if (m.clientes90 > 0) analise.push(`${m.clientes90} cliente${m.clientes90 > 1 ? 's' : ''} acima de 90 dias — risco elevado de não recebimento.`)
  if (m.recVar != null) analise.push(`Recuperação ${m.recVar >= 0 ? 'subiu' : 'caiu'} ${Math.abs(m.recVar).toFixed(2)}% no último mês (${formatCurrency(m.recMes)} recebidos).`)
  if (m.taxaPrazo != null) analise.push(`Histórico: ${m.taxaPrazo.toFixed(2)}% dos títulos foram pagos no prazo nos últimos 6 meses.`)
  const recomendacao = m.concentracao
    ? `Recomendação: priorize a cobrança de ${m.concentracao.nomes.slice(0, 2).join(' e ')} — responsáveis por ${m.concentracao.pct.toFixed(2)}% do valor vencido. ${win7(m) > 0 ? `Antecipe contato dos ${formatCurrency(win7(m))} que vencem em 7 dias.` : ''}`
    : 'Recomendação: carteira saudável, sem concentração relevante de vencidos no momento.'

  return (
    <div className="space-y-4">
      <IntelHeader title="Inteligência de cobrança" actionLabel="Analisar carteira" open={showAnalise} onToggle={() => setShowAnalise((v) => !v)} />
      {showAnalise && <AnalisePanel title="Análise da carteira" insights={analise} recomendacao={recomendacao} onClose={() => setShowAnalise(false)} />}

      {/* KPIs: hero + 3 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiHero
          label="Carteira a receber" sub="Em aberto" Icon={Users}
          value={formatCurrency(m.carteira)}
          lines={[
            { label: 'Vencido', value: formatCurrency(m.totalVencido), valueClass: 'text-[#fca5a5]' },
            { label: 'A vencer', value: formatCurrency(m.totalAVencer) },
          ]}
          band={heroBand}
        />
        <KpiCard
          title="Em atraso" sub="Vencidos" Icon={AlertTriangle} iconClass={ICON_TONE.red}
          value={formatCurrency(m.totalVencido)} valueClass="text-[#b91c1c] dark:text-red-400" borderClass="border-[#fecaca] dark:border-red-900/40"
          hint="Soma dos títulos a receber já vencidos e em aberto. Inclui nº de clientes e de títulos."
          footer={`${m.clientesVencidos} cliente${m.clientesVencidos !== 1 ? 's' : ''} · ${m.qtdVencidos} título${m.qtdVencidos !== 1 ? 's' : ''} · ${m.inadimplencia.toFixed(0)}% da carteira`}
        />
        <KpiCard
          title="A vencer" sub="Futuro" Icon={CalendarClock} iconClass={ICON_TONE.blue}
          value={formatCurrency(m.totalAVencer)} valueClass="text-[#1d4ed8] dark:text-blue-400"
          hint="Títulos a receber em aberto com vencimento futuro. 'Próx.' = próximo vencimento."
          footer={`${m.qtdAVencer} títulos · próx. ${m.proximoVenc ? brDate(m.proximoVenc) : '—'}`}
        />
        <KpiCard
          title="Inadimplência" sub="Vencido / carteira" Icon={Percent} iconClass={ICON_TONE.amber}
          value={`${m.inadimplencia.toFixed(1).replace('.', ',')}%`} valueClass={inadColor} borderClass="border-[#fde68a] dark:border-amber-900/40"
          hint={`Valor vencido ÷ carteira em aberto. A mini-barra mostra a idade do atraso; meta ${META_INADIMPLENCIA}%.`}
        >
          <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            {aging.map((v, i) => {
              const w = m.totalVencido > 0 ? (v / m.totalVencido) * 100 : 0
              return w > 0 ? <div key={i} style={{ width: `${w}%`, backgroundColor: ['#f59e0b', '#ea580c', '#dc2626'][i] }} /> : null
            })}
          </div>
          <p className="mt-1 text-[9px] text-gray-400">1–30 · 31–60 · 60d+ · meta {META_INADIMPLENCIA}%</p>
        </KpiCard>
      </div>

      {/* Calendário de recebimento — a receber por dia de vencimento, por semana. */}
      <ReceberCalendario data={data} />
    </div>
  )
}

/** Soma a vencer em 7 dias — usada só na recomendação. */
const win7 = (m: { previsaoDiaria: { dia: string; valor: number }[] }): number => {
  const hoje = todayISO()
  const fim = addDaysISO(hoje, 7)
  return m.previsaoDiaria.reduce((s, d) => (d.dia >= hoje && d.dia <= fim ? s + d.valor : s), 0)
}

export default ReceivablesIntel

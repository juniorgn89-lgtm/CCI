import { useMemo, useState } from 'react'
import { AlertTriangle, Clock, CalendarDays, Wallet } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import type { PayableRow } from '@/pages/Financeiro/hooks/useFinanceData'
import PagarCalendario from '@/pages/Financeiro/components/PagarCalendario'
import {
  IntelHeader, AnalisePanel, KpiHero, KpiCard,
} from '@/pages/Financeiro/components/shared/financeIntel'

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

const ICON_TONE = {
  red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
}

/**
 * Contas a Pagar — Inteligência de Pagamentos. Cabeçalho + KPIs (impacto no
 * caixa, atraso, hoje, a vencer) e, abaixo, o Calendário de pagamento (a pagar
 * por dia de vencimento, navegável por semana). Tudo do /TITULO_PAGAR + /CONTA.
 */
const PayablesIntel = ({ data, saldoEmCaixa }: Props) => {
  const hoje = todayISO()
  const [showAnalise, setShowAnalise] = useState(false)

  const m = useMemo(() => {
    // 3 baldes DISJUNTOS por vencimento: vencido (<hoje), hoje (=hoje), a vencer (>hoje).
    const pend = data.filter((r) => r.statusTag === 'vencido' || r.statusTag === 'a-vencer')
    const vencidos = pend.filter((r) => onlyDate(r.vencimento) < hoje)
    const hojeTitulos = pend.filter((r) => onlyDate(r.vencimento) === hoje)
    const aVencer = pend.filter((r) => onlyDate(r.vencimento) > hoje)

    const totalVencido = vencidos.reduce((s, r) => s + r.saldoRestante, 0)
    const totalAVencer = aVencer.reduce((s, r) => s + r.saldoRestante, 0)
    const totalHoje = hojeTitulos.reduce((s, r) => s + r.saldoRestante, 0)
    const totalPagar = totalVencido + totalHoje + totalAVencer

    const fornVencidos = new Set(vencidos.map((r) => r.fornecedorCodigo))
    const fornHoje = new Set(hojeTitulos.map((r) => r.fornecedorCodigo))
    const proximoVenc = aVencer.map((r) => onlyDate(r.vencimento)).sort()[0] ?? null

    // Janelas acumuladas (a partir de hoje).
    const win = (dias: number) => {
      const fim = addDaysISO(hoje, dias)
      return pend.reduce((s, r) => {
        const v = onlyDate(r.vencimento)
        return v >= hoje && v <= fim ? s + r.saldoRestante : s
      }, 0)
    }

    // Por fornecedor (agregado) — pra concentração da análise.
    const fMap = new Map<number, { nome: string; total: number }>()
    for (const r of pend) {
      const g = fMap.get(r.fornecedorCodigo) ?? { nome: nomeForn(r), total: 0 }
      g.total += r.saldoRestante
      fMap.set(r.fornecedorCodigo, g)
    }
    const fornecedores = Array.from(fMap.values()).sort((a, b) => b.total - a.total)

    let acc = 0; let nConc = 0
    for (const f of fornecedores) { acc += f.total; nConc += 1; if (acc >= totalPagar * 0.6) break }
    const concentracao = totalPagar > 0
      ? { fornecedores: nConc, pct: (acc / totalPagar) * 100, nomes: fornecedores.slice(0, nConc).map((f) => f.nome) }
      : null

    return {
      totalVencido, totalAVencer, totalPagar, totalHoje,
      qtdVencidos: vencidos.length, qtdAVencer: aVencer.length, qtdHoje: hojeTitulos.length,
      fornVencidos: fornVencidos.size, fornHoje: fornHoje.size,
      proximoVenc, prev7: win(7), concentracao,
      pctVencidos: pend.length > 0 ? (vencidos.length / pend.length) * 100 : 0,
    }
  }, [data, hoje])

  // Impacto no caixa.
  const saldoProjetado = saldoEmCaixa - m.totalPagar
  const caixaBand = saldoProjetado < 0 ? 'critico' : saldoProjetado < saldoEmCaixa * 0.2 ? 'atencao' : 'saudavel'
  const heroBand = {
    saudavel: { dotClass: 'bg-emerald-400', textClass: 'text-emerald-300', text: 'Caixa saudável' },
    atencao: { dotClass: 'bg-amber-400', textClass: 'text-amber-300', text: 'Caixa em atenção' },
    critico: { dotClass: 'bg-red-400', textClass: 'text-red-300', text: 'Caixa crítico' },
  }[caixaBand]
  const heroValueClass = caixaBand === 'critico' ? 'text-red-300' : caixaBand === 'atencao' ? 'text-[#fcd34d]' : 'text-[#6ee7b7]'

  // Análise automática.
  const analise: string[] = []
  if (m.concentracao) analise.push(`Concentração: ${m.concentracao.fornecedores} fornecedor${m.concentracao.fornecedores > 1 ? 'es' : ''} (${m.concentracao.nomes.slice(0, 3).join(', ')}) somam ${m.concentracao.pct.toFixed(2)}% das obrigações em aberto.`)
  if (m.totalVencido > 0) analise.push(`${formatCurrency(m.totalVencido)} já estão vencidos (${m.qtdVencidos} título${m.qtdVencidos > 1 ? 's' : ''}, ${m.fornVencidos} fornecedor${m.fornVencidos > 1 ? 'es' : ''}).`)
  if (m.prev7 > 0) analise.push(`${formatCurrency(m.prev7)} vencem nos próximos 7 dias — pressão imediata no caixa.`)
  analise.push(`Saldo projetado após pagamentos: ${formatCurrency(saldoProjetado)} (caixa ${heroBand.text.replace('Caixa ', '').toLowerCase()}).`)
  const recomendacao = m.concentracao
    ? `Recomendação: negocie prazo/condição com ${m.concentracao.nomes.slice(0, 2).join(' e ')} — concentram ${m.concentracao.pct.toFixed(2)}% do total a pagar.`
    : 'Recomendação: obrigações pulverizadas, sem concentração relevante.'

  return (
    <div className="space-y-4">
      <IntelHeader title="Inteligência de pagamentos" actionLabel="Analisar contas a pagar" open={showAnalise} onToggle={() => setShowAnalise((v) => !v)} />
      {showAnalise && <AnalisePanel title="Análise de pagamentos" insights={analise} recomendacao={recomendacao} onClose={() => setShowAnalise(false)} />}

      {/* KPIs: hero + 3 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiHero
          label="Impacto no caixa" sub="Saldo projetado" Icon={Wallet}
          value={`${saldoProjetado >= 0 ? '+' : ''}${formatCurrency(saldoProjetado)}`} valueClass={heroValueClass}
          lines={[
            { label: 'Saldo atual', value: formatCurrency(saldoEmCaixa) },
            { label: 'A pagar em aberto', value: `− ${formatCurrency(m.totalPagar)}`, valueClass: 'text-[#fca5a5]' },
          ]}
          band={heroBand}
        />
        <KpiCard
          title="Em atraso" sub="Vencidos" Icon={AlertTriangle} iconClass={ICON_TONE.red}
          value={formatCurrency(m.totalVencido)} valueClass="text-[#b91c1c] dark:text-red-400" borderClass="border-[#fecaca] dark:border-red-900/40"
          hint="Soma dos títulos a pagar já vencidos e em aberto (saldo restante)."
          footer={`${m.qtdVencidos} título${m.qtdVencidos !== 1 ? 's' : ''} · ${m.fornVencidos} fornecedor${m.fornVencidos !== 1 ? 'es' : ''} · ${m.pctVencidos.toFixed(0)}% da carteira`}
        />
        <KpiCard
          title="A pagar hoje" sub="Vence hoje" Icon={Clock} iconClass={ICON_TONE.orange}
          value={formatCurrency(m.totalHoje)} valueClass="text-[#c2410c] dark:text-orange-400" borderClass="border-[#fed7aa] dark:border-orange-900/40"
          hint="Títulos a pagar com vencimento hoje."
          footer={`${m.qtdHoje} título${m.qtdHoje !== 1 ? 's' : ''} · ${m.fornHoje} fornecedor${m.fornHoje !== 1 ? 'es' : ''}`}
        />
        <KpiCard
          title="A vencer" sub="Futuro" Icon={CalendarDays} iconClass={ICON_TONE.blue}
          value={formatCurrency(m.totalAVencer)} valueClass="text-[#1d4ed8] dark:text-blue-400"
          hint="Títulos a pagar em aberto com vencimento futuro. 'Próx.' = próximo vencimento."
          footer={`${m.qtdAVencer} títulos · próx. ${m.proximoVenc ? brDate(m.proximoVenc) : '—'}`}
        />
      </div>

      {/* Calendário de pagamento — a pagar por dia de vencimento, por semana. */}
      <PagarCalendario data={data} />
    </div>
  )
}

export default PayablesIntel

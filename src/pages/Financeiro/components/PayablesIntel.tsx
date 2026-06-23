import { useMemo, useState } from 'react'
import {
  AlertTriangle, Clock, CalendarDays, Wallet, Truck, ListOrdered, CalendarClock, Percent,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatCurrencyShort } from '@/lib/formatters'
import type { PayableRow } from '@/pages/Financeiro/hooks/useFinanceData'
import FornecedorPagarModal from '@/pages/Financeiro/components/FornecedorPagarModal'
import {
  IntelHeader, AnalisePanel, KpiHero, KpiCard, ChartCard, HBars, MiniBars30,
  StackedBarLegend, RankingCard, JanelaBars, IntelTabs, Badge,
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
const getStr = (r: PayableRow, k: string) => (r as unknown as Record<string, unknown>)[k] as string | undefined
const centroCusto = (r: PayableRow) => getStr(r, 'centroCustoDescricao')?.trim() || '—'
const categoria = (r: PayableRow) => getStr(r, 'planoContaGerencialDescricao')?.trim() || '—'
const numTitulo = (r: PayableRow) => getStr(r, 'numeroTitulo')?.trim() || `#${(r as unknown as { tituloPagarCodigo?: number }).tituloPagarCodigo ?? ''}`

/** Paleta categórica da participação por fornecedor. */
const CAT_CORES = ['#1e3a5f', '#2563eb', '#7c3aed', '#0891b2', '#ea580c', '#cbd5e1']

const ICON_TONE = {
  red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
}

type Aba = 'atraso' | 'fornecedor' | 'vencimento'

/**
 * Contas a Pagar — Inteligência de Pagamentos. Mesma anatomia da aba Receber
 * (blocos de `shared/financeIntel`), só muda a semântica (fornecedor, vermelho-
 * pagar, impacto no caixa). Tudo de dado real do /TITULO_PAGAR + saldo do /CONTA.
 */
const PayablesIntel = ({ data, saldoEmCaixa }: Props) => {
  const hoje = todayISO()
  const [aba, setAba] = useState<Aba>('atraso')
  const [showAnalise, setShowAnalise] = useState(false)
  const [detalhe, setDetalhe] = useState<{ codigo: number; nome: string } | null>(null)

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
      else if (v > hoje) g.aVencer += r.saldoRestante
      fMap.set(r.fornecedorCodigo, g)
    }
    const fornecedores = Array.from(fMap.values()).sort((a, b) => b.total - a.total)
    const topAVencer = [...fornecedores].sort((a, b) => b.aVencer - a.aVencer).filter((f) => f.aVencer > 0).slice(0, 8)
      .map((f) => ({ nome: f.nome, valor: f.aVencer }))

    // Participação (top 5 + outros).
    const top5 = fornecedores.slice(0, 5).map((f) => ({ nome: f.nome, valor: f.total }))
    const outros = fornecedores.slice(5).reduce((s, f) => s + f.total, 0)
    const participacao = outros > 0 ? [...top5, { nome: 'Outros', valor: outros }] : top5

    // Calendário de desembolsos (30 dias, por dia).
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
      totalVencido, totalAVencer, totalPagar, totalHoje,
      qtdVencidos: vencidos.length, qtdAVencer: aVencer.length, qtdHoje: hojeTitulos.length, qtdPend: pend.length,
      fornVencidos: fornVencidos.size, fornHoje: fornHoje.size,
      proximoVenc, prev7: win(7), prev30: win(30),
      heatmap, fornecedores, topAVencer, participacao, desembolsos, concentracao,
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

  // Tabela.
  const titulosAba = useMemo(() => {
    const pend = data.filter((r) => r.statusTag === 'vencido' || r.statusTag === 'a-vencer')
    if (aba === 'atraso') return pend.filter((r) => r.statusTag === 'vencido').sort((a, b) => b.diasAtraso - a.diasAtraso)
    if (aba === 'vencimento') return [...pend].sort((a, b) => onlyDate(a.vencimento).localeCompare(onlyDate(b.vencimento)))
    return [...pend].sort((a, b) => nomeForn(a).localeCompare(nomeForn(b)))
  }, [data, aba])

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

      {/* 3 gráficos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="A vencer por fornecedor" Icon={Truck} hint="Fornecedores que mais consomem o caixa futuro (a vencer), top 8.">
          <HBars data={m.topAVencer} color="#2563eb" />
        </ChartCard>
        <ChartCard title="Calendário de desembolsos" Icon={CalendarDays} hint="Saída de caixa por dia nos próximos 30 dias (vencimentos pendentes).">
          <MiniBars30 data={m.desembolsos} color="#ef4444" />
        </ChartCard>
        <ChartCard title="Participação no total" Icon={Percent} hint="Peso de cada fornecedor no total a pagar (top 5 + outros).">
          <StackedBarLegend
            total={m.totalPagar}
            segments={m.participacao.map((p, i) => ({ label: p.nome, valor: p.valor, color: CAT_CORES[i % CAT_CORES.length] }))}
          />
        </ChartCard>
      </div>

      {/* Ranking + Heatmap */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankingCard
          title="Maiores fornecedores" Icon={ListOrdered} hint="Ranking de fornecedores por valor em aberto e participação no total."
          accentClass="bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300"
          items={m.fornecedores.slice(0, 5).map((f) => ({
            key: String(f.codigo),
            nome: f.nome,
            sub: `${m.totalPagar > 0 ? ((f.total / m.totalPagar) * 100).toFixed(0) : 0}% do total${f.vencido > 0 ? ` · ${formatCurrencyShort(f.vencido)} vencido` : ''}`,
            valor: formatCurrencyShort(f.total),
          }))}
        />
        <JanelaBars
          title="Heatmap de vencimentos" Icon={CalendarClock} sub="Pressão de caixa acumulada por janela"
          hint="Quanto sairá do caixa acumulado por janela: hoje, 7, 15, 30 e 60 dias." rows={m.heatmap} color="#ef4444"
        />
      </div>

      {/* Tabela com abas */}
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <IntelTabs<Aba>
          tabs={[{ id: 'atraso', label: 'Em atraso' }, { id: 'fornecedor', label: 'Por fornecedor' }, { id: 'vencimento', label: 'Por vencimento' }]}
          active={aba}
          onChange={setAba}
          right={<span className="text-xs text-gray-400">{aba === 'fornecedor' ? `${m.fornecedores.length} fornecedores` : `${titulosAba.length} títulos`}</span>}
        />
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
                  <tr key={f.codigo} onClick={() => setDetalhe({ codigo: f.codigo, nome: f.nome })} className="cursor-pointer hover:bg-[#eff6ff] dark:hover:bg-blue-950/20">
                    <td className="max-w-[280px] truncate px-4 py-2 font-medium text-gray-800 dark:text-gray-200" title={f.nome}>{f.nome}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{f.qtd}</td>
                    <td className={cn('px-4 py-2 text-right tabular-nums', f.vencido > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-400')}>{f.vencido > 0 ? formatCurrencyInt(f.vencido) : '—'}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{f.aVencer > 0 ? formatCurrencyInt(f.aVencer) : '—'}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(f.total)}</td>
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
                  <tr key={r.codigo} onClick={() => setDetalhe({ codigo: r.fornecedorCodigo, nome: nomeForn(r) })} className="cursor-pointer hover:bg-[#eff6ff] dark:hover:bg-blue-950/20">
                    <td className="max-w-[200px] truncate px-3 py-2 font-medium text-gray-800 dark:text-gray-200" title={nomeForn(r)}>{nomeForn(r)}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-500 dark:text-gray-400">{numTitulo(r)}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-500 dark:text-gray-400">{brDate(onlyDate(r.dataMovimento))}</td>
                    <td className={cn('px-3 py-2 tabular-nums', r.statusTag === 'vencido' ? 'font-medium text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300')}>{brDate(onlyDate(r.vencimento))}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(r.saldoRestante)}</td>
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

export default PayablesIntel

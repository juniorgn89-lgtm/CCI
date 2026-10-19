import ShareReportButton from '@/components/feedback/ShareReportButton'
import type { ReportPayload, ReportRow } from '@/lib/report/reportTypes'
import { formatCurrencyInt, formatLiters, formatNumber } from '@/lib/formatters'
import { useFilterStore } from '@/store/filters'
import useRedeSetores, { type SetorId } from '@/pages/Dashboard/hooks/useRedeSetores'
import useContasResumo from '@/pages/Dashboard/hooks/useContasResumo'
import useReabastecimento from '@/pages/Dashboard/hooks/useReabastecimento'

const SETOR_LABEL: Record<SetorId, string> = { combustivel: 'Combustível', automotivos: 'Automotivos', conveniencia: 'Conveniência' }
const pctFmt = (v: number) => `${v.toFixed(2).replace('.', ',')}%`
const varTxt = (atual: number, anterior: number) => (anterior > 0 ? `${atual >= anterior ? '+' : ''}${(((atual - anterior) / anterior) * 100).toFixed(1).replace('.', ',')}%` : 'sem base')
const br = (iso: string) => (iso ?? '').split('-').reverse().join('/')
const docs = (n: number) => `${n} ${n === 1 ? 'doc.' : 'docs.'}`

/**
 * "Compartilhar" da Visão Geral da Central: PDF determinístico com o que está
 * na tela (setores, ranking por posto, tanques e contas), pra mandar no
 * WhatsApp ou baixar. Lê os MESMOS hooks dos cards (cache compartilhado), então
 * não faz busca nova. Sem IA: só os números que o dono já vê.
 */
const CentralCompartilhar = () => {
  const rede = useRedeSetores()
  const contas = useContasResumo()
  const { tanques } = useReabastecimento({ respeitarFiltro: true })
  const { dataInicial, dataFinal, empresaCodigos, comparisonMode } = useFilterStore()
  const cmp = comparisonMode === 'prevYear' ? 'vs ano ant.' : 'vs mês ant.'

  const build = (): ReportPayload => {
    const setores: { id: SetorId; obj: typeof rede.combustivel }[] = [
      { id: 'combustivel', obj: rede.combustivel },
      { id: 'automotivos', obj: rede.automotivos },
      { id: 'conveniencia', obj: rede.conveniencia },
    ]
    // Ranking por posto (lucro bruto somando os 3 setores).
    const porPosto = new Map<number, { posto: string; fat: number; lb: number; litros: number }>()
    for (const { id, obj } of setores) {
      for (const p of obj.postos) {
        const e = porPosto.get(p.empresaCodigo) ?? { posto: p.posto, fat: 0, lb: 0, litros: 0 }
        e.fat += p.faturamento; e.lb += p.lucroBruto
        if (id === 'combustivel') e.litros += p.qtd
        porPosto.set(p.empresaCodigo, e)
      }
    }
    const ranking = [...porPosto.values()].sort((a, b) => b.lb - a.lb)

    // Tanques por posto.
    const porPostoTq = new Map<number, { nome: string; atual: number; cap: number; criticos: number; baixos: number }>()
    for (const t of tanques) {
      const e = porPostoTq.get(t.empresaCodigo) ?? { nome: t.empresaNome, atual: 0, cap: 0, criticos: 0, baixos: 0 }
      e.atual += t.estoqueAtual; e.cap += t.capacidade
      if (t.nivel === 'critico') e.criticos++
      else if (t.nivel === 'alerta') e.baixos++
      porPostoTq.set(t.empresaCodigo, e)
    }
    const tq = [...porPostoTq.values()].map((p) => ({ ...p, pct: p.cap > 0 ? (p.atual / p.cap) * 100 : 0 })).sort((a, b) => b.criticos - a.criticos || a.pct - b.pct)

    const faixas = (l: typeof contas.pagar): ReportRow[] => [
      { label: 'Vencidas', value: formatCurrencyInt(l.buckets.vencidas.total), sub: docs(l.buckets.vencidas.count) },
      { label: 'Hoje', value: formatCurrencyInt(l.buckets.hoje.total), sub: docs(l.buckets.hoje.count) },
      { label: 'Próximos 7 dias', value: formatCurrencyInt(l.buckets.d7.total), sub: docs(l.buckets.d7.count) },
      { label: '8 a 30 dias', value: formatCurrencyInt(l.buckets.d30.total), sub: docs(l.buckets.d30.count) },
      { label: 'Depois de 30 dias', value: formatCurrencyInt(l.depois30.total), sub: docs(l.depois30.count) },
      { label: 'Tudo em aberto', value: formatCurrencyInt(l.tudo.total), sub: docs(l.tudo.count), strong: true },
    ]
    const saldoTudo = contas.receber.tudo.total - contas.pagar.tudo.total

    return {
      title: 'Central da Rede · Visão Geral',
      subtitle: `${br(dataInicial)} a ${br(dataFinal)} · ${empresaCodigos.length === 0 ? 'Todos os postos' : `${empresaCodigos.length} posto(s)`}`,
      kpis: [
        { label: 'Faturamento', value: formatCurrencyInt(rede.global.faturamento) },
        { label: 'Lucro bruto', value: formatCurrencyInt(rede.global.lucroBruto), tone: 'pos' },
        { label: 'Margem', value: pctFmt(rede.global.margem) },
        { label: 'Litros', value: formatLiters(rede.combustivel.qtd) },
      ],
      sections: [
        {
          title: 'Por setor',
          rows: setores.map(({ id, obj }): ReportRow => ({
            label: SETOR_LABEL[id],
            value: `${formatCurrencyInt(obj.lucroBruto)} L.B.`,
            sub: `fat. ${formatCurrencyInt(obj.faturamento)} · margem ${pctFmt(obj.margem)} · ${id === 'combustivel' ? formatLiters(obj.qtd) : `${formatNumber(Math.round(obj.qtd))} un`} · L.B. ${varTxt(obj.lucroBruto, obj.lucroBrutoAnoAnterior)} ${cmp}`,
          })).concat([{ label: 'Rede', value: `${formatCurrencyInt(rede.global.lucroBruto)} L.B.`, sub: `fat. ${formatCurrencyInt(rede.global.faturamento)} · margem ${pctFmt(rede.global.margem)} · L.B. ${varTxt(rede.global.lucroBruto, rede.global.lucroBrutoAnoAnterior)} ${cmp}`, strong: true }] as ReportRow[]),
          note: 'Venda fiscal apurada; dias fechados do cache e o dia de hoje ao vivo.',
        },
        {
          title: 'Ranking por lucro bruto',
          rows: ranking.map((p, i) => ({
            label: `${i + 1}. ${p.posto}`,
            value: formatCurrencyInt(p.lb),
            sub: `fat. ${formatCurrencyInt(p.fat)} · margem ${pctFmt(p.fat > 0 ? (p.lb / p.fat) * 100 : 0)}${p.litros > 0 ? ` · ${formatLiters(p.litros)}` : ''}`,
          })),
        },
        ...(tq.length > 0 ? [{
          title: 'Tanques de combustível',
          rows: tq.map((p) => ({
            label: p.nome,
            value: `${Math.round(p.pct)}% · ${formatNumber(Math.round(p.atual))} L`,
            sub: `capacidade ${formatNumber(Math.round(p.cap))} L · cabe ${formatNumber(Math.round(Math.max(0, p.cap - p.atual)))} L${p.criticos ? ` · ${p.criticos} crítico(s)` : ''}${p.baixos ? ` · ${p.baixos} baixo(s)` : ''}`,
          })),
          note: 'Estoque escritural do ERP. Crítico abaixo de 20%, baixo entre 20% e 30%.',
        }] : []),
        ...(contas.temDados ? [
          {
            title: 'Saldo da janela',
            rows: [
              { label: 'Vencido', value: formatCurrencyInt(contas.receber.buckets.vencidas.total - contas.pagar.buckets.vencidas.total), sub: `entra ${formatCurrencyInt(contas.receber.buckets.vencidas.total)} · sai ${formatCurrencyInt(contas.pagar.buckets.vencidas.total)}` },
              { label: 'Hoje', value: formatCurrencyInt(contas.receber.buckets.hoje.total - contas.pagar.buckets.hoje.total), sub: `entra ${formatCurrencyInt(contas.receber.buckets.hoje.total)} · sai ${formatCurrencyInt(contas.pagar.buckets.hoje.total)}` },
              { label: 'Tudo em aberto', value: formatCurrencyInt(saldoTudo), sub: `entra ${formatCurrencyInt(contas.receber.tudo.total)} · sai ${formatCurrencyInt(contas.pagar.tudo.total)}`, strong: true },
            ],
          },
          { title: 'Contas a pagar', rows: faixas(contas.pagar), note: 'Saldo = valor + acréscimo − desconto − pago.' },
          { title: 'Contas a receber', rows: faixas(contas.receber), note: 'Clientes mais cartões e apps pelo líquido estimado de taxa.' },
        ] : []),
      ],
      footnote: 'Visor360 · somente leitura · números do momento da geração.',
    }
  }

  return <ShareReportButton filename="central-da-rede.pdf" build={build} />
}

export default CentralCompartilhar

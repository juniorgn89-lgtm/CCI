import { useMemo } from 'react'
import { Building2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatLiters, formatNumber } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import { useFilterStore } from '@/store/filters'
import useRedeSetores, { type SetorId, type RedePostoRow } from '@/pages/Dashboard/hooks/useRedeSetores'
import { GUIAS } from '@/lib/guiasModais'
import { brDateShort, pctFmt, varPct, MODAL_CLS } from '@/pages/Dashboard/components/modais/util'

const SETOR_COR: Record<SetorId, string> = { combustivel: '#2563eb', conveniencia: '#10b981', automotivos: '#f59e0b' }
const SETOR_LABEL: Record<SetorId, string> = { combustivel: 'Combustível', conveniencia: 'Conveniência', automotivos: 'Automotivos' }

interface Props {
  empresaCodigo: number | null
  onClose: () => void
}

export const Delta = ({ value, label }: { value: number | null; label: string }) => {
  if (value === null) return <span className="text-[10px] text-gray-400">sem base</span>
  const up = value > 0.05, down = value < -0.05
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums', up ? 'text-emerald-600 dark:text-emerald-400' : down ? 'text-red-600 dark:text-red-400' : 'text-gray-500')}>
      <Icon className="h-3 w-3" />{value > 0 ? '+' : ''}{pctFmt(value)} <span className="font-normal text-gray-400">{label}</span>
    </span>
  )
}

/**
 * Central → Ranking por posto → clique: o posto por setor (faturamento, lucro
 * bruto, margem, quantidade, comparativo) e os produtos que mais dão lucro,
 * tudo do que a Visão Geral já carregou (nenhuma busca nova).
 */
const PostoResumoModal = ({ empresaCodigo, onClose }: Props) => {
  if (empresaCodigo == null) return null
  return <Inner empresaCodigo={empresaCodigo} onClose={onClose} />
}

const Inner = ({ empresaCodigo, onClose }: { empresaCodigo: number; onClose: () => void }) => {
  const rede = useRedeSetores()
  const dataInicial = useFilterStore((s) => s.dataInicial)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const cmpLabel = rede.comparisonMode === 'prevYear' ? 'vs AA' : 'vs MA'

  const dados = useMemo(() => {
    const setores: { id: SetorId; row: RedePostoRow | undefined; lbLabel: string; redeLb: number }[] = [
      { id: 'combustivel', row: rede.combustivel.postos.find((p) => p.empresaCodigo === empresaCodigo), lbLabel: rede.combustivel.lbLabel, redeLb: rede.combustivel.lucroBruto },
      { id: 'automotivos', row: rede.automotivos.postos.find((p) => p.empresaCodigo === empresaCodigo), lbLabel: rede.automotivos.lbLabel, redeLb: rede.automotivos.lucroBruto },
      { id: 'conveniencia', row: rede.conveniencia.postos.find((p) => p.empresaCodigo === empresaCodigo), lbLabel: rede.conveniencia.lbLabel, redeLb: rede.conveniencia.lucroBruto },
    ]
    const nome = setores.find((s) => s.row)?.row?.posto ?? `Posto ${empresaCodigo}`
    const fat = setores.reduce((s, x) => s + (x.row?.faturamento ?? 0), 0)
    const fatAnt = setores.reduce((s, x) => s + (x.row?.faturamentoAnoAnterior ?? 0), 0)
    const lb = setores.reduce((s, x) => s + (x.row?.lucroBruto ?? 0), 0)
    const lbAnt = setores.reduce((s, x) => s + (x.row?.lucroBrutoAnoAnterior ?? 0), 0)
    const litros = setores[0].row?.qtd ?? 0
    const litrosAnt = setores[0].row?.qtdAnoAnterior ?? 0
    const fatiaRede = rede.global.lucroBruto > 0 ? (lb / rede.global.lucroBruto) * 100 : 0
    // Posição no ranking de lucro bruto da rede.
    const porPosto = new Map<number, number>()
    for (const s of [rede.combustivel, rede.automotivos, rede.conveniencia]) for (const p of s.postos) porPosto.set(p.empresaCodigo, (porPosto.get(p.empresaCodigo) ?? 0) + p.lucroBruto)
    const ordem = [...porPosto.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c)
    const posicao = ordem.indexOf(empresaCodigo) + 1
    const produtos = setores.flatMap((s) => (s.row?.produtos ?? []).map((p) => ({ ...p, setor: s.id })))
      .filter((p) => p.lucroBruto > 0).sort((a, b) => b.lucroBruto - a.lucroBruto).slice(0, 8)
    const diasOperados = Math.max(...setores.map((s) => s.row?.diasOperados ?? 0))
    return { setores, nome, fat, fatAnt, lb, lbAnt, litros, litrosAnt, fatiaRede, posicao, totalPostos: ordem.length, produtos, diasOperados }
  }, [rede, empresaCodigo])

  const kpis = [
    { label: 'Faturamento', valor: formatCurrencyInt(dados.fat), delta: varPct(dados.fat, dados.fatAnt) },
    { label: 'Lucro bruto', valor: formatCurrencyInt(dados.lb), delta: varPct(dados.lb, dados.lbAnt) },
    { label: 'Margem', valor: pctFmt(dados.fat > 0 ? (dados.lb / dados.fat) * 100 : 0, 2), delta: null },
    { label: 'Litros', valor: formatLiters(dados.litros), delta: varPct(dados.litros, dados.litrosAnt) },
  ]

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent guia={GUIAS.postoResumo} className={MODAL_CLS}>
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a5f]/[0.07] text-[#1e3a5f] dark:bg-white/10 dark:text-blue-300"><Building2 className="h-4 w-4" /></span>
            {dados.nome}
            {dados.posicao > 0 && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{dados.posicao}º de {dados.totalPostos} em lucro bruto</span>}
          </DialogTitle>
          <DialogDescription>
            {brDateShort(dataInicial)} a {brDateShort(dataFinal)} · {dados.diasOperados} dia{dados.diasOperados === 1 ? '' : 's'} com venda · {pctFmt(dados.fatiaRede)} do lucro bruto da rede
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto px-6 pb-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{k.label}</p>
                <p className="mt-0.5 text-[18px] font-extrabold tabular-nums leading-tight text-gray-900 dark:text-gray-100">{k.valor}</p>
                {k.delta !== null ? <Delta value={k.delta} label={cmpLabel} /> : <span className="text-[10px] text-gray-400">lucro bruto ÷ faturamento</span>}
              </div>
            ))}
          </div>

          <h4 className="mt-4 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Por setor</h4>
          <table className="w-full min-w-[640px] text-[12px]">
            <thead className="text-[10px] uppercase tracking-wider text-gray-400">
              <tr>
                <th className="py-1.5 pr-3 text-left font-semibold">Setor</th>
                <th className="px-3 py-1.5 text-right font-semibold">Qtde</th>
                <th className="px-3 py-1.5 text-right font-semibold">Faturamento</th>
                <th className="px-3 py-1.5 text-right font-semibold">Lucro bruto</th>
                <th className="px-3 py-1.5 text-right font-semibold">Margem</th>
                <th className="px-3 py-1.5 text-right font-semibold">L.B./un</th>
                <th className="px-3 py-1.5 text-right font-semibold">Fatia no setor <InfoHint text="Quanto este posto representa do lucro bruto do setor na rede." /></th>
                <th className="py-1.5 pl-3 text-right font-semibold">{cmpLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {dados.setores.map((s) => {
                const r = s.row
                return (
                  <tr key={s.id} className="text-gray-800 dark:text-gray-200">
                    <td className="py-2 pr-3"><span className="inline-flex items-center gap-2 font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SETOR_COR[s.id] }} />{SETOR_LABEL[s.id]}</span></td>
                    {!r ? <td colSpan={7} className="px-3 py-2 text-right text-[11px] text-gray-400">sem venda no período</td> : (
                      <>
                        <td className="px-3 py-2 text-right tabular-nums">{s.id === 'combustivel' ? formatLiters(r.qtd) : `${formatNumber(Math.round(r.qtd))} un`}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(r.faturamento)}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrencyInt(r.lucroBruto)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{pctFmt(r.margem, 2)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.lbPorUnidade)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-500">{pctFmt(s.redeLb > 0 ? (r.lucroBruto / s.redeLb) * 100 : 0)}</td>
                        <td className="py-2 pl-3 text-right"><Delta value={varPct(r.lucroBruto, r.lucroBrutoAnoAnterior)} label="" /></td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>

          {dados.produtos.length > 0 && (
            <>
              <h4 className="mt-4 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Produtos que mais dão lucro</h4>
              <table className="w-full min-w-[640px] text-[12px]">
                <thead className="text-[10px] uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="py-1.5 pr-3 text-left font-semibold">Produto</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Qtde</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Lucro bruto</th>
                    <th className="px-3 py-1.5 text-right font-semibold">Margem</th>
                    <th className="py-1.5 pl-3 text-right font-semibold">L.B./un</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {dados.produtos.map((p) => (
                    <tr key={`${p.setor}-${p.produtoCodigo}`} className="text-gray-800 dark:text-gray-200">
                      <td className="py-1.5 pr-3"><span className="inline-flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: SETOR_COR[p.setor] }} /><span className="truncate">{p.produto}</span></span></td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{p.setor === 'combustivel' ? formatLiters(p.qtd) : `${formatNumber(Math.round(p.qtd))} un`}</td>
                      <td className="px-3 py-1.5 text-right font-semibold tabular-nums">{formatCurrencyInt(p.lucroBruto)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{pctFmt(p.margem, 2)}</td>
                      <td className="py-1.5 pl-3 text-right tabular-nums">{formatCurrency(p.lbPorUnidade)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
        <footer className="border-t border-gray-100 px-6 py-3 text-[11px] text-gray-400 dark:border-gray-800">
          Venda fiscal apurada (dias fechados do cache; o dia de hoje ao vivo). Comparativo {rede.comparisonMode === 'prevYear' ? 'com o mesmo período do ano anterior' : 'com o mês anterior'}, mesmos dias decorridos.
        </footer>
      </DialogContent>
    </Dialog>
  )
}

export default PostoResumoModal

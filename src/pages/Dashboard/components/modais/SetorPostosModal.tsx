import { useMemo } from 'react'
import { Droplets, Wrench, Store, Globe, Trophy } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency, formatCurrencyInt, formatLiters, formatNumber } from '@/lib/formatters'
import { useFilterStore } from '@/store/filters'
import useRedeSetores, { type SetorId, type RedeSetor } from '@/pages/Dashboard/hooks/useRedeSetores'
import { Delta } from '@/pages/Dashboard/components/modais/PostoResumoModal'
import { GUIAS } from '@/lib/guiasModais'
import { brDateShort, pctFmt, varPct, MODAL_CLS } from '@/pages/Dashboard/components/modais/util'

export type SetorModal = SetorId | 'global'

const META: Record<SetorModal, { label: string; Icon: typeof Droplets; cor: string }> = {
  combustivel: { label: 'Combustível', Icon: Droplets, cor: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  automotivos: { label: 'Automotivos', Icon: Wrench, cor: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' },
  conveniencia: { label: 'Conveniência', Icon: Store, cor: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' },
  global: { label: 'Global', Icon: Globe, cor: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' },
}

interface Props {
  setor: SetorModal | null
  onClose: () => void
  /** Clique num posto → o pai fecha este e abre o resumo do posto. */
  onPosto?: (empresaCodigo: number) => void
}

/**
 * Central → card de setor / donut / margem → clique: o setor posto a posto
 * (quantidade, faturamento, lucro bruto, margem, fatia e comparativo), ordenado
 * por lucro bruto. "Global" cruza os três setores por posto. Dados que a
 * Visão Geral já carregou — nenhuma busca nova.
 */
const SetorPostosModal = ({ setor, onClose, onPosto }: Props) => {
  if (!setor) return null
  return <Inner setor={setor} onClose={onClose} onPosto={onPosto} />
}

const Inner = ({ setor, onClose, onPosto }: { setor: SetorModal; onClose: () => void; onPosto?: (c: number) => void }) => {
  const rede = useRedeSetores()
  const dataInicial = useFilterStore((s) => s.dataInicial)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const cmpLabel = rede.comparisonMode === 'prevYear' ? 'vs AA' : 'vs MA'
  const meta = META[setor]

  const obj: RedeSetor | null = setor === 'global' ? null : rede[setor]

  const linhasSetor = useMemo(() => {
    if (!obj) return []
    return [...obj.postos].filter((p) => p.faturamento > 0 || p.lucroBruto !== 0).sort((a, b) => b.lucroBruto - a.lucroBruto)
  }, [obj])

  const linhasGlobal = useMemo(() => {
    if (setor !== 'global') return []
    const m = new Map<number, { empresaCodigo: number; posto: string; comb: number; auto: number; conv: number; lb: number; lbAnt: number; fat: number }>()
    const add = (id: SetorId, s: RedeSetor) => {
      for (const p of s.postos) {
        const e = m.get(p.empresaCodigo) ?? { empresaCodigo: p.empresaCodigo, posto: p.posto, comb: 0, auto: 0, conv: 0, lb: 0, lbAnt: 0, fat: 0 }
        if (id === 'combustivel') e.comb += p.lucroBruto
        else if (id === 'automotivos') e.auto += p.lucroBruto
        else e.conv += p.lucroBruto
        e.lb += p.lucroBruto; e.lbAnt += p.lucroBrutoAnoAnterior; e.fat += p.faturamento
        m.set(p.empresaCodigo, e)
      }
    }
    add('combustivel', rede.combustivel); add('automotivos', rede.automotivos); add('conveniencia', rede.conveniencia)
    return [...m.values()].sort((a, b) => b.lb - a.lb)
  }, [setor, rede.combustivel, rede.automotivos, rede.conveniencia])

  const totalLb = obj ? obj.lucroBruto : rede.global.lucroBruto
  const totalFat = obj ? obj.faturamento : rede.global.faturamento
  const totalLbAnt = obj ? obj.lucroBrutoAnoAnterior : rede.global.lucroBrutoAnoAnterior
  const nPostos = obj ? linhasSetor.length : linhasGlobal.length
  const rowCls = (clicavel: boolean) => cn('text-gray-800 dark:text-gray-200', clicavel && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5')

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent guia={GUIAS.setorPostos} className={MODAL_CLS}>
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', meta.cor)}><meta.Icon className="h-4 w-4" /></span>
            {meta.label} · posto a posto
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{brDateShort(dataInicial)} a {brDateShort(dataFinal)} · {nPostos} posto{nPostos === 1 ? '' : 's'}</span>
            <span>lucro bruto <b className="text-gray-700 dark:text-gray-200">{formatCurrencyInt(totalLb)}</b> · faturamento {formatCurrencyInt(totalFat)} · margem {pctFmt(totalFat > 0 ? (totalLb / totalFat) * 100 : 0, 2)}</span>
            <Delta value={varPct(totalLb, totalLbAnt)} label={cmpLabel} />
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto px-6 pb-4">
          {obj ? (
            <table className="w-full min-w-[640px] text-[12px]">
              <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wider text-gray-400 dark:bg-gray-900">
                <tr>
                  <th className="py-2 pr-3 text-left font-semibold">Posto</th>
                  <th className="px-3 py-2 text-right font-semibold">{setor === 'combustivel' ? 'Litros' : 'Qtde (un)'}</th>
                  <th className="px-3 py-2 text-right font-semibold">Faturamento</th>
                  <th className="px-3 py-2 text-right font-semibold">Lucro bruto</th>
                  <th className="px-3 py-2 text-right font-semibold">Margem</th>
                  <th className="px-3 py-2 text-right font-semibold">L.B./un</th>
                  <th className="px-3 py-2 text-right font-semibold">Fatia</th>
                  <th className="py-2 pl-3 text-right font-semibold">{cmpLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {linhasSetor.map((p, i) => (
                  <tr key={p.empresaCodigo} className={rowCls(!!onPosto)} onClick={() => onPosto?.(p.empresaCodigo)} title={onPosto ? 'Ver o resumo do posto' : undefined}>
                    <td className="py-2 pr-3"><span className="inline-flex items-center gap-1.5 font-medium"><span className="w-4 text-right tabular-nums text-gray-400">{i + 1}</span>{p.posto}{i === 0 && <Trophy className="h-3.5 w-3.5 text-amber-500" />}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums">{setor === 'combustivel' ? formatLiters(p.qtd) : formatNumber(Math.round(p.qtd))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(p.faturamento)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrencyInt(p.lucroBruto)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pctFmt(p.margem, 2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(p.lbPorUnidade)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-1.5 w-12 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><span className="block h-full rounded-full bg-[#1e3a5f] dark:bg-blue-500" style={{ width: `${totalLb > 0 ? Math.max(2, (p.lucroBruto / totalLb) * 100) : 0}%` }} /></span>
                        <span className="w-10 text-right tabular-nums text-gray-500">{pctFmt(totalLb > 0 ? (p.lucroBruto / totalLb) * 100 : 0)}</span>
                      </span>
                    </td>
                    <td className="py-2 pl-3 text-right"><Delta value={varPct(p.lucroBruto, p.lucroBrutoAnoAnterior)} label="" /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 text-[12px] font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                <tr>
                  <td className="py-2 pr-3">Rede</td>
                  <td className="px-3 py-2 text-right tabular-nums">{setor === 'combustivel' ? formatLiters(obj.qtd) : formatNumber(Math.round(obj.qtd))}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(obj.faturamento)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(obj.lucroBruto)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pctFmt(obj.margem, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(obj.lucroPorUnidade)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">100%</td>
                  <td className="py-2 pl-3 text-right"><Delta value={varPct(obj.lucroBruto, obj.lucroBrutoAnoAnterior)} label="" /></td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <table className="w-full min-w-[640px] text-[12px]">
              <thead className="sticky top-0 bg-white text-[10px] uppercase tracking-wider text-gray-400 dark:bg-gray-900">
                <tr>
                  <th className="py-2 pr-3 text-left font-semibold">Posto</th>
                  <th className="px-3 py-2 text-right font-semibold">L.B. Combustível</th>
                  <th className="px-3 py-2 text-right font-semibold">L.B. Automotivos</th>
                  <th className="px-3 py-2 text-right font-semibold">L.B. Conveniência</th>
                  <th className="px-3 py-2 text-right font-semibold">Lucro bruto</th>
                  <th className="px-3 py-2 text-right font-semibold">Faturamento</th>
                  <th className="px-3 py-2 text-right font-semibold">Margem</th>
                  <th className="px-3 py-2 text-right font-semibold">Fatia</th>
                  <th className="py-2 pl-3 text-right font-semibold">{cmpLabel}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {linhasGlobal.map((p, i) => (
                  <tr key={p.empresaCodigo} className={rowCls(!!onPosto)} onClick={() => onPosto?.(p.empresaCodigo)} title={onPosto ? 'Ver o resumo do posto' : undefined}>
                    <td className="py-2 pr-3"><span className="inline-flex items-center gap-1.5 font-medium"><span className="w-4 text-right tabular-nums text-gray-400">{i + 1}</span>{p.posto}{i === 0 && <Trophy className="h-3.5 w-3.5 text-amber-500" />}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(p.comb)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(p.auto)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(p.conv)}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatCurrencyInt(p.lb)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(p.fat)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pctFmt(p.fat > 0 ? (p.lb / p.fat) * 100 : 0, 2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{pctFmt(totalLb > 0 ? (p.lb / totalLb) * 100 : 0)}</td>
                    <td className="py-2 pl-3 text-right"><Delta value={varPct(p.lb, p.lbAnt)} label="" /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 text-[12px] font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
                <tr>
                  <td className="py-2 pr-3">Rede</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(rede.combustivel.lucroBruto)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(rede.automotivos.lucroBruto)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(rede.conveniencia.lucroBruto)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(rede.global.lucroBruto)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrencyInt(rede.global.faturamento)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pctFmt(rede.global.margem, 2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">100%</td>
                  <td className="py-2 pl-3 text-right"><Delta value={varPct(rede.global.lucroBruto, rede.global.lucroBrutoAnoAnterior)} label="" /></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
        <footer className="border-t border-gray-100 px-6 py-3 text-[11px] text-gray-400 dark:border-gray-800">
          Ordenado por lucro bruto. Fatia = parte do posto no lucro bruto {setor === 'global' ? 'da rede' : 'do setor'}. {onPosto ? 'Clique num posto para ver o resumo dele.' : ''}
        </footer>
      </DialogContent>
    </Dialog>
  )
}

export default SetorPostosModal

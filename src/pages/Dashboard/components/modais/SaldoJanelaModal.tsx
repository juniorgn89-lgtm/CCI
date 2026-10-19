import { useMemo } from 'react'
import { ArrowDownLeft, ArrowUpRight, Scale, ArrowRight } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import type { ContaItem } from '@/pages/Dashboard/hooks/useContasResumo'
import { GUIAS } from '@/lib/guiasModais'
import { MODAL_CLS } from '@/pages/Dashboard/components/modais/util'

export interface SaldoSel {
  label: string
  hint: string
  entra: ContaItem[]
  sai: ContaItem[]
}

interface Props {
  sel: SaldoSel | null
  onClose: () => void
  /** Abre a lista título a título daquele lado (fecha este modal). */
  onVerLista: (lado: 'receber' | 'pagar') => void
}

interface Cat { label: string; total: number; count: number }
interface Lado { total: number; count: number; cats: Cat[]; nomes: Cat[] }

const agrupar = (itens: ContaItem[]): Lado => {
  const cats = new Map<string, Cat>()
  const nomes = new Map<string, Cat>()
  let total = 0
  for (const i of itens) {
    total += i.valor
    const c = cats.get(i.catLabel) ?? { label: i.catLabel, total: 0, count: 0 }
    c.total += i.valor; c.count++; cats.set(i.catLabel, c)
    const n = nomes.get(i.nome) ?? { label: i.nome, total: 0, count: 0 }
    n.total += i.valor; n.count++; nomes.set(i.nome, n)
  }
  const ord = (m: Map<string, Cat>) => [...m.values()].sort((a, b) => b.total - a.total)
  return { total, count: itens.length, cats: ord(cats), nomes: ord(nomes).slice(0, 3) }
}

const Coluna = ({ lado, dados, Icon, titulo, cor, bar, max, onVerLista }: { lado: 'receber' | 'pagar'; dados: Lado; Icon: typeof ArrowDownLeft; titulo: string; cor: string; bar: string; max: number; onVerLista: (lado: 'receber' | 'pagar') => void }) => (
  <section className="min-w-0 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
    <header className="flex items-center justify-between gap-2">
      <p className={cn('inline-flex items-center gap-1.5 text-[12px] font-semibold', cor)}><Icon className="h-4 w-4" /> {titulo}</p>
      <p className="text-right">
        <span className="block text-[18px] font-extrabold tabular-nums leading-tight text-gray-900 dark:text-gray-100">{formatCurrencyInt(dados.total)}</span>
        <span className="text-[10px] text-gray-400">{dados.count} {dados.count === 1 ? 'título' : 'títulos'}</span>
      </p>
    </header>
    <ul className="mt-3 space-y-2">
      {dados.cats.length === 0 && <li className="text-[11px] text-gray-400">Nada neste horizonte.</li>}
      {dados.cats.map((c) => (
        <li key={c.label} className="text-[12px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-700 dark:text-gray-200">{c.label} <span className="text-[10px] text-gray-400">{c.count}</span></span>
            <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(c.total)}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className={cn('h-full rounded-full', bar)} style={{ width: `${Math.max(2, (c.total / max) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
    {dados.nomes.length > 0 && (
      <div className="mt-3 border-t border-gray-100 pt-2 dark:border-gray-800">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Maiores nomes</p>
        <ul className="mt-1 space-y-0.5">
          {dados.nomes.map((n) => (
            <li key={n.label} className="flex items-center justify-between gap-2 text-[11.5px]">
              <span className="truncate text-gray-600 dark:text-gray-300">{n.label}</span>
              <span className="shrink-0 tabular-nums text-gray-800 dark:text-gray-100">{formatCurrencyInt(n.total)}</span>
            </li>
          ))}
        </ul>
      </div>
    )}
    {dados.count > 0 && (
      <button type="button" onClick={() => onVerLista(lado)} className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#1e3a5f] hover:underline dark:text-blue-300">
        Ver os {dados.count} títulos <ArrowRight className="h-3.5 w-3.5" />
      </button>
    )}
  </section>
)

/** Entra × sai por categoria, num horizonte do "Saldo da janela" (Central). */
const SaldoJanelaModal = ({ sel, onClose, onVerLista }: Props) => {
  const entra = useMemo(() => agrupar(sel?.entra ?? []), [sel])
  const sai = useMemo(() => agrupar(sel?.sai ?? []), [sel])
  if (!sel) return null
  const saldo = entra.total - sai.total
  const ok = saldo >= 0
  const max = Math.max(entra.cats[0]?.total ?? 0, sai.cats[0]?.total ?? 0, 1)

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent guia={GUIAS.saldoJanela} className={MODAL_CLS}>
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a5f]/[0.07] text-[#1e3a5f] dark:bg-white/10 dark:text-blue-300"><Scale className="h-4 w-4" /></span>
            Saldo da janela · {sel.label}
          </DialogTitle>
          <DialogDescription>{sel.hint}</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-4">
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.04]">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Saldo</p>
              <p className={cn('text-[24px] font-extrabold tabular-nums leading-tight', ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>{ok ? '+' : '−'}{formatCurrencyInt(Math.abs(saldo))}</p>
            </div>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">
              entra <b className="tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrencyInt(entra.total)}</b> · sai <b className="tabular-nums text-rose-600 dark:text-rose-400">{formatCurrencyInt(sai.total)}</b>
              <span className="block text-[11px]">{ok ? 'O que entra cobre o que sai neste horizonte.' : 'O que entra não cobre o que sai: falta caixa para este horizonte.'}</span>
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Coluna lado="receber" dados={entra} Icon={ArrowDownLeft} titulo="Entra · a receber" cor="text-emerald-600 dark:text-emerald-400" bar="bg-emerald-500" max={max} onVerLista={onVerLista} />
            <Coluna lado="pagar" dados={sai} Icon={ArrowUpRight} titulo="Sai · a pagar" cor="text-rose-600 dark:text-rose-400" bar="bg-rose-500" max={max} onVerLista={onVerLista} />
          </div>
        </div>
        <footer className="border-t border-gray-100 px-6 py-3 text-[11px] text-gray-400 dark:border-gray-800">
          A receber inclui clientes e cartões/apps líquidos de taxa; a pagar inclui títulos abertos e parciais pelo saldo. Fonte: pendentes no ERP.
        </footer>
      </DialogContent>
    </Dialog>
  )
}

export default SaldoJanelaModal

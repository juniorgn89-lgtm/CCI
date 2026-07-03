import { useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import type { PayableRow } from '@/pages/Financeiro/hooks/useFinanceData'

interface Props {
  open: boolean
  onClose: () => void
  /** Dia de vencimento (yyyy-MM-dd) da linha clicada. */
  dia: string
  /** Títulos a pagar em aberto que vencem nesse dia. */
  titulos: PayableRow[]
}

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const onlyDate = (s: string) => (s ?? '').split('T')[0]
const brDate = (iso: string) => (iso ? onlyDate(iso).split('-').reverse().join('/') : '—')
const diaNome = (iso: string) => {
  const [y, m, d] = onlyDate(iso).split('-').map(Number)
  return DIAS_SEMANA[new Date(y, m - 1, d).getDay()]
}
const getStr = (r: PayableRow, k: string) => (r as Record<string, unknown>)[k] as string | undefined
const nomeForn = (r: PayableRow) => r.nomeFornecedor?.trim() || `Fornecedor ${r.fornecedorCodigo}`
const numTitulo = (r: PayableRow) => getStr(r, 'numeroTitulo')?.trim() || `#${r.tituloPagarCodigo}`
const centroCusto = (r: PayableRow) => getStr(r, 'centroCustoDescricao')?.trim() || '—'
const categoria = (r: PayableRow) => getStr(r, 'planoContaGerencialDescricao')?.trim() || '—'

/** Detalhamento dos títulos a pagar que vencem num dia do calendário. */
const PagarDiaModal = ({ open, onClose, dia, titulos }: Props) => {
  const resumo = useMemo(() => {
    const total = titulos.reduce((s, r) => s + r.saldoRestante, 0)
    const fornecedores = new Set(titulos.map((r) => r.fornecedorCodigo)).size
    const vencido = titulos.some((r) => r.statusTag === 'vencido')
    const maxDias = titulos.reduce((mx, r) => Math.max(mx, r.statusTag === 'vencido' ? r.diasAtraso : 0), 0)
    return { total, fornecedores, vencido, maxDias }
  }, [titulos])

  const ord = useMemo(
    () => [...titulos].sort((a, b) => b.saldoRestante - a.saldoRestante),
    [titulos],
  )

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="tabular-nums">{brDate(dia)}</span>
            <span className="text-sm font-normal text-gray-400">{diaNome(dia)}</span>
            <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold', resumo.vencido
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400'
              : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400')}>
              {resumo.vencido ? 'Vencido' : 'A vencer'}
            </span>
          </DialogTitle>
          <DialogDescription>
            {titulos.length} título{titulos.length !== 1 ? 's' : ''} · {resumo.fornecedores} fornecedor{resumo.fornecedores !== 1 ? 'es' : ''} a pagar
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Chip label="A pagar no dia" value={formatCurrency(resumo.total)} tone="red" />
          <Chip label="Fornecedores" value={String(resumo.fornecedores)} />
          <Chip label="Maior atraso" value={resumo.maxDias > 0 ? `${resumo.maxDias} dias` : '—'} tone={resumo.maxDias > 0 ? 'red' : undefined} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800/60">
                <tr className="text-left text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2 font-medium">Fornecedor</th>
                  <th className="px-3 py-2 font-medium">Documento</th>
                  <th className="px-3 py-2 font-medium">Emissão</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                  <th className="px-3 py-2 text-right font-medium">Dias atraso</th>
                  <th className="px-3 py-2 font-medium">Centro de custo</th>
                  <th className="px-3 py-2 font-medium">Categoria</th>
                  <th className="px-3 py-2 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {ord.map((r) => {
                  const doc = getStr(r, 'cpfCnpjFornecedor')
                  return (
                    <tr key={r.codigo} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40">
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-800 dark:text-gray-200">{nomeForn(r)}</p>
                        {doc && <p className="text-[10px] tabular-nums text-gray-400">{doc}</p>}
                      </td>
                      <td className="px-3 py-2 font-medium tabular-nums text-gray-700 dark:text-gray-300">{numTitulo(r)}</td>
                      <td className="px-3 py-2 tabular-nums text-gray-500 dark:text-gray-400">{brDate(r.dataMovimento)}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(r.saldoRestante)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">{r.diasAtraso > 0 ? `${r.diasAtraso}d` : '—'}</td>
                      <td className="max-w-[140px] truncate px-3 py-2 text-gray-500 dark:text-gray-400" title={centroCusto(r)}>{centroCusto(r)}</td>
                      <td className="max-w-[160px] truncate px-3 py-2 text-gray-500 dark:text-gray-400" title={categoria(r)}>{categoria(r)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold', r.statusTag === 'vencido'
                          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400'
                          : 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400')}>
                          {r.statusTag === 'vencido' ? 'Vencido' : 'A vencer'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const Chip = ({ label, value, tone }: { label: string; value: string; tone?: 'red' }) => (
  <div className="rounded-lg border border-gray-200 p-2.5 dark:border-gray-700">
    <p className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
    <p className={cn('mt-0.5 text-sm font-bold tabular-nums', tone === 'red' ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100')}>{value}</p>
  </div>
)

export default PagarDiaModal

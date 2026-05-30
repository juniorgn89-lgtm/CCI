import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { fmt } from './formatters'

interface DiferencaEncerrantesProps {
  fator: number
  empresaNome: string
  empresaCnpj: string
  /** Diferença total (Lt) a distribuir no 1º produto. Default 0 (encerrante == venda). */
  diferencaLt?: number
  /** Texto do período no cabeçalho. Default: intervalo mock. */
  periodoLabel?: string
}

interface EncerranteRow {
  ref: string
  produto: string
  encerrante: number
  venda: number
}

const baseRows: EncerranteRow[] = [
  { ref: '000001', produto: 'GASOLINA COMUM', encerrante: 4441.17, venda: 4441.17 },
  { ref: '000002', produto: 'ETANOL COMUM', encerrante: 1898.21, venda: 1898.21 },
  { ref: '000003', produto: 'DIESEL S-10', encerrante: 820.05, venda: 820.05 },
  { ref: '000004', produto: 'GASOLINA ADITIVADA', encerrante: 387.36, venda: 387.36 },
]

const DiferencaEncerrantes = ({
  fator,
  empresaNome,
  empresaCnpj,
  diferencaLt = 0,
  periodoLabel = 'Data Inicial: 19/05/2026 · Data Final: 19/05/2026',
}: DiferencaEncerrantesProps) => {
  // Linha destacada — útil pra comparar encerrante x venda entre produtos
  const [selected, setSelected] = useState<string | null>(null)
  const toggleSelected = (ref: string) => {
    setSelected((curr) => (curr === ref ? null : ref))
  }
  const rows = useMemo(
    () =>
      baseRows.map((r, i) => {
        const venda = r.venda * fator
        // A diferença total (Lt) é aplicada no 1º produto pra bater com o
        // indicador agregado de quem chama (ex.: ranking da rede).
        const encerrante = r.encerrante * fator + (i === 0 ? diferencaLt : 0)
        return { ...r, encerrante, venda, diferenca: encerrante - venda }
      }),
    [fator, diferencaLt],
  )

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Cabeçalho do relatório */}
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 dark:border-gray-700 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Diferença Encerrantes</h2>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {periodoLabel}
            </p>
          </div>
        </div>
        <div className="text-left md:text-right">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{empresaNome || '—'}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">{empresaCnpj || '—'}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">21/05/2026 12:13:51 BRT</p>
        </div>
      </div>

      <section className="mt-6">
        <div className="rounded-t-md border border-b-0 border-gray-200 bg-gray-100 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
          Conferência de Encerrantes
        </div>
        <div className="overflow-x-auto rounded-b-md border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                <th className="px-4 py-2 text-left">Ref.</th>
                <th className="px-4 py-2 text-left">Produto</th>
                <th className="px-4 py-2 text-right">Encerrante (Lt)</th>
                <th className="px-4 py-2 text-right">Venda (Lt)</th>
                <th className="px-4 py-2 text-right">Diferença (Lt)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const rowSelected = selected === r.ref
                return (
                <tr
                  key={r.ref}
                  onClick={() => toggleSelected(r.ref)}
                  aria-selected={rowSelected}
                  className={cn(
                    'cursor-pointer border-b border-gray-100 text-gray-800 transition-colors last:border-b-0 dark:border-gray-800 dark:text-gray-200',
                    rowSelected
                      ? 'bg-amber-100 hover:bg-amber-200/70 dark:bg-amber-900/30 dark:hover:bg-amber-900/40'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                  )}
                >
                  <td className="px-4 py-2 text-left tabular-nums">{r.ref}</td>
                  <td className="px-4 py-2 text-left">{r.produto}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(r.encerrante)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(r.venda)}</td>
                  <td
                    className={cn(
                      'px-4 py-2 text-right tabular-nums',
                      r.diferenca === 0
                        ? 'text-gray-400 dark:text-gray-500'
                        : 'font-semibold text-red-700 dark:text-red-400',
                    )}
                  >
                    {fmt(r.diferenca)}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default DiferencaEncerrantes

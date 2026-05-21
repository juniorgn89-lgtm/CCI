import { useMemo } from 'react'
import BarCell from '@/components/tables/BarCell'
import { cn } from '@/lib/utils'
import { fmt } from './formatters'

interface SobrasFaltasProps {
  fator: number
}

interface SobraFaltaRow {
  data: string
  turno: string
  pdv: string
  sobra: number
  falta: number
  diferenca: number
  acumulado: number
}

interface ResponsavelGroup {
  codigo: string
  rows: SobraFaltaRow[]
}

const baseGroups: ResponsavelGroup[] = [
  {
    codigo: '00069 - CRISTIELE MAURICIO ALVES',
    rows: [
      { data: '19/05/2026', turno: '1', pdv: '008 - PDV CONVENIENCIA', sobra: 2.48, falta: 0, diferenca: 2.48, acumulado: 2.48 },
      { data: '19/05/2026', turno: '1', pdv: '008 - PDV CONVENIENCIA', sobra: 0.6, falta: 0, diferenca: 0.6, acumulado: 0.6 },
      { data: '19/05/2026', turno: '1', pdv: '008 - PDV CONVENIENCIA', sobra: 0.56, falta: 0, diferenca: 0.56, acumulado: 0.56 },
    ],
  },
  {
    codigo: '00077 - JEAN REIS',
    rows: [
      { data: '19/05/2026', turno: '1', pdv: '001 - PDV', sobra: 0, falta: -71.32, diferenca: -71.32, acumulado: -71.32 },
      { data: '19/05/2026', turno: '1', pdv: '001 - PDV', sobra: 1.16, falta: 0, diferenca: 1.16, acumulado: 1.16 },
      { data: '19/05/2026', turno: '1', pdv: '001 - PDV', sobra: 0, falta: -0.88, diferenca: -0.88, acumulado: -0.88 },
      { data: '19/05/2026', turno: '1', pdv: '001 - PDV', sobra: 0, falta: -0.6, diferenca: -0.6, acumulado: -0.6 },
      { data: '19/05/2026', turno: '1', pdv: '001 - PDV', sobra: 0, falta: -1.36, diferenca: -1.36, acumulado: -1.36 },
      { data: '19/05/2026', turno: '1', pdv: '001 - PDV', sobra: 0.92, falta: 0, diferenca: 0.92, acumulado: 0.92 },
    ],
  },
]

const colorDiff = (v: number) =>
  v > 0
    ? 'text-emerald-700 dark:text-emerald-400'
    : v < 0
      ? 'text-red-700 dark:text-red-400'
      : 'text-gray-400 dark:text-gray-500'

const SobrasFaltas = ({ fator }: SobrasFaltasProps) => {
  const { groups, filialTotals, geralTotals, maxSobra, maxFalta, maxDiff } = useMemo(() => {
    const scale = (n: number) => n * fator

    const groups = baseGroups.map((g) => {
      const rows = g.rows.map((r) => ({
        ...r,
        sobra: scale(r.sobra),
        falta: scale(r.falta),
        diferenca: scale(r.diferenca),
        acumulado: scale(r.acumulado),
      }))
      const subtotal = rows.reduce(
        (acc, r) => ({
          sobra: acc.sobra + r.sobra,
          falta: acc.falta + r.falta,
          diferenca: acc.diferenca + r.diferenca,
        }),
        { sobra: 0, falta: 0, diferenca: 0 },
      )
      return { codigo: g.codigo, rows, subtotal }
    })

    const filialTotals = groups.reduce(
      (acc, g) => ({
        sobra: acc.sobra + g.subtotal.sobra,
        falta: acc.falta + g.subtotal.falta,
        diferenca: acc.diferenca + g.subtotal.diferenca,
      }),
      { sobra: 0, falta: 0, diferenca: 0 },
    )

    const geralTotals = filialTotals

    const allRows = groups.flatMap((g) => g.rows)
    const maxSobra = allRows.reduce((m, r) => Math.max(m, r.sobra), 0)
    const maxFalta = allRows.reduce((m, r) => Math.max(m, Math.abs(r.falta)), 0)
    const maxDiff = allRows.reduce((m, r) => Math.max(m, Math.abs(r.diferenca)), 0)

    return { groups, filialTotals, geralTotals, maxSobra, maxFalta, maxDiff }
  }, [fator])

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Cabeçalho do relatório */}
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 dark:border-gray-700 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="inline-flex w-fit items-center rounded-md bg-gray-900 px-2.5 py-1 text-xs font-bold tracking-wide text-white dark:bg-gray-100 dark:text-gray-900">
            autobem
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Sobras e Faltas</h2>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              Data Inicial: 19/05/2026 · Data Final: 19/05/2026 · Valores: Ambos · Agrupamento: Responsável · Tipo: Analítico
            </p>
          </div>
        </div>
        <div className="text-left md:text-right">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">POSTO ITAPOA</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">31.465.040/0001-32</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">21/05/2026 12:13:51 BRT</p>
        </div>
      </div>

      <section className="mt-6 space-y-6">
        {/* Filial band */}
        <div className="rounded-t-md border border-b-0 border-gray-200 bg-gray-200 px-4 py-2 text-sm font-bold uppercase tracking-wide text-gray-800 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100">
          Filial: POSTO ITAPOA
        </div>

        {groups.map((g) => (
          <div key={g.codigo}>
            <div className="rounded-t-md border border-b-0 border-gray-200 bg-gray-100 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
              Responsável: {g.codigo}
            </div>
            <div className="overflow-x-auto rounded-b-md border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    <th className="px-4 py-2 text-left">Data</th>
                    <th className="px-4 py-2 text-left">Turno</th>
                    <th className="px-4 py-2 text-left">PDV</th>
                    <th className="px-4 py-2 text-right">Sobra (R$)</th>
                    <th className="px-4 py-2 text-right">Falta (R$)</th>
                    <th className="px-4 py-2 text-right">Diferença (R$)</th>
                    <th className="px-4 py-2 text-right">Acumulado (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r, idx) => (
                    <tr
                      key={`${g.codigo}-${idx}`}
                      className="border-b border-gray-100 text-gray-800 last:border-b-0 dark:border-gray-800 dark:text-gray-200"
                    >
                      <td className="px-4 py-2 text-left">{r.data}</td>
                      <td className="px-4 py-2 text-left">{r.turno}</td>
                      <td className="px-4 py-2 text-left">{r.pdv}</td>
                      <td className="px-2 py-1.5">
                        {r.sobra > 0 ? (
                          <BarCell value={r.sobra} max={maxSobra} formatted={fmt(r.sobra)} color="green" align="near" />
                        ) : (
                          <div className="px-1.5 text-right tabular-nums text-gray-400 dark:text-gray-500">{fmt(0)}</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {r.falta < 0 ? (
                          <BarCell
                            value={Math.abs(r.falta)}
                            max={maxFalta}
                            formatted={fmt(r.falta)}
                            color="red"
                            align="near"
                          />
                        ) : (
                          <div className="px-1.5 text-right tabular-nums text-gray-400 dark:text-gray-500">{fmt(0)}</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        {r.diferenca !== 0 ? (
                          <BarCell
                            value={Math.abs(r.diferenca)}
                            max={maxDiff}
                            formatted={fmt(r.diferenca)}
                            color={r.diferenca >= 0 ? 'green' : 'red'}
                            align="near"
                          />
                        ) : (
                          <div className="px-1.5 text-right tabular-nums text-gray-400 dark:text-gray-500">{fmt(0)}</div>
                        )}
                      </td>
                      <td className={cn('px-4 py-2 text-right tabular-nums', colorDiff(r.acumulado))}>
                        {fmt(r.acumulado)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-gray-300 bg-gray-50 font-bold text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                    <td className="px-4 py-2 text-left" colSpan={3}>
                      Subtotal:
                    </td>
                    <td className={cn('px-4 py-2 text-right tabular-nums', colorDiff(g.subtotal.sobra))}>{fmt(g.subtotal.sobra)}</td>
                    <td className={cn('px-4 py-2 text-right tabular-nums', colorDiff(g.subtotal.falta))}>{fmt(g.subtotal.falta)}</td>
                    <td className={cn('px-4 py-2 text-right tabular-nums', colorDiff(g.subtotal.diferenca))}>
                      {fmt(g.subtotal.diferenca)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-400 dark:text-gray-500">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Total Filial */}
        <div>
          <div className="rounded-t-md border border-b-0 border-gray-200 bg-gray-100 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
            Total Filial
          </div>
          <div className="overflow-x-auto rounded-b-md border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <tbody>
                <tr className="bg-gray-50 font-bold text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                  <td className="px-4 py-2 text-left">POSTO ITAPOA</td>
                  <td className={cn('px-4 py-2 text-right tabular-nums', colorDiff(filialTotals.sobra))}>{fmt(filialTotals.sobra)}</td>
                  <td className={cn('px-4 py-2 text-right tabular-nums', colorDiff(filialTotals.falta))}>{fmt(filialTotals.falta)}</td>
                  <td className={cn('px-4 py-2 text-right tabular-nums', colorDiff(filialTotals.diferenca))}>
                    {fmt(filialTotals.diferenca)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Total Geral */}
        <div>
          <div className="rounded-t-md border border-b-0 border-gray-200 bg-gray-200 px-4 py-2 text-sm font-bold uppercase tracking-wide text-gray-800 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100">
            Total Geral
          </div>
          <div className="overflow-x-auto rounded-b-md border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <tbody>
                <tr className="bg-gray-100 font-bold text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                  <td className="px-4 py-2 text-left">Geral</td>
                  <td className={cn('px-4 py-2 text-right tabular-nums', colorDiff(geralTotals.sobra))}>{fmt(geralTotals.sobra)}</td>
                  <td className={cn('px-4 py-2 text-right tabular-nums', colorDiff(geralTotals.falta))}>{fmt(geralTotals.falta)}</td>
                  <td className={cn('px-4 py-2 text-right tabular-nums', colorDiff(geralTotals.diferenca))}>
                    {fmt(geralTotals.diferenca)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

export default SobrasFaltas

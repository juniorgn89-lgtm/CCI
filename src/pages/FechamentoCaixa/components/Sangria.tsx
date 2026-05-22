import { useMemo, useState } from 'react'
import BarCell from '@/components/tables/BarCell'
import SangriaDetailModal, { type SangriaLancamento } from './SangriaDetailModal'
import { fmt } from './formatters'

interface SangriaProps {
  fator: number
}

interface FuncionarioRow {
  nome: string
  dinheiro: number
}

const baseRows: FuncionarioRow[] = [
  { nome: 'ANDERSON DE OLIVEIRA MENDES', dinheiro: 821 },
  { nome: 'CRISTIELE MAURICIO ALVES', dinheiro: 171 },
  { nome: 'DERMEVAL SANTANA', dinheiro: 367 },
  { nome: 'GILVONEY SANTOS BONFIM', dinheiro: 1237 },
  { nome: 'ITALO MATEUS ROSA GARCIA', dinheiro: 1942 },
  { nome: 'IVANILDO DA SILVA', dinheiro: 1963 },
  { nome: 'JEAN REIS', dinheiro: 322 },
  { nome: 'KEILA MADUREIRA FRANCISCO', dinheiro: 495 },
  { nome: 'MAILANE DE JESUS SALES', dinheiro: 213 },
  { nome: 'WALACE ALBERTO FERREIRA', dinheiro: 700 },
]

// Mock — lançamentos individuais por funcionário (proporções somam 1.0).
// O valor real é calculado em runtime: pct * total do funcionário (já escalado
// pelo fator dos caixas selecionados).
const baseLancamentos: Record<string, SangriaLancamento[]> = {
  'ANDERSON DE OLIVEIRA MENDES': [
    { hora: '10:23', forma: 'Dinheiro', pct: 0.4, obs: 'Troco do cofre' },
    { hora: '16:48', forma: 'Dinheiro', pct: 0.6 },
  ],
  'CRISTIELE MAURICIO ALVES': [
    { hora: '15:30', forma: 'Dinheiro', pct: 1.0 },
  ],
  'DERMEVAL SANTANA': [
    { hora: '09:12', forma: 'Dinheiro', pct: 0.55 },
    { hora: '14:05', forma: 'Dinheiro', pct: 0.45 },
  ],
  'GILVONEY SANTOS BONFIM': [
    { hora: '08:45', forma: 'Dinheiro', pct: 0.32 },
    { hora: '13:20', forma: 'Dinheiro', pct: 0.40, obs: 'Reposição troco' },
    { hora: '19:10', forma: 'Dinheiro', pct: 0.28 },
  ],
  'ITALO MATEUS ROSA GARCIA': [
    { hora: '10:05', forma: 'Dinheiro', pct: 0.28 },
    { hora: '14:30', forma: 'Dinheiro', pct: 0.35 },
    { hora: '18:00', forma: 'Dinheiro', pct: 0.20 },
    { hora: '21:45', forma: 'Dinheiro', pct: 0.17, obs: 'Final de turno' },
  ],
  'IVANILDO DA SILVA': [
    { hora: '09:30', forma: 'Dinheiro', pct: 0.30 },
    { hora: '13:15', forma: 'Dinheiro', pct: 0.40 },
    { hora: '17:50', forma: 'Dinheiro', pct: 0.30 },
  ],
  'JEAN REIS': [
    { hora: '11:40', forma: 'Dinheiro', pct: 1.0 },
  ],
  'KEILA MADUREIRA FRANCISCO': [
    { hora: '10:55', forma: 'Dinheiro', pct: 0.6 },
    { hora: '16:20', forma: 'Dinheiro', pct: 0.4 },
  ],
  'MAILANE DE JESUS SALES': [
    { hora: '14:10', forma: 'Dinheiro', pct: 1.0 },
  ],
  'WALACE ALBERTO FERREIRA': [
    { hora: '09:00', forma: 'Dinheiro', pct: 0.5 },
    { hora: '15:35', forma: 'Dinheiro', pct: 0.5 },
  ],
}

const otherCols = [
  'Cheque',
  'Cheque Pré',
  'Cartão',
  'Nota',
  'Transferência',
  'Carta Frete',
  'Empréstimo',
  'Despesa',
  'Vale',
] as const

const Sangria = ({ fator }: SangriaProps) => {
  const [selectedFunc, setSelectedFunc] = useState<{ nome: string; total: number } | null>(null)

  const { rows, total, maxDinheiro } = useMemo(() => {
    const rows = baseRows.map((r) => ({ ...r, dinheiro: r.dinheiro * fator }))
    const total = rows.reduce((acc, r) => acc + r.dinheiro, 0)
    const maxDinheiro = rows.reduce((m, r) => Math.max(m, r.dinheiro), 0)
    return { rows, total, maxDinheiro }
  }, [fator])

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Cabeçalho do relatório */}
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 dark:border-gray-700 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Sangria</h2>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              Filtro por Período · Data Inicial: 20/05/2026 · Data Final: 21/05/2026 · Agrupar por: Funcionário · Tipo: Sintético
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
        {rows.map((row) => (
          <div key={row.nome}>
            <button
              type="button"
              onClick={() => setSelectedFunc({ nome: row.nome, total: row.dinheiro })}
              className="flex w-full items-center justify-between rounded-t-md border border-b-0 border-gray-200 bg-gray-100 px-4 py-2 text-left transition-colors hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-blue-900/20"
            >
              <span className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
                {row.nome}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Ver lançamentos →
              </span>
            </button>
            <div className="overflow-x-auto rounded-b-md border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                    <th className="px-4 py-2 text-right">Dinheiro (R$)</th>
                    {otherCols.map((c) => (
                      <th key={c} className="px-4 py-2 text-right">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-gray-800 dark:text-gray-200">
                    <td className="px-2 py-1.5">
                      <BarCell
                        value={row.dinheiro}
                        max={maxDinheiro}
                        formatted={fmt(row.dinheiro)}
                        color="blue"
                        align="near"
                      />
                    </td>
                    {otherCols.map((c) => (
                      <td key={c} className="px-4 py-2 text-right tabular-nums text-gray-400 dark:text-gray-500">
                        {fmt(0)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {/* Totais */}
        <div>
          <div className="rounded-t-md border border-b-0 border-gray-200 bg-gray-100 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
            Totais
          </div>
          <div className="overflow-x-auto rounded-b-md border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                  <th className="px-4 py-2 text-right">Dinheiro (R$)</th>
                  {otherCols.map((c) => (
                    <th key={c} className="px-4 py-2 text-right">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="bg-gray-50 font-bold text-gray-900 dark:bg-gray-800 dark:text-gray-100">
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(total)}</td>
                  {otherCols.map((c) => (
                    <td key={c} className="px-4 py-2 text-right tabular-nums text-gray-400 dark:text-gray-500">
                      {fmt(0)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <div className="mt-6 flex justify-end">
        <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          Quantidade sangria efetuada: 27
        </span>
      </div>

      <SangriaDetailModal
        open={!!selectedFunc}
        onClose={() => setSelectedFunc(null)}
        funcionario={selectedFunc?.nome ?? null}
        total={selectedFunc?.total ?? 0}
        lancamentos={selectedFunc ? (baseLancamentos[selectedFunc.nome] ?? []) : []}
      />
    </div>
  )
}

export default Sangria

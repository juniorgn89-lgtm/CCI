import { useMemo, useState } from 'react'
import BarCell from '@/components/tables/BarCell'
import { cn } from '@/lib/utils'
import { fmt } from './formatters'
import SobrasFaltasDetailModal, { type SobrasFaltasDetail } from './SobrasFaltasDetailModal'

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

// Mock de detalhes por linha — em produção viria de /CAIXA + caixa_alteracoes.
// Indexado pela combinação responsavel + idx da linha.
const buildDetail = (
  responsavel: string,
  row: { data: string; turno: string; pdv: string; sobra: number; falta: number; diferenca: number },
  idx: number,
): SobrasFaltasDetail => {
  const [dia, mes, ano] = row.data.split('/')
  const baseDate = `${ano}-${mes}-${dia}`
  // Hora derivada do idx pra dar variação determinística.
  const horas = [8, 10, 13, 16, 19, 22]
  const h = horas[idx % horas.length]
  const abertura = `${baseDate}T0${row.turno}:18:00Z`
  const fechamento = `${baseDate}T${String(h).padStart(2, '0')}:${30 + idx * 7}:00Z`

  // Composição: vendas plausíveis baseadas na diferença, + sangria/suprimento
  const vendas = 4200 + idx * 380 + Math.abs(row.diferenca) * 5
  const sangria = 320 + idx * 80
  const suprimento = 200
  const contagem = vendas + suprimento - sangria - row.diferenca

  // Histórico de alterações: rows com diferença significativa (|valor| > 50)
  // ganham narrativa completa de investigação. Pequenas alterações em alguns
  // rows pra mostrar variedade. Outros ficam sem alteração.
  const isSignificant = Math.abs(row.diferenca) > 50
  const nextDay = `${ano}-${mes}-${String(Number(dia) + 1).padStart(2, '0')}`

  const alteracoes = isSignificant
    ? [
      {
        quando: `${baseDate}T${String(h).padStart(2, '0')}:30:00Z`,
        quem: 'Sistema (Quality)',
        campo: 'Fechado',
        de: 'Não',
        para: 'Sim',
      },
      {
        quando: `${nextDay}T08:45:00Z`,
        quem: 'Maria Souza (Gerente)',
        campo: 'Bloqueado',
        de: 'Não',
        para: 'Sim · Investigação',
      },
      {
        quando: `${nextDay}T10:12:00Z`,
        quem: 'Maria Souza (Gerente)',
        campo: 'Apurado',
        de: `R$ ${fmt(vendas + suprimento - sangria + 20)}`,
        para: `R$ ${fmt(vendas + suprimento - sangria)}`,
      },
      {
        quando: `${nextDay}T10:12:00Z`,
        quem: 'Sistema (Quality)',
        campo: 'Diferença',
        de: `R$ ${fmt(row.diferenca - 20)}`,
        para: `R$ ${fmt(row.diferenca)}`,
      },
      {
        quando: `${nextDay}T10:15:00Z`,
        quem: 'Maria Souza (Gerente)',
        campo: 'Observação',
        de: '—',
        para: 'Falta acima do limite — operador relatou problema na maquininha de cartão',
      },
      {
        quando: `${nextDay}T10:16:00Z`,
        quem: 'Maria Souza (Gerente)',
        campo: 'Bloqueado',
        de: 'Sim · Investigação',
        para: 'Não',
      },
      {
        quando: `${nextDay}T11:00:00Z`,
        quem: 'Sistema (Quality)',
        campo: 'Consolidado',
        de: 'Não',
        para: 'Sim',
      },
    ]
    : idx % 3 === 1
      ? [
        {
          quando: `${baseDate}T${String(h + 1).padStart(2, '0')}:15:00Z`,
          quem: 'Sistema (Quality)',
          campo: 'Diferença',
          de: `R$ ${fmt(row.diferenca + (idx % 2 === 0 ? 12 : -8))}`,
          para: `R$ ${fmt(row.diferenca)}`,
        },
      ]
      : idx % 5 === 2
        ? [
          {
            quando: `${baseDate}T${String(h + 1).padStart(2, '0')}:05:00Z`,
            quem: 'João Almeida (Operador)',
            campo: 'Fechado',
            de: 'Não',
            para: 'Sim',
          },
          {
            quando: `${baseDate}T${String(h + 2).padStart(2, '0')}:40:00Z`,
            quem: 'Sistema (Quality)',
            campo: 'Apurado',
            de: `R$ ${fmt(vendas - 50)}`,
            para: `R$ ${fmt(vendas)}`,
          },
        ]
        : []

  const observacao = row.falta < -50
    ? 'Falta acima do limite — operador relatou problema na maquininha de cartão; conferir extrato.'
    : undefined

  return {
    responsavel,
    data: row.data,
    turno: row.turno,
    pdv: row.pdv,
    abertura,
    fechamento,
    fechado: true,
    consolidado: idx % 2 === 0,
    bloqueado: false,
    apurado: vendas + suprimento - sangria,
    sobra: row.sobra,
    falta: row.falta,
    diferenca: row.diferenca,
    observacao,
    composicao: { vendas, sangria, suprimento, contagem },
    alteracoes,
  }
}

const colorDiff = (v: number) =>
  v > 0
    ? 'text-emerald-700 dark:text-emerald-400'
    : v < 0
      ? 'text-red-700 dark:text-red-400'
      : 'text-gray-400 dark:text-gray-500'

const SobrasFaltas = ({ fator }: SobrasFaltasProps) => {
  const [selected, setSelected] = useState<SobrasFaltasDetail | null>(null)

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
            <div className="flex items-center justify-between rounded-t-md border border-b-0 border-gray-200 bg-gray-100 px-4 py-2 dark:border-gray-700 dark:bg-gray-800">
              <span className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-200">
                Responsável: {g.codigo}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                Clique numa linha pra ver detalhes e histórico
              </span>
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
                      onClick={() => setSelected(buildDetail(g.codigo, r, idx))}
                      className="cursor-pointer border-b border-gray-100 text-gray-800 transition-colors last:border-b-0 hover:bg-blue-50/60 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-blue-900/20"
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

      <SobrasFaltasDetailModal
        open={!!selected}
        onClose={() => setSelected(null)}
        detail={selected}
      />
    </div>
  )
}

export default SobrasFaltas

import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import BarCell from '@/components/tables/BarCell'
import { cn } from '@/lib/utils'
import { fmt } from './formatters'
import SobrasFaltasDetailModal, { type SobrasFaltasDetail } from './SobrasFaltasDetailModal'

type ValoresFilter = 'ambos' | 'sobras' | 'faltas'

interface SelectedCaixaInfo {
  id: string
  data: string
  turno: string
  pdv: string
}

interface SobrasFaltasProps {
  postoScale: number // diferenciação por posto (não muda com seleção)
  empresaNome: string
  empresaCnpj: string
  selectedCaixas: SelectedCaixaInfo[]
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

// Cada linha de sobra/falta é amarrada a UM caixa específico (caixaId).
// Selecionar caixas filtra quais linhas aparecem; valores são fixos.
interface PoolLinha {
  caixaId: string
  responsavel: string
  sobra: number
  falta: number
}

const pool: PoolLinha[] = [
  // 19/05/2026 — abertos (só entram se "Incluir abertos" marcado)
  { caixaId: '20260519-1-conv', responsavel: '00069 - CRISTIELE MAURICIO ALVES', sobra: 1.12, falta: 0 },
  { caixaId: '20260519-1-pista', responsavel: '00077 - JEAN REIS', sobra: 0, falta: -22.50 },
  // 18/05/2026
  { caixaId: '20260518-1-conv', responsavel: '00069 - CRISTIELE MAURICIO ALVES', sobra: 2.48, falta: 0 },
  { caixaId: '20260518-1-conv', responsavel: '00077 - JEAN REIS', sobra: 0, falta: -71.32 },
  { caixaId: '20260518-2-conv', responsavel: '00069 - CRISTIELE MAURICIO ALVES', sobra: 0.6, falta: 0 },
  { caixaId: '20260518-1-pista', responsavel: '00077 - JEAN REIS', sobra: 1.16, falta: 0 },
  { caixaId: '20260518-2-pista', responsavel: '00077 - JEAN REIS', sobra: 0, falta: -0.88 },
  // 17/05/2026
  { caixaId: '20260517-1-conv', responsavel: '00069 - CRISTIELE MAURICIO ALVES', sobra: 0.56, falta: 0 },
  { caixaId: '20260517-1-conv', responsavel: '00077 - JEAN REIS', sobra: 0, falta: -0.6 },
  { caixaId: '20260517-2-conv', responsavel: '00077 - JEAN REIS', sobra: 0, falta: -1.36 },
  { caixaId: '20260517-1-pista', responsavel: '00077 - JEAN REIS', sobra: 0.92, falta: 0 },
  // 16/05/2026
  { caixaId: '20260516-1-conv', responsavel: '00069 - CRISTIELE MAURICIO ALVES', sobra: 3.20, falta: 0 },
  { caixaId: '20260516-2-conv', responsavel: '00077 - JEAN REIS', sobra: 0, falta: -8.50 },
  { caixaId: '20260516-1-pista', responsavel: '00077 - JEAN REIS', sobra: 0, falta: -15.30 },
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

const SobrasFaltas = ({ postoScale, empresaNome, empresaCnpj, selectedCaixas }: SobrasFaltasProps) => {
  const [selected, setSelected] = useState<SobrasFaltasDetail | null>(null)
  const [valoresFilter, setValoresFilter] = useState<ValoresFilter>('ambos')

  const { groups, filialTotals, geralTotals, maxSobra, maxFalta, maxDiff } = useMemo(() => {
    // Index caixaId → metadados (data/turno/pdv) pra exibir nas linhas.
    const turnoShort = (t: string) => t.replace(/º\s*TURNO\s*/i, '').trim() || t
    const caixaById = new Map(selectedCaixas.map((c) => [c.id, c]))
    const selectedIds = new Set(selectedCaixas.map((c) => c.id))

    // Filtra pool pelos caixas selecionados. Cada linha tem valores REAIS (não
    // escalados pela quantidade de caixas). `postoScale` é aplicado pra
    // diferenciar postos (mesmo posto + mesmo caixa = mesmo valor sempre).
    const linhasFiltradas = pool.filter((l) => selectedIds.has(l.caixaId))

    // Agrupa por responsável e ordena por data desc, depois por caixaId.
    const porResp = new Map<string, Array<SobraFaltaRow>>()
    let acumPorResp: Record<string, number> = {}
    const ordenadas = [...linhasFiltradas].sort((a, b) => {
      const ca = caixaById.get(a.caixaId)
      const cb = caixaById.get(b.caixaId)
      if (!ca || !cb) return 0
      // dd/mm/yyyy → comparar como yyyymmdd
      const ka = ca.data.split('/').reverse().join('')
      const kb = cb.data.split('/').reverse().join('')
      return kb.localeCompare(ka) || a.caixaId.localeCompare(b.caixaId)
    })
    for (const l of ordenadas) {
      const caixa = caixaById.get(l.caixaId)
      if (!caixa) continue
      const sobra = l.sobra * postoScale
      const falta = l.falta * postoScale
      const diferenca = sobra + falta
      acumPorResp[l.responsavel] = (acumPorResp[l.responsavel] ?? 0) + diferenca
      const row: SobraFaltaRow = {
        data: caixa.data,
        turno: turnoShort(caixa.turno),
        pdv: caixa.pdv,
        sobra,
        falta,
        diferenca,
        acumulado: acumPorResp[l.responsavel],
      }
      if (!porResp.has(l.responsavel)) porResp.set(l.responsavel, [])
      porResp.get(l.responsavel)!.push(row)
    }

    const groups = Array.from(porResp.entries()).map(([codigo, rows]) => {
      const subtotal = rows.reduce(
        (acc, r) => ({
          sobra: acc.sobra + r.sobra,
          falta: acc.falta + r.falta,
          diferenca: acc.diferenca + r.diferenca,
        }),
        { sobra: 0, falta: 0, diferenca: 0 },
      )
      return { codigo, rows, subtotal }
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
  }, [postoScale, selectedCaixas])

  // Resumo dedicado às FALTAS (independente do filtro de exibição).
  const faltasSummary = useMemo(() => {
    const allRows = groups.flatMap((g) => g.rows.map((r) => ({ ...r, responsavel: g.codigo })))
    const faltasRows = allRows.filter((r) => r.falta < 0)
    const total = faltasRows.reduce((s, r) => s + r.falta, 0)
    const incidencias = faltasRows.length
    const maior = faltasRows.reduce(
      (acc, r) => (r.falta < acc.falta ? { falta: r.falta, responsavel: r.responsavel } : acc),
      { falta: 0, responsavel: '—' as string },
    )
    const porResp = new Map<string, number>()
    for (const r of faltasRows) porResp.set(r.responsavel, (porResp.get(r.responsavel) ?? 0) + r.falta)
    let topResp = '—'
    let topRespTotal = 0
    for (const [resp, t] of porResp) {
      if (t < topRespTotal) {
        topResp = resp
        topRespTotal = t
      }
    }
    return { total, incidencias, maior, topResp, topRespTotal }
  }, [groups])

  // Filtra os grupos pra exibição conforme `valoresFilter`.
  const displayGroups = useMemo(() => {
    if (valoresFilter === 'ambos') return groups
    return groups
      .map((g) => ({
        ...g,
        rows: g.rows.filter((r) => (valoresFilter === 'sobras' ? r.sobra > 0 : r.falta < 0)),
      }))
      .filter((g) => g.rows.length > 0)
  }, [groups, valoresFilter])

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
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{empresaNome || '—'}</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">{empresaCnpj || '—'}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">21/05/2026 12:13:51 BRT</p>
        </div>
      </div>

      {/* Resumo das faltas — strip horizontal compacto */}
      {faltasSummary.incidencias === 0 ? (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400">
          <AlertTriangle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          Sem faltas registradas no período.
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-md border border-red-200 bg-red-50/50 px-3 py-2 text-xs dark:border-red-900/40 dark:bg-red-900/10">
          <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">
            <AlertTriangle className="h-3.5 w-3.5" /> Faltas
          </span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="text-gray-600 dark:text-gray-400">
            Total{' '}
            <span className="font-semibold tabular-nums text-red-700 dark:text-red-400">
              R$ {fmt(faltasSummary.total)}
            </span>
          </span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="text-gray-600 dark:text-gray-400">
            <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">{faltasSummary.incidencias}</span>{' '}
            {faltasSummary.incidencias === 1 ? 'incidência' : 'incidências'}
          </span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="text-gray-600 dark:text-gray-400">
            Maior{' '}
            <span className="font-semibold tabular-nums text-red-700 dark:text-red-400">
              R$ {fmt(faltasSummary.maior.falta)}
            </span>{' '}
            <span className="text-gray-500 dark:text-gray-500" title={faltasSummary.maior.responsavel}>
              ({faltasSummary.maior.responsavel})
            </span>
          </span>
          <span className="text-gray-300 dark:text-gray-600">·</span>
          <span className="text-gray-600 dark:text-gray-400">
            Top{' '}
            <span className="font-semibold text-gray-900 dark:text-gray-100" title={faltasSummary.topResp}>
              {faltasSummary.topResp}
            </span>{' '}
            <span className="font-semibold tabular-nums text-red-700 dark:text-red-400">
              R$ {fmt(faltasSummary.topRespTotal)}
            </span>
          </span>
        </div>
      )}

      {/* Filtro de visualização: ambos / sobras / faltas */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Mostrar:
        </span>
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
          {([
            { v: 'ambos', l: 'Ambos' },
            { v: 'sobras', l: 'Só sobras' },
            { v: 'faltas', l: 'Só faltas' },
          ] as { v: ValoresFilter; l: string }[]).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setValoresFilter(opt.v)}
              className={cn(
                'inline-flex h-7 items-center rounded-md px-3 text-xs font-medium transition-colors',
                valoresFilter === opt.v
                  ? 'bg-[#1e3a5f] text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200',
              )}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-4 space-y-6">
        {/* Filial band */}
        <div className="rounded-t-md border border-b-0 border-gray-200 bg-gray-200 px-4 py-2 text-sm font-bold uppercase tracking-wide text-gray-800 dark:border-gray-700 dark:bg-gray-700 dark:text-gray-100">
          Filial: {empresaNome || '—'}
        </div>

        {displayGroups.map((g) => (
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
                  <td className="px-4 py-2 text-left">{empresaNome || '—'}</td>
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

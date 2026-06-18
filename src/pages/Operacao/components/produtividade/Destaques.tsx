import { useMemo } from 'react'
import { Award, Trophy, CalendarDays, Sparkles, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatLiters } from '@/lib/formatters'
import { useFilterStore } from '@/store/filters'
import useFuncionariosAdmissao from '@/pages/Operacao/hooks/useFuncionariosAdmissao'
import type { FrentistaProdRow, PeriodInfo } from '@/pages/Operacao/components/ProdutividadeTab'

interface Props {
  frentistas: FrentistaProdRow[]
  periodInfo: PeriodInfo
}

const WEEK_RANGES = [
  { week: 1, startDay: 1, endDay: 7 },
  { week: 2, startDay: 8, endDay: 14 },
  { week: 3, startDay: 15, endDay: 21 },
  { week: 4, startDay: 22, endDay: 31 },
]

const MES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/** Janela (dias) pra considerar um colaborador "novato" pela data de admissão. */
const NOVATO_WINDOW_DAYS = 90

const isValidNome = (nome: string | null | undefined): boolean => {
  if (!nome) return false
  const t = nome.trim()
  if (t === '' || /^\d+$/.test(t)) return false
  if (/^(Frentista|Funcionário|Funcionario) \d+$/.test(t)) return false
  return true
}

const getWeekIndex = (yyyymmdd: string): number => {
  const day = parseInt(yyyymmdd.substring(8, 10), 10)
  if (day <= 7) return 0
  if (day <= 14) return 1
  if (day <= 21) return 2
  return 3
}

const formatBrDate = (iso: string): string => {
  if (!iso || iso.length < 10) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/** Dias entre duas datas yyyy-MM-dd (b − a). */
const daysBetween = (a: string, b: string): number => {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  if (!ay || !by) return Infinity
  return Math.round((new Date(by, bm - 1, bd).getTime() - new Date(ay, am - 1, ad).getTime()) / 86400000)
}

const Destaques = ({ frentistas, periodInfo }: Props) => {
  const { dataInicial } = useFilterStore()
  const { admissaoMap, hasAdmissaoData } = useFuncionariosAdmissao()

  const [yearStr, monthStr] = (dataInicial ?? '').split('-')
  const currentYear = parseInt(yearStr, 10) || new Date().getFullYear()
  const currentMonth = parseInt(monthStr, 10) || new Date().getMonth() + 1
  const currentMonthName = MES_NOMES[currentMonth - 1] ?? ''
  const lastDayCurrent = new Date(currentYear, currentMonth, 0).getDate()

  const validFrentistas = useMemo(
    () => frentistas.filter((f) => isValidNome(f.nome)),
    [frentistas],
  )

  // ── (a) Ranking GERAL do período ──
  const rankingGeral = useMemo(
    () =>
      [...validFrentistas]
        .map((f) => ({
          codigo: f.funcionarioCodigo,
          nome: f.nome,
          litros: f.litros,
          faturamento: f.faturamento,
          atendimentos: f.atendimentos,
        }))
        .sort((a, b) => b.litros - a.litros),
    [validFrentistas],
  )

  // ── (b) Ranking SEMANAL (por semana do mês corrente) ──
  const rankingSemanal = useMemo(() => {
    const prefix = `${yearStr}-${monthStr}`
    return validFrentistas
      .map((f) => {
        const weeks = [0, 0, 0, 0]
        for (const d of f.dailyLitros) {
          if (d.data.substring(0, 7) !== prefix) continue
          weeks[getWeekIndex(d.data)] += d.litros
        }
        const total = weeks.reduce((s, v) => s + v, 0)
        // Melhor semana do colaborador.
        let bestIdx = 0
        for (let i = 1; i < weeks.length; i++) if (weeks[i] > weeks[bestIdx]) bestIdx = i
        return { codigo: f.funcionarioCodigo, nome: f.nome, weeks, total, bestIdx }
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [validFrentistas, yearStr, monthStr])

  // ── (c) Novatos (recém-admitidos) ──
  // Referência: fim do período (dataFinal) ou hoje, o que for menor.
  const refDate = useMemo(() => {
    const { dataFinal, todayStr } = periodInfo
    if (!dataFinal) return todayStr
    return dataFinal < todayStr ? dataFinal : todayStr
  }, [periodInfo])

  const novatos = useMemo(() => {
    if (!hasAdmissaoData) return []
    return validFrentistas
      .map((f) => {
        const info = admissaoMap.get(f.funcionarioCodigo)
        const dataAdmissao = info?.dataAdmissao ?? ''
        const diasCasa = dataAdmissao ? daysBetween(dataAdmissao, refDate) : Infinity
        return {
          codigo: f.funcionarioCodigo,
          nome: f.nome,
          litros: f.litros,
          faturamento: f.faturamento,
          dataAdmissao,
          diasCasa,
        }
      })
      .filter((r) => r.dataAdmissao !== '' && r.diasCasa <= NOVATO_WINDOW_DAYS && r.diasCasa >= 0)
      .sort((a, b) => a.diasCasa - b.diasCasa)
  }, [validFrentistas, admissaoMap, hasAdmissaoData, refDate])

  const weekLabel = (i: number): string => {
    const range = WEEK_RANGES[i]
    const end = i === 3 ? lastDayCurrent : range.endDay
    return `${String(range.startDay).padStart(2, '0')}-${String(end).padStart(2, '0')}/${String(currentMonth).padStart(2, '0')}`
  }

  if (frentistas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-12 text-center dark:border-gray-700 dark:bg-gray-900">
        <Award className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-2 text-sm text-gray-400">Sem dados de frentistas no período.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
          <Award className="h-5 w-5 text-emerald-600" />
          Destaques — {currentMonthName} {currentYear}
        </h3>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          Rankings do período e identificação de colaboradores recém-admitidos
        </p>
      </div>

      {/* (a) Ranking GERAL do período */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <Trophy className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ranking geral do período</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <th className="w-10 px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">#</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Frentista</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Litros</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Faturamento</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Abastec.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rankingGeral.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-sm text-gray-400">Sem dados no período.</td></tr>
              ) : (
                rankingGeral.map((r, idx) => (
                  <tr key={r.codigo} className={idx % 2 === 1 ? 'bg-gray-50/70 dark:bg-gray-800/30' : undefined}>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{r.nome}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(r.litros)}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(r.faturamento)}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-gray-500 dark:text-gray-400">{r.atendimentos}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* (b) Ranking SEMANAL */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <CalendarDays className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ranking semanal — {currentMonthName}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <th className="w-10 px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">#</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Frentista</th>
                {WEEK_RANGES.map((wr, i) => (
                  <th key={wr.week} className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                    Sem {wr.week}
                    <span className="block text-[10px] font-normal text-gray-400">{weekLabel(i)}</span>
                  </th>
                ))}
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Total mês</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rankingSemanal.length === 0 ? (
                <tr><td colSpan={7} className="py-8 text-center text-sm text-gray-400">Sem volume no mês corrente.</td></tr>
              ) : (
                rankingSemanal.map((r, idx) => (
                  <tr key={r.codigo} className={idx % 2 === 1 ? 'bg-gray-50/70 dark:bg-gray-800/30' : undefined}>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{r.nome}</td>
                    {r.weeks.map((w, i) => (
                      <td
                        key={i}
                        className={cn(
                          'px-4 py-2.5 text-right text-xs tabular-nums',
                          i === r.bestIdx && w > 0
                            ? 'font-semibold text-amber-700 dark:text-amber-400'
                            : 'text-gray-700 dark:text-gray-300',
                        )}
                      >
                        {w > 0 ? formatLiters(w) : '—'}
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-right text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(r.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* (c) Novatos */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <Sparkles className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Novatos</h3>
          <span className="text-xs text-gray-400">admitidos nos últimos {NOVATO_WINDOW_DAYS} dias</span>
        </div>
        {!hasAdmissaoData ? (
          <div className="flex items-start gap-2 px-5 py-6 text-sm text-gray-500 dark:text-gray-400">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
            <p>
              A rede não preenche a data de admissão dos funcionários (campo
              <span className="font-medium"> dataAdmissao</span> de /FUNCIONARIO vazio),
              então não é possível identificar colaboradores recém-admitidos.
            </p>
          </div>
        ) : novatos.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-400">Nenhum colaborador admitido nos últimos {NOVATO_WINDOW_DAYS} dias com volume no período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Frentista</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Admissão</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Dias de casa</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Litros</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Faturamento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {novatos.map((r, idx) => (
                  <tr key={r.codigo} className={idx % 2 === 1 ? 'bg-gray-50/70 dark:bg-gray-800/30' : undefined}>
                    <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">
                      <span className="flex items-center gap-2">
                        {r.nome}
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400">
                          Novato
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-sm tabular-nums text-gray-700 dark:text-gray-300">{formatBrDate(r.dataAdmissao)}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-gray-700 dark:text-gray-300">{r.diasCasa}</td>
                    <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(r.litros)}</td>
                    <td className="px-4 py-2.5 text-right text-sm tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(r.faturamento)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Destaques

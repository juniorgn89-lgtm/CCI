import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, CheckCircle2, Clock, Loader2, Play, RefreshCw, AlertCircle, Database,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import {
  fetchApuracaoStatusByMonth,
  upsertApuracaoDiaria,
  computeApuracaoRows,
} from '@/api/supabase/apuracao'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchAbastecimentosChunked } from '@/api/helpers/fetchAbastecimentosChunked'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { fetchLmc } from '@/api/endpoints/combustiveis'
import { fetchVendaResumo } from '@/api/endpoints/vendas'
import { cn } from '@/lib/utils'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const

type MonthStatus = 'apurado' | 'parcial' | 'nao_apurado' | 'futuro' | 'em_andamento' | 'erro'

interface MonthState {
  status: MonthStatus
  expected: number
  actual: number
  error?: string
}

const padMonth = (m: number) => String(m).padStart(2, '0')

const lastDayOfMonth = (year: number, month: number) =>
  new Date(year, month, 0).getDate()

const todayParts = () => {
  const d = new Date()
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
}

const threeMonthsBefore = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setMonth(dt.getMonth() - 3)
  return `${dt.getFullYear()}-${padMonth(dt.getMonth() + 1)}-${padMonth(dt.getDate())}`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Calcula o último dia do mês que conta como "fechado" (anterior ao dia de
 * hoje). Pra mês passado = lastDayOfMonth. Pra mês corrente = ontem ou null.
 */
const closedEndForMonth = (year: number, month: number): string | null => {
  const today = todayParts()
  // Mês inteiro futuro
  if (year > today.year || (year === today.year && month > today.month)) return null
  const lastDay = lastDayOfMonth(year, month)
  // Mês inteiro passado
  if (year < today.year || (year === today.year && month < today.month)) {
    return `${year}-${padMonth(month)}-${padMonth(lastDay)}`
  }
  // Mês corrente — ontem
  if (today.day <= 1) return null
  return `${today.year}-${padMonth(today.month)}-${padMonth(today.day - 1)}`
}

const expectedRowsForMonth = (year: number, month: number, empresasCount: number): number => {
  const end = closedEndForMonth(year, month)
  if (!end) return 0
  const start = `${year}-${padMonth(month)}-01`
  // Conta dias entre start e end
  const startDate = new Date(year, month - 1, 1)
  const endParts = end.split('-').map(Number)
  const endDate = new Date(endParts[0], endParts[1] - 1, endParts[2])
  const days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
  return days * empresasCount
  // start is unused as variable but kept for clarity
  void start
}

const Apuracao = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const rede = useTenantStore((s) => s.rede)

  // Gate: master OU supervisor com pode_apurar=true. Já vem da auth store
  // (bootstrap consolida is_master + pode_apurar em canApurar).
  const isMaster = useAuthStore((s) => s.isMaster)
  const canApurar = useAuthStore((s) => s.canApurar)
  const authLoading = useAuthStore((s) => s.isLoading)
  const hasAccess = isMaster || canApurar

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)

  // Empresas da rede atual — usado pra calcular o expected count por mês.
  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    enabled: hasAccess && !!rede,
    staleTime: 10 * 60 * 1000,
  })
  const empresas = empresasData?.resultados ?? []
  const empresasCount = empresas.length

  // Status do ano selecionado — mapa mês → count de rows no Supabase.
  const { data: statusMap, isLoading: loadingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['apuracao-status', rede?.id, year],
    queryFn: () => rede ? fetchApuracaoStatusByMonth(rede.id, year) : new Map<number, number>(),
    enabled: hasAccess && !!rede,
    staleTime: 60 * 1000,
  })

  // Estado por mês durante apuração (em_andamento / erro)
  const [progress, setProgress] = useState<Map<number, MonthState>>(new Map())
  const [running, setRunning] = useState(false)

  const computeStatus = (month: number): MonthState => {
    const ongoing = progress.get(month)
    if (ongoing && (ongoing.status === 'em_andamento' || ongoing.status === 'erro')) {
      return ongoing
    }
    const expected = expectedRowsForMonth(year, month, empresasCount)
    const actual = statusMap?.get(month) ?? 0
    if (expected === 0) return { status: 'futuro', expected: 0, actual }
    if (actual >= expected) return { status: 'apurado', expected, actual }
    if (actual === 0) return { status: 'nao_apurado', expected, actual }
    return { status: 'parcial', expected, actual }
  }

  /**
   * Apura um mês: fetcha live da Quality + upsert no Supabase. Sequencial.
   */
  const apurarMes = async (month: number): Promise<{ ok: boolean; rows: number; error?: string }> => {
    if (!rede) return { ok: false, rows: 0, error: 'Sem rede conectada' }
    const end = closedEndForMonth(year, month)
    if (!end) return { ok: false, rows: 0, error: 'Mês ainda futuro' }
    const start = `${year}-${padMonth(month)}-01`

    setProgress((prev) => new Map(prev).set(month, { status: 'em_andamento', expected: expectedRowsForMonth(year, month, empresasCount), actual: 0 }))
    try {
      const empresasCodes = empresas.map((e) => e.codigo)
      const lmcStart = threeMonthsBefore(start)

      const [abast, lmc, resumo] = await Promise.all([
        fetchAbastecimentosChunked({ dataInicial: start, dataFinal: end }),
        fetchAllPages(
          (p) => fetchLmc({
            empresaCodigo: empresasCodes,
            dataInicial: lmcStart, dataFinal: end,
            ultimoCodigo: p.ultimoCodigo, limite: p.limite,
          }),
          1000, 50
        ),
        fetchVendaResumo({ dataInicial: start, dataFinal: end }),
      ])

      const rows = computeApuracaoRows({
        redeId: rede.id,
        empresaCodigos: empresasCodes,
        dataInicial: start,
        dataFinal: end,
        abastecimentos: abast,
        lmc,
        vendaResumo: resumo,
      })
      await upsertApuracaoDiaria(rows)
      return { ok: true, rows: rows.length }
    } catch (e) {
      const msg = (e as Error).message || 'Erro desconhecido'
      setProgress((prev) => new Map(prev).set(month, { status: 'erro', expected: 0, actual: 0, error: msg }))
      return { ok: false, rows: 0, error: msg }
    }
  }

  const handleApurarMes = async (month: number) => {
    setRunning(true)
    await apurarMes(month)
    await refetchStatus()
    queryClient.invalidateQueries({ queryKey: ['apuracao-cache'] })
    setProgress((prev) => {
      const next = new Map(prev)
      next.delete(month)
      return next
    })
    setRunning(false)
  }

  const handleApurarAno = async () => {
    setRunning(true)
    const today = todayParts()
    const maxMonth = year < today.year ? 12 : today.month
    for (let m = 1; m <= maxMonth; m++) {
      // Pula meses já apurados
      const current = computeStatus(m)
      if (current.status === 'apurado' || current.status === 'futuro') continue
      await apurarMes(m)
      await refetchStatus()
      // Pausa entre meses pra evitar storm na API
      if (m < maxMonth) await sleep(800)
    }
    queryClient.invalidateQueries({ queryKey: ['apuracao-cache'] })
    setProgress(new Map())
    setRunning(false)
  }

  if (authLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Você não tem permissão para apurar dados. Peça ao gerente para liberar.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      </div>
    )
  }

  if (!rede) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <Database className="mx-auto h-8 w-8 text-gray-400" />
        <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          Nenhuma rede conectada
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Conecte uma rede em <strong>/selecionar-rede</strong> antes de apurar dados.
        </p>
        <button
          onClick={() => navigate('/selecionar-rede')}
          className="mt-4 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162d4a]"
        >
          Selecionar rede
        </button>
      </div>
    )
  }

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
  const today = todayParts()

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Apuração</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Pré-carregue meses fechados pra que o supervisor abra o dashboard sem espera —{' '}
              <strong>rede {rede.nome}</strong>
            </p>
          </div>
        </div>
        <button
          onClick={handleApurarAno}
          disabled={running || empresasCount === 0}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            running || empresasCount === 0
              ? 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
              : 'bg-[#1e3a5f] text-white hover:bg-[#162d4a]'
          )}
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Apurar ano todo
        </button>
      </div>

      {/* Year selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Ano</span>
        <div className="flex flex-wrap gap-1.5">
          {years.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              disabled={running}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                y === year
                  ? 'bg-[#1e3a5f] text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
                running && 'cursor-not-allowed opacity-50'
              )}
            >
              {y}
            </button>
          ))}
        </div>
        <button
          onClick={() => refetchStatus()}
          disabled={loadingStatus}
          className="ml-auto inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <RefreshCw className={cn('h-3 w-3', loadingStatus && 'animate-spin')} />
          Atualizar status
        </button>
      </div>

      {/* Loading status */}
      {loadingStatus ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : empresasCount === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            Nenhuma empresa encontrada na rede — verifique a CHAVE Quality em /admin/redes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {MESES.map((label, idx) => {
            const month = idx + 1
            const state = computeStatus(month)
            const isFutureMonth = year > today.year || (year === today.year && month > today.month)
            const isCurrentMonth = year === today.year && month === today.month
            return (
              <MonthCard
                key={month}
                label={label}
                month={month}
                state={state}
                isFutureMonth={isFutureMonth}
                isCurrentMonth={isCurrentMonth}
                disabled={running}
                onApurar={() => handleApurarMes(month)}
              />
            )
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Apuração faz fetch live da API Quality e grava no Supabase. Mês fechado
        completo fica imutável; mês corrente cobre só dias passados (hoje
        continua sempre live). Funciona apenas na rede atualmente conectada.
      </p>
    </div>
  )
}

interface MonthCardProps {
  label: string
  month: number
  state: MonthState
  isFutureMonth: boolean
  isCurrentMonth: boolean
  disabled: boolean
  onApurar: () => void
}

const MonthCard = ({ label, state, isFutureMonth, isCurrentMonth, disabled, onApurar }: MonthCardProps) => {
  const { Icon, color, statusLabel } = (() => {
    switch (state.status) {
      case 'em_andamento':
        return { Icon: Loader2, color: 'text-blue-600 dark:text-blue-400 animate-spin', statusLabel: 'Apurando...' }
      case 'apurado':
        return { Icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400', statusLabel: 'Apurado' }
      case 'parcial':
        return { Icon: Clock, color: 'text-amber-600 dark:text-amber-400', statusLabel: `Parcial ${state.actual}/${state.expected}` }
      case 'nao_apurado':
        return { Icon: Clock, color: 'text-gray-400', statusLabel: 'Não apurado' }
      case 'futuro':
        return { Icon: Clock, color: 'text-gray-300 dark:text-gray-600', statusLabel: 'Futuro' }
      case 'erro':
        return { Icon: AlertCircle, color: 'text-red-600 dark:text-red-400', statusLabel: state.error ?? 'Erro' }
    }
  })()

  const canApurar = !disabled && !isFutureMonth && state.status !== 'em_andamento'

  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-3 transition-colors dark:bg-gray-900',
        state.status === 'apurado'
          ? 'border-emerald-200 dark:border-emerald-900/40'
          : state.status === 'em_andamento'
          ? 'border-blue-300 dark:border-blue-700'
          : state.status === 'erro'
          ? 'border-red-200 dark:border-red-900/40'
          : 'border-gray-200 dark:border-gray-700',
        (isFutureMonth || state.status === 'futuro') && 'opacity-50'
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
        {isCurrentMonth && (
          <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
            atual
          </span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
        <span className={cn('truncate text-xs font-medium', color)} title={statusLabel}>
          {statusLabel}
        </span>
      </div>
      <button
        onClick={onApurar}
        disabled={!canApurar}
        className={cn(
          'mt-3 w-full rounded-md py-1.5 text-xs font-semibold transition-colors',
          canApurar
            ? state.status === 'apurado'
              ? 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
              : 'bg-[#1e3a5f] text-white hover:bg-[#162d4a]'
            : 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
        )}
      >
        {state.status === 'em_andamento' ? 'Apurando...' : state.status === 'apurado' ? 'Reapurar' : 'Apurar'}
      </button>
    </div>
  )
}

export default Apuracao

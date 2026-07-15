import { Fragment, useMemo, useState } from 'react'
import {
  ClipboardCheck, ChevronRight, ChevronDown, CreditCard, Banknote, Scale,
  AlertTriangle, CheckCircle2, Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrencyInt } from '@/lib/formatters'
import useOperacaoData from '@/pages/Operacao/hooks/useOperacaoData'
import useShowSkeleton from '@/hooks/useShowSkeleton'
import { Skeleton } from '@/components/ui/skeleton'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import useCartaoBreakdown from '@/pages/FechamentoCaixa/hooks/useCartaoBreakdown'
import CartaoDetalheModal from '@/pages/FechamentoCaixa/components/CartaoDetalheModal'
import RealizadoChave from '@/components/kpi/RealizadoChave'
import type { ConferenciaForma } from '@/pages/Operacao/hooks/useOperacaoData'

const EPS = 0.005
const fmtDate = (iso: string): string => (iso ? iso.split('-').reverse().join('/') : '-')
const isCartao = (nome: string) => (nome ?? '').toUpperCase().includes('CART')

/** Iniciais do operador (até 2 palavras) pro avatar. */
const initials = (nome: string): string =>
  (nome ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'

/* ── Painel derivado por PDV (caixa) ── */
interface Panel {
  caixaCodigo: number
  turnoCodigo: number
  tipo: string // pdvLabel
  data: string
  operador: string
  conferido: boolean
  formas: ConferenciaForma[]
  totalApresentado: number
  totalApurado: number
  totalDiferenca: number
  divergente: boolean
}

const tipoTone = (label: string): string =>
  label === 'Pista'
    ? 'bg-[#dbeafe] text-[#1d4ed8] dark:bg-blue-900/30 dark:text-blue-300'
    : label === 'Conveniência'
      ? 'bg-[#f3e8ff] text-[#7c3aed] dark:bg-violet-900/30 dark:text-violet-300'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'

const diffText = (v: number): string =>
  v < -EPS ? 'text-[#b91c1c] dark:text-red-400' : v > EPS ? 'text-[#15803d] dark:text-emerald-400' : 'text-gray-400'
const fmtDiff = (v: number): string => (Math.abs(v) < EPS ? '—' : `${v > 0 ? '+' : ''}${formatCurrencyInt(v)}`)

const DiffPill = ({ v }: { v: number }) => {
  if (Math.abs(v) < EPS) return <span className="text-gray-400">—</span>
  const pos = v > 0
  return (
    <span className={cn(
      'inline-block rounded-md px-2 py-0.5 text-xs font-bold tabular-nums',
      pos ? 'bg-[#dcfce7] text-[#15803d] dark:bg-emerald-900/40 dark:text-emerald-300'
        : 'bg-[#fee2e2] text-[#b91c1c] dark:bg-red-900/40 dark:text-red-300',
    )}>
      {pos ? '+' : ''}{formatCurrencyInt(v)}
    </span>
  )
}

/** Larguras compartilhadas entre tabela de formas e rodapé de total. */
const Cols = () => (
  <colgroup>
    <col className="w-[34%]" /><col className="w-[22%]" /><col className="w-[22%]" /><col className="w-[22%]" />
  </colgroup>
)

/* ── KPI card ── */
const KpiCard = ({ navy, label, sub, value, valueClass, Icon, chipBg, chipColor, footer }: {
  navy?: boolean; label: string; sub: string; value: string; valueClass?: string
  Icon: typeof Scale; chipBg?: string; chipColor?: string; footer: string
}) => (
  <div className={cn(
    'flex flex-col rounded-2xl border p-5 shadow-sm',
    navy ? 'border-[#1e3a5f]/30 bg-gradient-to-br from-[#1e3a5f] to-[#27496f]' : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
  )}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className={cn('text-[13px] font-semibold', navy ? 'text-white' : 'text-gray-900 dark:text-gray-100')}>{label}</p>
        <p className={cn('text-[11px] uppercase tracking-wide', navy ? 'text-white/60' : 'text-gray-400')}>{sub}</p>
      </div>
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', navy ? 'bg-white/15' : chipBg)}>
        <Icon className={cn('h-5 w-5', navy ? 'text-white/90' : chipColor)} />
      </div>
    </div>
    <p className={cn('mt-3 text-3xl font-bold tabular-nums', navy ? 'text-white' : (valueClass ?? 'text-gray-900 dark:text-gray-100'))}>{value}</p>
    <div className={cn('mt-auto border-t pt-3', navy ? 'border-white/15' : 'border-gray-100 dark:border-gray-800')}>
      <span className={cn('text-[11px]', navy ? 'text-white/60' : 'text-gray-400')}>{footer}</span>
    </div>
  </div>
)

const ContentSkeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
    </div>
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
    </div>
  </div>
)

/**
 * Conferência por PDV — compara, por caixa/PDV e forma de pagamento, o
 * APRESENTADO (declarado) × APURADO (sistema), destacando sobras/faltas. Painéis
 * derivam de `turnoRows` (pra caixas pendentes aparecerem) com a quebra por forma
 * vinda de `conferenciaPdv` (/CAIXA_APRESENTADO). Multi-turno, status por caixa,
 * drill-down e KPIs (só conferidos). Tudo GET/read-only.
 */
const ConferenciaPdv = ({ empresaCodigo }: { empresaCodigo?: number | null } = {}) => {
  const { turnoRows, conferenciaPdv, isLoading, hasEmpresa } = useOperacaoData(empresaCodigo)
  const showSkeleton = useShowSkeleton(isLoading, turnoRows.length > 0)

  const [filterPdv, setFilterPdv] = useState<'todos' | 'pista' | 'conveniencia'>('todos')
  const [turnoSel, setTurnoSel] = useState<number | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [cartaoPanel, setCartaoPanel] = useState<Panel | null>(null)

  // Quebra do cartão (sob demanda) pro modal — escopo do PDV clicado.
  const pdvByCaixa = useMemo(
    () => (cartaoPanel ? new Map([[cartaoPanel.caixaCodigo, cartaoPanel.tipo]]) : new Map<number, string>()),
    [cartaoPanel],
  )
  const cartao = useCartaoBreakdown(cartaoPanel ? [cartaoPanel.caixaCodigo] : [], pdvByCaixa, cartaoPanel !== null)

  // Painéis por caixa (a partir de turnoRows → pendentes inclusos) + join formas.
  const panels = useMemo<Panel[]>(() => {
    const confByCaixa = new Map(conferenciaPdv.map((c) => [c.caixaCodigo, c]))
    return turnoRows.map((t) => {
      const conf = confByCaixa.get(t.caixaCodigo)
      const conferido = !!conf && conf.formas.length > 0
      const totalDiferenca = conf?.totalDiferenca ?? 0
      return {
        caixaCodigo: t.caixaCodigo,
        turnoCodigo: t.turnoCodigo,
        tipo: t.pdvLabel,
        data: t.dataMovimento.slice(0, 10),
        operador: t.funcionarioNome,
        conferido,
        formas: conf?.formas ?? [],
        totalApresentado: conf?.totalApresentado ?? 0,
        totalApurado: conf?.totalApurado ?? 0,
        totalDiferenca,
        divergente: conferido && Math.abs(totalDiferenca) > EPS,
      }
    })
  }, [turnoRows, conferenciaPdv])

  // Turnos presentes (data-driven), rótulo estável 1º/2º/3º pela ordem do código.
  const turnos = useMemo(() => {
    const codigos = Array.from(new Set(panels.map((p) => p.turnoCodigo))).sort((a, b) => a - b)
    return codigos.map((codigo, i) => ({ codigo, label: `${i + 1}º Turno` }))
  }, [panels])

  // Turno ativo: o selecionado se válido, senão o primeiro disponível.
  const turnoAtivo = turnoSel != null && turnos.some((t) => t.codigo === turnoSel)
    ? turnoSel
    : (turnos[0]?.codigo ?? null)
  const turnoLabel = turnos.find((t) => t.codigo === turnoAtivo)?.label ?? '—'

  // Trocar de turno limpa os drill-downs abertos.
  const [prevTurno, setPrevTurno] = useState(turnoAtivo)
  if (prevTurno !== turnoAtivo) {
    setPrevTurno(turnoAtivo)
    setExpanded(new Set())
  }

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  // Escopo visível: turno ativo + filtro de tipo, ordenado (pendente → divergente → ok).
  const visiveis = useMemo(() => {
    const rank = (p: Panel) => (!p.conferido ? 0 : p.divergente ? 1 : 2)
    return panels
      .filter((p) => p.turnoCodigo === turnoAtivo)
      .filter((p) => filterPdv === 'todos' || (filterPdv === 'pista' ? p.tipo === 'Pista' : p.tipo === 'Conveniência'))
      .sort((a, b) => rank(a) - rank(b) || Math.abs(b.totalDiferenca) - Math.abs(a.totalDiferenca))
  }, [panels, turnoAtivo, filterPdv])

  const kpis = useMemo(() => {
    const conferidos = visiveis.filter((p) => p.conferido)
    const apresentado = conferidos.reduce((s, p) => s + p.totalApresentado, 0)
    const apurado = conferidos.reduce((s, p) => s + p.totalApurado, 0)
    const diferenca = conferidos.reduce((s, p) => s + p.totalDiferenca, 0)
    const comDivergencia = conferidos.filter((p) => p.divergente).length
    const pendentes = visiveis.filter((p) => !p.conferido).length
    return { apresentado, apurado, diferenca, comDivergencia, conferidos: conferidos.length, pendentes }
  }, [visiveis])

  if (!hasEmpresa) return <SelectCompanyState />
  if (showSkeleton) return <ContentSkeleton />

  if (turnoRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-20 text-center dark:border-gray-700 dark:bg-gray-900">
        <ClipboardCheck className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Sem caixas no período</p>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Ajuste o período pra conferir os caixas por PDV.</p>
      </div>
    )
  }

  const tudoConferido = visiveis.length > 0 && kpis.pendentes === 0 && kpis.comDivergencia === 0

  return (
    <div className="space-y-4">
      {/* ── Barra de controles ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-[#0f0f0f]">
          {([
            { id: 'todos', label: 'Todos' },
            { id: 'pista', label: 'Pista' },
            { id: 'conveniencia', label: 'Conveniência' },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilterPdv(t.id)}
              className={cn('rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-colors',
                filterPdv === t.id ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <ClipboardCheck className="h-3.5 w-3.5" />
            {visiveis.length} {visiveis.length === 1 ? 'PDV' : 'PDVs'} · {turnoLabel}
          </span>
          {turnos.length > 1 && (
            <div className="inline-flex gap-1 rounded-xl border border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-[#0f0f0f]">
              {turnos.map((t) => (
                <button
                  key={t.codigo}
                  type="button"
                  onClick={() => setTurnoSel(t.codigo)}
                  className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                    turnoAtivo === t.codigo ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800')}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── KPIs (somam só conferidos do escopo) ── */}
      <div>
        <RealizadoChave />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard navy label="Apresentado" sub="Declarado no caixa" Icon={CreditCard}
          value={formatCurrencyInt(kpis.apresentado)} footer={`${visiveis.length} ${visiveis.length === 1 ? 'PDV' : 'PDVs'} · ${turnoLabel}`} />
        <KpiCard label="Apurado" sub="Sistema" Icon={Banknote}
          chipBg="bg-[#dbeafe] dark:bg-blue-900/30" chipColor="text-[#2563eb] dark:text-blue-400"
          value={formatCurrencyInt(kpis.apurado)} footer="valor conferido pelo sistema" />
        <KpiCard label="Diferença líquida" sub="Apresentado − Apurado" Icon={Scale}
          chipBg="bg-[#dcfce7] dark:bg-emerald-900/30" chipColor="text-[#16a34a] dark:text-emerald-400"
          value={fmtDiff(kpis.diferenca)} valueClass={diffText(kpis.diferenca)} footer="saldo de sobras e faltas" />
        <KpiCard label="Com divergência" sub="PDVs conferidos" Icon={AlertTriangle}
          chipBg="bg-[#fef3c7] dark:bg-amber-900/30" chipColor="text-[#d97706] dark:text-amber-400"
          value={`${kpis.comDivergencia} / ${kpis.conferidos}`}
          footer={kpis.pendentes > 0 ? `${kpis.pendentes} PDV${kpis.pendentes === 1 ? '' : 's'} pendente${kpis.pendentes === 1 ? '' : 's'}` : 'exigem atenção'} />
        </div>
      </div>

      {/* ── Banner "Tudo conferido" ── */}
      {tudoConferido && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#bbf7d0] bg-[#f0fdf4] px-5 py-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CheckCircle2 className="h-6 w-6 shrink-0 text-[#15803d] dark:text-emerald-400" />
          <div>
            <p className="text-sm font-semibold text-[#15803d] dark:text-emerald-300">Tudo conferido</p>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">Nenhuma divergência nos PDVs deste turno — caixas batidos.</p>
          </div>
        </div>
      )}

      {/* ── Painéis por PDV ── */}
      {visiveis.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-900">
          <ClipboardCheck className="mb-3 h-9 w-9 text-gray-300 dark:text-gray-600" />
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {filterPdv === 'todos' ? 'Nenhum caixa registrado neste turno' : `Nenhum PDV de ${filterPdv === 'pista' ? 'Pista' : 'Conveniência'} neste turno`}
          </p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Selecione outro turno ou filtro acima.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
          {visiveis.map((p) => (
            <section key={p.caixaCodigo} className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
              {/* Header: tipo + id/data · status */}
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold', tipoTone(p.tipo))}>{p.tipo}</span>
                  <span className="truncate text-[11px] text-gray-400">#{p.caixaCodigo} · {fmtDate(p.data)}</span>
                </div>
                {p.conferido ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#dcfce7] px-2 py-0.5 text-[11px] font-semibold text-[#15803d] dark:bg-emerald-900/40 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" /> Conferido
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fef3c7] px-2 py-0.5 text-[11px] font-semibold text-[#b45309] dark:bg-amber-900/40 dark:text-amber-300">
                    <Clock className="h-3 w-3" /> Pendente
                  </span>
                )}
              </div>

              {/* Faixa do operador */}
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e3a5f] text-[10px] font-bold text-white">{initials(p.operador)}</span>
                <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100" title={p.operador}>{p.operador}</span>
              </div>

              {p.conferido ? (
                <>
                  <div className="flex-1 overflow-x-auto">
                    <table className="w-full table-fixed text-xs">
                      <Cols />
                      <thead className="text-[10px] uppercase tracking-wider text-gray-400">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold">Forma</th>
                          <th className="px-3 py-2 text-right font-semibold">Apresentado</th>
                          <th className="px-3 py-2 text-right font-semibold">Apurado</th>
                          <th className="px-3 py-2 text-right font-semibold">Diferença</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {p.formas.map((f) => {
                          const cartaoRow = isCartao(f.nome)
                          const divergente = Math.abs(f.diferenca) > EPS
                          const expandable = divergente && !cartaoRow
                          const key = `${p.caixaCodigo}:${f.nome}`
                          const isOpen = expanded.has(key)
                          const tint = divergente ? (f.diferenca > 0 ? 'bg-[#f0fdf4] dark:bg-emerald-950/20' : 'bg-[#fef2f2] dark:bg-red-950/20') : ''
                          return (
                            <Fragment key={f.nome}>
                              <tr
                                onClick={cartaoRow ? () => setCartaoPanel(p) : expandable ? () => toggle(key) : undefined}
                                className={cn(tint, (cartaoRow || expandable) && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50')}
                                title={cartaoRow ? 'Ver débito/crédito por bandeira' : expandable ? 'Ver detalhe da diferença' : undefined}
                              >
                                <td className="truncate px-3 py-1.5 font-medium text-gray-900 dark:text-gray-100">
                                  <span className="inline-flex items-center gap-1">
                                    {expandable && (isOpen ? <ChevronDown className="h-3 w-3 text-gray-400" /> : <ChevronRight className="h-3 w-3 text-gray-400" />)}
                                    {f.nome}
                                    {cartaoRow && (
                                      <span className="inline-flex items-center gap-0.5 rounded bg-[#eff6ff] px-1 py-0.5 text-[9px] font-semibold text-[#2563eb] dark:bg-blue-900/30 dark:text-blue-300">
                                        detalhar <ChevronRight className="h-2.5 w-2.5" />
                                      </span>
                                    )}
                                  </span>
                                </td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrencyInt(f.apresentado)}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">{formatCurrencyInt(f.apurado)}</td>
                                <td className="px-3 py-1.5 text-right"><DiffPill v={f.diferenca} /></td>
                              </tr>
                              {expandable && isOpen && (
                                <tr className="bg-[#fafafa] dark:bg-gray-800/30">
                                  <td colSpan={4} className="px-3 py-2">
                                    <div className="grid grid-cols-3 gap-2 border-l-2 border-gray-200 pl-3 dark:border-gray-700">
                                      <div>
                                        <p className="text-[10px] uppercase tracking-wide text-gray-400">Apresentado</p>
                                        <p className="text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">{formatCurrencyInt(f.apresentado)}</p>
                                        <p className="text-[10px] text-gray-400">pelo operador</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] uppercase tracking-wide text-gray-400">Apurado</p>
                                        <p className="text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">{formatCurrencyInt(f.apurado)}</p>
                                        <p className="text-[10px] text-gray-400">pelo sistema</p>
                                      </div>
                                      <div>
                                        <p className="text-[10px] uppercase tracking-wide text-gray-400">{f.diferenca > 0 ? 'Sobra' : 'Falta'} de caixa</p>
                                        <p className={cn('text-sm font-bold tabular-nums', diffText(f.diferenca))}>{fmtDiff(f.diferenca)}</p>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <table className="w-full table-fixed border-t-2 border-gray-200 text-xs dark:border-gray-700">
                    <Cols />
                    <tbody>
                      <tr className="bg-[#fafafa] font-bold dark:bg-gray-800/50">
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-200">Total</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(p.totalApresentado)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyInt(p.totalApurado)}</td>
                        <td className="px-3 py-2 text-right"><DiffPill v={p.totalDiferenca} /></td>
                      </tr>
                    </tbody>
                  </table>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fef3c7] dark:bg-amber-900/30">
                    <Clock className="h-6 w-6 text-[#d97706] dark:text-amber-400" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">Conferência pendente</p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">O operador ainda não fechou este caixa — sem apresentado pra conferir.</p>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <CartaoDetalheModal
        open={cartaoPanel !== null}
        onClose={() => setCartaoPanel(null)}
        linhas={cartao.linhas}
        total={cartao.total}
        pdvs={cartao.pdvs}
        isLoading={cartao.isLoading}
      />
    </div>
  )
}

export default ConferenciaPdv

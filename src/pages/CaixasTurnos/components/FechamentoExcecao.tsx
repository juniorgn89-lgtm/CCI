import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Sparkles, Lock, CreditCard, Check, AlertTriangle, RotateCcw, ThumbsUp, ThumbsDown,
  ArrowUpRight, Info, ShieldCheck, BarChart3, TrendingUp, ChevronRight, Building2, X,
  Wallet, Banknote, Ticket, QrCode,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { Skeleton } from '@/components/ui/skeleton'
import useFechamentoExcecao, {
  type ExcecaoCaixa, type ExcecaoClasse, type CausaTier, type EvidenciaTier, type SparkPonto,
} from '@/pages/CaixasTurnos/hooks/useFechamentoExcecao'
import useDiferencasCaixa from '@/pages/CaixasTurnos/hooks/useDiferencasCaixa'
import useCartaoBreakdown from '@/pages/FechamentoCaixa/hooks/useCartaoBreakdown'
import { isCartaoForma } from '@/lib/difCaixa'

/** Ícone + cor por forma de pagamento (visual igual ao mockup). */
const formaIcon = (nome: string): { Icon: LucideIcon; text: string; bg: string } => {
  const u = (nome ?? '').toUpperCase()
  if (u.includes('DINHEIRO')) return { Icon: Banknote, text: 'text-[#15803d]', bg: 'bg-[#dcfce7] dark:bg-emerald-900/30' }
  if (u.includes('PIX')) return { Icon: QrCode, text: 'text-[#0d9488]', bg: 'bg-[#ccfbf1] dark:bg-teal-900/30' }
  if (isCartaoForma(nome)) return { Icon: CreditCard, text: 'text-[#4338ca]', bg: 'bg-[#e0e7ff] dark:bg-indigo-900/30' }
  if (u.includes('VOUCHER') || u.includes('FROTA') || u.includes('VALE')) return { Icon: Ticket, text: 'text-[#b45309]', bg: 'bg-[#fef3c7] dark:bg-amber-900/30' }
  return { Icon: Wallet, text: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' }
}

/* ── Feedback 👍/👎 em localStorage (por caixa, sobrevive reload; sem backend) ── */
const FEEDBACK_KEY = 'visor360.excecao.feedback'
type Feedback = 'up' | 'down'
const readFeedback = (): Record<string, Feedback> => {
  try { return JSON.parse(localStorage.getItem(FEEDBACK_KEY) || '{}') } catch { return {} }
}
const writeFeedback = (key: string, fb: Feedback): Record<string, Feedback> => {
  const all = readFeedback(); all[key] = fb
  try { localStorage.setItem(FEEDBACK_KEY, JSON.stringify(all)) } catch { /* noop */ }
  return all
}

const fmtDif = (v: number): string => `${v < 0 ? '−' : '+'}${formatCurrency(Math.abs(v))}`
const iniciais = (nome: string): string =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'

const CLASSE_META: Record<ExcecaoClasse, { label: string; text: string; bg: string; border: string; accent: string }> = {
  investigar: { label: 'Investigar', text: 'text-[#b91c1c] dark:text-red-400', bg: 'bg-[#fee2e2] dark:bg-red-900/30', border: 'border-[#fecaca] dark:border-red-900/50', accent: 'bg-[#ef4444]' },
  revisar: { label: 'Revisar', text: 'text-[#b45309] dark:text-amber-400', bg: 'bg-[#fef3c7] dark:bg-amber-900/30', border: 'border-[#fde68a] dark:border-amber-900/50', accent: 'bg-[#f59e0b]' },
  ok: { label: 'OK', text: 'text-[#15803d] dark:text-emerald-400', bg: 'bg-[#dcfce7] dark:bg-emerald-900/30', border: 'border-[#bbf7d0] dark:border-emerald-900/50', accent: 'bg-emerald-500' },
}
const CAUSA_TIER_META: Record<CausaTier, { label: string }> = {
  atual: { label: 'Verificável agora' }, historico: { label: 'Requer histórico' }, misto: { label: 'Verificável + histórico' },
}
const TIER_META: Record<EvidenciaTier, { label: string; text: string; bg: string }> = {
  atual: { label: 'dado atual', text: 'text-[#16a34a] dark:text-emerald-400', bg: 'bg-[#f0fdf4] dark:bg-emerald-900/20' },
  historico: { label: 'histórico', text: 'text-[#4338ca] dark:text-indigo-400', bg: 'bg-[#eef2ff] dark:bg-indigo-900/20' },
}

const Kpi = ({ label, secondary, value, sub, tone, Icon }: { label: string; secondary: string; value: string; sub?: string; tone: 'neutral' | ExcecaoClasse; Icon: LucideIcon }) => {
  const meta = tone === 'neutral' ? null : CLASSE_META[tone]
  return (
    <div className={cn('rounded-2xl border bg-white p-4 shadow-sm dark:bg-gray-900', meta ? meta.border : 'border-gray-200 dark:border-gray-700')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-gray-900 dark:text-gray-100">{label}</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{secondary}</p>
        </div>
        <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta ? meta.bg : 'bg-gray-100 dark:bg-gray-800')}>
          <Icon className={cn('h-4 w-4', meta ? meta.text : 'text-gray-500')} />
        </div>
      </div>
      <p className={cn('mt-2 text-2xl font-bold tabular-nums', meta ? meta.text : 'text-gray-900 dark:text-gray-100')}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{sub}</p>}
    </div>
  )
}

/* ── Sparkline 90d (cima/baixo da linha-zero) ── */
const Sparkline = ({ serie }: { serie: SparkPonto[] }) => {
  const max = Math.max(1, ...serie.map((p) => Math.abs(p.dif)))
  const cor = (p: SparkPonto) =>
    p.status === 'ok' ? 'bg-gray-200 dark:bg-gray-700'
      : p.status === 'sobra' ? (p.hoje ? 'bg-[#16a34a]' : 'bg-[#86efac]')
        : (p.hoje ? 'bg-[#dc2626]' : 'bg-[#fca5a5]')
  return (
    <div className="flex h-12 items-center gap-0.5">
      {serie.map((p, i) => {
        const h = Math.max(2, Math.round((Math.abs(p.dif) / max) * 20))
        const up = p.dif >= 0
        return (
          <div key={i} className="flex h-full flex-1 flex-col justify-center" title={`${p.data}: ${fmtDif(p.dif)}`}>
            <div className="flex flex-1 items-end justify-center">{up && <span className={cn('w-full rounded-sm', cor(p))} style={{ height: h }} />}</div>
            <div className="h-px w-full bg-gray-200 dark:bg-gray-700" />
            <div className="flex flex-1 items-start justify-center">{!up && <span className={cn('w-full rounded-sm', cor(p))} style={{ height: h }} />}</div>
          </div>
        )
      })}
    </div>
  )
}

const FechamentoExcecao = () => {
  const data = useFechamentoExcecao()
  const { totalCaixas, unidades, turnos, okCount, okPct, revisarCount, investigarCount, fila, toleranciaLabel, baseCaveat, isLoading, hasEmpresa } = data
  const [vista, setVista] = useState<'fila' | 'panorama'>('fila')
  const [filtro, setFiltro] = useState<'todos' | 'investigar' | 'revisar'>('todos')
  const [selKey, setSelKey] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, Feedback>>(() => readFeedback())
  const [acao, setAcao] = useState<Record<string, 'investigar' | 'aceito'>>({})

  const filaFiltrada = useMemo(() => fila.filter((e) => filtro === 'todos' || e.classe === filtro), [fila, filtro])
  const sel: ExcecaoCaixa | null = useMemo(() => filaFiltrada.find((e) => e.key === selKey) ?? filaFiltrada[0] ?? null, [filaFiltrada, selKey])

  if (!hasEmpresa) return <SelectCompanyState />
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
        <Skeleton className="h-[420px] w-full rounded-2xl" />
      </div>
    )
  }
  const totalFila = fila.length

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#c7d2fe] bg-[#eef2ff] px-5 py-4 dark:border-indigo-900/50 dark:bg-indigo-950/30">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4f46e5] text-white"><Sparkles className="h-5 w-5" /></div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Você só precisa olhar <span className="text-[#4338ca] dark:text-indigo-400">{totalFila} de {totalCaixas} caixas</span>. O restante foi conferido e bate dentro da tolerância.</p>
            <p className="mt-0.5 text-[12.5px] text-gray-600 dark:text-gray-400">A IA classifica e explica cada diferença a partir dos valores já apurados pelo sistema — ela <strong>não recalcula</strong> nada. Agora com <strong>histórico de 90 dias</strong>: recorrência por operador e tolerância adaptativa por PDV.</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-gray-900 dark:text-emerald-400">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
          Análise read-only
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Caixas do dia" secondary={`${unidades} unidades · ${turnos} turnos`} value={String(totalCaixas)} sub={`${okCount} conferidos · ${totalFila} em exceção`} tone="neutral" Icon={Wallet} />
        <Kpi label="Conferidos OK" secondary="dentro da tolerância" value={String(okCount)} sub={`${okPct}% dos caixas · sem ação`} tone="ok" Icon={Check} />
        <Kpi label="Revisar" secondary="causa provável" value={String(revisarCount)} sub="diferença explicável" tone="revisar" Icon={Info} />
        <Kpi label="Investigar" secondary="risco elevado" value={String(investigarCount)} sub="recorrência ou valor alto" tone="investigar" Icon={AlertTriangle} />
      </div>

      {/* Toggle Fila ↔ Panorama */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
          {([['fila', 'Fila de exceção', Sparkles], ['panorama', 'Panorama', BarChart3]] as const).map(([id, lbl, Icon]) => (
            <button key={id} type="button" onClick={() => setVista(id)}
              className={cn('inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors',
                vista === id ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900 dark:text-gray-400')}>
              <Icon className="h-3.5 w-3.5" />{lbl}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-gray-400">{vista === 'fila' ? 'O que olhar e por quê — priorizado' : 'Onde estão as diferenças — visão agregada'}</span>
      </div>

      {vista === 'panorama' ? (
        <Panorama />
      ) : totalFila === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <ShieldCheck className="mx-auto h-8 w-8 text-emerald-400" />
          <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">Nenhum caixa precisa de atenção</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Todos dentro da banda adaptativa no período. Lembre: os OK entram em amostragem de auditoria.</p>
        </div>
      ) : (
        <>
        {/* Nota — o que a Fila é (vs Panorama). Mesma aparência índigo do Panorama. */}
        <div className="flex items-start gap-2.5 rounded-2xl border border-[#e0e7ff] bg-[#eef2ff] px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/20">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#4338ca] dark:text-indigo-400" />
          <p className="text-[12px] leading-relaxed text-[#3730a3] dark:text-indigo-300">
            Cada linha é <strong>UM caixa</strong> que estourou a tolerância (Revisar/Investigar) — caixas <strong>dentro da banda não aparecem</strong> aqui. O <strong>saldo total da rede</strong> (tudo somado, sobras − faltas) está no <strong>Panorama</strong>. Fila = agir nos casos; Panorama = entender o todo.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr]">
          {/* Fila */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Fila de exceção</h3>
              <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
                {([['todos', 'Todos'], ['investigar', 'Investigar'], ['revisar', 'Revisar']] as const).map(([id, lbl]) => (
                  <button key={id} type="button" onClick={() => setFiltro(id)}
                    className={cn('inline-flex h-7 items-center rounded-md px-3 text-xs font-medium transition-colors', filtro === id ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400')}>{lbl}</button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filaFiltrada.map((e) => {
                const m = CLASSE_META[e.classe]; const isSel = sel?.key === e.key
                return (
                  <button key={e.key} type="button" onClick={() => setSelKey(e.key)}
                    className={cn('flex w-full items-center gap-3 px-3 py-3 text-left transition-colors', isSel ? 'bg-[#eff6ff] dark:bg-blue-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40')}>
                    <span className={cn('h-10 w-1 shrink-0 rounded-full', m.accent)} />
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">{iniciais(e.operador)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13px] font-semibold text-gray-900 dark:text-gray-100">{e.operador}</span>
                        <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase', m.bg, m.text)}>{m.label}</span>
                      </span>
                      <span className="truncate text-[11px] text-gray-500 dark:text-gray-400">{e.pdvLabel} · {e.causa}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={cn('block text-[13px] font-bold tabular-nums', e.diferenca < 0 ? 'text-[#b91c1c] dark:text-red-400' : 'text-[#15803d] dark:text-emerald-400')}>{fmtDif(e.diferenca)}</span>
                      <span className="block text-[10px] text-gray-400">conf. {e.confianca}%</span>
                    </span>
                  </button>
                )
              })}
              {filaFiltrada.length === 0 && <p className="px-4 py-6 text-center text-xs text-gray-400">Sem caixas neste filtro.</p>}
            </div>
          </div>
          {sel && <CopilotoPanel sel={sel} baseCaveat={baseCaveat} feedback={feedback} setFeedback={setFeedback} acao={acao} setAcao={setAcao} />}
        </div>
        </>
      )}

      {/* Nota conceitual */}
      <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-4 text-[12px] leading-relaxed text-gray-500 dark:border-gray-700 dark:text-gray-400">
        <span className="inline-flex items-center gap-1 font-semibold text-gray-600 dark:text-gray-300"><Info className="h-3.5 w-3.5" /> Conceito Nível 1 · Fase 2 (read-only).</span>{' '}
        O motor determinístico calcula apurado e diferença; a IA classifica, explica e prioriza — <strong>nunca recalcula</strong>. A Fase 2 acrescenta <strong>recorrência histórica (90d)</strong> e <strong>tolerância adaptativa por PDV</strong><InfoHint text={toleranciaLabel} /> (a banda de "OK" é aprendida do histórico de cada posto, não uma constante). Auto-aprovação e lançamento de ajuste seguem como passo futuro (escrita + auditoria); os "OK" entram em amostragem de auditoria.
      </div>
    </div>
  )
}

/* ── Painel copiloto ── */
const CopilotoPanel = ({ sel, baseCaveat, feedback, setFeedback, acao, setAcao }: {
  sel: ExcecaoCaixa; baseCaveat: string
  feedback: Record<string, Feedback>; setFeedback: (f: Record<string, Feedback>) => void
  acao: Record<string, 'investigar' | 'aceito'>; setAcao: (a: Record<string, 'investigar' | 'aceito'>) => void
}) => {
  const m = CLASSE_META[sel.classe]; const fb = feedback[sel.key]; const ac = acao[sel.key]
  const h = sel.historico
  const [detalhe, setDetalhe] = useState(false)
  const onFb = (v: Feedback) => setFeedback(writeFeedback(sel.key, v))

  return (
    <>
    <div className="lg:sticky lg:top-4 lg:self-start">
      <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm dark:border-gray-700">
        <div className="flex items-center justify-between gap-2 bg-gradient-to-br from-[#1e3a5f] to-[#27496f] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Copiloto de fechamento</p>
            <p className="truncate text-sm font-semibold text-white">{sel.operador}</p>
            <p className="truncate text-[11px] text-white/60">{sel.pdvLabel} · {sel.turno} · {sel.data.split('-').reverse().join('/')}</p>
          </div>
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', m.bg, m.text)}>{m.label}</span>
        </div>

        <div className="space-y-4 bg-white p-5 dark:bg-gray-900">
          {/* 3 números */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { l: 'Apresentado', v: sel.apresentado != null ? formatCurrency(sel.apresentado) : '—' },
              { l: 'Apurado', v: formatCurrency(sel.apurado) },
              { l: 'Diferença', v: fmtDif(sel.diferenca), tone: sel.diferenca < 0 ? 'text-[#b91c1c] dark:text-red-400' : 'text-[#15803d] dark:text-emerald-400' },
            ].map((x) => (
              <div key={x.l} className="rounded-xl bg-gray-50 px-3 py-2 text-center dark:bg-gray-800/50">
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{x.l}</p>
                <p className={cn('mt-0.5 text-[13px] font-bold tabular-nums text-gray-900 dark:text-gray-100', x.tone)}>{x.v}</p>
              </div>
            ))}
          </div>
          <p className="flex items-center gap-1 text-[10px] text-gray-400"><Lock className="h-3 w-3" /> Valores apurados pelo sistema · a IA não recalcula.</p>

          {/* Tolerância adaptativa (Fase 2) */}
          <div className="flex items-start gap-2 rounded-xl border border-[#e0e7ff] bg-[#eef2ff] px-3 py-2.5 dark:border-indigo-900/50 dark:bg-indigo-950/20">
            <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-[#3730a3] dark:text-indigo-400" />
            <p className="text-[12px] text-[#3730a3] dark:text-indigo-300">
              Tolerância adaptativa <strong>{sel.pdvLabel}</strong>: ±{formatCurrency(sel.banda.valor)}{' '}
              <span className="text-[#4338ca]/70">({sel.banda.fonte === 'pdv90d' ? 'aprendida de 90d' : 'fixa — PDV sem histórico'})</span>.
              {sel.banda.excedePct > 0 && <> Diferença excede a banda em <strong>{Math.round(sel.banda.excedePct)}%</strong>.</>}
              <InfoHint text={baseCaveat} className="ml-1 text-[#4338ca]/60" />
            </p>
          </div>

          {/* Causa + tier + confiança */}
          <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                {sel.isCartao ? <CreditCard className="h-4 w-4 text-[#4338ca]" /> : <AlertTriangle className="h-4 w-4 text-[#b45309]" />}{sel.causa}
              </span>
              <span className="shrink-0 rounded-full bg-[#eef2ff] px-2 py-0.5 text-[10px] font-semibold text-[#4338ca] dark:bg-indigo-900/30 dark:text-indigo-400">{CAUSA_TIER_META[sel.causaTier].label}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full rounded-full bg-[#4f46e5]" style={{ width: `${sel.confianca}%` }} /></div>
              <span className="text-[11px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">{sel.confianca}%</span>
              <InfoHint text="Confiança = força do casamento dos sinais determinísticos (proporção que casa), não um peso arbitrário." />
            </div>
          </div>

          {/* Evidências */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Como a IA chegou aqui</p>
            <ul className="mt-2 space-y-2">
              {sel.evidencias.map((ev, i) => {
                const t = TIER_META[ev.tier]
                return (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span className="min-w-0 text-[12.5px] leading-snug text-gray-700 dark:text-gray-300">{ev.texto}{' '}<span className={cn('ml-0.5 inline-block rounded px-1 py-0.5 text-[9px] font-semibold uppercase', t.bg, t.text)}>{t.label}</span></span>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Histórico 90d (Fase 2) */}
          <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"><RotateCcw className="h-3.5 w-3.5" /> Histórico do operador</span>
              <span className="rounded-full bg-[#e0e7ff] px-1.5 py-0.5 text-[9px] font-semibold text-[#4338ca] dark:bg-indigo-900/30 dark:text-indigo-400">FASE 2 · 90 DIAS</span>
            </div>
            {h.serie.length > 0 ? <Sparkline serie={h.serie} /> : <p className="mt-2 text-[11px] text-gray-400">Sem histórico no período.</p>}
            {h.padrao && (
              <div className={cn('mt-1 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium', h.alta ? 'bg-[#fee2e2] text-[#b91c1c] dark:bg-red-900/30 dark:text-red-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300')}>
                <RotateCcw className="h-3 w-3" /> Padrão: {h.padrao}{h.alta && ' (recorrência alta)'}
              </div>
            )}
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              {[
                { l: 'caixas c/ dif', v: String(h.comDif) },
                { l: 'taxa vs total', v: `${Math.round(h.ratePct)}%` },
                { l: 'média da rede', v: `${Math.round(h.redeRatePct)}%` },
              ].map((x) => (
                <div key={x.l}><p className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{x.v}</p><p className="text-[9px] uppercase tracking-wide text-gray-400">{x.l}</p></div>
              ))}
            </div>
          </div>

          {/* Ações (locais) */}
          <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
            <div className="flex gap-2">
              {sel.classe === 'investigar' ? (
                <button type="button" onClick={() => setAcao({ ...acao, [sel.key]: 'investigar' })} className={cn('flex-1 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-colors', ac === 'investigar' ? 'bg-[#b91c1c] text-white' : 'bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fecaca] dark:bg-red-900/30 dark:text-red-400')}>{ac === 'investigar' ? '✓ Marcado p/ investigar' : 'Marcar p/ investigar'}</button>
              ) : (
                <button type="button" onClick={() => setAcao({ ...acao, [sel.key]: 'aceito' })} className={cn('flex-1 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-colors', ac === 'aceito' ? 'bg-[#1e3a5f] text-white' : 'bg-[#1e3a5f]/10 text-[#1e3a5f] hover:bg-[#1e3a5f]/20 dark:bg-blue-900/30 dark:text-blue-300')}>{ac === 'aceito' ? '✓ Explicação aceita' : 'Aceitar explicação'}</button>
              )}
              <button type="button" onClick={() => setDetalhe(true)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-[12.5px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">{sel.isCartao ? 'Rever taxa' : 'Abrir detalhe do caixa'} <ArrowUpRight className="h-3.5 w-3.5" /></button>
            </div>
            <p className="text-[10px] text-gray-400">A decisão e o registro são do gestor — nada é gravado.</p>
          </div>

          {/* Feedback */}
          <div className={cn('flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5', fb ? 'border-emerald-200 bg-[#f0fdf4] dark:border-emerald-900/50 dark:bg-emerald-950/20' : 'border-gray-100 dark:border-gray-800')}>
            <p className="text-[12px] text-gray-600 dark:text-gray-300">{fb ? 'Obrigado — isso treina o copiloto.' : 'Esta explicação ajudou?'}</p>
            <div className="flex shrink-0 gap-1.5">
              <button type="button" onClick={() => onFb('up')} aria-label="Ajudou" className={cn('flex h-7 w-7 items-center justify-center rounded-lg transition-colors', fb === 'up' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800')}><ThumbsUp className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => onFb('down')} aria-label="Não ajudou" className={cn('flex h-7 w-7 items-center justify-center rounded-lg transition-colors', fb === 'down' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800')}><ThumbsDown className="h-3.5 w-3.5" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
    {detalhe && <CaixaDetalheModal sel={sel} onClose={() => setDetalhe(false)} />}
    </>
  )
}

/* ── Modal "detalhe do caixa" — apresentado × apurado × diferença por forma ── */
const CaixaDetalheModal = ({ sel, onClose }: { sel: ExcecaoCaixa; onClose: () => void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
    <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Detalhe do caixa · {sel.operador}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{sel.pdvLabel} · {sel.turno} · {sel.data.split('-').reverse().join('/')}</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-4 w-4" /></button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-5">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-gray-100 text-[10px] uppercase tracking-wide text-gray-400 dark:border-gray-800">
              <th className="py-1.5 text-left font-medium">Forma</th>
              <th className="py-1.5 text-right font-medium">Apresentado</th>
              <th className="py-1.5 text-right font-medium">Apurado</th>
              <th className="py-1.5 text-right font-medium">Diferença</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
            {sel.formasDetalhe.map((f) => (
              <tr key={f.nome}>
                <td className="py-1.5 text-gray-700 dark:text-gray-300">{f.nome}</td>
                <td className="py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{formatCurrency(f.apresentado)}</td>
                <td className="py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-400">{formatCurrency(f.apurado)}</td>
                <td className={cn('py-1.5 text-right font-semibold tabular-nums', Math.abs(f.diferenca) < 0.005 ? 'text-gray-400' : f.diferenca < 0 ? 'text-[#b91c1c]' : 'text-[#15803d]')}>{Math.abs(f.diferenca) < 0.005 ? formatCurrency(0) : fmtDif(f.diferenca)}</td>
              </tr>
            ))}
            {sel.formasDetalhe.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-xs text-gray-400">Sem quebra por forma para este caixa.</td></tr>}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 font-semibold dark:border-gray-700">
              <td className="py-2 text-gray-800 dark:text-gray-200">Total</td>
              <td className="py-2 text-right tabular-nums text-gray-800 dark:text-gray-200">{sel.apresentado != null ? formatCurrency(sel.apresentado) : '—'}</td>
              <td className="py-2 text-right tabular-nums text-gray-800 dark:text-gray-200">{formatCurrency(sel.apurado)}</td>
              <td className={cn('py-2 text-right tabular-nums', sel.diferenca < 0 ? 'text-[#b91c1c]' : 'text-[#15803d]')}>{fmtDif(sel.diferenca)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="mt-4 flex items-center gap-1 text-[10px] text-gray-400"><Lock className="h-3 w-3" /> Valores apurados pelo sistema · read-only, nada é gravado.</p>
      </div>
    </div>
  </div>
)

/* ── Barra divergente em torno do zero ── */
const Divergente = ({ valor, max }: { valor: number; max: number }) => {
  const pct = max > 0 ? (Math.abs(valor) / max) * 50 : 0
  const neg = valor < 0
  return (
    <div className="relative h-4 flex-1">
      <div className="absolute left-1/2 top-0 h-full w-px bg-gray-300 dark:bg-gray-600" />
      <div className={cn('absolute top-0 h-full rounded-sm', neg ? 'bg-[#fca5a5]' : 'bg-[#86efac]')} style={neg ? { right: '50%', width: `${pct}%` } : { left: '50%', width: `${pct}%` }} />
    </div>
  )
}

/* ── Panorama (cortes da antiga Diferenças) ── */
const Panorama = () => {
  const dif = useDiferencasCaixa()
  const [modal, setModal] = useState<{ forma: string; isCartao: boolean; valor: number } | null>(null)

  const maxResp = Math.max(1, ...dif.porResponsavel.map((r) => Math.abs(r.liquido)))
  const maxDia = Math.max(1, ...dif.porDia.map((d) => Math.abs(d.valor)))
  const respOrd = [...dif.porResponsavel].sort((a, b) => Math.abs(b.liquido) - Math.abs(a.liquido))
  const diaOrd = dif.porDia.slice(-30)

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Nota explicativa — o que é falta/sobra e como os 2 cortes se relacionam */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-[#e0e7ff] bg-[#eef2ff] px-4 py-3 dark:border-indigo-900/50 dark:bg-indigo-950/20 lg:col-span-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#4338ca] dark:text-indigo-400" />
        <p className="text-[12px] leading-relaxed text-[#3730a3] dark:text-indigo-300">
          <strong>Falta (−)</strong> = o operador entregou <strong>menos</strong> dinheiro do que o sistema esperava · <strong>Sobra (+)</strong> = entregou <strong>mais</strong>.
          {' '}<strong>“Por responsável”</strong> mostra <strong>quem</strong> está com diferença; <strong>“Onde está a diferença”</strong> mostra o <strong>líquido por forma</strong> — as sobras e faltas se cancelam, por isso o total da rede fica pequeno e quase tudo aparece em <strong>Dinheiro</strong> (a única forma contada à mão). São a mesma diferença por ângulos diferentes.
        </p>
      </div>

      {/* Por responsável */}
      <Card titulo="Por responsável" sub="Líquido de diferença no período · sobra ▲ / falta ▼">
        <div className="space-y-2">
          {respOrd.map((r) => (
            <div key={r.nome} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-[12px] text-gray-700 dark:text-gray-300">{r.nome}</span>
              <Divergente valor={r.liquido} max={maxResp} />
              <span className={cn('w-20 shrink-0 text-right text-[12px] font-semibold tabular-nums', r.liquido < 0 ? 'text-[#b91c1c]' : 'text-[#15803d]')}>{fmtDif(r.liquido)}</span>
            </div>
          ))}
          {respOrd.length === 0 && <p className="text-center text-xs text-gray-400">Sem diferenças no período.</p>}
        </div>
      </Card>

      {/* Onde está a diferença (por forma) */}
      <Card titulo="Onde está a diferença" sub="Líquido por forma de pagamento">
        <div className="space-y-1">
          {dif.porForma.map((f) => {
            const ic = formaIcon(f.nome)
            return (
              <button key={f.nome} type="button" onClick={() => !f.isNaoConferido && setModal({ forma: f.nome, isCartao: f.isCartao, valor: f.valor })}
                className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left', f.isNaoConferido ? 'cursor-default' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40')}>
                <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', ic.bg)}><ic.Icon className={cn('h-4 w-4', ic.text)} /></span>
                <span className="flex-1 truncate text-[12.5px] font-medium text-gray-700 dark:text-gray-300">{f.nome}</span>
                <span className={cn('text-[12.5px] font-semibold tabular-nums', f.valor < 0 ? 'text-[#b91c1c]' : 'text-[#15803d]')}>{fmtDif(f.valor)}</span>
                {!f.isNaoConferido && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
              </button>
            )
          })}
          {dif.porForma.length === 0 && <p className="text-center text-xs text-gray-400">Sem diferenças por forma.</p>}
        </div>
      </Card>

      {/* Diferença por dia */}
      <Card titulo="Diferença por dia" sub="Líquido diário · 30 dias · sobra ▲ verde / falta ▼ vermelho" full>
        <div className="flex h-32 items-center gap-1">
          {diaOrd.map((d) => {
            const hh = Math.max(2, Math.round((Math.abs(d.valor) / maxDia) * 52)); const up = d.valor >= 0
            return (
              <div key={d.dia} className="flex h-full flex-1 flex-col justify-center" title={`${d.dia}: ${fmtDif(d.valor)}`}>
                <div className="flex flex-1 items-end justify-center">{up && <span className="w-full rounded-sm bg-[#86efac]" style={{ height: hh }} />}</div>
                <div className="h-px w-full bg-gray-200 dark:bg-gray-700" />
                <div className="flex flex-1 items-start justify-center">{!up && <span className="w-full rounded-sm bg-[#fca5a5]" style={{ height: hh }} />}</div>
              </div>
            )
          })}
          {diaOrd.length === 0 && <p className="w-full text-center text-xs text-gray-400">Sem dados.</p>}
        </div>
      </Card>

      <p className="text-[11px] italic text-gray-400 lg:col-span-2">Panorama incorpora os cortes agregados da antiga aba Diferenças.</p>

      {modal && <FormaModal modal={modal} caixaCodigos={dif.caixaCodigos} pdvByCaixa={dif.pdvByCaixa} formaPorPosto={dif.formaPorPosto} onClose={() => setModal(null)} />}
    </div>
  )
}

const Card = ({ titulo, sub, full, children }: { titulo: string; sub: string; full?: boolean; children: React.ReactNode }) => (
  <div className={cn('rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900', full && 'lg:col-span-2')}>
    <h3 className="text-[14px] font-semibold text-gray-900 dark:text-gray-100">{titulo}</h3>
    <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{sub}</p>
    <div className="mt-3">{children}</div>
  </div>
)

/* ── Modal de composição (bandeira p/ cartão · posto p/ demais) ── */
const FormaModal = ({ modal, caixaCodigos, pdvByCaixa, formaPorPosto, onClose }: {
  modal: { forma: string; isCartao: boolean; valor: number }
  caixaCodigos: number[]; pdvByCaixa: Map<number, string>
  formaPorPosto: Map<string, { posto: string; valor: number }[]>
  onClose: () => void
}) => {
  const ehCartao = modal.isCartao || isCartaoForma(modal.forma)
  const card = useCartaoBreakdown(caixaCodigos, pdvByCaixa, ehCartao)
  // Filtra a bandeira pelo tipo do clique (Crédito/Débito) quando aplicável.
  const tipoClicado = /CRED/i.test(modal.forma) ? 'Crédito' : /DEB/i.test(modal.forma) ? 'Débito' : null
  const linhasCartao = useMemo(() => card.linhas.filter((l) => !tipoClicado || l.tipo === tipoClicado), [card.linhas, tipoClicado])

  // Já vem no escopo certo (fechados + dedup) do useDiferencasCaixa → soma = linha.
  const linhasPosto = formaPorPosto.get(modal.forma) ?? []

  const tipo = ehCartao ? 'Composição por bandeira' : 'Por posto'
  const maxV = ehCartao ? Math.max(1, ...linhasCartao.map((l) => l.valor)) : Math.max(1, ...linhasPosto.map((l) => Math.abs(l.valor)))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-gray-900" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div>
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-gray-100">{ehCartao ? <CreditCard className="h-4 w-4 text-[#4338ca]" /> : <Building2 className="h-4 w-4 text-gray-400" />}{modal.forma}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">{tipo}{!ehCartao && <> · líquido {fmtDif(modal.valor)}</>}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-5">
          {ehCartao ? (
            <>
              <p className="mb-3 rounded-lg bg-[#eef2ff] px-3 py-2 text-[11px] text-[#4338ca] dark:bg-indigo-950/30">Composição do cartão por bandeira (volume transacionado) — a <strong>diferença</strong> existe no nível da forma (Crédito/Débito), não por bandeira.</p>
              {card.isLoading ? <p className="text-center text-xs text-gray-400">Carregando…</p> : linhasCartao.length === 0 ? <p className="text-center text-xs text-gray-400">Sem transações de cartão nos caixas.</p> : (
                <div className="space-y-2">
                  {linhasCartao.map((l) => (
                    <div key={l.key} className="flex items-center gap-2">
                      <span className="w-28 shrink-0 truncate text-[12px] text-gray-700 dark:text-gray-300">{l.bandeira} <span className="text-gray-400">{l.tipo}</span></span>
                      <div className="h-3 flex-1 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-800"><div className="h-full rounded-sm bg-[#86efac]" style={{ width: `${(l.valor / maxV) * 100}%` }} /></div>
                      <span className="w-20 shrink-0 text-right text-[12px] font-semibold tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(l.valor)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : linhasPosto.length === 0 ? <p className="text-center text-xs text-gray-400">Sem quebra por posto.</p> : (
            <div className="space-y-2">
              {linhasPosto.map((l) => (
                <div key={l.posto} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 truncate text-[12px] text-gray-700 dark:text-gray-300">{l.posto}</span>
                  <div className="h-3 flex-1 overflow-hidden rounded-sm bg-gray-100 dark:bg-gray-800"><div className={cn('h-full rounded-sm', l.valor < 0 ? 'bg-[#fca5a5]' : 'bg-[#86efac]')} style={{ width: `${(Math.abs(l.valor) / maxV) * 100}%` }} /></div>
                  <span className={cn('w-20 shrink-0 text-right text-[12px] font-semibold tabular-nums', l.valor < 0 ? 'text-[#b91c1c]' : 'text-[#15803d]')}>{fmtDif(l.valor)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 flex items-center gap-1 text-[10px] text-gray-400"><Lock className="h-3 w-3" /> Read-only · valores do sistema.</p>
        </div>
      </div>
    </div>
  )
}

export default FechamentoExcecao

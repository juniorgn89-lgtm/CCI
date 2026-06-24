import { useMemo, useState } from 'react'
import {
  Sparkles, Lock, CreditCard, Check, AlertTriangle, RotateCcw, ThumbsUp, ThumbsDown,
  ArrowUpRight, Info, ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'
import InfoHint from '@/components/ui/InfoHint'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { Skeleton } from '@/components/ui/skeleton'
import useFechamentoExcecao, {
  type ExcecaoCaixa, type ExcecaoClasse, type CausaTier, type EvidenciaTier,
} from '@/pages/CaixasTurnos/hooks/useFechamentoExcecao'

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
  atual: { label: 'Verificável agora' },
  historico: { label: 'Requer histórico' },
  misto: { label: 'Verificável + histórico' },
}

const TIER_META: Record<EvidenciaTier, { label: string; text: string; bg: string }> = {
  atual: { label: 'dado atual', text: 'text-[#16a34a] dark:text-emerald-400', bg: 'bg-[#f0fdf4] dark:bg-emerald-900/20' },
  historico: { label: 'histórico', text: 'text-[#4338ca] dark:text-indigo-400', bg: 'bg-[#eef2ff] dark:bg-indigo-900/20' },
}

/* ── KPI card ── */
const Kpi = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: 'neutral' | ExcecaoClasse }) => {
  const meta = tone === 'neutral' ? null : CLASSE_META[tone]
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={cn('mt-1.5 text-2xl font-bold tabular-nums', meta ? meta.text : 'text-gray-900 dark:text-gray-100')}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">{sub}</p>}
    </div>
  )
}

const FechamentoExcecao = () => {
  const data = useFechamentoExcecao()
  const { totalCaixas, okCount, okPct, revisarCount, investigarCount, fila, toleranciaLabel, isLoading, hasEmpresa } = data
  const [filtro, setFiltro] = useState<'todos' | 'investigar' | 'revisar'>('todos')
  const [selKey, setSelKey] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<string, Feedback>>(() => readFeedback())
  // Ações locais (sem escrita): marcado p/ investigar / aceito.
  const [acao, setAcao] = useState<Record<string, 'investigar' | 'aceito'>>({})

  const filaFiltrada = useMemo(
    () => fila.filter((e) => filtro === 'todos' || e.classe === filtro),
    [fila, filtro],
  )
  const sel: ExcecaoCaixa | null = useMemo(
    () => filaFiltrada.find((e) => e.key === selKey) ?? filaFiltrada[0] ?? null,
    [filaFiltrada, selKey],
  )

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
      {/* 1 · Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#c7d2fe] bg-[#eef2ff] px-5 py-4 dark:border-indigo-900/50 dark:bg-indigo-950/30">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#4f46e5] text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Você só precisa olhar <span className="text-[#4338ca] dark:text-indigo-400">{totalFila} de {totalCaixas} caixas</span>.
            </p>
            <p className="mt-0.5 text-[12.5px] text-gray-600 dark:text-gray-400">
              A IA classifica e prioriza — <strong>não recalcula valores</strong> e <strong>nada é automático</strong>. Os números vêm do motor do sistema.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-gray-900 dark:text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Análise read-only
        </span>
      </div>

      {/* 2 · KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Caixas do dia" value={String(totalCaixas)} tone="neutral" />
        <Kpi label="Conferidos OK" value={String(okCount)} sub={`${okPct}% · sem ação`} tone="ok" />
        <Kpi label="Revisar" value={String(revisarCount)} tone="revisar" />
        <Kpi label="Investigar" value={String(investigarCount)} tone="investigar" />
      </div>

      {totalFila === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <ShieldCheck className="mx-auto h-8 w-8 text-emerald-400" />
          <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">Nenhum caixa precisa de atenção</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Todos dentro da tolerância no período. Lembre: os OK entram em amostragem de auditoria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr]">
          {/* 3 · Fila de exceção */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Fila de exceção</h3>
              <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
                {([['todos', 'Todos'], ['investigar', 'Investigar'], ['revisar', 'Revisar']] as const).map(([id, lbl]) => (
                  <button key={id} type="button" onClick={() => setFiltro(id)}
                    className={cn('inline-flex h-7 items-center rounded-md px-3 text-xs font-medium transition-colors',
                      filtro === id ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50')}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filaFiltrada.map((e) => {
                const m = CLASSE_META[e.classe]
                const isSel = sel?.key === e.key
                return (
                  <button key={e.key} type="button" onClick={() => setSelKey(e.key)}
                    className={cn('flex w-full items-center gap-3 px-3 py-3 text-left transition-colors',
                      isSel ? 'bg-[#eff6ff] dark:bg-blue-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40')}>
                    <span className={cn('h-10 w-1 shrink-0 rounded-full', m.accent)} />
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {iniciais(e.operador)}
                    </span>
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

          {/* 4 · Painel copiloto */}
          {sel && <CopilotoPanel sel={sel} feedback={feedback} setFeedback={setFeedback} acao={acao} setAcao={setAcao} />}
        </div>
      )}

      {/* 5 · Nota conceitual */}
      <div className="rounded-2xl border border-dashed border-gray-300 px-5 py-4 text-[12px] leading-relaxed text-gray-500 dark:border-gray-700 dark:text-gray-400">
        <span className="inline-flex items-center gap-1 font-semibold text-gray-600 dark:text-gray-300"><Info className="h-3.5 w-3.5" /> Nível 1 — copiloto read-only.</span>{' '}
        A IA classifica e explica; <strong>não grava nada</strong>. Os caixas OK <strong>não são definitivos</strong> — entram em amostragem de auditoria aleatória. Auto-aprovação e lançamento de ajuste são fase futura (exigem escrita + auditoria). Tolerância: {toleranciaLabel}.
      </div>
    </div>
  )
}

/* ── Painel copiloto (coluna direita) ── */
const CopilotoPanel = ({ sel, feedback, setFeedback, acao, setAcao }: {
  sel: ExcecaoCaixa
  feedback: Record<string, Feedback>
  setFeedback: (f: Record<string, Feedback>) => void
  acao: Record<string, 'investigar' | 'aceito'>
  setAcao: (a: Record<string, 'investigar' | 'aceito'>) => void
}) => {
  const m = CLASSE_META[sel.classe]
  const fb = feedback[sel.key]
  const ac = acao[sel.key]
  const onFb = (v: Feedback) => setFeedback(writeFeedback(sel.key, v))

  return (
    <div className="lg:sticky lg:top-4 lg:self-start">
      <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm dark:border-gray-700">
        {/* Header navy */}
        <div className="flex items-center justify-between gap-2 bg-gradient-to-br from-[#1e3a5f] to-[#27496f] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">Copiloto de fechamento</p>
            <p className="truncate text-sm font-semibold text-white">{sel.operador}</p>
            <p className="truncate text-[11px] text-white/60">{sel.pdvLabel} · {sel.turno} · {sel.data.split('-').reverse().join('/')}</p>
          </div>
          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', m.bg, m.text)}>{m.label}</span>
        </div>

        <div className="space-y-4 bg-white p-5 dark:bg-gray-900">
          {/* 3 números do motor */}
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

          {/* Causa provável + tier + confiança */}
          <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-gray-900 dark:text-gray-100">
                {sel.isCartao ? <CreditCard className="h-4 w-4 text-[#4338ca]" /> : <AlertTriangle className="h-4 w-4 text-[#b45309]" />}
                {sel.causa}
              </span>
              <span className="shrink-0 rounded-full bg-[#eef2ff] px-2 py-0.5 text-[10px] font-semibold text-[#4338ca] dark:bg-indigo-900/30 dark:text-indigo-400">{CAUSA_TIER_META[sel.causaTier].label}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div className="h-full rounded-full bg-[#4f46e5]" style={{ width: `${sel.confianca}%` }} />
              </div>
              <span className="text-[11px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">{sel.confianca}%</span>
              <InfoHint text="Confiança = força do casamento dos sinais determinísticos (proporção que casa), não um peso arbitrário." />
            </div>
          </div>

          {/* Como a IA chegou aqui — evidências */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Como a IA chegou aqui</p>
            <ul className="mt-2 space-y-2">
              {sel.evidencias.map((ev, i) => {
                const t = TIER_META[ev.tier]
                return (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span className="min-w-0 text-[12.5px] leading-snug text-gray-700 dark:text-gray-300">
                      {ev.texto}{' '}
                      <span className={cn('ml-0.5 inline-block rounded px-1 py-0.5 text-[9px] font-semibold uppercase', t.bg, t.text)}>{t.label}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Recorrência */}
          {sel.recorrencia.count > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/50">
              <RotateCcw className="h-4 w-4 shrink-0 text-gray-400" />
              <p className="text-[12px] text-gray-600 dark:text-gray-300">
                Recorrência: <strong>{sel.recorrencia.count} de {sel.recorrencia.total}</strong> caixas com diferença no período ({Math.round(sel.recorrencia.ratePct)}%, normalizado por exposição).
                {sel.recorrencia.alta && <span className="ml-1 font-semibold text-[#b91c1c] dark:text-red-400">recorrência alta</span>}
              </p>
            </div>
          )}

          {/* Ações sugeridas (locais, sem escrita) */}
          <div className="space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
            <div className="flex gap-2">
              {sel.classe === 'investigar' ? (
                <button type="button" onClick={() => setAcao({ ...acao, [sel.key]: 'investigar' })}
                  className={cn('flex-1 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-colors', ac === 'investigar' ? 'bg-[#b91c1c] text-white' : 'bg-[#fee2e2] text-[#b91c1c] hover:bg-[#fecaca] dark:bg-red-900/30 dark:text-red-400')}>
                  {ac === 'investigar' ? '✓ Marcado p/ investigar' : 'Marcar p/ investigar'}
                </button>
              ) : (
                <button type="button" onClick={() => setAcao({ ...acao, [sel.key]: 'aceito' })}
                  className={cn('flex-1 rounded-lg px-3 py-2 text-[12.5px] font-semibold transition-colors', ac === 'aceito' ? 'bg-[#1e3a5f] text-white' : 'bg-[#1e3a5f]/10 text-[#1e3a5f] hover:bg-[#1e3a5f]/20 dark:bg-blue-900/30 dark:text-blue-300')}>
                  {ac === 'aceito' ? '✓ Explicação aceita' : 'Aceitar explicação'}
                </button>
              )}
              <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-2 text-[12.5px] font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                {sel.isCartao ? 'Rever taxa' : 'Abrir caixa'} <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[10px] text-gray-400">A decisão e o registro são do gestor — nada é gravado.</p>
          </div>

          {/* Feedback 👍/👎 — coletor de rótulo */}
          <div className={cn('flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5',
            fb ? 'border-emerald-200 bg-[#f0fdf4] dark:border-emerald-900/50 dark:bg-emerald-950/20' : 'border-gray-100 dark:border-gray-800')}>
            <p className="text-[12px] text-gray-600 dark:text-gray-300">{fb ? 'Obrigado — isso treina o copiloto.' : 'Esta explicação ajudou?'}</p>
            <div className="flex shrink-0 gap-1.5">
              <button type="button" onClick={() => onFb('up')} aria-label="Ajudou"
                className={cn('flex h-7 w-7 items-center justify-center rounded-lg transition-colors', fb === 'up' ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800')}>
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" onClick={() => onFb('down')} aria-label="Não ajudou"
                className={cn('flex h-7 w-7 items-center justify-center rounded-lg transition-colors', fb === 'down' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-gray-800')}>
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FechamentoExcecao

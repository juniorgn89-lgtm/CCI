import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Sun, X, BarChart3, Sparkles, SlidersHorizontal, Calendar, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { useFilterStore } from '@/store/filters'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { MODULOS } from '@/lib/modulos'
import { todayLocal } from '@/lib/period'
import { formatCurrencyShort, formatLitersShort } from '@/lib/formatters'
import useBriefingResumo from '@/components/briefing/useBriefingResumo'

const pad = (n: number) => String(n).padStart(2, '0')
const isoMinusDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d - n)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}
const saudacao = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const dataExtenso = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  const wd = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'][new Date(y, m - 1, d).getDay()]
  return `${wd} · ${d} ${MESES[m - 1].toUpperCase()} ${y}`
}
const ddmmyyyy = (iso: string) => iso.split('-').reverse().join('/')
/** R$/L com 2 casas (padrão do design do briefing). */
const rl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
/** Renderiza texto com **trechos** em negrito. */
const rich = (s: string) => s.split('**').map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>))

const DeltaPill = ({ v }: { v: number | null }) => {
  if (v == null) return <span className="text-[10px] text-gray-400">sem base</span>
  const up = v >= 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
      up ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300')}>
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{up ? '+' : ''}{v.toFixed(1)}%
    </span>
  )
}

const BriefingModal = () => {
  const navigate = useNavigate()
  const seenToday = useAuthStore((s) => s.briefingSeenToday)
  const setSeen = useAuthStore((s) => s.setBriefingSeenToday)
  const onboardingSeen = useAuthStore((s) => s.onboardingSeen)
  const fullName = useAuthStore((s) => s.fullName)
  const isMaster = useAuthStore((s) => s.isMaster)
  const modulosPermitidos = useAuthStore((s) => s.modulosPermitidos)
  const rede = useTenantStore((s) => s.rede)
  const setPeriodo = useFilterStore((s) => s.setPeriodo)
  const setEmpresas = useFilterStore((s) => s.setEmpresas)

  // Fechamento de sessão: permite "fechar sem marcar" (checkbox desmarcado) sem
  // reabrir na hora. Reabertura deliberada (menu "Briefing do dia") zera o store
  // seenToday true→false → o efeito abaixo reabre.
  const [closed, setClosed] = useState(false)
  const prevSeen = useRef(seenToday)
  useEffect(() => {
    if (prevSeen.current === true && seenToday === false) setClosed(false)
    prevSeen.current = seenToday
  }, [seenToday])

  const open = !seenToday && onboardingSeen && !!rede && !closed
  const resumo = useBriefingResumo(open)

  const mods = useMemo(
    () => MODULOS.filter((m) => isMaster || !modulosPermitidos || modulosPermitidos.length === 0 || modulosPermitidos.includes(m.id)),
    [isMaster, modulosPermitidos],
  )
  const [modPath, setModPath] = useState('')
  const modSel = modPath || mods.find((m) => m.id === 'dashboard')?.path || mods[0]?.path || '/dashboard'

  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 30 * 60 * 1000,
    enabled: open,
  })
  const postos = useEmpresasPermitidas(empresasData?.resultados ?? [])

  const [periodo, setPeriodoSel] = useState<'atual' | 'passado'>('atual')
  const [escopo, setEscopo] = useState<'fechado' | 'aberto'>('fechado')
  const [postoSel, setPostoSel] = useState<number | null>(null)
  const [naoMostrar, setNaoMostrar] = useState(true)

  const range = useMemo(() => {
    const hoje = todayLocal()
    const [y, m] = hoje.split('-').map(Number)
    if (periodo === 'passado') {
      const py = m === 1 ? y - 1 : y
      const pm = m === 1 ? 12 : m - 1
      const last = new Date(py, pm, 0).getDate()
      return { ini: `${py}-${pad(pm)}-01`, fim: `${py}-${pad(pm)}-${pad(last)}` }
    }
    const ini = `${y}-${pad(m)}-01`
    const ontem = isoMinusDays(hoje, 1)
    const fim = escopo === 'aberto' ? hoje : (ontem >= ini ? ontem : ini)
    return { ini, fim }
  }, [periodo, escopo])

  // Frase de leitura DETERMINÍSTICA (decomposição volume × margem da ΔLB).
  const leitura = useMemo(() => {
    const { volumeEffect: vol, marginEffect: marg, deltaLB, deltaLitros, deltaLbPorLitroAbs } = resumo
    if (!resumo.hasData || deltaLB == null) return null
    const litrosTxt = deltaLitros != null ? `os litros ${deltaLitros >= 0 ? 'subiram' : 'caíram'} ${Math.abs(deltaLitros).toFixed(1)}%` : null
    const rlTxt = deltaLbPorLitroAbs != null ? `${deltaLbPorLitroAbs >= 0 ? '+' : '−'}${rl(Math.abs(deltaLbPorLitroAbs))}/L` : null
    if (deltaLB >= 0) {
      if (marg > vol) return `Lucro subiu puxado por **margem**${rlTxt ? ` (${rlTxt})` : ''}, não por volume${litrosTxt ? ` — ${litrosTxt}` : ''}. Ganho saudável.`
      if (vol > 0 && marg <= 0) return `Lucro subiu por **volume**${litrosTxt ? ` (${litrosTxt})` : ''}; a margem por litro recuou${rlTxt ? ` (${rlTxt})` : ''}. Atenção pra não trocar lucro por litro.`
      return `Lucro subiu — **volume e margem** somaram${litrosTxt ? ` (${litrosTxt})` : ''}.`
    }
    return `Lucro caiu ${Math.abs(deltaLB).toFixed(1)}% vs a ${resumo.diaSemana} passada — ${Math.abs(marg) >= Math.abs(vol) ? '**a margem por litro**' : '**o volume**'} puxou pra baixo.`
  }, [resumo])

  const dismiss = () => {
    setClosed(true)
    if (naoMostrar) {
      setSeen(true)
      supabase?.rpc('mark_briefing_seen').then(({ error }) => { if (error) console.warn('[briefing] mark error:', error.message) })
    }
  }
  const analisar = () => {
    setPeriodo(range.ini, range.fim)
    setEmpresas(postoSel != null ? [postoSel] : [])
    dismiss()
    navigate(modSel)
  }

  const Pill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick}
      className={cn('rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors',
        active ? 'bg-[#1e3a5f] text-white shadow-sm' : 'text-gray-600 hover:bg-gray-200/60 dark:text-gray-300')}>
      {children}
    </button>
  )
  const selCls = 'rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] font-medium dark:border-gray-700 dark:bg-gray-800'

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss() }}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden rounded-[22px] p-0 [&>button]:hidden">
        {/* Header navy */}
        <div className="relative bg-gradient-to-br from-[#1e3a5f] to-[#27496f] px-6 pb-5 pt-5">
          <div className="flex items-start gap-3">
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#fbbf24] to-[#f59e0b]">
              <span className="absolute inset-0 rounded-xl shadow-[0_0_22px_6px_rgba(245,197,24,.25)]" />
              <Sun className="relative h-5 w-5 text-white" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">{dataExtenso(resumo.ontem)}</p>
              <DialogTitle className="text-[21px] font-bold leading-tight text-white">
                {saudacao()}{fullName ? `, ${fullName.split(' ')[0]}` : ''}
              </DialogTitle>
            </div>
            <button type="button" onClick={dismiss} aria-label="Fechar"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <DialogDescription className="mt-1.5 text-[13px] text-white/70">
            Aqui está o resumo de ontem — e um atalho pra começar sua análise do dia.
          </DialogDescription>
        </div>

        {/* Body */}
        <div className="space-y-3 px-6 py-4">
          {/* Label de contexto */}
          <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-gray-400">
            <BarChart3 className="h-3.5 w-3.5" /> Combustível · ontem ({resumo.diaSemana}) vs {resumo.diaSemana} passada
          </p>

          {/* KPIs */}
          {resumo.isLoading ? (
            <div className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
          ) : !resumo.hasData ? (
            <div className="rounded-2xl border border-gray-200 p-4 text-center text-[12px] text-gray-400 dark:border-gray-700">
              Ontem ainda não fechou no cache de apuração — confira mais tarde.
            </div>
          ) : (
            <div className="grid grid-cols-[1.5fr_1fr_1fr] overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700">
              <div className="border-r border-gray-100 bg-gradient-to-br from-[#f0f6ff] to-white p-3.5 dark:border-gray-800 dark:from-blue-950/20 dark:to-gray-900">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Lucro bruto</p>
                <p className="mt-0.5 text-[30px] font-extrabold leading-none tabular-nums text-[#1e3a5f] dark:text-blue-200">{formatCurrencyShort(resumo.lb)}</p>
                <div className="mt-1.5"><DeltaPill v={resumo.deltaLB} /></div>
              </div>
              <div className="border-r border-gray-100 p-3.5 dark:border-gray-800">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Lucro / litro</p>
                <p className="mt-0.5 text-[21px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{rl(resumo.lbPorLitro)}<span className="text-xs font-medium text-gray-400">/L</span></p>
                <div className="mt-1.5"><DeltaPill v={resumo.deltaLbPorLitroPct} /></div>
              </div>
              <div className="p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Litros</p>
                <p className="mt-0.5 text-[21px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatLitersShort(resumo.litros)}</p>
                <div className="mt-1.5"><DeltaPill v={resumo.deltaLitros} /></div>
              </div>
            </div>
          )}

          {/* Frase de leitura determinística */}
          {leitura && (
            <div className="flex items-start gap-2 rounded-xl border border-[#dbeafe] bg-[#f0f6ff] px-3.5 py-2.5 dark:border-blue-900/40 dark:bg-blue-950/20">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb] dark:text-blue-300" />
              <p className="text-[12.5px] leading-snug text-[#1e3a5f] dark:text-blue-100">{rich(leitura)}</p>
            </div>
          )}

          {/* Ajustar análise */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-gray-400">
              <SlidersHorizontal className="h-3.5 w-3.5" /> Ajustar análise
            </p>
            <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/60 p-3 dark:border-gray-700 dark:bg-gray-800/30">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-gray-600 dark:text-gray-300">Período</span>
                <div className="flex gap-1"><Pill active={periodo === 'atual'} onClick={() => setPeriodoSel('atual')}>Mês atual</Pill><Pill active={periodo === 'passado'} onClick={() => setPeriodoSel('passado')}>Mês passado</Pill></div>
              </div>
              {periodo === 'atual' && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-gray-600 dark:text-gray-300">Escopo</span>
                  <div className="flex gap-1"><Pill active={escopo === 'fechado'} onClick={() => setEscopo('fechado')}>Fechado (até ontem)</Pill><Pill active={escopo === 'aberto'} onClick={() => setEscopo('aberto')}>Aberto (inclui hoje)</Pill></div>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-gray-600 dark:text-gray-300">Módulo</span>
                <select value={modSel} onChange={(e) => setModPath(e.target.value)} className={selCls}>
                  {mods.map((m) => <option key={m.id} value={m.path}>{m.label}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-medium text-gray-600 dark:text-gray-300">Posto</span>
                <select value={postoSel ?? ''} onChange={(e) => setPostoSel(e.target.value ? Number(e.target.value) : null)} className={selCls}>
                  <option value="">Todos os postos</option>
                  {postos.map((p) => <option key={p.codigo} value={p.codigo}>{p.fantasia}</option>)}
                </select>
              </div>
            </div>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-gray-400">
              <Calendar className="h-3 w-3" /> Vai analisar {ddmmyyyy(range.ini)} – {ddmmyyyy(range.fim)}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-6 py-3 dark:border-gray-800">
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400">
            <input type="checkbox" checked={naoMostrar} onChange={(e) => setNaoMostrar(e.target.checked)} className="h-3.5 w-3.5 rounded border-gray-300 text-[#2563eb] focus:ring-[#2563eb]" />
            Não mostrar de novo hoje
          </label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={dismiss} className="rounded-lg px-3 py-2 text-[13px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">Fechar</button>
            <button type="button" onClick={analisar}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,.3)] hover:from-[#1d4ed8] hover:to-[#1d4ed8]">
              Analisar <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default BriefingModal

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { X, SlidersHorizontal, Calendar, ArrowRight } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useTenantStore } from '@/store/tenant'
import { useFilterStore } from '@/store/filters'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { MODULOS } from '@/lib/modulos'
import { abasFor } from '@/lib/moduleRegistry'
import { todayLocal } from '@/lib/period'
import { formatCurrencyInt, formatNumber } from '@/lib/formatters'
import useBriefingResumo from '@/components/briefing/useBriefingResumo'
import useBriefingProjecaoCombustivel from '@/components/briefing/useBriefingProjecaoCombustivel'

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
/** yyyy-MM-dd → DD/MM (sem ano). */
const ddmm = (iso: string) => iso.split('-').slice(1).reverse().join('/')
/** R$/L com 2 casas (padrão do design do briefing). */
const rl = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`
/** Renderiza texto com **trechos** em negrito. */
const rich = (s: string) => s.split('**').map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>))

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
  const projComb = useBriefingProjecaoCombustivel(open)

  const mods = useMemo(
    () => MODULOS.filter((m) => isMaster || !modulosPermitidos || modulosPermitidos.length === 0 || modulosPermitidos.includes(m.id)),
    [isMaster, modulosPermitidos],
  )
  const [modPath, setModPath] = useState('')
  const modSel = modPath || mods.find((m) => m.id === 'dashboard')?.path || mods[0]?.path || '/dashboard'
  // Abas (sub-tabs) do módulo escolhido — reseta pra default ao trocar de módulo.
  const abas = useMemo(() => abasFor(modSel), [modSel])
  const [abaSel, setAbaSel] = useState('')
  useEffect(() => { setAbaSel('') }, [modSel])

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

  // Frase de leitura DETERMINÍSTICA (decomposição volume × margem da ΔLB). Sempre
  // começa pelo PERÍODO COMPARADO (ontem vs mesmo dia da semana passada + data),
  // já que os KPIs foram removidos e a frase carrega o contexto.
  const leitura = useMemo(() => {
    const { volumeEffect: vol, marginEffect: marg, deltaLB, deltaLitros, deltaLbPorLitroAbs, diaSemana, ontem } = resumo
    if (!resumo.hasData || deltaLB == null) return null
    // Concordância de gênero: domingo/sábado = masculino ("passado"); seg–sex = feminino ("passada").
    const passado = diaSemana === 'domingo' || diaSemana === 'sábado' ? 'passado' : 'passada'
    const cmpRef = `**${diaSemana} ${passado} (${ddmm(isoMinusDays(ontem, 7))})**`
    const litrosTxt = deltaLitros != null ? `os litros ${deltaLitros >= 0 ? 'subiram' : 'caíram'} ${Math.abs(deltaLitros).toFixed(1)}%` : null
    const rlTxt = deltaLbPorLitroAbs != null ? `${deltaLbPorLitroAbs >= 0 ? '+' : '−'}${rl(Math.abs(deltaLbPorLitroAbs))}/L` : null
    if (deltaLB >= 0) {
      const motivo = marg > vol
        ? `, puxado por **margem**${rlTxt ? ` (${rlTxt})` : ''} e não por volume${litrosTxt ? ` — ${litrosTxt}` : ''}`
        : (vol > 0 && marg <= 0)
          ? ` por **volume**${litrosTxt ? ` (${litrosTxt})` : ''}; a margem por litro recuou${rlTxt ? ` (${rlTxt})` : ''}`
          : ` — **volume e margem** somaram${litrosTxt ? ` (${litrosTxt})` : ''}`
      return `Vs ${cmpRef}: o lucro subiu **${deltaLB.toFixed(1)}%**${motivo}.`
    }
    return `Vs ${cmpRef}: o lucro caiu **${Math.abs(deltaLB).toFixed(1)}%** — ${Math.abs(marg) >= Math.abs(vol) ? '**a margem por litro**' : '**o volume**'} puxou pra baixo${litrosTxt ? ` (${litrosTxt})` : ''}.`
  }, [resumo])

  // Análise (determinística, read-only) da projeção de combustível pro card.
  const CONFIA_LABEL = { alta: 'Confiança alta', media: 'Confiança média', baixa: 'Confiança baixa' } as const
  const analiseComb = projComb.hasData
    ? `No ritmo atual, o mês fecha ${projComb.deltaVsMesAnt != null
        ? (projComb.deltaVsMesAnt >= 0
            ? `**${projComb.deltaVsMesAnt.toFixed(1).replace('.', ',')}% acima**`
            : `**${Math.abs(projComb.deltaVsMesAnt).toFixed(1).replace('.', ',')}% abaixo**`) + ' do mês passado'
        : 'no mesmo nível do mês passado'} — ${rl(projComb.rbLitro)}/L de lucro. Faltam **${projComb.diasRestantes} dia${projComb.diasRestantes === 1 ? '' : 's'}** pra fechar.`
    : ''

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
    navigate(abaSel ? `${modSel}?tab=${abaSel}` : modSel)
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
          {/* Leitura do dia (frase determinística). KPIs removidos — a frase
              carrega o período comparado + a variação. */}
          {resumo.isLoading ? (
            <div className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          ) : !resumo.hasData ? (
            <div className="rounded-xl border border-gray-200 p-4 text-center text-[12px] text-gray-400 dark:border-gray-700">
              Ontem ainda não fechou no cache de apuração — confira mais tarde.
            </div>
          ) : leitura ? (
            <div className="rounded-xl border border-[#dbeafe] bg-[#f0f6ff] px-3.5 py-2.5 dark:border-blue-900/40 dark:bg-blue-950/20">
              <p className="text-[12.5px] leading-snug text-[#1e3a5f] dark:text-blue-100">{rich(leitura)}</p>
            </div>
          ) : null}

          {/* Projeção de fim do mês do combustível (heads-up) + análise da IA. */}
          {projComb.hasData && (
            <div className="rounded-xl bg-gradient-to-br from-[#1e3a5f] to-[#27496f] px-3.5 py-3 text-white shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/60">Projeção do combustível · fim do mês</p>
                <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/70">{CONFIA_LABEL[projComb.confiabilidade]}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[19px] font-bold tabular-nums">{formatNumber(Math.round(projComb.litrosProj))} L</span>
                {projComb.deltaVsMesAnt != null && (
                  <span className={cn('text-[11px] font-semibold tabular-nums', projComb.deltaVsMesAnt >= 0 ? 'text-emerald-300' : 'text-red-300')}>
                    {projComb.deltaVsMesAnt >= 0 ? '▲ +' : '▼ '}{Math.abs(projComb.deltaVsMesAnt).toFixed(1).replace('.', ',')}% vs mês ant.
                  </span>
                )}
                <span className="ml-auto text-[11px] text-white/60">LB estimado <strong className="font-semibold text-white/90">{formatCurrencyInt(projComb.lucroProj)}</strong></span>
              </div>
              <p className="mt-1.5 text-[11.5px] leading-snug text-white/85">{rich(analiseComb)}</p>
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
              {abas.length > 1 && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium text-gray-600 dark:text-gray-300">Aba</span>
                  <select value={abaSel} onChange={(e) => setAbaSel(e.target.value)} className={selCls}>
                    {abas.map((a) => <option key={a.tab} value={a.tab}>{a.label}</option>)}
                  </select>
                </div>
              )}
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

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Sun, TrendingUp, Percent, Droplet, ArrowUp, ArrowDown, ArrowRight, Calendar } from 'lucide-react'
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

const Delta = ({ v, unit = '%' }: { v: number | null; unit?: string }) => {
  if (v == null) return <span className="text-[11px] text-gray-400">— sem base</span>
  const up = v >= 0
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums', up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
      {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}{up ? '+' : ''}{v.toFixed(1)}{unit}
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

  // Abre 1×/dia, só depois do onboarding e com uma rede conectada (digest precisa).
  const open = !seenToday && onboardingSeen && !!rede

  const resumo = useBriefingResumo(open)

  // Módulos liberados pro usuário (default: Central, ou o 1º permitido).
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
  const [postoSel, setPostoSel] = useState<number | null>(null) // null = Todos

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

  const markSeen = () => {
    setSeen(true) // otimista
    supabase?.rpc('mark_briefing_seen').then(({ error }) => {
      if (error) console.warn('[briefing] mark error:', error.message)
    })
  }

  const analisar = () => {
    setPeriodo(range.ini, range.fim)
    setEmpresas(postoSel != null ? [postoSel] : [])
    markSeen()
    navigate(modSel)
  }

  const Pill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" onClick={onClick}
      className={cn('rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors', active ? 'bg-[#1e3a5f] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300')}>
      {children}
    </button>
  )

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) markSeen() }}>
      <DialogContent className="max-w-xl">
        <DialogTitle className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-gray-100">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white"><Sun className="h-4 w-4" /></span>
          {saudacao()}{fullName ? `, ${fullName.split(' ')[0]}` : ''}.
        </DialogTitle>
        <DialogDescription className="text-[13px] text-gray-500 dark:text-gray-400">
          Resumo de ontem e um atalho pra começar sua análise do dia.
        </DialogDescription>

        {/* Digest — apurado de ontem vs mesmo dia da semana passada */}
        <div className="mt-1 rounded-xl border border-gray-200 bg-gray-50/60 p-3 dark:border-gray-700 dark:bg-gray-800/30">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Combustível · ontem ({resumo.diaSemana}) vs {resumo.diaSemana} passada
          </p>
          {resumo.isLoading ? (
            <p className="py-3 text-center text-[12px] text-gray-400">Carregando o fechamento de ontem…</p>
          ) : !resumo.hasData ? (
            <p className="py-3 text-center text-[12px] text-gray-400">Ontem ainda não fechou no cache de apuração — confira mais tarde.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-white p-2.5 dark:bg-gray-900">
                <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-400"><TrendingUp className="h-3 w-3" /> Lucro bruto</div>
                <p className="mt-0.5 text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrencyShort(resumo.lb)}</p>
                <Delta v={resumo.deltaLB} />
              </div>
              <div className="rounded-lg bg-white p-2.5 dark:bg-gray-900">
                <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-400"><Percent className="h-3 w-3" /> Margem</div>
                <p className="mt-0.5 text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">{resumo.margem.toFixed(1)}%</p>
                <Delta v={resumo.deltaMargemPp} unit=" p.p." />
              </div>
              <div className="rounded-lg bg-white p-2.5 dark:bg-gray-900">
                <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-gray-400"><Droplet className="h-3 w-3" /> Litros</div>
                <p className="mt-0.5 text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatLitersShort(resumo.litros)}</p>
                <Delta v={resumo.deltaLitros} />
              </div>
            </div>
          )}
        </div>

        {/* Filtros de análise */}
        <div className="mt-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Período</span>
            <Pill active={periodo === 'atual'} onClick={() => setPeriodoSel('atual')}>Mês atual</Pill>
            <Pill active={periodo === 'passado'} onClick={() => setPeriodoSel('passado')}>Mês passado</Pill>
          </div>
          {periodo === 'atual' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Escopo</span>
              <Pill active={escopo === 'fechado'} onClick={() => setEscopo('fechado')}>Fechado (até ontem)</Pill>
              <Pill active={escopo === 'aberto'} onClick={() => setEscopo('aberto')}>Aberto (inclui hoje)</Pill>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Módulo</span>
            <select value={modSel} onChange={(e) => setModPath(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] font-medium dark:border-gray-700 dark:bg-gray-800">
              {mods.map((m) => <option key={m.id} value={m.path}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Posto</span>
            <select value={postoSel ?? ''} onChange={(e) => setPostoSel(e.target.value ? Number(e.target.value) : null)}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] font-medium dark:border-gray-700 dark:bg-gray-800">
              <option value="">Todos os postos</option>
              {postos.map((p) => <option key={p.codigo} value={p.codigo}>{p.fantasia}</option>)}
            </select>
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-gray-400">
            <Calendar className="h-3 w-3" /> Vai analisar {range.ini.split('-').reverse().join('/')} – {range.fim.split('-').reverse().join('/')}
          </p>
        </div>

        <div className="mt-2 flex items-center justify-end gap-2">
          <button type="button" onClick={markSeen}
            className="rounded-lg px-3 py-2 text-[13px] font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            Fechar
          </button>
          <button type="button" onClick={analisar}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563eb] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#1d4ed8]">
            Analisar <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default BriefingModal

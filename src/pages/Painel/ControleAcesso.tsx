import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, AreaChart as RAreaChart, Area, BarChart as RBarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { Radio, Users, Activity, Clock, ShieldCheck, Building2, X, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { fetchProfiles } from '@/api/supabase/profiles'
import { fetchRedes } from '@/api/supabase/redes'
import { useChartTheme } from '@/lib/chartTheme'
import { cn } from '@/lib/utils'

interface AcessoRow {
  rede_id: string | null
  user_id: string
  path: string
  modulo: string | null
  created_at: string
}

const DIA = 864e5
const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const nInt = (n: number) => n.toLocaleString('pt-BR')
const quando = (iso: string) => {
  const d = new Date(iso)
  const now = new Date()
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const same = (a: Date, b: Date) => dayKey(a) === dayKey(b)
  if (same(d, now)) return `hoje ${hm}`
  if (same(d, new Date(now.getTime() - DIA))) return `ontem ${hm}`
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${hm}`
}

/**
 * Controle de acesso — página do Painel (só gerente). Analytics de uso de TODAS
 * as redes (últimos 30 dias): quem acessa, quando (dia/hora) e as telas mais
 * usadas. O card "Acessos por rede" é multi-seleção e filtra o resto.
 */
const ControleAcesso = () => {
  const isMaster = useAuthStore((s) => s.isMaster)
  const ct = useChartTheme()
  const [sel, setSel] = useState<Set<string>>(() => new Set())
  const [selUser, setSelUser] = useState<{ id: string; nome: string; email: string } | null>(null)
  const toggle = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['acesso-log-todas'],
    enabled: !!supabase && isMaster,
    staleTime: 60_000,
    queryFn: async (): Promise<AcessoRow[]> => {
      if (!supabase) return []
      const desde = new Date(Date.now() - 30 * DIA).toISOString()
      const { data, error } = await supabase
        .from('acesso_log')
        .select('rede_id,user_id,path,modulo,created_at')
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
        .limit(20000)
      if (error) throw error
      return (data ?? []) as AcessoRow[]
    },
  })
  const { data: profiles = [] } = useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles, enabled: isMaster, staleTime: 5 * 60_000 })
  const { data: redes = [] } = useQuery({ queryKey: ['redes'], queryFn: fetchRedes, enabled: isMaster, staleTime: 5 * 60_000 })

  const nomeDe = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of profiles) m.set(p.user_id, p.full_name || p.email || 'Usuário')
    return m
  }, [profiles])
  const emailDe = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of profiles) m.set(p.user_id, p.email)
    return m
  }, [profiles])
  const redeNome = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of redes) m.set(r.id, r.nome)
    return m
  }, [redes])
  const nomeRede = (id: string | null) => (id ? redeNome.get(id) ?? 'Rede' : 'Sem rede')

  const porRede = useMemo(() => {
    const m = new Map<string, { acessos: number; usuarios: Set<string> }>()
    for (const r of rows) {
      const id = r.rede_id ?? '—'
      const e = m.get(id) ?? { acessos: 0, usuarios: new Set<string>() }
      e.acessos++
      e.usuarios.add(r.user_id)
      m.set(id, e)
    }
    return [...m.entries()]
      .map(([id, v]) => ({ id, acessos: v.acessos, usuarios: v.usuarios.size }))
      .sort((a, b) => b.acessos - a.acessos)
  }, [rows])

  const rowsFiltradas = useMemo(
    () => (sel.size === 0 ? rows : rows.filter((r) => r.rede_id != null && sel.has(r.rede_id))),
    [rows, sel],
  )

  const stat = useMemo(() => {
    const now = Date.now()
    const online = new Set<string>()
    const ativos = new Set<string>()
    const byDay = new Map<string, number>()
    const byHour = new Array<number>(24).fill(0)
    const byTela = new Map<string, number>()
    for (const r of rowsFiltradas) {
      const t = new Date(r.created_at)
      ativos.add(r.user_id)
      if (now - t.getTime() < 5 * 60_000) online.add(r.user_id)
      byDay.set(dayKey(t), (byDay.get(dayKey(t)) ?? 0) + 1)
      byHour[t.getHours()]++
      const k = r.modulo || r.path
      byTela.set(k, (byTela.get(k) ?? 0) + 1)
    }
    const dias: { label: string; count: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * DIA)
      dias.push({ label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, count: byDay.get(dayKey(d)) ?? 0 })
    }
    const horas = byHour.map((count, h) => ({ h, count }))
    const topTelas = [...byTela.entries()].map(([tela, count]) => ({ tela, count })).sort((a, b) => b.count - a.count).slice(0, 8)
    let pico = -1
    let picoV = 0
    byHour.forEach((c, h) => { if (c > picoV) { picoV = c; pico = h } })
    return { online: online.size, ativos: ativos.size, total: rowsFiltradas.length, dias, horas, topTelas, pico }
  }, [rowsFiltradas])

  if (!isMaster || !supabase) return null

  const maxRede = porRede[0]?.acessos ?? 1
  const picoLabel = stat.total > 0 && stat.pico >= 0 ? `${pad(stat.pico)}h` : '—'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1e3a5f]">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-base font-bold text-gray-900 dark:text-gray-100">Controle de acesso</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Quem acessa, quando e as telas mais usadas — últimos 30 dias.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-52 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
          Ainda sem registros de acesso — eles começam a aparecer conforme a equipe usar o app.
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi Icon={Radio} label="Online agora" value={nInt(stat.online)} tint="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" />
            <Kpi Icon={Users} label="Usuários (30d)" value={nInt(stat.ativos)} tint="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" />
            <Kpi Icon={Activity} label="Acessos (30d)" value={nInt(stat.total)} tint="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400" />
            <Kpi Icon={Clock} label="Pico do dia" value={picoLabel} tint="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400" />
          </div>

          {/* Acessos por rede — multi-seleção + caixa de selecionadas */}
          {porRede.length > 1 && (
            <Card
              titulo="Acessos por rede"
              acao={sel.size > 0 ? <button onClick={() => setSel(new Set())} className="text-[11px] font-semibold text-[#2563eb] hover:underline">Ver todas</button> : undefined}
            >
              {sel.size > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg bg-[#f4f8ff] p-2 dark:bg-blue-950/20">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide text-gray-400">Selecionadas</span>
                  {[...sel].map((id) => (
                    <span key={id} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[12px] font-semibold text-[#1d4ed8] shadow-sm dark:bg-blue-900/40 dark:text-blue-300">
                      {nomeRede(id)}
                      <button onClick={() => toggle(id)} aria-label={`Remover ${nomeRede(id)}`} className="rounded-full p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/60">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <ul className="space-y-0.5">
                {porRede.map((r) => {
                  const on = sel.has(r.id)
                  return (
                    <li key={r.id}>
                      <button
                        onClick={() => toggle(r.id)}
                        className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors', on ? 'bg-[#f4f8ff] dark:bg-blue-950/25' : 'hover:bg-gray-50 dark:hover:bg-white/5')}
                      >
                        <span className={cn('flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors', on ? 'border-[#2563eb] bg-[#2563eb] text-white' : 'border-gray-300 dark:border-gray-600')}>
                          {on && <Check className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <Building2 className={cn('h-4 w-4 shrink-0', on ? 'text-[#2563eb]' : 'text-gray-400')} />
                        <span className={cn('w-40 shrink-0 truncate text-[13px]', on ? 'font-semibold text-[#1d4ed8] dark:text-blue-300' : 'font-medium text-gray-700 dark:text-gray-300')}>{nomeRede(r.id)}</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                          <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${(r.acessos / maxRede) * 100}%` }} />
                        </div>
                        <span className="w-14 shrink-0 text-right text-[13px] font-bold tabular-nums text-gray-800 dark:text-gray-200">{nInt(r.acessos)}</span>
                        <span className="hidden w-16 shrink-0 text-right text-[11px] tabular-nums text-gray-400 sm:inline">{r.usuarios} usr</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          {/* Gráficos por tempo */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card titulo="Acessos por dia (14 dias)">
              <ResponsiveContainer width="100%" height={200}>
                <RAreaChart data={stat.dias} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ca-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ct.accent} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={ct.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                  <XAxis dataKey="label" interval={1} tick={{ fontSize: 10, fill: ct.axis }} tickLine={false} axisLine={false} />
                  <YAxis width={30} allowDecimals={false} tick={{ fontSize: 10, fill: ct.axis }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, ...ct.tooltip }} formatter={((v: number) => [nInt(v), 'acessos']) as never} />
                  <Area type="monotone" dataKey="count" name="Acessos" stroke={ct.accent} strokeWidth={2} fill="url(#ca-area)" dot={false} activeDot={{ r: 4 }} />
                </RAreaChart>
              </ResponsiveContainer>
            </Card>

            <Card titulo="Horário (por hora do dia)">
              <ResponsiveContainer width="100%" height={200}>
                <RBarChart data={stat.horas} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                  <XAxis dataKey="h" interval={2} tickFormatter={(h: number) => `${h}h`} tick={{ fontSize: 10, fill: ct.axis }} tickLine={false} axisLine={false} />
                  <YAxis width={30} allowDecimals={false} tick={{ fontSize: 10, fill: ct.axis }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, ...ct.tooltip }} formatter={((v: number) => [nInt(v), 'acessos']) as never} labelFormatter={(h) => `${pad(Number(h))}h`} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {stat.horas.map((d) => <Cell key={d.h} fill={d.h === stat.pico ? '#FCB619' : ct.accent} />)}
                  </Bar>
                </RBarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          {/* Telas + últimos acessos */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card titulo="Telas mais acessadas">
              {stat.topTelas.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-gray-400">Sem acessos nessa seleção.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, stat.topTelas.length * 34)}>
                  <RBarChart data={stat.topTelas} layout="vertical" margin={{ top: 0, right: 28, left: 6, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: ct.axis }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="tela" width={128} tick={{ fontSize: 11, fill: ct.axis }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, ...ct.tooltip }} formatter={((v: number) => [nInt(v), 'acessos']) as never} cursor={{ fill: ct.grid, opacity: 0.4 }} />
                    <Bar dataKey="count" fill={ct.accent} radius={[0, 4, 4, 0]} />
                  </RBarChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card titulo="Últimos acessos">
              {rowsFiltradas.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-gray-400">Nenhum acesso nessa seleção.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rowsFiltradas.slice(0, 12).map((r, i) => (
                    <li key={i}>
                      <button
                        onClick={() => setSelUser({ id: r.user_id, nome: nomeDe.get(r.user_id) ?? 'Usuário', email: emailDe.get(r.user_id) ?? '' })}
                        className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left text-[12.5px] transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                        title="Ver acessos deste usuário (90 dias)"
                      >
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gray-100 text-[10px] font-bold uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          {(nomeDe.get(r.user_id) ?? '?').slice(0, 2)}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-medium text-gray-800 dark:text-gray-200">{nomeDe.get(r.user_id) ?? 'Usuário'}</span>
                        {sel.size !== 1 && <span className="hidden shrink-0 truncate text-[11px] text-gray-400 md:inline">{nomeRede(r.rede_id)}</span>}
                        <span className="shrink-0 truncate text-gray-500 dark:text-gray-400">{r.modulo || r.path}</span>
                        <span className="w-20 shrink-0 text-right tabular-nums text-gray-400">{quando(r.created_at)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}

      {selUser && <AcessoUsuarioModal user={selUser} redeNome={redeNome} onClose={() => setSelUser(null)} />}
    </div>
  )
}

/* ─── Modal: histórico de acesso de um usuário (90 dias) ─── */

interface UserRef { id: string; nome: string; email: string }
interface UserRow { rede_id: string | null; path: string; modulo: string | null; created_at: string }

const AcessoUsuarioModal = ({ user, redeNome, onClose }: { user: UserRef; redeNome: Map<string, string>; onClose: () => void }) => {
  const ct = useChartTheme()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['acesso-user', user.id],
    enabled: !!supabase,
    staleTime: 60_000,
    queryFn: async (): Promise<UserRow[]> => {
      if (!supabase) return []
      const desde = new Date(Date.now() - 90 * DIA).toISOString()
      const { data, error } = await supabase
        .from('acesso_log')
        .select('rede_id,path,modulo,created_at')
        .eq('user_id', user.id)
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
        .limit(10000)
      if (error) throw error
      return (data ?? []) as UserRow[]
    },
  })
  const nomeRede = (id: string | null) => (id ? redeNome.get(id) ?? 'Rede' : 'Sem rede')

  const stat = useMemo(() => {
    const byDay = new Map<string, number>()
    const byTela = new Map<string, number>()
    const byRede = new Map<string, number>()
    for (const r of rows) {
      const t = new Date(r.created_at)
      byDay.set(dayKey(t), (byDay.get(dayKey(t)) ?? 0) + 1)
      byTela.set(r.modulo || r.path, (byTela.get(r.modulo || r.path) ?? 0) + 1)
      const rid = r.rede_id ?? '—'
      byRede.set(rid, (byRede.get(rid) ?? 0) + 1)
    }
    const now = Date.now()
    const dias: { label: string; count: number }[] = []
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now - i * DIA)
      dias.push({ label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, count: byDay.get(dayKey(d)) ?? 0 })
    }
    const topTelas = [...byTela.entries()].map(([tela, count]) => ({ tela, count })).sort((a, b) => b.count - a.count).slice(0, 6)
    const redesUsadas = [...byRede.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count)
    return { total: rows.length, diasAtivos: byDay.size, dias, topTelas, redesUsadas, ultimo: rows[0]?.created_at }
  }, [rows])

  const maxTela = stat.topTelas[0]?.count ?? 1

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Acessos de ${user.nome}`}>
      <button className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" aria-label="Fechar" onClick={onClose} />
      <div className="relative flex max-h-[86vh] w-full max-w-2xl animate-fade-in flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#0f0f0f]">
        <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 p-4 dark:border-white/10">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1e3a5f] text-[13px] font-bold uppercase text-white">{user.nome.slice(0, 2)}</span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold text-gray-900 dark:text-gray-100">{user.nome}</h2>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user.email || 'histórico de acesso'} · últimos 90 dias</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/10"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-4 overflow-y-auto p-4">
          {isLoading ? (
            <div className="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          ) : stat.total === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Sem acessos nos últimos 90 dias.</p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <MiniKpi label="Acessos (90d)" value={nInt(stat.total)} />
                <MiniKpi label="Dias ativos" value={nInt(stat.diasAtivos)} />
                <MiniKpi label="Último acesso" value={stat.ultimo ? quando(stat.ultimo) : '—'} />
              </div>

              <Card titulo="Acessos por dia (90 dias)">
                <ResponsiveContainer width="100%" height={170}>
                  <RAreaChart data={stat.dias} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cau-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ct.accent} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={ct.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                    <XAxis dataKey="label" interval={14} tick={{ fontSize: 10, fill: ct.axis }} tickLine={false} axisLine={false} />
                    <YAxis width={30} allowDecimals={false} tick={{ fontSize: 10, fill: ct.axis }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, ...ct.tooltip }} formatter={((v: number) => [nInt(v), 'acessos']) as never} />
                    <Area type="monotone" dataKey="count" stroke={ct.accent} strokeWidth={2} fill="url(#cau-area)" dot={false} activeDot={{ r: 4 }} />
                  </RAreaChart>
                </ResponsiveContainer>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2">
                <Card titulo="Telas mais acessadas">
                  <ul className="space-y-1.5">
                    {stat.topTelas.map((t) => (
                      <li key={t.tela} className="flex items-center gap-2">
                        <span className="w-28 shrink-0 truncate text-[12px] text-gray-700 dark:text-gray-300">{t.tela}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5"><div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${(t.count / maxTela) * 100}%` }} /></div>
                        <span className="w-10 shrink-0 text-right text-[12px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">{nInt(t.count)}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card titulo="Redes acessadas">
                  <ul className="space-y-1.5">
                    {stat.redesUsadas.map((r) => (
                      <li key={r.id} className="flex items-center gap-2 text-[12px]">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                        <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300">{nomeRede(r.id)}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-gray-600 dark:text-gray-300">{nInt(r.count)}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>

              <Card titulo="Últimos acessos">
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.slice(0, 15).map((r, i) => (
                    <li key={i} className="flex items-center gap-2 py-1.5 text-[12px]">
                      <span className="min-w-0 flex-1 truncate text-gray-700 dark:text-gray-300">{r.modulo || r.path}</span>
                      <span className="hidden shrink-0 truncate text-[11px] text-gray-400 sm:inline">{nomeRede(r.rede_id)}</span>
                      <span className="w-20 shrink-0 text-right tabular-nums text-gray-400">{quando(r.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const MiniKpi = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-3 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
    <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
    <p className="text-[10.5px] text-gray-500 dark:text-gray-400">{label}</p>
  </div>
)

const Kpi = ({ Icon, label, value, tint }: { Icon: typeof Users; label: string; value: string; tint: string }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
    <div className="flex items-center gap-2">
      <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', tint)}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{label}</span>
    </div>
    <p className="mt-2.5 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{value}</p>
  </div>
)

const Card = ({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
    <div className="mb-3 flex items-center justify-between gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{titulo}</p>
      {acao}
    </div>
    {children}
  </div>
)

export default ControleAcesso

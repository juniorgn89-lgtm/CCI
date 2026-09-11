import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Radio, Users, Activity, MonitorSmartphone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTenantStore } from '@/store/tenant'
import { useAuthStore } from '@/store/auth'
import { fetchProfiles } from '@/api/supabase/profiles'

interface AcessoRow {
  user_id: string
  path: string
  modulo: string | null
  created_at: string
}

const DIA = 864e5
const pad = (n: number) => String(n).padStart(2, '0')
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
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
 * Controle de acesso — analytics de uso (só gerente). Lê `acesso_log` da rede
 * conectada (últimos 30 dias): quem acessa, quando (dia/hora) e as telas mais
 * usadas. Só passa a ter dado a partir do momento que o logger entrou no ar.
 */
const ControleAcessoSection = () => {
  const isMaster = useAuthStore((s) => s.isMaster)
  const redeId = useTenantStore((s) => s.rede?.id)

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['acesso-log', redeId],
    enabled: !!supabase && !!redeId && isMaster,
    staleTime: 60_000,
    queryFn: async (): Promise<AcessoRow[]> => {
      if (!supabase || !redeId) return []
      const desde = new Date(Date.now() - 30 * DIA).toISOString()
      const { data, error } = await supabase
        .from('acesso_log')
        .select('user_id,path,modulo,created_at')
        .eq('rede_id', redeId)
        .gte('created_at', desde)
        .order('created_at', { ascending: false })
        .limit(8000)
      if (error) throw error
      return (data ?? []) as AcessoRow[]
    },
  })
  const { data: profiles = [] } = useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles, enabled: isMaster, staleTime: 5 * 60_000 })
  const nomeDe = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of profiles) m.set(p.user_id, p.full_name || p.email || 'Usuário')
    return m
  }, [profiles])

  const stat = useMemo(() => {
    const now = Date.now()
    const online = new Set<string>()
    const ativos = new Set<string>()
    const byDay = new Map<string, number>()
    const byHour = new Array<number>(24).fill(0)
    const byTela = new Map<string, number>()
    for (const r of rows) {
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
    const topTelas = [...byTela.entries()].map(([tela, count]) => ({ tela, count })).sort((a, b) => b.count - a.count).slice(0, 8)
    return { online: online.size, ativos: ativos.size, total: rows.length, dias, horas: byHour, topTelas }
  }, [rows])

  if (!isMaster || !supabase) return null

  const maxDia = Math.max(1, ...stat.dias.map((d) => d.count))
  const maxHora = Math.max(1, ...stat.horas)
  const maxTela = stat.topTelas[0]?.count ?? 1
  const picoHora = stat.horas.indexOf(maxHora)

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Controle de acesso</h2>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Quem acessa, quando e as telas mais usadas — últimos 30 dias.</p>
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
          Ainda sem registros de acesso — eles começam a aparecer conforme a equipe usar o app.
        </div>
      ) : (
        <div className="space-y-3">
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi Icon={Radio} label="Online agora" value={String(stat.online)} tone="text-emerald-600 dark:text-emerald-400" />
            <Kpi Icon={Users} label="Usuários (30d)" value={String(stat.ativos)} />
            <Kpi Icon={Activity} label="Acessos (30d)" value={stat.total.toLocaleString('pt-BR')} />
            <Kpi Icon={MonitorSmartphone} label="Pico do dia" value={`${pad(picoHora)}h`} />
          </div>

          {/* Acessos por dia (14d) */}
          <Card titulo="Acessos por dia (14 dias)">
            <div className="flex h-28 items-end gap-1">
              {stat.dias.map((d, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${d.label}: ${d.count}`}>
                  <div className="flex w-full flex-1 items-end">
                    <div className="w-full rounded-t bg-[#2563eb]/80 transition-all" style={{ height: `${(d.count / maxDia) * 100}%`, minHeight: d.count > 0 ? 2 : 0 }} />
                  </div>
                  <span className="text-[8.5px] tabular-nums text-gray-400">{d.label.slice(0, 2)}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Horário de pico (0-23h) */}
          <Card titulo="Horário (por hora do dia)">
            <div className="flex h-20 items-end gap-[3px]">
              {stat.horas.map((c, h) => (
                <div key={h} className="flex flex-1 flex-col items-center" title={`${pad(h)}h: ${c}`}>
                  <div className="flex w-full flex-1 items-end">
                    <div className={`w-full rounded-t ${h === picoHora ? 'bg-[#FCB619]' : 'bg-[#0F766E]/60'}`} style={{ height: `${(c / maxHora) * 100}%`, minHeight: c > 0 ? 2 : 0 }} />
                  </div>
                  {h % 6 === 0 && <span className="mt-0.5 text-[8px] tabular-nums text-gray-400">{h}h</span>}
                </div>
              ))}
            </div>
          </Card>

          {/* Telas mais acessadas */}
          <Card titulo="Telas mais acessadas">
            <ul className="space-y-1.5">
              {stat.topTelas.map((t) => (
                <li key={t.tela} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 truncate text-[12px] text-gray-700 dark:text-gray-300">{t.tela}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5">
                    <div className="h-full rounded-full bg-[#2563eb]" style={{ width: `${(t.count / maxTela) * 100}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[12px] font-semibold tabular-nums text-gray-600 dark:text-gray-300">{t.count.toLocaleString('pt-BR')}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Últimos acessos */}
          <Card titulo="Últimos acessos">
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.slice(0, 12).map((r, i) => (
                <li key={i} className="flex items-center gap-2 py-1.5 text-[12px]">
                  <span className="min-w-0 flex-1 truncate font-medium text-gray-800 dark:text-gray-200">{nomeDe.get(r.user_id) ?? 'Usuário'}</span>
                  <span className="shrink-0 truncate text-gray-500 dark:text-gray-400">{r.modulo || r.path}</span>
                  <span className="w-24 shrink-0 text-right tabular-nums text-gray-400">{quando(r.created_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </section>
  )
}

const Kpi = ({ Icon, label, value, tone }: { Icon: typeof Users; label: string; value: string; tone?: string }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
      <Icon className="h-3.5 w-3.5" />
      <span className="text-[10.5px] font-medium">{label}</span>
    </div>
    <p className={`mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100 ${tone ?? ''}`}>{value}</p>
  </div>
)

const Card = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{titulo}</p>
    {children}
  </div>
)

export default ControleAcessoSection

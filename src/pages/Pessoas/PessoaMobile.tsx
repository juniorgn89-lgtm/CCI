import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Search, Crown, Shield, User, Fuel } from 'lucide-react'
import { fetchProfiles, type ProfileRow } from '@/api/supabase/profiles'
import { fetchFrentistas } from '@/api/supabase/frentistas'
import { fetchRedes } from '@/api/supabase/redes'
import { useAuthStore } from '@/store/auth'
import { formatNumber } from '@/lib/formatters'
import { KpiCard, Section, Segmented, Badge, type Tone } from '@/components/mobile/primitives'
import { LoadingScreen, EmptyCard } from '@/components/mobile/states'

type Cargo = 'Gerente Geral' | 'Supervisor' | 'Gerente' | 'Frentista'

interface PessoaRow {
  id: string
  nome: string
  email?: string
  cargo: Cargo
  posto: string
  ativo: boolean
}

const CARGO_ORDER: Cargo[] = ['Gerente Geral', 'Supervisor', 'Gerente', 'Frentista']
const CARGO_TONE: Record<Cargo, Tone> = {
  'Gerente Geral': 'violet',
  Supervisor: 'blue',
  Gerente: 'emerald',
  Frentista: 'amber',
}
const CARGO_ICON: Record<Cargo, typeof User> = {
  'Gerente Geral': Crown,
  Supervisor: Shield,
  Gerente: User,
  Frentista: Fuel,
}

const profileCargo = (p: ProfileRow): Cargo => (p.is_master ? 'Gerente Geral' : p.role === 'supervisor' ? 'Supervisor' : 'Gerente')

/**
 * Pessoas — versão mobile (read-only). Combina profiles (gerentes/supervisores)
 * + frentistas numa lista com nome, cargo, posto e status. Busca + filtros.
 * Gerenciamento (criar/editar) segue só no desktop (/admin/*).
 */
const PessoaMobile = () => {
  const [busca, setBusca] = useState('')
  const [cargoFiltro, setCargoFiltro] = useState<'todos' | Cargo>('todos')
  const [statusFiltro, setStatusFiltro] = useState<'ativos' | 'inativos' | 'todos'>('ativos')
  const isMaster = useAuthStore((s) => s.isMaster)

  const { data: profiles = [], isLoading: lp } = useQuery({ queryKey: ['profiles'], queryFn: fetchProfiles, staleTime: 60_000 })
  const { data: frentistas = [], isLoading: lf } = useQuery({ queryKey: ['frentistas'], queryFn: () => fetchFrentistas(), staleTime: 60_000 })
  const { data: redes = [] } = useQuery({ queryKey: ['redes'], queryFn: fetchRedes, staleTime: 5 * 60 * 1000 })

  const redeNomeById = useMemo(() => new Map(redes.map((r) => [r.id, r.nome])), [redes])

  const pessoas = useMemo<PessoaRow[]>(() => {
    const out: PessoaRow[] = []
    for (const p of profiles) {
      if (p.is_master && !isMaster) continue
      out.push({
        id: `profile:${p.user_id}`,
        nome: p.full_name || p.email,
        email: p.email,
        cargo: profileCargo(p),
        posto: p.rede_id ? (redeNomeById.get(p.rede_id) ?? '—') : '— (rede livre)',
        ativo: p.approved,
      })
    }
    for (const f of frentistas) {
      out.push({ id: `frentista:${f.user_id}`, nome: f.nome, cargo: 'Frentista', posto: f.empresa_nome, ativo: f.ativo })
    }
    return out.sort((a, b) => {
      const d = CARGO_ORDER.indexOf(a.cargo) - CARGO_ORDER.indexOf(b.cargo)
      return d !== 0 ? d : a.nome.localeCompare(b.nome, 'pt-BR')
    })
  }, [profiles, frentistas, redeNomeById, isMaster])

  const resumo = useMemo(() => {
    const c: Record<Cargo, number> = { 'Gerente Geral': 0, Supervisor: 0, Gerente: 0, Frentista: 0 }
    for (const p of pessoas) if (p.ativo) c[p.cargo]++
    return c
  }, [pessoas])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return pessoas.filter((p) => {
      if (cargoFiltro !== 'todos' && p.cargo !== cargoFiltro) return false
      if (statusFiltro === 'ativos' && !p.ativo) return false
      if (statusFiltro === 'inativos' && p.ativo) return false
      if (q && !(p.nome.toLowerCase().includes(q) || (p.email?.toLowerCase().includes(q)) || p.posto.toLowerCase().includes(q))) return false
      return true
    })
  }, [pessoas, busca, cargoFiltro, statusFiltro])

  const cargosVisiveis = isMaster ? CARGO_ORDER : CARGO_ORDER.filter((c) => c !== 'Gerente Geral')

  if (lp || lf) return <LoadingScreen message="Carregando pessoas…" />

  const totalAtivos = resumo['Gerente Geral'] + resumo.Supervisor + resumo.Gerente + resumo.Frentista

  return (
    <div className="space-y-3 pb-2">
      <h1 className="text-[19px] font-bold text-gray-900 dark:text-gray-100">Pessoas</h1>

      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="Pessoas ativas" tone="navy" Icon={Users} value={formatNumber(totalAtivos)} />
        <KpiCard label="Frentistas" tone="amber" Icon={Fuel} value={formatNumber(resumo.Frentista)} />
        <KpiCard label="Gerentes" tone="emerald" Icon={User} value={formatNumber(resumo.Gerente)} />
        <KpiCard label="Supervisores" tone="blue" Icon={Shield} value={formatNumber(resumo.Supervisor)} />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, email ou posto…"
          className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-[13px] text-gray-900 placeholder:text-gray-400 focus:border-[#2563eb] focus:outline-none dark:border-[#3a3a3a] dark:bg-[#242424] dark:text-gray-100"
        />
      </div>

      <Segmented
        value={statusFiltro}
        onChange={(v) => setStatusFiltro(v as typeof statusFiltro)}
        options={[{ value: 'ativos', label: 'Ativos' }, { value: 'inativos', label: 'Inativos' }, { value: 'todos', label: 'Todos' }]}
      />
      <Segmented
        scroll
        value={cargoFiltro}
        onChange={(v) => setCargoFiltro(v as 'todos' | Cargo)}
        options={[{ value: 'todos', label: 'Todos cargos' }, ...cargosVisiveis.map((c) => ({ value: c, label: c }))]}
      />

      {filtradas.length === 0 ? (
        <EmptyCard title="Ninguém encontrado" desc="Ajuste a busca ou os filtros." />
      ) : (
        <Section Icon={Users} title="Equipe" right={<Badge tone="navy">{filtradas.length}</Badge>} flush>
          <div className="divide-y divide-gray-100 dark:divide-[#303030]">
            {filtradas.map((p) => {
              const Icon = CARGO_ICON[p.cargo]
              return (
                <div key={p.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-[#303030]">
                    <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-gray-900 dark:text-gray-100">
                      <span className="truncate">{p.nome}</span>
                      {!p.ativo && <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase text-gray-400 dark:bg-[#303030] dark:text-gray-500">inativo</span>}
                    </p>
                    <p className="truncate text-[10.5px] text-gray-400 dark:text-gray-500">{p.posto}</p>
                  </div>
                  <Badge tone={CARGO_TONE[p.cargo]}>{p.cargo}</Badge>
                </div>
              )
            })}
          </div>
        </Section>
      )}
    </div>
  )
}

export default PessoaMobile

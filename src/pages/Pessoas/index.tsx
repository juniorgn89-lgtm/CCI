import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Crown, Shield, User, Fuel } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchProfiles, type ProfileRow } from '@/api/supabase/profiles'
import { fetchFrentistas } from '@/api/supabase/frentistas'
import { fetchRedes } from '@/api/supabase/redes'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'
import useIsMobile from '@/hooks/useIsMobile'
import PessoaMobile from '@/pages/Pessoas/PessoaMobile'

type Cargo = 'Gerente Geral' | 'Supervisor' | 'Gerente' | 'Frentista'

interface PessoaRow {
  id: string
  nome: string
  email?: string
  cargo: Cargo
  posto: string
  ativo: boolean
}

const CARGO_STYLE: Record<Cargo, { badge: string; Icon: typeof User }> = {
  'Gerente Geral': {
    badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    Icon: Crown,
  },
  'Supervisor': {
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    Icon: Shield,
  },
  'Gerente': {
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    Icon: User,
  },
  'Frentista': {
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    Icon: Fuel,
  },
}

const CARGO_ORDER: Cargo[] = ['Gerente Geral', 'Supervisor', 'Gerente', 'Frentista']

const profileCargo = (p: ProfileRow): Cargo => {
  if (p.is_master) return 'Gerente Geral'
  if (p.role === 'supervisor') return 'Supervisor'
  return 'Gerente'
}

/**
 * Tela read-only de Pessoas — combina profiles (gerentes/supervisores) +
 * frentistas em uma única lista com nome, cargo, posto e status. Gerenciamento
 * (criar/editar/inativar) continua em /admin/usuarios e /admin/frentistas.
 */
const Pessoas = () => {
  const [busca, setBusca] = useState('')
  const [cargoFiltro, setCargoFiltro] = useState<'todos' | Cargo>('todos')
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'ativos' | 'inativos'>('ativos')
  // "Gerente Geral" (master, conta CCI) só aparece pra outros masters.
  // Usuários comuns/supervisores não devem ver essa conta na listagem.
  const isMaster = useAuthStore((s) => s.isMaster)

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: fetchProfiles,
    staleTime: 60_000,
  })
  const { data: frentistas = [], isLoading: loadingFrentistas } = useQuery({
    queryKey: ['frentistas'],
    queryFn: () => fetchFrentistas(),
    staleTime: 60_000,
  })
  const { data: redes = [] } = useQuery({
    queryKey: ['redes'],
    queryFn: fetchRedes,
    staleTime: 5 * 60 * 1000,
  })

  const isLoading = loadingProfiles || loadingFrentistas

  // Map rede_id → nome pra resolver "posto" dos profiles (que apontam pra rede,
  // não pra empresa específica). Frentistas têm empresa_nome direto.
  const redeNomeById = useMemo(() => {
    const m = new Map<string, string>()
    for (const r of redes) m.set(r.id, r.nome)
    return m
  }, [redes])

  const pessoas = useMemo<PessoaRow[]>(() => {
    const out: PessoaRow[] = []
    for (const p of profiles) {
      // Esconde Gerente Geral pra quem não é master.
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
      out.push({
        id: `frentista:${f.user_id}`,
        nome: f.nome,
        cargo: 'Frentista',
        posto: f.empresa_nome,
        ativo: f.ativo,
      })
    }
    // Ordena por cargo (na ordem CARGO_ORDER) e depois por nome
    return out.sort((a, b) => {
      const ca = CARGO_ORDER.indexOf(a.cargo)
      const cb = CARGO_ORDER.indexOf(b.cargo)
      if (ca !== cb) return ca - cb
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
  }, [profiles, frentistas, redeNomeById, isMaster])

  // Cargos visíveis no resumo — não-master não vê o card de Gerente Geral.
  const cargosVisiveis = useMemo<Cargo[]>(
    () => isMaster ? CARGO_ORDER : CARGO_ORDER.filter((c) => c !== 'Gerente Geral'),
    [isMaster],
  )

  const pessoasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return pessoas.filter((p) => {
      if (cargoFiltro !== 'todos' && p.cargo !== cargoFiltro) return false
      if (statusFiltro === 'ativos' && !p.ativo) return false
      if (statusFiltro === 'inativos' && p.ativo) return false
      if (q) {
        const matches = p.nome.toLowerCase().includes(q)
          || (p.email && p.email.toLowerCase().includes(q))
          || p.posto.toLowerCase().includes(q)
        if (!matches) return false
      }
      return true
    })
  }, [pessoas, busca, cargoFiltro, statusFiltro])

  // Resumo por cargo (sempre considera todos os ativos, ignora filtro de busca)
  const resumo = useMemo(() => {
    const counts: Record<Cargo, number> = {
      'Gerente Geral': 0,
      'Supervisor': 0,
      'Gerente': 0,
      'Frentista': 0,
    }
    for (const p of pessoas) {
      if (p.ativo) counts[p.cargo]++
    }
    return counts
  }, [pessoas])

  const isMobile = useIsMobile()
  if (isMobile) return <PessoaMobile />

  return (
    <div className="space-y-6">
      <PageHeaderTitle placement="header">
        <div className="flex items-center gap-2.5">
          <span className="h-7 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
          <FocusModeToggle />
        </div>
      </PageHeaderTitle>

      {/* Resumo por cargo */}
      <div className={cn(
        'grid grid-cols-2 gap-3',
        cargosVisiveis.length === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3',
      )}>
        {cargosVisiveis.map((cargo) => {
          const style = CARGO_STYLE[cargo]
          const Icon = style.Icon
          return (
            <button
              key={cargo}
              type="button"
              onClick={() => setCargoFiltro(cargoFiltro === cargo ? 'todos' : cargo)}
              className={cn(
                'flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-all hover:shadow-sm',
                cargoFiltro === cargo
                  ? 'border-indigo-300 bg-indigo-50/40 dark:border-indigo-700 dark:bg-indigo-900/20'
                  : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
              )}
            >
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {cargo}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
                  {resumo[cargo]}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  ativos
                </p>
              </div>
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', style.badge)}>
                <Icon className="h-5 w-5" />
              </div>
            </button>
          )
        })}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar nome, email ou posto..."
            className="h-9 w-full rounded-md border border-gray-200 bg-gray-50 pl-8 pr-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
          {([
            { v: 'ativos', l: 'Ativos' },
            { v: 'inativos', l: 'Inativos' },
            { v: 'todos', l: 'Todos' },
          ] as const).map((opt) => (
            <button
              key={opt.v}
              onClick={() => setStatusFiltro(opt.v)}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                statusFiltro === opt.v
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
              )}
            >
              {opt.l}
            </button>
          ))}
        </div>
        <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
          {pessoasFiltradas.length} pessoa{pessoasFiltradas.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : pessoasFiltradas.length === 0 ? (
          <div className="px-5 py-16 text-center text-sm text-gray-400">
            Nenhuma pessoa pros filtros aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/50 text-[11px] uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                  <th className="px-4 py-2.5 text-left font-medium">Cargo</th>
                  <th className="px-4 py-2.5 text-left font-medium">Posto / Rede</th>
                  <th className="px-4 py-2.5 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {pessoasFiltradas.map((p) => {
                  const style = CARGO_STYLE[p.cargo]
                  const Icon = style.Icon
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                        <div>
                          <p>{p.nome}</p>
                          {p.email && p.email !== p.nome && (
                            <p className="text-[10px] text-gray-400 dark:text-gray-500">{p.email}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn(
                          'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium',
                          style.badge,
                        )}>
                          <Icon className="h-3 w-3" />
                          {p.cargo}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{p.posto}</td>
                      <td className="px-4 py-2.5 text-center">
                        {p.ativo ? (
                          <span className="inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                            Inativo
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        Visualização somente. Gerenciamento (criar/editar/inativar) em <strong>/admin/usuarios</strong> e <strong>/admin/frentistas</strong>.
      </p>
    </div>
  )
}

export default Pessoas

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { UserCog, Shield, ShieldCheck, Crown, ArrowLeft, Loader2, Plus, X, Eye, EyeOff, Trash2, Building2, LayoutGrid, Database, Fuel } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import {
  fetchProfiles,
  updateProfileRole,
  updateProfileApproved,
  updateProfileRedeId,
  updateProfileEmpresas,
  updateProfileModulos,
  updateProfilePodeApurar,
  updateProfilePodeVerReabastecimento,
  createUser,
  deleteUser,
  type ProfileRow,
} from '@/api/supabase/profiles'
import { fetchRedes, type RedeRow } from '@/api/supabase/redes'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useTenantStore } from '@/store/tenant'
import { cn } from '@/lib/utils'
import { MODULOS } from '@/lib/modulos'

const Usuarios = () => {
  const navigate = useNavigate()
  const myUser = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  // Gate: agora só gerente (is_master) acessa /admin/usuarios.
  // Filtra por user_id (master vê todos via RLS, então .single() sem filtro quebra).
  const [isMaster, setIsMaster] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const { supabase } = await import('@/lib/supabase')
      if (!supabase || !myUser) {
        setIsMaster(false)
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('is_master')
        .eq('user_id', myUser.id)
        .maybeSingle()
      if (!cancelled) setIsMaster(!!data?.is_master)
    }
    check()
    return () => { cancelled = true }
  }, [myUser])

  const { data: profiles = [], isLoading, error } = useQuery({
    queryKey: ['profiles'],
    queryFn: fetchProfiles,
    enabled: isMaster === true,
  })

  const { data: redes = [] } = useQuery({
    queryKey: ['redes'],
    queryFn: fetchRedes,
    enabled: isMaster === true,
    staleTime: 5 * 60 * 1000,
  })

  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [editingEmpresasFor, setEditingEmpresasFor] = useState<ProfileRow | null>(null)
  const [editingModulosFor, setEditingModulosFor] = useState<ProfileRow | null>(null)

  const handleToggleRole = async (row: ProfileRow) => {
    if (row.user_id === myUser?.id) {
      alert('Você não pode mudar o próprio role.')
      return
    }
    if (row.is_master) {
      alert('Gerente não pode ser rebaixado.')
      return
    }
    const next: 'user' | 'supervisor' = row.role === 'supervisor' ? 'user' : 'supervisor'
    if (next === 'supervisor' && !row.rede_id) {
      alert('Defina uma rede pra esse usuário antes de promovê-lo a supervisor.')
      return
    }
    setBusyUserId(row.user_id)
    try {
      await updateProfileRole(row.user_id, next)
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`)
    } finally {
      setBusyUserId(null)
    }
  }

  const handleToggleApproved = async (row: ProfileRow) => {
    if (row.user_id === myUser?.id) {
      alert('Você não pode desativar a própria conta.')
      return
    }
    setBusyUserId(row.user_id)
    try {
      await updateProfileApproved(row.user_id, !row.approved)
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`)
    } finally {
      setBusyUserId(null)
    }
  }

  const handleChangeRede = async (row: ProfileRow, redeId: string) => {
    if (row.is_master) {
      alert('Gerente não tem rede vinculada (vê todas).')
      return
    }
    setBusyUserId(row.user_id)
    try {
      await updateProfileRedeId(row.user_id, redeId)
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`)
    } finally {
      setBusyUserId(null)
    }
  }

  const handleSaveEmpresas = async (codigos: number[] | null) => {
    if (!editingEmpresasFor) return
    setBusyUserId(editingEmpresasFor.user_id)
    try {
      await updateProfileEmpresas(editingEmpresasFor.user_id, codigos)
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      setEditingEmpresasFor(null)
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`)
    } finally {
      setBusyUserId(null)
    }
  }

  const handleSaveModulos = async (modulos: string[] | null) => {
    if (!editingModulosFor) return
    setBusyUserId(editingModulosFor.user_id)
    try {
      await updateProfileModulos(editingModulosFor.user_id, modulos)
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      setEditingModulosFor(null)
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`)
    } finally {
      setBusyUserId(null)
    }
  }

  const handleTogglePodeApurar = async (row: ProfileRow) => {
    if (row.user_id === myUser?.id) {
      alert('Você não pode mudar o próprio poder.')
      return
    }
    if (row.is_master) {
      alert('Gerente já tem o poder de apurar — não precisa do flag.')
      return
    }
    setBusyUserId(row.user_id)
    try {
      await updateProfilePodeApurar(row.user_id, !row.pode_apurar)
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`)
    } finally {
      setBusyUserId(null)
    }
  }

  const handleTogglePodeReabast = async (row: ProfileRow) => {
    if (row.user_id === myUser?.id) {
      alert('Você não pode mudar o próprio poder.')
      return
    }
    if (row.is_master) {
      alert('Gerente já vê o reabastecimento — não precisa do flag.')
      return
    }
    setBusyUserId(row.user_id)
    try {
      await updateProfilePodeVerReabastecimento(row.user_id, !row.pode_ver_reabastecimento)
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`)
    } finally {
      setBusyUserId(null)
    }
  }

  const handleDelete = async (row: ProfileRow) => {
    if (row.user_id === myUser?.id) {
      alert('Você não pode excluir a própria conta.')
      return
    }
    if (row.is_master) {
      alert('Gerente não pode ser excluído.')
      return
    }
    const nome = row.full_name || row.email
    const ok = window.confirm(
      `Excluir o usuário ${nome}?\n\nEssa ação remove o acesso permanentemente.`
    )
    if (!ok) return
    setBusyUserId(row.user_id)
    try {
      await deleteUser(row.user_id)
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
    } catch (e) {
      alert(`Erro: ${(e as Error).message}`)
    } finally {
      setBusyUserId(null)
    }
  }

  if (isMaster === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!isMaster) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Acesso restrito à CCI Consultoria.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      </div>
    )
  }

  const redesAtivas = redes.filter((r) => r.ativo)

  // Separa gerentes (is_master) dos demais usuários — gerente aparece em card acima,
  // não na tabela. A tabela só lista quem realmente pode ser editado/promovido.
  const gerentes = profiles.filter((p) => p.is_master)
  const naoMaster = profiles.filter((p) => !p.is_master)

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <UserCog className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Usuários</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Crie acessos, defina rede e promova supervisores
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162d4a]"
        >
          <Plus className="h-4 w-4" />
          Novo usuário
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm text-red-600 dark:text-red-400">{(error as Error).message}</p>
        </div>
      )}

      {/* Banner do gerente (CCI Consultoria). Fica fora da tabela porque o
          próprio gerente não se edita aqui — todos os campos seriam "vê tudo". */}
      {gerentes.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Gerente{gerentes.length > 1 ? 's' : ''} (CCI Consultoria)
          </p>
          <div className="flex flex-wrap gap-2">
            {gerentes.map((g) => {
              const isSelf = g.user_id === myUser?.id
              return (
                <div
                  key={g.user_id}
                  className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-2.5 dark:border-amber-900/40 dark:bg-amber-900/20"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                    <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {g.full_name || g.email}
                      </p>
                      {isSelf && (
                        <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-medium uppercase text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                          você
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-gray-600 dark:text-gray-400">
                      {g.email} · vê todas as redes e postos
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : naoMaster.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Nenhum usuário cadastrado ainda. Use <strong>"+ Novo usuário"</strong> para criar.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                <th className="px-4 py-2.5 text-left font-medium">Email</th>
                <th className="px-4 py-2.5 text-center font-medium">Acesso</th>
                <th className="px-4 py-2.5 text-left font-medium">Rede</th>
                <th className="px-4 py-2.5 text-center font-medium">Postos</th>
                <th className="px-4 py-2.5 text-center font-medium">Módulos</th>
                <th className="px-4 py-2.5 text-center font-medium" title="Pode apurar dados pra alimentar o cache">Apurar</th>
                <th className="px-4 py-2.5 text-center font-medium" title="Pode ver o painel de Reabastecimento na Central da Rede">Reabast.</th>
                <th className="px-4 py-2.5 text-center font-medium">Papel</th>
                <th className="w-16 px-4 py-2.5 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {naoMaster.map((p) => (
                <UserRow
                  key={p.user_id}
                  profile={p}
                  isSelf={p.user_id === myUser?.id}
                  redes={redesAtivas}
                  busy={busyUserId === p.user_id}
                  onToggleApproved={() => handleToggleApproved(p)}
                  onToggleRole={() => handleToggleRole(p)}
                  onChangeRede={(redeId) => handleChangeRede(p, redeId)}
                  onEditEmpresas={() => setEditingEmpresasFor(p)}
                  onEditModulos={() => setEditingModulosFor(p)}
                  onTogglePodeApurar={() => handleTogglePodeApurar(p)}
                  onTogglePodeReabast={() => handleTogglePodeReabast(p)}
                  onDelete={() => handleDelete(p)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Supervisor de uma rede gerencia frentistas <strong>só dessa rede</strong>.
        Pra promover alguém a supervisor, primeiro defina a rede dele.
      </p>

      {showCreate && (
        <CreateUserModal
          redes={redesAtivas}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false)
            queryClient.invalidateQueries({ queryKey: ['profiles'] })
          }}
        />
      )}

      {editingEmpresasFor && (
        <EmpresasModal
          profile={editingEmpresasFor}
          redes={redesAtivas}
          onClose={() => setEditingEmpresasFor(null)}
          onSave={handleSaveEmpresas}
        />
      )}

      {editingModulosFor && (
        <ModulosModal
          profile={editingModulosFor}
          onClose={() => setEditingModulosFor(null)}
          onSave={handleSaveModulos}
        />
      )}
    </div>
  )
}

/* ─── Modal de criar usuário ─── */

interface CreateUserModalProps {
  redes: RedeRow[]
  onClose: () => void
  onCreated: () => void
}

const CreateUserModal = ({ redes, onClose, onCreated }: CreateUserModalProps) => {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<'user' | 'supervisor'>('user')
  const [redeId, setRedeId] = useState<string>(redes[0]?.id ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!fullName.trim() || !email.trim() || !password) {
      setErr('Preencha todos os campos.')
      return
    }
    if (password.length < 6) {
      setErr('Senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (!redeId) {
      setErr('Selecione uma rede.')
      return
    }
    setSubmitting(true)
    try {
      await createUser({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        role,
        rede_id: redeId,
      })
      onCreated()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Novo usuário</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Nome completo</span>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex: João Silva"
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              autoComplete="off"
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Senha inicial</span>
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mín. 6 caracteres"
                autoComplete="new-password"
                minLength={6}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 pr-9 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">Compartilhe com o usuário pelo canal seguro de sua escolha.</p>
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Rede</span>
            <select
              value={redeId}
              onChange={(e) => setRedeId(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
            >
              <option value="" disabled>Selecione uma rede</option>
              {redes.map((r) => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </select>
          </label>

          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Papel</span>
            <div className="mt-1 inline-flex w-full items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setRole('user')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                  role === 'user'
                    ? 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                )}
              >
                <Shield className="h-3 w-3" />
                Usuário
              </button>
              <button
                type="button"
                onClick={() => setRole('supervisor')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                  role === 'supervisor'
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                )}
              >
                <ShieldCheck className="h-3 w-3" />
                Supervisor
              </button>
            </div>
          </div>

          {err && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/30">
              <p className="text-xs font-medium text-red-600 dark:text-red-400">{err}</p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#1e3a5f] px-3 py-2 text-sm font-semibold text-white hover:bg-[#162d4a] disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Criando...
                </>
              ) : 'Criar usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ─── Row ─── */

interface UserRowProps {
  profile: ProfileRow
  isSelf: boolean
  redes: RedeRow[]
  busy: boolean
  onToggleApproved: () => void
  onToggleRole: () => void
  onChangeRede: (redeId: string) => void
  onEditEmpresas: () => void
  onEditModulos: () => void
  onTogglePodeApurar: () => void
  onTogglePodeReabast: () => void
  onDelete: () => void
}

const UserRow = ({ profile: p, isSelf, redes, busy, onToggleApproved, onToggleRole, onChangeRede, onEditEmpresas, onEditModulos, onTogglePodeApurar, onTogglePodeReabast, onDelete }: UserRowProps) => {
  const restricao = p.empresa_codigos && p.empresa_codigos.length > 0
    ? `${p.empresa_codigos.length} ${p.empresa_codigos.length === 1 ? 'posto' : 'postos'}`
    : null
  const restricaoModulos = p.modulos_permitidos && p.modulos_permitidos.length > 0
    ? `${p.modulos_permitidos.length} de ${MODULOS.length}`
    : null
  return (
    <tr>
      <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
        {p.full_name || '—'}
        {isSelf && (
          <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            você
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{p.email}</td>

      {/* Acesso (toggle) */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={onToggleApproved}
            disabled={busy || isSelf || p.is_master}
            role="switch"
            aria-checked={p.approved}
            aria-label={p.approved ? 'Desaprovar acesso' : 'Aprovar acesso'}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
              p.approved ? 'bg-emerald-500' : 'bg-amber-400',
              (busy || isSelf || p.is_master) && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className={cn(
              'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
              p.approved ? 'translate-x-[18px]' : 'translate-x-0.5'
            )} />
          </button>
          <span className={cn(
            'text-xs font-medium',
            p.approved ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
          )}>
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : (p.approved ? 'Aprovado' : 'Pendente')}
          </span>
        </div>
      </td>

      {/* Rede (dropdown) — gerente fica "—" porque vê todas */}
      <td className="px-4 py-3">
        {p.is_master ? (
          <span className="text-xs text-gray-400">— vê todas —</span>
        ) : (
          <select
            value={p.rede_id ?? ''}
            onChange={(e) => onChangeRede(e.target.value)}
            disabled={busy}
            className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 disabled:opacity-50"
          >
            <option value="" disabled>Selecione uma rede</option>
            {redes.map((r) => (
              <option key={r.id} value={r.id}>{r.nome}</option>
            ))}
          </select>
        )}
      </td>

      {/* Postos — atalho pra modal de checkboxes. Gerente vê todos por design. */}
      <td className="px-4 py-3">
        {p.is_master ? (
          <span className="block text-center text-xs text-gray-400">— todos —</span>
        ) : (
          <div className="flex items-center justify-center">
            <button
              onClick={onEditEmpresas}
              disabled={busy}
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                restricao
                  ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400',
                busy && 'opacity-50 cursor-not-allowed'
              )}
              title={restricao ? 'Editar postos permitidos' : 'Vê todos os postos da rede — clique pra restringir'}
            >
              <Building2 className="h-3 w-3" />
              {restricao ?? 'Todos'}
            </button>
          </div>
        )}
      </td>

      {/* Módulos — mesmo padrão dos postos. Gerente vê todos por design. */}
      <td className="px-4 py-3">
        {p.is_master ? (
          <span className="block text-center text-xs text-gray-400">— todos —</span>
        ) : (
          <div className="flex items-center justify-center">
            <button
              onClick={onEditModulos}
              disabled={busy}
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                restricaoModulos
                  ? 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-purple-900/50 dark:bg-purple-900/30 dark:text-purple-300'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400',
                busy && 'opacity-50 cursor-not-allowed'
              )}
              title={restricaoModulos ? 'Editar módulos liberados' : 'Vê todos os módulos — clique pra restringir'}
            >
              <LayoutGrid className="h-3 w-3" />
              {restricaoModulos ?? 'Todos'}
            </button>
          </div>
        )}
      </td>

      {/* Apurar — toggle pra dar/tirar o poder de pré-carregar meses fechados.
          Gerente sempre tem (não precisa do flag) → mostra ícone fixo. */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-center">
          {p.is_master ? (
            <span
              title="Gerente já tem o poder de apurar"
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            >
              <Database className="h-2.5 w-2.5" />
              Sempre
            </span>
          ) : (
            <button
              onClick={onTogglePodeApurar}
              disabled={busy}
              role="switch"
              aria-checked={p.pode_apurar}
              aria-label={p.pode_apurar ? 'Revogar poder de apurar' : 'Conceder poder de apurar'}
              title={p.pode_apurar ? 'Pode apurar — clique pra revogar' : 'Sem poder — clique pra conceder'}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                p.pode_apurar ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600',
                busy && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                p.pode_apurar ? 'translate-x-[18px]' : 'translate-x-0.5'
              )} />
            </button>
          )}
        </div>
      </td>

      {/* Reabastecimento — toggle pra dar/tirar a visão do painel de estoque baixo */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-center">
          {p.is_master ? (
            <span
              title="Gerente sempre vê o reabastecimento"
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            >
              <Fuel className="h-2.5 w-2.5" />
              Sempre
            </span>
          ) : (
            <button
              onClick={onTogglePodeReabast}
              disabled={busy}
              role="switch"
              aria-checked={p.pode_ver_reabastecimento}
              aria-label={p.pode_ver_reabastecimento ? 'Revogar visão de reabastecimento' : 'Conceder visão de reabastecimento'}
              title={p.pode_ver_reabastecimento ? 'Vê o painel — clique pra revogar' : 'Sem acesso — clique pra conceder'}
              className={cn(
                'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                p.pode_ver_reabastecimento ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600',
                busy && 'opacity-50 cursor-not-allowed'
              )}
            >
              <span className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                p.pode_ver_reabastecimento ? 'translate-x-[18px]' : 'translate-x-0.5'
              )} />
            </button>
          )}
        </div>
      </td>

      {/* Papel — badge Gerente pra is_master OR segmented control Usuário | Supervisor */}
      <td className="px-4 py-3">
        {p.is_master ? (
          <div className="flex items-center justify-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
              <Crown className="h-3 w-3" />
              Gerente
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
              <RoleOption
                active={p.role === 'user'}
                color="gray"
                icon={<Shield className="h-3 w-3" />}
                label="Usuário"
                disabled={busy || isSelf}
                onClick={() => p.role !== 'user' && onToggleRole()}
              />
              <RoleOption
                active={p.role === 'supervisor'}
                color="blue"
                icon={<ShieldCheck className="h-3 w-3" />}
                label="Supervisor"
                disabled={busy || isSelf}
                onClick={() => p.role !== 'supervisor' && onToggleRole()}
              />
            </div>
          </div>
        )}
      </td>

      {/* Ações — lixeira (desabilitada pra você mesmo e pra master) */}
      <td className="px-4 py-3 text-right">
        <button
          onClick={onDelete}
          disabled={busy || isSelf || p.is_master}
          title={
            isSelf
              ? 'Você não pode excluir a própria conta'
              : p.is_master
                ? 'Gerente não pode ser excluído'
                : 'Excluir usuário'
          }
          aria-label={`Excluir ${p.full_name || p.email}`}
          className={cn(
            'inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400',
            (busy || isSelf || p.is_master) && 'cursor-not-allowed opacity-30 hover:bg-transparent hover:text-gray-400 dark:hover:bg-transparent dark:hover:text-gray-400'
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  )
}

/* ─── Modal de seleção de postos permitidos ─── */

interface EmpresasModalProps {
  profile: ProfileRow
  redes: RedeRow[]
  onClose: () => void
  onSave: (codigos: number[] | null) => void
}

const EmpresasModal = ({ profile, redes, onClose, onSave }: EmpresasModalProps) => {
  const currentTenant = useTenantStore((s) => s.rede)
  const profileRede = redes.find((r) => r.id === profile.rede_id)
  // O modal só consegue listar postos se o tenant atual = a rede do supervisor
  // (porque usa a CHAVE da rede via interceptor pra chamar /EMPRESAS).
  const sameAsTenant = !!currentTenant && currentTenant.id === profile.rede_id

  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(profile.empresa_codigos ?? [])
  )

  const { data: empresasData, isLoading } = useQuery({
    queryKey: ['empresas-admin-permissoes', currentTenant?.id],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    enabled: sameAsTenant,
    staleTime: 5 * 60 * 1000,
  })
  const empresas = (empresasData?.resultados ?? []).slice().sort(
    (a, b) => (a.fantasia || a.razao).localeCompare(b.fantasia || b.razao)
  )

  const toggle = (codigo: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(codigo)) next.delete(codigo)
      else next.add(codigo)
      return next
    })
  }

  const allChecked = empresas.length > 0 && empresas.every((e) => selected.has(e.codigo))
  const toggleAll = () => {
    if (allChecked) setSelected(new Set())
    else setSelected(new Set(empresas.map((e) => e.codigo)))
  }

  const handleSave = () => {
    const arr = Array.from(selected)
    // Se selecionou todos OU não selecionou nada, passa null (sem restrição)
    const value = arr.length === 0 || arr.length === empresas.length ? null : arr
    onSave(value)
  }

  const userName = profile.full_name || profile.email

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Postos permitidos</h2>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{userName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          {!profile.rede_id ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400">
              Defina uma rede pro usuário antes de restringir postos.
            </div>
          ) : !sameAsTenant ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-xs text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
              <p className="font-medium">Rede diferente da atual</p>
              <p className="mt-1">
                Esse usuário pertence à rede <strong>{profileRede?.nome ?? 'desconhecida'}</strong>.
                Pra listar os postos, mude pra essa rede no seletor do header e abra o modal de novo.
              </p>
            </div>
          ) : isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : empresas.length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-500 dark:text-gray-400">
              Nenhum posto encontrado na rede.
            </p>
          ) : (
            <>
              <label className="mb-3 flex cursor-pointer items-center gap-2 border-b border-gray-100 pb-2 dark:border-gray-800">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="h-3.5 w-3.5 rounded border-gray-300"
                />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Marcar todos
                </span>
                <span className="ml-auto text-[10px] text-gray-400">
                  {selected.size} de {empresas.length}
                </span>
              </label>

              <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                {empresas.map((e) => (
                  <label
                    key={e.codigo}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(e.codigo)}
                      onChange={() => toggle(e.codigo)}
                      className="h-3.5 w-3.5 rounded border-gray-300"
                    />
                    <span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-200">
                      {e.fantasia || e.razao}
                    </span>
                    <span className="shrink-0 tabular-nums text-[10px] text-gray-400">
                      #{e.codigo}
                    </span>
                  </label>
                ))}
              </div>

              <p className="mt-3 text-[11px] text-gray-400">
                Marcar todos ou nenhum equivale a "vê todos da rede" (sem restrição).
              </p>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!sameAsTenant || !profile.rede_id}
            className="flex-1 rounded-md bg-[#1e3a5f] px-3 py-2 text-sm font-semibold text-white hover:bg-[#162d4a] disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Modal de seleção de módulos liberados ─── */

interface ModulosModalProps {
  profile: ProfileRow
  onClose: () => void
  onSave: (modulos: string[] | null) => void
}

const ModulosModal = ({ profile, onClose, onSave }: ModulosModalProps) => {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(profile.modulos_permitidos ?? [])
  )

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allChecked = MODULOS.every((m) => selected.has(m.id))
  const toggleAll = () => {
    if (allChecked) setSelected(new Set())
    else setSelected(new Set(MODULOS.map((m) => m.id)))
  }

  const handleSave = () => {
    const arr = Array.from(selected)
    // Tudo ou nada → null (sem restrição, vê todos)
    const value = arr.length === 0 || arr.length === MODULOS.length ? null : arr
    onSave(value)
  }

  const userName = profile.full_name || profile.email

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Módulos liberados</h2>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{userName}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <label className="mb-3 flex cursor-pointer items-center gap-2 border-b border-gray-100 pb-2 dark:border-gray-800">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={toggleAll}
              className="h-3.5 w-3.5 rounded border-gray-300"
            />
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Marcar todos
            </span>
            <span className="ml-auto text-[10px] text-gray-400">
              {selected.size} de {MODULOS.length}
            </span>
          </label>

          <div className="space-y-1">
            {MODULOS.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <input
                  type="checkbox"
                  checked={selected.has(m.id)}
                  onChange={() => toggle(m.id)}
                  className="h-3.5 w-3.5 rounded border-gray-300"
                />
                <span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-200">
                  {m.label}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-gray-400">
                  {m.path}
                </span>
              </label>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-gray-400">
            Configurações fica sempre acessível, independente da seleção. Marcar
            todos ou nenhum equivale a "sem restrição".
          </p>
        </div>

        <div className="flex items-center gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <button
            onClick={onClose}
            className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 rounded-md bg-[#1e3a5f] px-3 py-2 text-sm font-semibold text-white hover:bg-[#162d4a]"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Segmented control item ─── */

interface RoleOptionProps {
  active: boolean
  color: 'gray' | 'blue'
  icon: React.ReactNode
  label: string
  disabled: boolean
  onClick: () => void
}

const RoleOption = ({ active, color, icon, label, disabled, onClick }: RoleOptionProps) => {
  const activeBg = color === 'blue' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100'
  return (
    <button
      onClick={onClick}
      disabled={disabled || active}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium transition-colors',
        active
          ? activeBg
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/50 dark:hover:text-gray-200',
        disabled && !active && 'opacity-50 cursor-not-allowed',
        active && 'cursor-default'
      )}
    >
      {icon}
      {label}
    </button>
  )
}

export default Usuarios

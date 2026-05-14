import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { UserCog, Shield, ShieldCheck, ArrowLeft, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/auth'
import {
  fetchProfiles,
  updateProfileRole,
  updateProfileApproved,
  type ProfileRow,
} from '@/api/supabase/profiles'
import { cn } from '@/lib/utils'

const Usuarios = () => {
  const navigate = useNavigate()
  const myUser = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  // Gate: role real vem da tabela profiles. Busca uma vez.
  const [myRole, setMyRole] = useState<string | null>(null)
  const [roleLoaded, setRoleLoaded] = useState(false)
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const { supabase } = await import('@/lib/supabase')
      if (!supabase) {
        setRoleLoaded(true)
        return
      }
      const { data } = await supabase.from('profiles').select('role').single()
      if (!cancelled) {
        setMyRole(data?.role ?? null)
        setRoleLoaded(true)
      }
    }
    check()
    return () => { cancelled = true }
  }, [])
  const isSupervisor = myRole === 'supervisor'

  const { data: profiles = [], isLoading, error } = useQuery({
    queryKey: ['profiles'],
    queryFn: fetchProfiles,
    enabled: isSupervisor,
  })

  const [busyUserId, setBusyUserId] = useState<string | null>(null)

  const handleToggleRole = async (row: ProfileRow) => {
    if (row.user_id === myUser?.id) {
      alert('Você não pode mudar o próprio role — peça pra outro supervisor.')
      return
    }
    const next: 'user' | 'supervisor' = row.role === 'supervisor' ? 'user' : 'supervisor'
    if (next === 'user' && row.email === 'contato@cci.app.br') {
      alert('Não é permitido rebaixar a conta da CCI Consultoria.')
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

  if (!roleLoaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!isSupervisor) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">Acesso restrito a supervisores.</p>
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
          <UserCog className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Usuários</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Aprove cadastros e promova supervisores
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm text-red-600 dark:text-red-400">{(error as Error).message}</p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum usuário encontrado.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50/50 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                <th className="px-4 py-2.5 text-left font-medium">Email</th>
                <th className="px-4 py-2.5 text-center font-medium">Acesso</th>
                <th className="px-4 py-2.5 text-center font-medium">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {profiles.map((p) => {
                const isSelf = p.user_id === myUser?.id
                const isCciContato = p.email === 'contato@cci.app.br'
                return (
                  <tr key={p.user_id}>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {p.full_name || '—'}
                      {isSelf && (
                        <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          você
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{p.email}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleApproved(p)}
                        disabled={busyUserId === p.user_id || isSelf}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                          p.approved
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300'
                        )}
                      >
                        {busyUserId === p.user_id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <span className={cn('h-2 w-2 rounded-full', p.approved ? 'bg-emerald-500' : 'bg-amber-500')} />
                        )}
                        {p.approved ? 'Aprovado' : 'Pendente'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleRole(p)}
                        disabled={busyUserId === p.user_id || isSelf || (p.role === 'supervisor' && isCciContato)}
                        title={isCciContato && p.role === 'supervisor' ? 'CCI Consultoria não pode ser rebaixada' : undefined}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                          p.role === 'supervisor'
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
                        )}
                      >
                        {p.role === 'supervisor' ? <ShieldCheck className="h-3 w-3" /> : <Shield className="h-3 w-3" />}
                        {p.role === 'supervisor' ? 'Supervisor' : 'Usuário'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Promover alguém para supervisor dá acesso à gestão de frentistas e à esta mesma tela.
      </p>
    </div>
  )
}

export default Usuarios

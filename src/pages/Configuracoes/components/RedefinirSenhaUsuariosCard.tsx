import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KeyRound, Search, Loader2 } from 'lucide-react'
import { fetchProfiles } from '@/api/supabase/profiles'
import { useAuthStore } from '@/store/auth'
import { cn } from '@/lib/utils'

/**
 * Redefinição de senha de OUTROS usuários (só admin/master). Dispara o email de
 * redefinição do Supabase Auth (`resetPasswordForEmail`) — o próprio usuário
 * define a nova senha pelo link (/redefinir-senha). O admin não digita a senha:
 * frontend puro, sem service_role/Edge Function, dentro do READ-ONLY (operação
 * de Auth por handler, não `useMutation`). Pra a SUA própria senha, use o card
 * "Segurança" acima.
 */
const RedefinirSenhaUsuariosCard = () => {
  const isMaster = useAuthStore((s) => s.isMaster)
  const myUserId = useAuthStore((s) => s.user?.id)
  const [busca, setBusca] = useState('')
  const [busyEmail, setBusyEmail] = useState<string | null>(null)

  const { data: perfis = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: fetchProfiles,
    staleTime: 5 * 60 * 1000,
    enabled: isMaster,
  })

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const base = perfis.filter((p) => p.user_id !== myUserId) // a própria senha fica no card "Segurança"
    if (!q) return base
    return base.filter((p) => `${p.full_name ?? ''} ${p.email ?? ''}`.toLowerCase().includes(q))
  }, [perfis, busca, myUserId])

  if (!isMaster) return null

  const enviarReset = async (email: string) => {
    if (!email) { alert('Usuário sem email cadastrado.'); return }
    if (!confirm(`Enviar link de redefinição de senha para ${email}?\nEle recebe um email e define a nova senha.`)) return
    setBusyEmail(email)
    try {
      const { supabase } = await import('@/lib/supabase')
      if (!supabase) throw new Error('Supabase não configurado')
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      })
      if (error) throw error
      alert(`Link de redefinição enviado para ${email}.`)
    } catch (e) {
      alert(`Erro ao enviar reset: ${(e as Error).message}`)
    } finally {
      setBusyEmail(null)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        Redefinir senha de usuários
      </h2>
      <p className="-mt-1 text-xs text-gray-500 dark:text-gray-400">
        Envia um email de redefinição pro usuário escolhido — ele mesmo define a nova senha pelo link. A sua própria senha fica no card <span className="font-medium">Segurança</span> acima.
      </p>

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou email…"
          className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <div className="max-h-[360px] divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900">
        {isLoading ? (
          <div className="p-5 text-sm text-gray-400">Carregando usuários…</div>
        ) : filtrados.length === 0 ? (
          <div className="p-5 text-sm text-gray-400">Nenhum usuário encontrado.</div>
        ) : (
          filtrados.map((p) => {
            const busy = busyEmail === p.email
            return (
              <div key={p.user_id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                  <KeyRound className="h-4 w-4 text-gray-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{p.full_name || '—'}</p>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">{p.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => enviarReset(p.email)}
                  disabled={busy || !p.email}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                    busy || !p.email
                      ? 'cursor-not-allowed border border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-600'
                      : 'border border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-300 dark:hover:bg-blue-900/20',
                  )}
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
                  Enviar link
                </button>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}

export default RedefinirSenhaUsuariosCard

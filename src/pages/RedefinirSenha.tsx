import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Fuel, KeyRound, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

type RecoveryState = 'checking' | 'ready' | 'invalid'

/**
 * Página de redefinição de senha. Acessada via link no email enviado pelo
 * Supabase resetPasswordForEmail. O Supabase client (com detectSessionInUrl)
 * já processa o token do hash da URL automaticamente e dispara um evento
 * PASSWORD_RECOVERY no onAuthStateChange — usamos isso pra liberar o form.
 */
const RedefinirSenha = () => {
  const navigate = useNavigate()
  const [state, setState] = useState<RecoveryState>('checking')
  const [senha, setSenha] = useState('')
  const [senhaConfirm, setSenhaConfirm] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!supabase) {
      setState('invalid')
      return
    }
    let cancelled = false

    // Quando o link de recovery é processado, vem o evento PASSWORD_RECOVERY
    // e a sessão fica disponível. Em alguns casos a sessão já existe quando
    // a página monta (depende do timing do hash parsing).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setState('ready')
      }
    })

    // Fallback: checa sessão atual depois de um pequeno delay pra dar tempo
    // do client processar o hash.
    const timer = setTimeout(async () => {
      if (cancelled) return
      const { data: { session } } = await supabase!.auth.getSession()
      if (cancelled) return
      if (session) setState('ready')
      else setState('invalid')
    }, 1500)

    return () => {
      cancelled = true
      subscription.unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!supabase) {
      setError('Supabase não configurado.')
      return
    }
    if (senha.length < 6) {
      setError('A senha precisa ter no mínimo 6 caracteres.')
      return
    }
    if (senha !== senhaConfirm) {
      setError('As senhas não conferem.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: senha })
      if (error) {
        setError(error.message)
        return
      }
      setSuccess(true)
      // Redireciona pro login depois de alguns segundos
      setTimeout(() => navigate('/login', { replace: true }), 2500)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#1e3a5f] via-[#1a3358] to-[#0f2440] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white p-8 shadow-2xl dark:bg-gray-900">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1e3a5f]">
            <Fuel className="h-7 w-7 text-[#f5c518]" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900 dark:text-gray-100">
            Redefinir senha
          </h1>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Defina uma nova senha pra sua conta Visor360.
          </p>
        </div>

        {state === 'checking' && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Validando link...</p>
          </div>
        )}

        {state === 'invalid' && (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Link inválido ou expirado
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              O link de redefinição de senha não é mais válido. Solicite um novo no login.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="mt-2 inline-flex rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162d4a]"
            >
              Voltar pro login
            </button>
          </div>
        )}

        {state === 'ready' && !success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Nova senha</span>
              <div className="relative mt-1">
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="new-password"
                  minLength={6}
                  autoFocus
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 pr-9 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowSenha((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  tabIndex={-1}
                >
                  {showSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Confirmar senha</span>
              <input
                type={showSenha ? 'text' : 'password'}
                value={senhaConfirm}
                onChange={(e) => setSenhaConfirm(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
              />
            </label>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/30">
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={cn(
                'flex w-full items-center justify-center gap-1.5 rounded-md bg-[#1e3a5f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#162d4a]',
                submitting && 'cursor-not-allowed opacity-60'
              )}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Atualizando...
                </>
              ) : (
                <>
                  <KeyRound className="h-3.5 w-3.5" />
                  Definir nova senha
                </>
              )}
            </button>
          </form>
        )}

        {success && (
          <div className="space-y-3 py-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Senha alterada com sucesso
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Redirecionando pro login...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default RedefinirSenha

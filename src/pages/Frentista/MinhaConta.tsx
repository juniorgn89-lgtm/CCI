import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Lock, CheckCircle2, Loader2 } from 'lucide-react'
import { useFreentistaStore } from '@/store/frentista'
import { supabase } from '@/lib/supabase'

/**
 * Tela "Minha conta" do frentista. Por ora oferece só troca de PIN.
 * O PIN vira o password real do Supabase via prefixo `frentista-<pin>`,
 * o mesmo mapping usado no login (useFrentistaAuth).
 */
const MinhaConta = () => {
  const navigate = useNavigate()
  const session = useFreentistaStore((s) => s.session)
  const [pinAtual, setPinAtual] = useState('')
  const [pinNovo, setPinNovo] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (pinNovo !== pinConfirm) {
      setError('Confirmação não confere')
      return
    }
    if (pinNovo.length < 4) {
      setError('PIN deve ter pelo menos 4 dígitos')
      return
    }
    if (!/^\d+$/.test(pinNovo)) {
      setError('PIN deve ser numérico')
      return
    }
    if (!supabase) {
      setError('Supabase não configurado')
      return
    }

    setSubmitting(true)
    try {
      // Reautentica com o PIN atual antes de trocar (evita troca sem confirmação de identidade
      // mesmo se a sessão estiver válida)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        setError('Sessão inválida. Faça login novamente.')
        return
      }
      const { error: reauthErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: `frentista-${pinAtual}`,
      })
      if (reauthErr) {
        setError('PIN atual incorreto')
        return
      }

      // Troca o PIN
      const { error: updErr } = await supabase.auth.updateUser({
        password: `frentista-${pinNovo}`,
      })
      if (updErr) {
        setError(updErr.message)
        return
      }
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-md py-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-7 w-7 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">PIN atualizado</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Use o novo PIN no próximo login.
        </p>
        <button
          onClick={() => navigate('/frentista')}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-[#1e3a5f] px-5 py-2 text-sm font-semibold text-white hover:bg-[#162d4a]"
        >
          Voltar
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-6 py-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <User className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Minha conta</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">{session?.nome}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Trocar PIN</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">PIN atual</span>
            <input
              type="password"
              inputMode="numeric"
              value={pinAtual}
              onChange={(e) => setPinAtual(e.target.value.replace(/\D/g, ''))}
              maxLength={8}
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm tabular-nums focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Novo PIN</span>
            <input
              type="password"
              inputMode="numeric"
              value={pinNovo}
              onChange={(e) => setPinNovo(e.target.value.replace(/\D/g, ''))}
              maxLength={8}
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm tabular-nums focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
              minLength={4}
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Confirmar novo PIN</span>
            <input
              type="password"
              inputMode="numeric"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
              maxLength={8}
              className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm tabular-nums focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              required
              minLength={4}
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
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Atualizando...
              </>
            ) : (
              'Trocar PIN'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default MinhaConta

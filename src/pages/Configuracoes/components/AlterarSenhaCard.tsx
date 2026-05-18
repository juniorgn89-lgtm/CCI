import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, KeyRound, Loader2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const AlterarSenhaCard = () => {
  const { changePassword } = useAuth()

  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaConfirm, setSenhaConfirm] = useState('')
  const [showAtual, setShowAtual] = useState(false)
  const [showNova, setShowNova] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (senhaNova.length < 6) {
      setError('A nova senha precisa ter no mínimo 6 caracteres.')
      return
    }
    if (senhaNova !== senhaConfirm) {
      setError('As senhas novas não conferem.')
      return
    }
    if (senhaAtual === senhaNova) {
      setError('A nova senha deve ser diferente da atual.')
      return
    }

    setSubmitting(true)
    try {
      const r = await changePassword(senhaAtual, senhaNova)
      if (!r.ok) {
        setError(r.error ?? 'Erro ao alterar a senha.')
        return
      }
      setSuccess(true)
      setSenhaAtual('')
      setSenhaNova('')
      setSenhaConfirm('')
      // Esconde sucesso depois de alguns segundos
      setTimeout(() => setSuccess(false), 5000)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        Segurança
      </h2>
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Alterar senha</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Mínimo 6 caracteres. Você precisa informar a senha atual.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          {/* Senha atual */}
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Senha atual</span>
            <div className="relative mt-1">
              <input
                type={showAtual ? 'text' : 'password'}
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 pr-9 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
              />
              <button
                type="button"
                onClick={() => setShowAtual((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                tabIndex={-1}
              >
                {showAtual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          {/* Senha nova */}
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Senha nova</span>
            <div className="relative mt-1">
              <input
                type={showNova ? 'text' : 'password'}
                value={senhaNova}
                onChange={(e) => setSenhaNova(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 pr-9 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
              />
              <button
                type="button"
                onClick={() => setShowNova((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                tabIndex={-1}
              >
                {showNova ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          {/* Confirmar senha */}
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Confirmar senha</span>
            <input
              type={showNova ? 'text' : 'password'}
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

          {success && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                Senha alterada com sucesso.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#162d4a]',
              submitting && 'opacity-60 cursor-not-allowed'
            )}
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Alterando...
              </>
            ) : (
              'Alterar senha'
            )}
          </button>
        </form>
      </div>
    </section>
  )
}

export default AlterarSenhaCard

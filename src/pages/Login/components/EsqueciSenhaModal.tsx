import { useState, type FormEvent } from 'react'
import { X, Mail, Loader2, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

interface EsqueciSenhaModalProps {
  initialEmail?: string
  onClose: () => void
}

const EsqueciSenhaModal = ({ initialEmail = '', onClose }: EsqueciSenhaModalProps) => {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState(initialEmail)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!email.trim()) {
      setError('Informe o email da sua conta.')
      return
    }
    setSubmitting(true)
    try {
      const r = await requestPasswordReset(email.trim())
      if (!r.ok) {
        setError(r.error ?? 'Não foi possível enviar o email.')
        return
      }
      setSent(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
              <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Esqueceu a senha?
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!sent ? (
          <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Informe o email da sua conta. Enviaremos um link pra você definir uma nova senha.
            </p>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                autoFocus
                className="mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                required
              />
            </label>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/50 dark:bg-red-950/30">
                <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
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
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#1e3a5f] px-3 py-2 text-sm font-semibold text-white hover:bg-[#162d4a]',
                  submitting && 'cursor-not-allowed opacity-60'
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar link'
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 px-5 py-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Email enviado
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Verifique a caixa de entrada de <strong>{email}</strong> e clique no link pra definir uma nova senha.
              Não esqueça de olhar o spam.
            </p>
            <button
              onClick={onClose}
              className="mt-2 inline-flex rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162d4a]"
            >
              Entendi
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default EsqueciSenhaModal

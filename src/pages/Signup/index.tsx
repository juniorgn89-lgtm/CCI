import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Fuel, ArrowLeft, CheckCircle2, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

type PostSignupState = 'idle' | 'email-confirm' | 'awaiting-approval'

const Signup = () => {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [postState, setPostState] = useState<PostSignupState>('idle')
  const { signup, error } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (password !== confirm) {
      setLocalError('As senhas não coincidem')
      return
    }
    if (password.length < 6) {
      setLocalError('A senha precisa ter pelo menos 6 caracteres')
      return
    }

    setSubmitting(true)
    try {
      const result = await signup(email, password, fullName)
      if (result?.needsEmailConfirmation) setPostState('email-confirm')
      else if (result?.needsApproval) setPostState('awaiting-approval')
    } finally {
      setSubmitting(false)
    }
  }

  if (postState === 'email-confirm') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 dark:bg-gray-950">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Quase lá!</h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            Enviamos um link de confirmação para <span className="font-semibold">{email}</span>.
            Confirme seu email — depois, a CCI Consultoria precisa liberar seu acesso.
          </p>
          <Button
            onClick={() => navigate('/login')}
            className="mt-8 h-12 w-full rounded-lg bg-[#1e3a5f] text-sm font-bold hover:bg-[#162d4a]"
          >
            Voltar para o login
          </Button>
        </div>
      </div>
    )
  }

  if (postState === 'awaiting-approval') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 dark:bg-gray-950">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Cadastro recebido</h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            Sua conta <span className="font-semibold">{email}</span> foi criada e está aguardando
            aprovação da CCI Consultoria. Você será notificado quando o acesso for liberado.
          </p>
          <Button
            onClick={() => navigate('/login')}
            className="mt-8 h-12 w-full rounded-lg bg-[#1e3a5f] text-sm font-bold hover:bg-[#162d4a]"
          >
            Voltar para o login
          </Button>
        </div>
      </div>
    )
  }

  const displayError = localError ?? error

  return (
    <div className="relative flex min-h-screen">
      {/* Left panel — mesmo padrão visual do Login */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-[#1e3a5f] via-[#1a3358] to-[#0f2440] lg:flex lg:flex-col lg:items-center lg:justify-center">
        <div className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-white/5" />
        <div className="absolute right-20 top-1/4 h-40 w-40 rounded-full bg-white/[0.03]" />

        <div className="relative z-10 max-w-md px-14 text-center">
          <div className="mb-8 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm">
              <Fuel className="h-9 w-9 text-[#f5c518]" />
            </div>
          </div>
          <h2 className="text-[2.5rem] font-extrabold leading-[1.15] text-[#f5c518]">
            Crie sua conta<br />
            e comece em<br />
            minutos.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-blue-100/70">
            Acompanhe indicadores de combustíveis, conveniências, operação e lucratividade em
            tempo real com visão 360° da sua rede de postos.
          </p>
        </div>

        <p className="absolute bottom-6 text-xs text-white/25">
          &copy; {new Date().getFullYear()} CCISGA — Todos os direitos reservados
        </p>
      </div>

      {/* Right panel */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 dark:bg-gray-950 lg:w-1/2">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1e3a5f]">
            <Fuel className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#1e3a5f] dark:text-white">
              CCISGA
            </h1>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">Criar conta</p>
          </div>
        </div>

        <div className="w-full max-w-[380px]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="text"
              autoComplete="name"
              placeholder="Nome completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="h-12 rounded-lg border-gray-300 bg-gray-50 text-center text-sm placeholder:text-gray-400 focus:border-[#1e3a5f] focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
              required
            />

            <Input
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-lg border-gray-300 bg-gray-50 text-center text-sm placeholder:text-gray-400 focus:border-[#1e3a5f] focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
              required
            />

            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Senha (mín. 6 caracteres)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-lg border-gray-300 bg-gray-50 pr-10 text-center text-sm placeholder:text-gray-400 focus:border-[#1e3a5f] focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <Input
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="Confirmar senha"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-12 rounded-lg border-gray-300 bg-gray-50 text-center text-sm placeholder:text-gray-400 focus:border-[#1e3a5f] focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
              required
              minLength={6}
            />

            {displayError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
                <p className="text-center text-sm font-medium text-red-600 dark:text-red-400">
                  {displayError}
                </p>
              </div>
            )}

            <Button
              type="submit"
              className="h-12 w-full rounded-lg bg-[#1e3a5f] text-sm font-bold tracking-wide hover:bg-[#162d4a]"
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Criando conta...
                </span>
              ) : (
                'Criar conta'
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 font-medium text-gray-600 hover:text-[#1e3a5f] dark:text-gray-400 dark:hover:text-blue-400"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Já tem conta? Entrar
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default Signup

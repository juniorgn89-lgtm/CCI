import { type FormEvent, useEffect, useState } from 'react'
import { Eye, EyeOff, Fuel, User, BarChart3, Mail, Lock, ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useFrentistaAuth } from '@/hooks/useFrentistaAuth'
import { cn } from '@/lib/utils'
import { prefetchPrincipais } from '@/routes/prefetch'
import LoginQrCode from '@/pages/Login/components/LoginQrCode'
import EsqueciSenhaModal from '@/pages/Login/components/EsqueciSenhaModal'
import SecurityBadge from '@/pages/Login/components/SecurityBadge'
import FrentistaCarScene from '@/pages/Login/components/FrentistaCarScene'

type LoginMode = 'gerente' | 'frentista'

// Prefetch do /dashboard em idle: baixa o chunk enquanto o usuário digita,
// pra que o redirect pós-login seja instantâneo. Degrada pra setTimeout
// onde requestIdleCallback não existe (Safari mais antigo).
const schedulePrefetch = (fn: () => void): (() => void) => {
  const ric = (window as typeof window & {
    requestIdleCallback?: (cb: () => void) => number
    cancelIdleCallback?: (id: number) => void
  }).requestIdleCallback
  if (ric) {
    const id = ric(fn)
    return () => (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id)
  }
  const id = window.setTimeout(fn, 1500)
  return () => window.clearTimeout(id)
}

const Login = () => {
  const [mode, setMode] = useState<LoginMode>('gerente')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { login, error } = useAuth()

  const [frentistaCodigo, setFrentistaCodigo] = useState('')
  const [frentistaPin, setFreentistaPin] = useState('')
  const [frentistaSubmitting, setFrentistaSubmitting] = useState(false)
  const { login: loginFrentista, error: frentistaError } = useFrentistaAuth()
  const navigate = useNavigate()

  const [forgotOpen, setForgotOpen] = useState(false)

  useEffect(() => schedulePrefetch(prefetchPrincipais), [])

  const handleGerenteSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await login(email, password)
    } finally {
      setSubmitting(false)
    }
  }

  const handleFreentistaLogin = async (e: FormEvent) => {
    e.preventDefault()
    setFrentistaSubmitting(true)
    try {
      const ok = await loginFrentista(frentistaCodigo, frentistaPin)
      if (ok) navigate('/frentista')
    } finally {
      setFrentistaSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen bg-gradient-to-br from-[#1e3a5f] via-[#1a3358] to-[#0f2440]">
      {/* Painel esquerdo — decorativo, escondido em telas < lg.
          Animações: bolhas com float parallax, ícone com glow pulsante,
          texto com fade-in slide-up escalonado, mini-cards de KPI mock. */}
      <div className="relative hidden w-1/2 overflow-hidden lg:flex lg:flex-col lg:items-center lg:justify-center">
        {/* Bolhas decorativas com float lento (cada uma com keyframe diferente) */}
        <div
          className="absolute -left-20 -top-20 h-80 w-80 rounded-full bg-white/5"
          style={{ animation: 'login-float-a 12s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-8 right-8 h-96 w-96 rounded-full bg-white/5"
          style={{ animation: 'login-float-b 14s ease-in-out infinite' }}
        />
        <div
          className="absolute right-20 top-1/4 h-40 w-40 rounded-full bg-white/[0.03]"
          style={{ animation: 'login-float-c 10s ease-in-out infinite' }}
        />

        <div className="relative z-20 max-w-md px-14 text-center">
          <div
            className="mb-8 flex justify-center"
            style={{ animation: 'login-fade-up 0.6s ease-out 0.1s both' }}
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-sm"
              style={{ animation: 'login-glow 3.5s ease-in-out 0.8s infinite' }}
            >
              <Fuel className="h-9 w-9 text-[#f5c518]" />
            </div>
          </div>
          <h2
            className="text-[2.5rem] font-extrabold leading-[1.15] text-[#f5c518]"
            style={{ animation: 'login-fade-up 0.7s ease-out 0.25s both' }}
          >
            Simplifique sua<br />
            gestão, amplifique<br />
            seus resultados!
          </h2>
          <p
            className="mt-6 text-base leading-relaxed text-blue-100/70"
            style={{ animation: 'login-fade-up 0.7s ease-out 0.45s both' }}
          >
            Acompanhe indicadores de combustíveis, conveniências, operação e lucratividade em tempo real com visão 360° da sua rede de postos.
          </p>

          {/* Caricatura animada — frentista abastecendo carro */}
          <div
            className="mt-8 flex justify-center"
            style={{ animation: 'login-fade-up 0.8s ease-out 0.7s both' }}
          >
            <FrentistaCarScene />
          </div>
        </div>

        <p className="absolute bottom-6 text-xs text-white/25">
          &copy; {new Date().getFullYear()} Visor360 — Todos os direitos reservados
        </p>
      </div>

      {/* Painel direito — formulário (intocado do design Spalla). 100% em
          mobile, 50% em lg+. */}
      <div className="flex w-full flex-col items-center justify-center px-4 py-8 lg:w-1/2">
      {/* Brand topo: nome + subtítulo */}
      <div className="mb-6 flex flex-col items-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">Visor360</h1>
        <p className="mt-2 text-sm text-blue-100/70">Sistema de Análise de Redes</p>
      </div>

      {/* Card branco com formulário */}
      <div className="w-full max-w-[440px] rounded-2xl bg-white px-8 py-7 shadow-2xl dark:bg-gray-950">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Acessar portal</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Entre com seu e-mail e senha de acesso.
        </p>

        {/* Role selector tabs */}
        <div className="mt-6 flex overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
          <button
            onClick={() => setMode('gerente')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
              mode === 'gerente'
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            )}
          >
            <BarChart3 className="h-4 w-4" />
            Gerente
          </button>
          <button
            onClick={() => setMode('frentista')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
              mode === 'frentista'
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            )}
          >
            <User className="h-4 w-4" />
            Frentista
          </button>
        </div>

        {/* Gerente form */}
        {mode === 'gerente' && (
          <form onSubmit={handleGerenteSubmit} className="mt-5 space-y-4">
            <div>
              <label htmlFor="email" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                E-mail
              </label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 rounded-lg border-gray-200 bg-white pl-9 text-sm placeholder:text-gray-400 focus:border-[#1e3a5f] focus:ring-[#1e3a5f] dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Senha
              </label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 rounded-lg border-gray-200 bg-white pl-9 pr-10 text-sm placeholder:text-gray-400 focus:border-[#1e3a5f] focus:ring-[#1e3a5f] dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 dark:border-red-900/50 dark:bg-red-950/30">
                <p className="text-center text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="group h-11 w-full rounded-lg bg-[#1e3a5f] text-sm font-semibold hover:bg-[#162d4a] dark:bg-[#1e3a5f] dark:hover:bg-[#162d4a]"
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Acessando...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  Entrar
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-xs font-semibold text-[#1e3a5f] hover:underline dark:text-blue-400"
              >
                Esqueci minha senha
              </button>
            </div>
          </form>
        )}

        {/* Frentista form */}
        {mode === 'frentista' && (
          <form onSubmit={handleFreentistaLogin} className="mt-5 space-y-4">
            <div>
              <label htmlFor="frentista-codigo" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Código
              </label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="frentista-codigo"
                  type="text"
                  placeholder="Seu código"
                  value={frentistaCodigo}
                  onChange={(e) => setFrentistaCodigo(e.target.value)}
                  className="h-11 rounded-lg border-gray-200 bg-white pl-9 text-sm placeholder:text-gray-400 focus:border-green-500 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="frentista-pin" className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                PIN
              </label>
              <div className="relative mt-1">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="frentista-pin"
                  type="password"
                  placeholder="Seu PIN"
                  value={frentistaPin}
                  onChange={(e) => setFreentistaPin(e.target.value)}
                  className="h-11 rounded-lg border-gray-200 bg-white pl-9 text-sm placeholder:text-gray-400 focus:border-green-500 focus:ring-green-500 dark:border-gray-700 dark:bg-gray-900"
                  required
                />
              </div>
            </div>

            {frentistaError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 dark:border-red-900/50 dark:bg-red-950/30">
                <p className="text-center text-xs font-medium text-red-600 dark:text-red-400">{frentistaError}</p>
              </div>
            )}

            <Button
              type="submit"
              className="group h-11 w-full rounded-lg bg-green-600 text-sm font-semibold hover:bg-green-500"
              disabled={frentistaSubmitting}
            >
              {frentistaSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Entrando...
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  Entrar
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              )}
            </Button>

            <LoginQrCode code={frentistaCodigo} pin={frentistaPin} />
          </form>
        )}
      </div>

      {/* Footer: security badge + créditos */}
      <div className="mt-6 flex w-full max-w-[440px] flex-col items-center gap-3">
        <SecurityBadge />
        <p className="text-[11px] text-white/50">CCI Consultoria · Visor360</p>
      </div>
      </div>
      {/* /painel direito */}

      {forgotOpen && (
        <EsqueciSenhaModal initialEmail={email} onClose={() => setForgotOpen(false)} />
      )}
    </div>
  )
}

export default Login

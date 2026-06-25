import { type FormEvent, useEffect, useState } from 'react'
import { Eye, EyeOff, User, BarChart3, Mail, Lock, ArrowRight, ShieldCheck, Clock } from 'lucide-react'
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

// Marca/logo reutilizada no topo do painel navy e na versão mobile do form.
const BrandMark = ({ light = false }: { light?: boolean }) => (
  <div className="flex items-center gap-2.5">
    <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#2563eb] shadow-lg shadow-blue-900/40">
      <BarChart3 className="h-5 w-5 text-white" />
    </div>
    <span
      className={cn(
        'text-xl font-extrabold tracking-tight',
        light ? 'text-white' : 'text-[#0f172a] dark:text-gray-100',
      )}
    >
      Visor<span className="text-[#60a5fa]">360</span>
    </span>
  </div>
)

// Barras ilustrativas do mock "Faturamento · 7 dias" (placeholder, pré-auth).
const MOCK_BARS = [42, 55, 48, 68, 60, 82, 95]

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

  // Botão "Entrar" acende (azul/verde forte) só quando os campos estão preenchidos.
  const canSubmitGerente = email.trim().length > 0 && password.length > 0
  const canSubmitFrentista = frentistaCodigo.trim().length > 0 && frentistaPin.length > 0

  return (
    <div className="flex min-h-screen bg-[#fbfcfe] dark:bg-gray-950">
      {/* ───────────────────────── Painel esquerdo (navy) ─────────────────────────
          Vende o produto: marca + headline + prévia do dashboard + sinais de
          confiança. Decorativo e escondido em telas < lg. As animações aqui são
          só decorativas (halo flutuante) — o conteúdo essencial (marca, headline,
          card) pinta visível de imediato, sem fade de opacity. */}
      <aside
        className="relative hidden w-[52%] flex-col overflow-hidden lg:flex"
        style={{
          background: 'radial-gradient(125% 120% at 75% 0%, #27496f, #1a3050 40%, #0e1d30)',
        }}
      >
        {/* Grid sutil */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
        {/* Halo azul decorativo (flutua devagar) */}
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-[30rem] w-[30rem] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(37,99,235,.3), transparent 70%)',
            animation: 'login-float-a 14s ease-in-out infinite',
          }}
        />

        <div className="relative z-10 flex flex-1 flex-col px-14 py-12">
          {/* Coluna centralizada (espelha o form da direita) — evita o conteúdo
              grudar na borda esquerda do painel navy. */}
          <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
          {/* Topo: marca */}
          <BrandMark light />

          {/* Centro: pitch + prévia */}
          <div className="flex flex-1 flex-col justify-center py-10">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#2563eb]/40 bg-[#2563eb]/10 px-3 py-1 text-xs font-medium text-white/90">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
              Plataforma de gestão de postos
            </div>

            <h1 className="mt-6 text-[2.25rem] font-extrabold leading-[1.1] text-white">
              Toda a sua rede,
              <br />
              sob controle.
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-blue-100/70">
              Combustíveis, conveniência, fechamento de caixa e lucratividade — indicadores em
              tempo real, com a clareza que a sua operação exige.
            </p>

            {/* Card de prévia do dashboard (placeholder ilustrativo) */}
            <div className="mt-8 max-w-md rounded-2xl border border-white/10 bg-white/[0.08] p-4 shadow-2xl shadow-black/30 backdrop-blur-sm">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-2 text-[11px] font-medium text-white/60">
                  Central da Rede · tempo real
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-white/[0.05] p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-white/45">
                    Faturamento
                  </p>
                  <p className="mt-1 text-base font-extrabold text-white">R$ 9,66 mi</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-[#4ade80]">▲ 4,8% vs mês ant.</p>
                </div>
                <div className="rounded-xl bg-white/[0.05] p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-white/45">
                    Margem bruta
                  </p>
                  <p className="mt-1 text-base font-extrabold text-white">18,4%</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-[#4ade80]">▲ 0,6 p.p.</p>
                </div>
                <div className="rounded-xl bg-white/[0.05] p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-white/45">
                    Caixas a revisar
                  </p>
                  <p className="mt-1 text-base font-extrabold text-white">6 de 47</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-[#fbbf24]">exceção</p>
                </div>
              </div>

              <div className="mt-3 rounded-xl bg-white/[0.04] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-white/60">Faturamento · 7 dias</span>
                  <span className="text-[11px] font-semibold text-[#4ade80]">+12%</span>
                </div>
                <div className="mt-3 flex h-16 items-end gap-1.5">
                  {MOCK_BARS.map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-gradient-to-t from-[#2563eb]/40 to-[#60a5fa]"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé: sinais de confiança + créditos */}
          <div>
            <div className="flex items-center gap-5 text-[12px] text-white/55">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#4ade80]" />
                Dados criptografados
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[#60a5fa]" />
                Atualização em tempo real
              </span>
            </div>
            <p className="mt-3 text-[11px] text-white/30">
              &copy; {new Date().getFullYear()} CCI · Visor360
            </p>
          </div>
          </div>
        </div>
      </aside>

      {/* ───────────────────────── Painel direito (form claro) ───────────────────────── */}
      <main className="flex w-full flex-col lg:w-[48%]">
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-[380px]">
            {/* Marca no topo só no mobile (o painel navy some em < lg) */}
            <div className="mb-8 lg:hidden">
              <BrandMark />
            </div>

            <h2 className="text-[1.55rem] font-extrabold text-[#0f172a] dark:text-gray-100">
              Bem-vindo de volta
            </h2>
            <p className="mt-1.5 text-sm text-[#64748b] dark:text-gray-400">
              Acesse o portal da sua rede de postos.
            </p>

            {/* Abas Gerente / Frentista (segmented) */}
            <div className="mt-6 flex gap-1 rounded-full bg-[#eef2f7] p-1 dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setMode('gerente')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all',
                  mode === 'gerente'
                    ? 'bg-white text-[#1e3a5f] shadow-sm dark:bg-gray-900 dark:text-blue-300'
                    : 'text-[#64748b] hover:text-[#334155] dark:text-gray-400',
                )}
              >
                <BarChart3 className="h-4 w-4" />
                Gerente
              </button>
              <button
                type="button"
                onClick={() => setMode('frentista')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all',
                  mode === 'frentista'
                    ? 'bg-white text-[#15803d] shadow-sm dark:bg-gray-900 dark:text-green-400'
                    : 'text-[#64748b] hover:text-[#334155] dark:text-gray-400',
                )}
              >
                <User className="h-4 w-4" />
                Frentista
              </button>
            </div>

            {/* Form Gerente */}
            {mode === 'gerente' && (
              <form onSubmit={handleGerenteSubmit} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="text-xs font-semibold text-[#334155] dark:text-gray-300"
                  >
                    E-mail
                  </label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-[46px] rounded-[11px] border-[#e2e8f0] bg-white pl-9 text-sm placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="text-xs font-semibold text-[#334155] dark:text-gray-300"
                    >
                      Senha
                    </label>
                    <button
                      type="button"
                      onClick={() => setForgotOpen(true)}
                      className="text-xs font-semibold text-[#2563eb] hover:underline dark:text-blue-400"
                    >
                      Esqueci
                    </button>
                  </div>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-[46px] rounded-[11px] border-[#e2e8f0] bg-white pl-9 pr-10 text-sm placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] transition-colors hover:text-[#475569] dark:hover:text-gray-300"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-[11px] border border-red-200 bg-red-50 px-4 py-2.5 dark:border-red-900/50 dark:bg-red-950/30">
                    <p className="text-center text-xs font-medium text-red-600 dark:text-red-400">
                      {error}
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  className={cn(
                    'group h-[46px] w-full rounded-[11px] text-sm font-semibold text-white transition-all',
                    canSubmitGerente
                      ? 'bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] shadow-[0_10px_24px_rgba(37,99,235,.34)] hover:from-[#1d4ed8] hover:to-[#1d4ed8]'
                      : 'cursor-not-allowed bg-[#cbd5e1] text-white/70 shadow-none hover:bg-[#cbd5e1] dark:bg-gray-700',
                  )}
                  disabled={submitting || !canSubmitGerente}
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Acessando...
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      Entrar no portal
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  )}
                </Button>
              </form>
            )}

            {/* Form Frentista */}
            {mode === 'frentista' && (
              <form onSubmit={handleFreentistaLogin} className="mt-6 space-y-4">
                <div>
                  <label
                    htmlFor="frentista-codigo"
                    className="text-xs font-semibold text-[#334155] dark:text-gray-300"
                  >
                    Código
                  </label>
                  <div className="relative mt-1.5">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                    <Input
                      id="frentista-codigo"
                      type="text"
                      placeholder="Seu código"
                      value={frentistaCodigo}
                      onChange={(e) => setFrentistaCodigo(e.target.value)}
                      className="h-[46px] rounded-[11px] border-[#e2e8f0] bg-white pl-9 text-sm placeholder:text-[#94a3b8] focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/15 dark:border-gray-700 dark:bg-gray-900"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="frentista-pin"
                    className="text-xs font-semibold text-[#334155] dark:text-gray-300"
                  >
                    PIN
                  </label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
                    <Input
                      id="frentista-pin"
                      type="password"
                      placeholder="Seu PIN"
                      value={frentistaPin}
                      onChange={(e) => setFreentistaPin(e.target.value)}
                      className="h-[46px] rounded-[11px] border-[#e2e8f0] bg-white pl-9 text-sm placeholder:text-[#94a3b8] focus:border-[#16a34a] focus:ring-2 focus:ring-[#16a34a]/15 dark:border-gray-700 dark:bg-gray-900"
                      required
                    />
                  </div>
                </div>

                {frentistaError && (
                  <div className="rounded-[11px] border border-red-200 bg-red-50 px-4 py-2.5 dark:border-red-900/50 dark:bg-red-950/30">
                    <p className="text-center text-xs font-medium text-red-600 dark:text-red-400">
                      {frentistaError}
                    </p>
                  </div>
                )}

                <Button
                  type="submit"
                  className={cn(
                    'group h-[46px] w-full rounded-[11px] text-sm font-semibold text-white transition-all',
                    canSubmitFrentista
                      ? 'bg-gradient-to-r from-[#16a34a] to-[#15803d] shadow-[0_10px_24px_rgba(22,163,74,.32)] hover:from-[#15803d] hover:to-[#15803d]'
                      : 'cursor-not-allowed bg-[#cbd5e1] text-white/70 shadow-none hover:bg-[#cbd5e1] dark:bg-gray-700',
                  )}
                  disabled={frentistaSubmitting || !canSubmitFrentista}
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

                {/* Divisor + QR no totem */}
                <div className="flex items-center gap-3 pt-1">
                  <span className="h-px flex-1 bg-[#e2e8f0] dark:bg-gray-700" />
                  <span className="text-[11px] text-[#94a3b8]">ou use o QR code no totem</span>
                  <span className="h-px flex-1 bg-[#e2e8f0] dark:bg-gray-700" />
                </div>
                <LoginQrCode code={frentistaCodigo} pin={frentistaPin} />
              </form>
            )}

            {/* Rodapé do form */}
            <div className="mt-8 space-y-3">
              <SecurityBadge />
              <p className="text-center text-xs text-[#64748b] dark:text-gray-400">
                Problemas para acessar?{' '}
                <span className="font-semibold text-[#334155] dark:text-gray-200">
                  Fale com o suporte
                </span>
              </p>
            </div>
          </div>
        </div>
      </main>

      {forgotOpen && (
        <EsqueciSenhaModal initialEmail={email} onClose={() => setForgotOpen(false)} />
      )}
    </div>
  )
}

export default Login

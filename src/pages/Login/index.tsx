import { type FormEvent, useState } from 'react'
import { Eye, EyeOff, Fuel, User, BarChart3 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useFreentistaStore } from '@/store/frentista'
import { useFilterStore } from '@/store/filters'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

type LoginMode = 'gerente' | 'frentista'

// Temporary test access — will be replaced by Supabase auth
const FRENTISTA_TEST = {
  codigo: '1001',
  pin: '1234',
  nome: 'DERMEVAL SANTANA',
  empresaCodigo: 1,
  empresaNome: 'POSTO ITAPOA',
}

const Login = () => {
  const [mode, setMode] = useState<LoginMode>('gerente')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { login, isLoading, error } = useAuth()

  const [frentistaCodigo, setFrentistaCodigo] = useState('')
  const [frentistaPin, setFreentistaPin] = useState('')
  const [frentistaError, setFreentistaError] = useState<string | null>(null)
  const { setSession } = useFreentistaStore()
  const { setEmpresas } = useFilterStore()
  const navigate = useNavigate()

  const handleGerenteSubmit = (e: FormEvent) => {
    e.preventDefault()
    login(user, password)
  }

  const handleFreentistaLogin = (e: FormEvent) => {
    e.preventDefault()
    setFreentistaError(null)

    if (frentistaCodigo === FRENTISTA_TEST.codigo && frentistaPin === FRENTISTA_TEST.pin) {
      sessionStorage.setItem('app_authenticated', 'true')
      sessionStorage.setItem('app_mode', 'frentista')
      setEmpresas([FRENTISTA_TEST.empresaCodigo])
      setSession({
        funcionarioCodigo: 0, // Will be resolved by name lookup in the app
        nome: FRENTISTA_TEST.nome,
        empresaCodigo: FRENTISTA_TEST.empresaCodigo,
        empresaNome: FRENTISTA_TEST.empresaNome,
      })
      navigate('/frentista')
    } else {
      setFreentistaError('Código ou PIN inválido')
    }
  }

  return (
    <div className="relative flex min-h-screen">
      {/* Left panel */}
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
            Simplifique sua<br />
            gestão, amplifique<br />
            seus resultados!
          </h2>
          <p className="mt-6 text-base leading-relaxed text-blue-100/70">
            Acompanhe indicadores de combustíveis, conveniências, operação e lucratividade em tempo real com visão 360° da sua rede de postos.
          </p>
        </div>

        <p className="absolute bottom-6 text-xs text-white/25">
          &copy; {new Date().getFullYear()} CCISGA — Todos os direitos reservados
        </p>
      </div>

      {/* Right panel */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 dark:bg-gray-950 lg:w-1/2">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1e3a5f]">
              <Fuel className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1e3a5f] dark:text-white">
                CCISGA
              </h1>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                Simplifique sua gestão, amplifique seus resultados
              </p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[380px]">
          {/* Role selector tabs */}
          <div className="mb-6 flex overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
            <button
              onClick={() => setMode('gerente')}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all',
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
                'flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all',
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
            <form onSubmit={handleGerenteSubmit} className="space-y-5">
              <Input
                type="text"
                placeholder="Digite seu usuário"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="h-12 rounded-lg border-gray-300 bg-gray-50 pl-10 pr-10 text-center text-sm placeholder:text-gray-400 focus:border-[#1e3a5f] focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
                required
              />

              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-lg border-gray-300 bg-gray-50 pl-10 pr-10 text-center text-sm placeholder:text-gray-400 focus:border-[#1e3a5f] focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
                  required
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

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
                  <p className="text-center text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="h-12 w-full rounded-lg bg-[#1e3a5f] text-sm font-bold tracking-wide hover:bg-[#162d4a] dark:bg-[#1e3a5f] dark:hover:bg-[#162d4a]"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Acessando...
                  </span>
                ) : (
                  'Acessar'
                )}
              </Button>
            </form>
          )}

          {/* Frentista form */}
          {mode === 'frentista' && (
            <form onSubmit={handleFreentistaLogin} className="space-y-5">
              <Input
                type="text"
                placeholder="Seu código"
                value={frentistaCodigo}
                onChange={(e) => setFrentistaCodigo(e.target.value)}
                className="h-12 rounded-lg border-gray-300 bg-gray-50 pl-10 pr-10 text-center text-sm placeholder:text-gray-400 focus:border-green-500 focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:focus:border-green-500"
                required
              />

              <Input
                type="password"
                placeholder="Seu PIN"
                value={frentistaPin}
                onChange={(e) => setFreentistaPin(e.target.value)}
                className="h-12 rounded-lg border-gray-300 bg-gray-50 pl-10 pr-10 text-center text-sm placeholder:text-gray-400 focus:border-green-500 focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:focus:border-green-500"
                required
              />

              {frentistaError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900/50 dark:bg-red-950/30">
                  <p className="text-center text-sm font-medium text-red-600 dark:text-red-400">{frentistaError}</p>
                </div>
              )}

              <Button
                type="submit"
                className="h-12 w-full rounded-lg bg-green-600 text-sm font-bold tracking-wide hover:bg-green-500"
              >
                Entrar
              </Button>
            </form>
          )}
        </div>

        <p className="mt-12 text-center text-xs text-gray-400 dark:text-gray-500 lg:hidden">
          &copy; {new Date().getFullYear()} CCISGA
        </p>
      </div>
    </div>
  )
}

export default Login

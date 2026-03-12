import { type FormEvent, useState } from 'react'
import { Eye, EyeOff, Fuel } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

const Login = () => {
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { login, isLoading, error } = useAuth()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    login(user, password)
  }

  return (
    <div className="relative flex min-h-screen">
      {/* Left panel — gradient background + centered text */}
      <div className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-[#1e3a5f] via-[#1a3358] to-[#0f2440] lg:flex lg:flex-col lg:items-center lg:justify-center">
        {/* Decorative circles */}
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

      {/* Right panel — login form */}
      <div className="flex w-full flex-col items-center justify-center bg-white px-6 dark:bg-gray-950 lg:w-1/2">
        {/* Logo + tagline */}
        <div className="mb-12 flex flex-col items-center">
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
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Input
                id="user"
                type="text"
                placeholder="Digite seu usuário"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                className="h-12 rounded-lg border-gray-300 bg-gray-50 text-center text-sm placeholder:text-gray-400 focus:border-[#1e3a5f] focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
                required
              />
            </div>

            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-lg border-gray-300 bg-gray-50 pr-10 text-center text-sm placeholder:text-gray-400 focus:border-[#1e3a5f] focus:bg-white dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
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
                <p className="text-sm font-medium text-center text-red-600 dark:text-red-400">{error}</p>
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
        </div>

        <p className="mt-12 text-center text-xs text-gray-400 dark:text-gray-500 lg:hidden">
          &copy; {new Date().getFullYear()} CCISGA
        </p>
      </div>
    </div>
  )
}

export default Login

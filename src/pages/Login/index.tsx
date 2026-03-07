import { type FormEvent, useState } from 'react'
import { Fuel } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

const Login = () => {
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoading, error } = useAuth()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    login(user, password)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-sm px-4">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#1e3a5f]">
            <Fuel className="h-8 w-8 text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-[#1e3a5f] dark:text-blue-400">CCISGA</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Painel de Gestão de Postos</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <h2 className="text-center text-lg font-semibold text-gray-900 dark:text-gray-100">Entrar</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="user" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Usuário
                </label>
                <Input
                  id="user"
                  type="text"
                  placeholder="Usuário"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Senha
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <p className="text-sm font-medium text-red-500">{error}</p>
              )}

              <Button type="submit" className="w-full bg-[#1e3a5f] hover:bg-[#1e3a5f]/90" disabled={isLoading}>
                {isLoading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default Login

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { login as loginEndpoint } from '@/api/endpoints/auth'

let memoryToken: string | null = sessionStorage.getItem('auth_token')

export const useAuth = () => {
  const [token, setToken] = useState<string | null>(memoryToken)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const isAuthenticated = token !== null

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await loginEndpoint(email, password)
      memoryToken = response.token
      sessionStorage.setItem('auth_token', response.token)
      setToken(response.token)
      navigate('/dashboard')
    } catch {
      setError('Credenciais inválidas')
    } finally {
      setIsLoading(false)
    }
  }, [navigate])

  const logout = useCallback(() => {
    memoryToken = null
    sessionStorage.removeItem('auth_token')
    setToken(null)
    queryClient.clear()
    navigate('/login')
  }, [navigate, queryClient])

  return { token, isAuthenticated, isLoading, error, login, logout }
}

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

const AUTHENTICATED_KEY = 'app_authenticated'

export const useAuth = () => {
  const [authenticated, setAuthenticated] = useState(
    () => sessionStorage.getItem(AUTHENTICATED_KEY) === 'true'
  )
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const isAuthenticated = authenticated

  const login = useCallback((user: string, password: string) => {
    setError(null)

    const validUser = import.meta.env.VITE_APP_USER
    const validPassword = import.meta.env.VITE_APP_PASSWORD

    if (user === validUser && password === validPassword) {
      sessionStorage.setItem(AUTHENTICATED_KEY, 'true')
      setAuthenticated(true)
      const isMobile = window.innerWidth < 768
      navigate(isMobile ? '/gerente' : '/dashboard')
    } else {
      setError('Credenciais inválidas')
    }
  }, [navigate])

  const logout = useCallback(() => {
    sessionStorage.removeItem(AUTHENTICATED_KEY)
    setAuthenticated(false)
    queryClient.clear()
    navigate('/login')
  }, [navigate, queryClient])

  return { isAuthenticated, isLoading: false, error, login, logout }
}

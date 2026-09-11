import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { logAcesso } from '@/lib/acessoLog'

/** Registra uma visita a cada troca de rota (só dentro do app autenticado). */
export const useLogAcesso = () => {
  const { pathname } = useLocation()
  useEffect(() => {
    logAcesso(pathname)
  }, [pathname])
}

import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useFrentistaAuth } from '@/hooks/useFrentistaAuth'

/**
 * AutoLogin via QR code: `/frentista/auto?code=1001&pin=1234`.
 * Convertemos os params em login Supabase usando o mesmo mapping do useFrentistaAuth.
 */
const AutoLogin = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useFrentistaAuth()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Evita disparar o login mais de uma vez em strict mode / re-render
  const triggeredRef = useRef(false)

  useEffect(() => {
    if (triggeredRef.current) return
    triggeredRef.current = true

    const code = searchParams.get('code')
    const pin = searchParams.get('pin')

    if (!code || !pin) {
      navigate('/login', { replace: true })
      return
    }

    login(code, pin).then((ok) => {
      if (ok) navigate('/frentista', { replace: true })
      else setErrorMessage('Não foi possível autenticar. Verifique o QR code ou tente pela tela de login.')
    })
  }, [searchParams, navigate, login])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        {errorMessage ? (
          <>
            <p className="text-sm font-medium text-red-600 dark:text-red-400">{errorMessage}</p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="rounded-md bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162d4a]"
            >
              Ir para login
            </button>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-[#1e3a5f]" />
            <p className="text-sm font-medium text-gray-500">Autenticando...</p>
          </>
        )}
      </div>
    </div>
  )
}

export default AutoLogin

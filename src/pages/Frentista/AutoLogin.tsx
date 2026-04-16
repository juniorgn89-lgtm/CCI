import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useFreentistaStore } from '@/store/frentista'
import { useFilterStore } from '@/store/filters'
import { Loader2 } from 'lucide-react'

const FRENTISTA_TEST = {
  codigo: '1001',
  pin: '1234',
  nome: 'DERMEVAL SANTANA',
  empresaCodigo: 1,
  empresaNome: 'POSTO ITAPOA',
}

const AutoLogin = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setSession } = useFreentistaStore()
  const { setEmpresas } = useFilterStore()

  useEffect(() => {
    const code = searchParams.get('code')
    const pin = searchParams.get('pin')

    if (code === FRENTISTA_TEST.codigo && pin === FRENTISTA_TEST.pin) {
      sessionStorage.setItem('app_authenticated', 'true')
      sessionStorage.setItem('app_mode', 'frentista')
      setEmpresas([FRENTISTA_TEST.empresaCodigo])
      setSession({
        funcionarioCodigo: 0,
        nome: FRENTISTA_TEST.nome,
        empresaCodigo: FRENTISTA_TEST.empresaCodigo,
        empresaNome: FRENTISTA_TEST.empresaNome,
      })
      navigate('/frentista', { replace: true })
    } else {
      navigate('/login', { replace: true })
    }
  }, [searchParams, navigate, setSession, setEmpresas])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#1e3a5f]" />
        <p className="text-sm font-medium text-gray-500">Autenticando...</p>
      </div>
    </div>
  )
}

export default AutoLogin

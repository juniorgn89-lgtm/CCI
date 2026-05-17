import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useFilters } from '@/hooks/useFilters'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'

/**
 * Auto-seleciona o único posto permitido pro usuário no filtro global, em
 * qualquer módulo que NÃO seja o Dashboard.
 *
 * Razão: pra user com 1 posto só (ex: supervisor restrito), os módulos como
 * Operação/Conveniências/Estoques não funcionam sem empresa selecionada — só
 * mostram "Selecione uma empresa". O Dashboard tem o toggle Central ⇄ Posto
 * próprio, então fica de fora.
 *
 * Chamado uma vez no AppLayout pra cobrir todas as rotas internas.
 */
const useAutoSelectSinglePosto = () => {
  const { pathname } = useLocation()
  const { empresaCodigos, setEmpresas } = useFilters()

  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })
  const empresas = useEmpresasPermitidas(empresasData?.resultados ?? [])

  useEffect(() => {
    if (pathname === '/dashboard') return
    if (empresas.length === 1 && empresaCodigos.length === 0) {
      setEmpresas([empresas[0].codigo])
    }
  }, [pathname, empresas, empresaCodigos.length, setEmpresas])
}

export default useAutoSelectSinglePosto

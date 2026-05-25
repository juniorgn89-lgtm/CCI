import { Building2, ArrowRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { useFilters } from '@/hooks/useFilters'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Empty state quando nenhuma empresa está selecionada. Lista as empresas
 * permitidas pro usuário como cards clicáveis — atalho pra evitar abrir o
 * dropdown global no header. Filtra por `useEmpresasPermitidas` (mesma regra
 * do CompanySelect): master vê todas, supervisor/frentista só as suas.
 */
const SelectCompanyState = () => {
  const { setEmpresas } = useFilters()
  const { data: empresasData, isLoading } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })
  const empresas = useEmpresasPermitidas(empresasData?.resultados ?? [])

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-blue-200 bg-blue-50/50 px-6 py-10 dark:border-blue-800 dark:bg-blue-950/20">
      <Building2 className="h-10 w-10 text-blue-400 dark:text-blue-500" />
      <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
        Selecione uma empresa
      </p>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Pra visualizar os dados, clique numa empresa abaixo ou use o filtro no topo.
      </p>

      {/* Lista clicável */}
      <div className="mt-6 w-full max-w-2xl">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : empresas.length === 0 ? (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            Nenhuma empresa disponível pra este usuário.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {empresas.map((e) => (
              <button
                key={e.codigo}
                type="button"
                onClick={() => setEmpresas([e.codigo])}
                className="group flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left transition-all hover:border-blue-400 hover:bg-blue-50/60 hover:shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-700 dark:hover:bg-blue-900/20"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {e.fantasia || e.razao}
                  </p>
                  {e.fantasia && e.razao && e.fantasia !== e.razao && (
                    <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                      {e.razao}
                    </p>
                  )}
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-blue-500 dark:text-gray-600 dark:group-hover:text-blue-400" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SelectCompanyState

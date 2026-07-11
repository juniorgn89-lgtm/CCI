import { Building2, ArrowRight, Store } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { useFilters } from '@/hooks/useFilters'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Gate de empresa — mostrado nos módulos que funcionam com UM posto por vez
 * (operacionais/físicos por-posto) quando nenhuma empresa (ou mais de uma) está
 * selecionada. Lista as empresas permitidas como cards clicáveis; clicar aplica
 * exatamente uma. Filtra por `useEmpresasPermitidas` (master vê todas;
 * supervisor/frentista só as suas).
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
    <div className="mx-auto flex max-w-3xl flex-col items-center overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50/70 to-white px-6 py-12 text-center shadow-sm dark:border-blue-900/40 dark:from-blue-950/20 dark:to-gray-900">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e3a5f] text-white shadow-md shadow-[#1e3a5f]/20">
        <Building2 className="h-7 w-7" />
      </span>
      <h3 className="mt-4 text-lg font-bold text-[#1e3a5f] dark:text-blue-100">
        Escolha uma empresa para continuar
      </h3>
      <p className="mt-1.5 max-w-md text-sm text-gray-500 dark:text-gray-400">
        Este módulo funciona com <span className="font-semibold text-gray-700 dark:text-gray-200">uma empresa por vez</span>. Selecione um posto abaixo ou pela pílula no topo.
      </p>

      {/* Lista clicável */}
      <div className="mt-7 w-full max-w-2xl">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : empresas.length === 0 ? (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            Nenhuma empresa disponível pra este usuário.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {empresas.map((e) => (
              <button
                key={e.codigo}
                type="button"
                onClick={() => setEmpresas([e.codigo])}
                className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-left transition-all hover:border-[#2563eb] hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-600"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#2563eb] transition-colors group-hover:bg-[#2563eb] group-hover:text-white dark:bg-blue-950/40">
                  <Store className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {e.fantasia || e.razao}
                  </p>
                  {e.fantasia && e.razao && e.fantasia !== e.razao && (
                    <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{e.razao}</p>
                  )}
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-gray-300 transition-all group-hover:translate-x-0.5 group-hover:text-[#2563eb] dark:text-gray-600" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default SelectCompanyState

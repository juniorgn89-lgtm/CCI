import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, FileBarChart, RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { fetchRelatoriosDisponiveis } from '@/api/endpoints/relatorios'
import ReportSelector, { type SelectedReport } from '@/pages/Relatorios/components/ReportSelector'
import ReportViewer from '@/pages/Relatorios/components/ReportViewer'

const SelectorSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
    <div className="border-b border-gray-200 px-4 py-3">
      <Skeleton className="h-4 w-36" />
    </div>
    <div className="space-y-3 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-4" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      ))}
    </div>
  </div>
)

const Relatorios = () => {
  const [selected, setSelected] = useState<SelectedReport | null>(null)

  const {
    data: relatoriosResponse,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['relatoriosDisponiveis'],
    queryFn: () => fetchRelatoriosDisponiveis(),
  })

  const relatoriosPersonalizados = relatoriosResponse?.resultados ?? []

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
          <AlertCircle className="h-10 w-10 text-red-400" />
          <p className="mt-3 text-sm font-medium text-gray-700">
            Não foi possível carregar os relatórios.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Verifique sua conexão e tente novamente.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in flex flex-col gap-6 lg:flex-row">
      <div className="w-full shrink-0 lg:w-80">
        {isLoading ? (
          <SelectorSkeleton />
        ) : (
          <ReportSelector
            relatoriosPersonalizados={relatoriosPersonalizados}
            selected={selected}
            onSelect={setSelected}
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {selected ? (
          <ReportViewer selected={selected} />
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-24">
            <FileBarChart className="h-12 w-12 text-gray-300" />
            <p className="mt-4 text-sm font-medium text-gray-600">
              Selecione um relatório
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Escolha um relatório na lista ao lado para visualizá-lo.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Relatorios

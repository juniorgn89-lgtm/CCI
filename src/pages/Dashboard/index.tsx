import { LayoutDashboard } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import TurnosAoVivo from '@/pages/Dashboard/components/TurnosAoVivo'
import ResumoOperacao from '@/pages/Dashboard/components/ResumoOperacao'
import ProjecoesPainel from '@/pages/Dashboard/components/ProjecoesPainel'
import TabelaPostos from '@/pages/Dashboard/components/TabelaPostos'

const Dashboard = () => {
  const { empresaCodigos } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null

  // Lookup do nome da empresa selecionada (cache compartilhado com outros queries)
  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 30 * 60 * 1000,
    enabled: empresaCodigo !== null,
  })
  const empresa = empresaCodigo
    ? empresasData?.resultados.find((e) => e.empresaCodigo === empresaCodigo)
    : null
  const empresaNome = empresa?.fantasia || empresa?.razao || (empresaCodigo ? `Posto ${empresaCodigo}` : '')

  if (empresaCodigo !== null) {
    return (
      <div className="space-y-6">
        <ResumoOperacao empresaNome={empresaNome} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
          <LayoutDashboard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Central da Rede</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Acompanhamento dos postos em tempo real
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <TurnosAoVivo />
          <TabelaPostos />
        </div>
        <div className="xl:sticky xl:top-4 xl:self-start">
          <ProjecoesPainel />
        </div>
      </div>
    </div>
  )
}

export default Dashboard

import { LayoutDashboard, Building2, Network } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import TurnosAoVivo from '@/pages/Dashboard/components/TurnosAoVivo'
import ResumoOperacao from '@/pages/Dashboard/components/ResumoOperacao'
import ProjecoesPainel from '@/pages/Dashboard/components/ProjecoesPainel'
import TabelaPostos from '@/pages/Dashboard/components/TabelaPostos'
import { cn } from '@/lib/utils'

const Dashboard = () => {
  const { empresaCodigos, setEmpresas } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null

  // Carrega empresas pra: (a) descobrir nome do posto selecionado;
  // (b) saber quantos postos o user tem permissão pra ver — se for 1 só,
  // mostramos o toggle Central ⇄ Posto.
  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 30 * 60 * 1000,
  })
  const empresas = empresasData?.resultados ?? []
  const empresasPermitidas = useEmpresasPermitidas(empresas)

  const empresa = empresaCodigo
    ? empresas.find((e) => e.empresaCodigo === empresaCodigo)
    : null
  const empresaNome = empresa?.fantasia || empresa?.razao || (empresaCodigo ? `Posto ${empresaCodigo}` : '')

  // Toggle aparece pra user com exatamente 1 posto permitido — multi-posto
  // já tem o dropdown no header.
  const showToggle = empresasPermitidas.length === 1
  const singlePosto = showToggle ? empresasPermitidas[0] : null
  const singleNome = singlePosto?.fantasia || singlePosto?.razao || ''

  return (
    <div className="space-y-4">
      {showToggle && singlePosto && (
        <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
          <button
            onClick={() => setEmpresas([])}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              empresaCodigo === null
                ? 'bg-[#1e3a5f] text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            <Network className="h-3.5 w-3.5" />
            Central da Rede
          </button>
          <button
            onClick={() => setEmpresas([singlePosto.codigo])}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              empresaCodigo === singlePosto.codigo
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            )}
          >
            <Building2 className="h-3.5 w-3.5" />
            {singleNome || 'Meu posto'}
          </button>
        </div>
      )}

      {empresaCodigo !== null ? (
        <ResumoOperacao empresaNome={empresaNome} />
      ) : (
        <>
          {/* Header */}
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

          {/* Side-by-side — `items-stretch` (default) faz o painel direito esticar
              até a altura total da coluna esquerda (cards + tabela), alinhando topo↔
              topo e rodapé↔rodapé. */}
          <div className="flex flex-col gap-6 xl:flex-row">
            <div className="min-w-0 flex-1 space-y-4">
              <TurnosAoVivo />
              <TabelaPostos />
            </div>
            <aside className="hidden w-[260px] shrink-0 xl:block">
              <ProjecoesPainel />
            </aside>
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard

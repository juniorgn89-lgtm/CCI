import { lazy, Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import { Skeleton } from '@/components/ui/skeleton'
import PostoLocalSelect from '@/components/filters/PostoLocalSelect'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import useIsMobile from '@/hooks/useIsMobile'
import FechamentosMobile from '@/pages/FechamentoCaixa/FechamentosMobile'

// Só a Visão Geral usa dados REAIS (useOperacaoData → caixas/turnos do Supabase
// + live). As abas legadas (Caixa Geral, Sangria, Sobras/Faltas, Diferença
// Encerrantes) eram mock e foram retiradas até terem fonte real — os arquivos
// seguem em components/ pra religar quando o backend de fechamento existir.
const VisaoGeral = lazy(() => import('@/pages/FechamentoCaixa/components/VisaoGeral'))

const TabSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
    <div className="space-y-3">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  </div>
)

const FechamentoCaixa = () => {
  // Fechamento é por-posto → um posto por vez, com seletor quando o filtro tem mais.
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas(), staleTime: 10 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const postos = empresaCodigos.length === 0
    ? empresasPermitidas
    : empresasPermitidas.filter((e) => empresaCodigos.includes(e.codigo))
  const [activeCodigo, setActiveCodigo] = useState<number | null>(null)
  const postoCodes = postos.map((p) => p.codigo)
  const selectedCodigo = activeCodigo != null && postoCodes.includes(activeCodigo)
    ? activeCodigo
    : (postos[0]?.codigo ?? null)
  const isMobile = useIsMobile()

  // Mobile: tela própria (picker de caixas + relatório agregado).
  if (isMobile) return <FechamentosMobile />

  return (
    <div className="space-y-6">
      <PageHeaderTitle placement="header">
        <div className="flex items-center gap-2.5">
          <span className="h-7 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
          <FocusModeToggle />
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {/* Seletor de posto — só quando o filtro tem mais de um (Todos/subconjunto). */}
      {postos.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <PostoLocalSelect postos={postos} value={selectedCodigo} onChange={setActiveCodigo} />
        </div>
      )}

      {postos.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center text-sm text-gray-400 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          Nenhum posto disponível.
        </p>
      ) : (
        <Suspense fallback={<TabSkeleton />}>
          <VisaoGeral empresaCodigo={selectedCodigo} />
        </Suspense>
      )}
    </div>
  )
}

export default FechamentoCaixa

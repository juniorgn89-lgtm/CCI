import { lazy, Suspense } from 'react'
import { Brain } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import KpiSkeleton from '@/components/feedback/KpiSkeleton'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import TopBar from '@/components/layout/TopBar'
import useIsMobile from '@/hooks/useIsMobile'
import InteligenciaMobile from './InteligenciaMobile'

// Cadu IA é o único conteúdo do módulo (o Radar de Preços foi pro Comercial).
const AssistenteInteligente = lazy(() => import('./components/AssistenteInteligente'))

const TabFallback = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <KpiSkeleton key={i} />
      ))}
    </div>
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  </div>
)

const Inteligencia = () => {
  const isMobile = useIsMobile()

  // Mobile: shell próprio (Cadu IA).
  if (isMobile) return <InteligenciaMobile />

  return (
    <div className="space-y-3">
      <TopBar
        className="sticky -top-4 z-30 -mx-4 -mt-4 md:-top-5 md:-mx-6 md:-mt-5"
        title={
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-gray-100">Inteligência da Rede</h1>
            <FocusModeToggle />
          </div>
        }
      />

      <Suspense fallback={<TabFallback />}>
        <AssistenteInteligente />
      </Suspense>
    </div>
  )
}

export default Inteligencia

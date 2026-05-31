import { Fuel } from 'lucide-react'
import { useFilterStore } from '@/store/filters'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import NivelTanquesCard from '@/pages/Dashboard/components/NivelTanquesCard'

/**
 * Módulo Reabastecimento (grupo Posto) — nível dos tanques do posto, última
 * compra e projeção até o fim do mês. Reaproveita o NivelTanquesCard (mesma
 * visão usada no Resumo do posto), agora como módulo próprio na navegação.
 */
const Reabastecimento = () => {
  const { empresaCodigos } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0
  const empresaNome = useEmpresaNome()

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1e3a5f]">
            <Fuel className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                Reabastecimento{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Nível dos tanques, última compra e projeção até o fim do mês
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {!hasEmpresa && <SelectCompanyState />}
      {hasEmpresa && empresaCodigo !== null && (
        <NivelTanquesCard empresaCodigo={empresaCodigo} />
      )}
    </div>
  )
}

export default Reabastecimento

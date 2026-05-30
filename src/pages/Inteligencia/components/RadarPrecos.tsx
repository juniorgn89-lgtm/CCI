import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import { Skeleton } from '@/components/ui/skeleton'
import { useFilterStore } from '@/store/filters'
import GuerraPreco from './GuerraPreco'

/**
 * Aba "Radar de Preços" do módulo Vendas — abriga a análise de Guerra de Preço.
 * Busca os abastecimentos do período (rows) e os combustíveis (fuelTypeData) e
 * passa pro `GuerraPreco`, que é autocontido (header + estado vazio próprios).
 * Montada sempre como aba dentro de Vendas/index, onde a seleção de empresa e o
 * header da página já são tratados.
 */
const RadarPrecos = () => {
  const { rows, fuelTypeData, isLoading } = useAbastecimentosAnalytics()
  const dataInicial = useFilterStore((s) => s.dataInicial)

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {isLoading ? (
        <div className="space-y-2 p-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-md" />
          ))}
        </div>
      ) : (
        <GuerraPreco rows={rows} fuelTypes={fuelTypeData} dataInicial={dataInicial} />
      )}
    </section>
  )
}

export default RadarPrecos

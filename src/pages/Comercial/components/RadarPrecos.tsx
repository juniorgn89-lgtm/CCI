import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import useAbastecimentosAnalytics from '@/pages/Operacao/hooks/useAbastecimentosAnalytics'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import GuerraPreco from './GuerraPreco'

/**
 * Aba "Radar de Preços" (Guerra de Preço) do módulo Comercial. Análise de preço/
 * margem/elasticidade baseada no abastecimento da PRÓPRIA rede (não usa preço de
 * concorrente — por isso a FlagBand do Comercial não se aplica aqui).
 *
 * O abastecimento cru é por-posto (gated a 1 posto pra não estourar o cache),
 * então a aba mostra UM posto por vez, com seletor quando o filtro tem mais de um.
 */
const RadarPrecos = () => {
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

  const { rows, fuelTypeData, isLoading } = useAbastecimentosAnalytics(selectedCodigo)
  const dataInicial = useFilterStore((s) => s.dataInicial)

  return (
    <div className="space-y-3">
      {/* Seletor de posto — Radar é por-posto (preço se define por loja). */}
      {postos.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {postos.map((e) => (
            <button
              key={e.codigo}
              type="button"
              onClick={() => setActiveCodigo(e.codigo)}
              className={cn(
                'rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors',
                e.codigo === selectedCodigo
                  ? 'bg-[#1e3a5f] text-white shadow-sm dark:bg-blue-700'
                  : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800',
              )}
            >
              {e.fantasia}
            </button>
          ))}
        </div>
      )}

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
    </div>
  )
}

export default RadarPrecos

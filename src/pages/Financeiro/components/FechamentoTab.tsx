import { lazy, Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2 } from 'lucide-react'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { Skeleton } from '@/components/ui/skeleton'
import PostoLocalSelect from '@/components/filters/PostoLocalSelect'

const FechamentoExcecao = lazy(() => import('@/pages/CaixasTurnos/components/FechamentoExcecao'))

/**
 * Aba "Fechamento" do Financeiro. Fechamento de caixa é POR POSTO, mas usa um
 * seletor de posto LOCAL — NÃO o filtro global de empresa. Assim, escolher um
 * posto aqui não "vaza" pras outras abas do Financeiro nem pros demais módulos
 * (o filtro do topo fica intocado). Reaproveita o copiloto FechamentoExcecao.
 */
const FechamentoTab = () => {
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  // Postos = permitidos ∩ filtro global (se o usuário restringiu lá); senão todos.
  const postos = empresaCodigos.length === 0
    ? empresasPermitidas
    : empresasPermitidas.filter((e) => empresaCodigos.includes(e.codigo))
  const [activeCodigo, setActiveCodigo] = useState<number | null>(null)
  const postoCodes = postos.map((p) => p.codigo)
  const selectedCodigo = activeCodigo != null && postoCodes.includes(activeCodigo)
    ? activeCodigo
    : (postos[0]?.codigo ?? null)

  if (postos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
        Nenhum posto disponível.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Seletor de posto LOCAL — o filtro do topo NÃO é alterado. Chips quando
          são poucos; dropdown com busca quando há muitos (escala). */}
      {postos.length > 1 && (
        <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
            <Building2 className="h-3.5 w-3.5" /> Posto:
          </span>
          <PostoLocalSelect postos={postos} value={selectedCodigo} onChange={setActiveCodigo} />
        </div>
        <p className="text-[11px] leading-snug text-gray-400 dark:text-gray-500">
          O fechamento de caixa se concilia <span className="font-medium text-gray-500 dark:text-gray-400">por loja</span> (cada posto tem seus próprios caixas e turnos) — por isso você escolhe o posto aqui. A seleção vale <span className="font-medium text-gray-500 dark:text-gray-400">só nesta aba</span>: não altera o filtro do topo nem as outras abas do Financeiro.
        </p>
        </div>
      )}
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <FechamentoExcecao empresaCodigo={selectedCodigo} />
      </Suspense>
    </div>
  )
}

export default FechamentoTab

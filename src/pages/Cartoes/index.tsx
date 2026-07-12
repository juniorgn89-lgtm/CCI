import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CreditCard, CircleCheck, FileText, SlidersHorizontal } from 'lucide-react'
import useTabParam from '@/hooks/useTabParam'
import { useFilterStore } from '@/store/filters'
import { useFilters } from '@/hooks/useFilters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import TopBarTabs from '@/components/layout/TopBarTabs'
import useCartoesConciliacao from '@/pages/Cartoes/hooks/useCartoesConciliacao'
import ResultadoTab from '@/pages/Cartoes/components/ResultadoTab'
import DetalhamentoTab from '@/pages/Cartoes/components/DetalhamentoTab'
import ParametrosTab from '@/pages/Cartoes/components/ParametrosTab'

type CartaoTab = 'resultado' | 'detalhamento' | 'parametros'
const isCartaoTab = (v: string | null): v is CartaoTab =>
  v === 'resultado' || v === 'detalhamento' || v === 'parametros'

const TAB_META: { id: CartaoTab; label: string; Icon: typeof CreditCard }[] = [
  { id: 'resultado', label: 'Resultado', Icon: CircleCheck },
  { id: 'detalhamento', label: 'Detalhamento', Icon: FileText },
  { id: 'parametros', label: 'Parâmetros', Icon: SlidersHorizontal },
]

const Cartoes = () => {
  const [tab, setTab] = useTabParam<CartaoTab>('resultado', isCartaoTab)
  const { data, isLoading } = useCartoesConciliacao()

  // Postos no escopo (pra aba Parâmetros) — respeita o filtro de empresa.
  const empresaCodigos = useFilterStore((s) => s.empresaCodigos)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const { setEmpresas } = useFilters()
  const { data: empresasData } = useQuery({ queryKey: ['empresas'], queryFn: () => fetchEmpresas({ limite: 200 }), staleTime: 30 * 60 * 1000 })
  const permitidas = useEmpresasPermitidas(
    useMemo(() => (empresasData?.resultados ?? []).map((e) => ({ codigo: e.empresaCodigo, nome: e.fantasia || e.razao || `Posto ${e.empresaCodigo}` })), [empresasData]),
  )
  const postos = empresaCodigos.length > 0 ? permitidas.filter((e) => empresaCodigos.includes(e.codigo)) : permitidas

  const openPosto = (codigo: number) => {
    setEmpresas([codigo])
    setTab('resultado')
  }

  return (
    <div className="space-y-4">
      {/* Título compacto no header + Modo Foco (padrão do app). */}
      <PageHeaderTitle placement="header">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f] text-white">
              <CreditCard className="h-4 w-4" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Cartões · Conciliação</span>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">sistema × repasse do adquirente</span>
            </span>
          </span>
          <span className="h-7 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
          <FocusModeToggle />
        </div>
      </PageHeaderTitle>

      {/* Sub-abas na topbar */}
      <PageHeaderTitle>
        <TopBarTabs
          active={tab}
          onChange={(id) => setTab(id as CartaoTab)}
          tabs={TAB_META.map((t) => ({ id: t.id, label: t.label, Icon: t.Icon }))}
        />
      </PageHeaderTitle>

      {/* Seletor de período global */}
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      {tab === 'resultado' && <ResultadoTab data={data} isLoading={isLoading} />}
      {tab === 'detalhamento' && <DetalhamentoTab data={data} isLoading={isLoading} />}
      {tab === 'parametros' && <ParametrosTab postos={postos} dia={dataFinal} onOpenPosto={openPosto} />}
    </div>
  )
}

export default Cartoes

import { Link } from 'react-router-dom'
import { LineChart, Fuel, Wrench, Store, ArrowRight } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import PageHeaderActions from '@/components/layout/PageHeaderActions'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import DateRangeToolbar from '@/components/filters/DateRangeToolbar'
import SelectCompanyState from '@/components/feedback/SelectCompanyState'
import { useFilterStore } from '@/store/filters'
import { useEmpresaNome } from '@/hooks/useEmpresaNome'
import ComercialNav from '@/pages/Comercial/ComercialNav'

interface SegmentLinkProps {
  to: string
  Icon: typeof Fuel
  title: string
  subtitle: string
  iconBg: string
  iconColor: string
}

const SegmentLink = ({ to, Icon, title, subtitle, iconBg, iconColor }: SegmentLinkProps) => (
  <Link
    to={to}
    className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-700"
  >
    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}>
      <Icon className={`h-5 w-5 ${iconColor}`} />
    </div>
    <div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
    <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-400">
      Abrir <ArrowRight className="h-3 w-3" />
    </span>
  </Link>
)

/**
 * Comercial · Vendas — visão consolidada do mix da pista + conveniência.
 * Por enquanto é um hub que aponta para cada segmento; a próxima iteração
 * traz KPIs combinados (faturamento total, participação por segmento, etc.).
 */
const ComercialVendas = () => {
  const { empresaCodigos } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0
  const empresaNome = useEmpresaNome()

  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-50 dark:bg-indigo-900/30">
            <LineChart className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                Comercial · Vendas{empresaNome ? ` · ${empresaNome}` : ''}
              </h1>
              <FocusModeToggle />
            </div>
            <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
              Mix consolidado — combustível + pista + conveniência
            </p>
          </div>
        </div>
      </PageHeaderTitle>
      <PageHeaderActions>
        <DateRangeToolbar />
      </PageHeaderActions>

      <ComercialNav />

      {!hasEmpresa && <SelectCompanyState />}

      {hasEmpresa && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <SegmentLink
            to="/comercial/combustivel"
            Icon={Fuel}
            title="Combustível"
            subtitle="Litros vendidos, faturamento e ticket médio por tipo de combustível."
            iconBg="bg-blue-50 dark:bg-blue-900/30"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <SegmentLink
            to="/comercial/pista"
            Icon={Wrench}
            title="Pista"
            subtitle="Produtos automotivos vendidos na pista — filtros, óleos, palhetas, aditivos."
            iconBg="bg-amber-50 dark:bg-amber-900/30"
            iconColor="text-amber-600 dark:text-amber-400"
          />
          <SegmentLink
            to="/comercial/conveniencia"
            Icon={Store}
            title="Conveniência"
            subtitle="Vendas da loja de conveniência — bebidas, snacks, tabacaria, mercearia."
            iconBg="bg-emerald-50 dark:bg-emerald-900/30"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
        </div>
      )}

      {hasEmpresa && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-10 text-center dark:border-gray-700 dark:bg-gray-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-900/30">
            <LineChart className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-gray-900 dark:text-gray-100">
            Mix consolidado — em construção
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            A próxima iteração traz KPIs combinados de faturamento, participação por
            segmento, taxa de conversão e evolução hora a hora.
          </p>
        </div>
      )}
    </div>
  )
}

export default ComercialVendas

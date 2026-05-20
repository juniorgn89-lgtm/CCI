import { Link } from 'react-router-dom'
import { Fuel, Wrench, GitMerge } from 'lucide-react'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'

/* ─── Card de cada opção ─── */

interface OptionCardProps {
  to: string
  Icon: typeof Fuel
  title: string
  subtitle: string
  iconBg: string
  iconColor: string
}

const OptionCard = ({ to, Icon, title, subtitle, iconBg, iconColor }: OptionCardProps) => (
  <Link
    to={to}
    className="group relative flex flex-col gap-3 overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-blue-700"
  >
    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${iconBg}`}>
      <Icon className={`h-6 w-6 ${iconColor}`} />
    </div>
    <div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
    <span className="mt-auto inline-flex items-center gap-1 text-xs font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-400">
      Abrir →
    </span>
  </Link>
)

/* ─── Landing ─── */

const OperacaoLanding = () => {
  return (
    <div className="space-y-6">
      <PageHeaderTitle>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
            <Fuel className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold text-gray-900 dark:text-gray-100">Operação do Posto</h1>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              Escolha o que quer ver
            </p>
          </div>
        </div>
      </PageHeaderTitle>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        <OptionCard
          to="/operacao/combustivel"
          Icon={Fuel}
          title="Combustível"
          subtitle="Bombas, abastecimentos, turnos, caixa e produtividade — tudo do que rola na bomba."
          iconBg="bg-blue-50 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <OptionCard
          to="/operacao/pista"
          Icon={Wrench}
          title="Pista"
          subtitle="Produtos automotivos vendidos na pista — filtros, óleos, palhetas, aditivos, baterias e acessórios."
          iconBg="bg-amber-50 dark:bg-amber-900/30"
          iconColor="text-amber-600 dark:text-amber-400"
        />
        <OptionCard
          to="/operacao/mix"
          Icon={GitMerge}
          title="Mix"
          subtitle="Visão consolidada da pista: combustível + automotivos juntos. Faturamento, ticket médio e taxa de conversão."
          iconBg="bg-purple-50 dark:bg-purple-900/30"
          iconColor="text-purple-600 dark:text-purple-400"
        />
      </div>
    </div>
  )
}

export default OperacaoLanding

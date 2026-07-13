import { useLocation } from 'react-router-dom'
import PageHeaderTitle from '@/components/layout/PageHeaderTitle'
import FocusModeToggle from '@/components/layout/FocusModeToggle'
import { moduleFor } from '@/lib/moduleRegistry'

/**
 * Bloco de identidade do módulo (ícone + nome + subtítulo + Modo Foco) exibido
 * no Header, dirigido pela rota via `@/lib/moduleRegistry`. Global: some nas
 * rotas sem entrada no registro. Substitui o bloco que cada página replicava.
 */
const ModuleHeaderChrome = () => {
  const { pathname } = useLocation()
  const m = moduleFor(pathname)
  if (!m) return null
  const { Icon, nome, subtitle } = m

  return (
    <PageHeaderTitle placement="header">
      <div className="flex items-center gap-2.5">
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#1e3a5f] text-white"><Icon className="h-4 w-4" /></span>
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{nome}</span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{subtitle}</span>
          </span>
        </span>
        <span className="h-7 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
        <FocusModeToggle />
      </div>
    </PageHeaderTitle>
  )
}

export default ModuleHeaderChrome

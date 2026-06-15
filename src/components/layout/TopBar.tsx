import { cn } from '@/lib/utils'

interface TopBarProps {
  /**
   * Bloco de título (lado esquerdo). Geralmente o slot-portal
   * `PAGE_HEADER_TITLE_SLOT_ID`, que cada página preenche via <PageHeaderTitle>.
   * Carrega o próprio `flex-1`/`min-w-0` pra crescer e truncar.
   */
  title?: React.ReactNode
  /**
   * Cluster de filtros/ações (lado direito) — normalmente <GlobalFilterControls>.
   * Opcional: telas sem filtros (ex.: nível de rede) passam só o título.
   */
  actions?: React.ReactNode
  /** Sombra reforçada quando o conteúdo já rolou (feedback de barra fixa). */
  scrolled?: boolean
  className?: string
}

/**
 * TopBar consolidada do sistema — barra densa de UMA linha (título à esquerda,
 * filtros/ações à direita) que fica fixa no topo, abaixo do Header de chrome.
 *
 * Presentacional e configurável por props (sem estado próprio) pra ser a fonte
 * ÚNICA do layout da barra e evitar forks por tela. Em ≥1366px tudo cabe numa
 * linha; abaixo disso `flex-wrap` quebra de forma controlada (filtros descem).
 *
 * Padrão arquitetural completo: docs/TOPBAR.md
 */
const TopBar = ({ title, actions, scrolled, className }: TopBarProps) => (
  <div
    className={cn(
      'flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 bg-white px-4 py-1.5 transition-shadow duration-200 dark:bg-gray-900 md:px-6',
      scrolled ? 'shadow-md' : 'shadow-sm',
      className,
    )}
  >
    {title}
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
)

export default TopBar

import { forwardRef } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RowActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Ícone de apoio à esquerda do nome. */
  icon: LucideIcon
  /** Nome/rótulo da ação — SEMPRE presente (padrão da casa: nunca só ícone). */
  label: string
  /** Ícone à direita (ex.: ChevronDown quando o botão abre um menu). */
  trailingIcon?: LucideIcon
  /** Classe extra no ícone principal (ex.: animate-spin em estado carregando). */
  iconClassName?: string
  /** Tom: 'default' (azul no hover) ou 'danger' (vermelho — ações destrutivas: excluir/resetar). */
  tone?: 'default' | 'danger'
}

// Cor de texto/hover por tom. Neutro em repouso; a intenção (azul/vermelho)
// aparece no hover, pra ação destrutiva não gritar em toda linha mas sinalizar.
const TONE: Record<'default' | 'danger', string> = {
  default: 'text-gray-600 hover:border-[#2563eb] hover:text-[#2563eb] dark:text-gray-300 dark:hover:border-blue-500 dark:hover:text-blue-300',
  danger: 'text-gray-600 hover:border-red-400 hover:text-red-600 dark:text-gray-300 dark:hover:border-red-500 dark:hover:text-red-400',
}

/**
 * Botão padrão das COLUNAS DE AÇÃO — pill contornado, ícone + nome (nunca só
 * ícone). Fonte única do estilo: dropdown "Analisar", "Ver detalhe", "Reabrir",
 * "Editar", "Excluir" etc. todos passam por aqui, então nunca divergem.
 * forwardRef + spread de props pra funcionar como `DropdownMenuTrigger asChild`.
 */
const RowActionButton = forwardRef<HTMLButtonElement, RowActionButtonProps>(
  ({ icon: Icon, label, trailingIcon: Trailing, iconClassName, tone = 'default', className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800',
        TONE[tone],
        className,
      )}
      {...props}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', iconClassName)} />
      {label}
      {Trailing && <Trailing className="h-3 w-3 shrink-0 opacity-70" />}
    </button>
  ),
)
RowActionButton.displayName = 'RowActionButton'

export default RowActionButton

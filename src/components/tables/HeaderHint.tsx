import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'

interface HeaderHintProps {
  /** Rótulo da coluna. */
  label: string
  /** Texto de ajuda do "?". */
  help: string
  /** Segunda linha opcional (menor/suave) — ex.: qualificador "(mês ant.)". */
  sub?: string
  align?: 'left' | 'right' | 'center'
  /** Início de grupo de colunas — desenha o divisor vertical à esquerda. */
  groupStart?: boolean
  className?: string
}

/**
 * Cabeçalho de coluna (`<th>`) com rótulo + "?" de ajuda padrão (InfoHint).
 * Substitui os `ThWithHelp` locais espalhados pelas tabelas — mesmo contrato
 * (label/help/align/groupStart), tooltip único do sistema.
 */
const HeaderHint = ({ label, help, sub, align = 'right', groupStart, className }: HeaderHintProps) => (
  <th
    className={cn(
      'px-4 py-2 font-medium',
      align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right',
      groupStart && 'border-l border-gray-200 dark:border-gray-700',
      className,
    )}
  >
    <span
      className={cn(
        'inline-flex items-center gap-1',
        align === 'right' && 'justify-end',
        align === 'center' && 'justify-center',
      )}
    >
      {label}
      <InfoHint text={help} />
    </span>
    {sub && (
      <span className="mt-0.5 block whitespace-nowrap text-[10px] font-normal normal-case text-gray-400 dark:text-gray-500">
        {sub}
      </span>
    )}
  </th>
)

export default HeaderHint

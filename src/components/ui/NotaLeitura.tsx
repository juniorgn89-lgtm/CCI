import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface NotaLeituraProps {
  /** Texto da nota (pode conter <strong>). */
  children: ReactNode
  /** Ícone à esquerda. Default: Info azul. Passe `icon={null}` para esconder. */
  icon?: ReactNode
  /** `box` (nota/dica/disclaimer avulso) ou `footer` (rodapé de card, flush). */
  variant?: 'box' | 'footer'
  className?: string
}

/**
 * NotaLeitura — nota explicativa de leitura (legenda, rodapé, disclaimer, dica
 * "como ler a tela") com destaque AZUL sutil, theme-aware. Padrão único do app.
 */
const strongEmphasis =
  '[&_strong]:font-semibold [&_strong]:text-blue-900 dark:[&_strong]:text-blue-100'

const NotaLeitura = ({ children, icon, variant = 'box', className }: NotaLeituraProps) => {
  const showIcon = icon !== null
  const iconNode = icon === undefined ? <Info className="h-3.5 w-3.5" /> : icon

  if (variant === 'footer') {
    return (
      <div
        className={cn(
          'border-t border-blue-100 bg-blue-50/50 px-4 py-2.5 text-[10.5px] leading-relaxed text-blue-800/90',
          'dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-200/75',
          strongEmphasis,
          showIcon && 'flex items-start gap-2',
          className,
        )}
      >
        {showIcon && (
          <span className="mt-0.5 shrink-0 text-blue-500 dark:text-blue-400">{iconNode}</span>
        )}
        {showIcon ? <span className="min-w-0">{children}</span> : children}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2 text-[11px] leading-relaxed text-blue-800/90',
        'dark:border-blue-900/40 dark:bg-blue-950/25 dark:text-blue-200/80',
        strongEmphasis,
        className,
      )}
    >
      {showIcon && (
        <span className="mt-0.5 shrink-0 text-blue-500 dark:text-blue-400">{iconNode}</span>
      )}
      <span className="min-w-0">{children}</span>
    </div>
  )
}

export default NotaLeitura

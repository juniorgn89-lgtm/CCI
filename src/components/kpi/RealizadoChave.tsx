import { cn } from '@/lib/utils'

interface RealizadoChaveProps {
  /** Texto do rótulo (cru). Default: período realizado. */
  label?: string
  /**
   * Cor da máscara que "corta" a linha atrás do rótulo — deve casar com o fundo
   * imediatamente por trás. Default = área de conteúdo do app (gray-50/gray-950).
   * Passe `bg-white dark:bg-gray-900` quando a chave ficar sobre um cartão branco.
   */
  maskClassName?: string
  className?: string
}

/**
 * "Chave" (estilo legend) que abraça por cima uma fileira de cartões, com um
 * rótulo cru centralizado cortando a linha — sinaliza que os cartões mostram o
 * REALIZADO do período do filtro. Linha com cantos descendo em direção aos
 * cartões. Renderizar imediatamente antes do grid de KPIs (de preferência no
 * mesmo wrapper, pra os cantos "encostarem" nos cartões).
 */
const RealizadoChave = ({
  label = 'Realizado · Período Selecionado',
  maskClassName = 'bg-gray-50 dark:bg-gray-950',
  className,
}: RealizadoChaveProps) => (
  <div
    className={cn(
      'relative mb-2 h-3 rounded-t-xl border-x border-t border-gray-200 dark:border-gray-700',
      className,
    )}
  >
    <span
      className={cn(
        'absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap px-2.5 text-[11px] font-medium text-gray-400 dark:text-gray-500',
        maskClassName,
      )}
    >
      {label}
    </span>
  </div>
)

export default RealizadoChave

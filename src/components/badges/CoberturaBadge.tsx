import { Boxes } from 'lucide-react'
import { cn } from '@/lib/utils'
import { coberturaBadgeData } from '@/components/badges/cobertura'

interface CoberturaBadgeProps {
  saldo: number | undefined
  quantidade: number
  diasPeriodo: number
  /** "compact" (default) é mais curto pra tabelas; "long" tem "X dias" completo. */
  format?: 'compact' | 'long'
  /** Texto mostrado quando o produto não tem registro de estoque. Default: "—". */
  fallback?: string
}

/**
 * Badge de cobertura pronto pra usar — encapsula `coberturaBadgeData` num
 * componente. Use quando precisar do badge sem manipular o objeto cru.
 */
const CoberturaBadge = ({ saldo, quantidade, diasPeriodo, format = 'compact', fallback = '—' }: CoberturaBadgeProps) => {
  const badge = coberturaBadgeData(saldo, quantidade, diasPeriodo, format)
  if (!badge) return <span className="text-[10px] text-gray-400">{fallback}</span>
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums', badge.bg, badge.text)}
      title={badge.tooltip}
    >
      <Boxes className="h-3 w-3" />
      {badge.label}
    </span>
  )
}

export default CoberturaBadge

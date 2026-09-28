import { TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import InfoHint from '@/components/ui/InfoHint'
import { descreverProjecaoModo, type ProjecaoModo } from '@/lib/projecaoModo'

interface ProjecaoModoAvisoProps {
  modo: ProjecaoModo
  /** Sufixo curto (ex.: "combustível") quando o chip fala de um setor específico. */
  contexto?: string
  /** 'navy' = sobre os painéis escuros de projeção; 'claro' = cards brancos/escuros. */
  tone?: 'claro' | 'navy'
  className?: string
}

/**
 * Chip âmbar "Projeção linear" + "?" com o motivo. Só aparece quando a projeção
 * NÃO é sazonal — quando é, não renderiza nada (o padrão não precisa de selo).
 * Um lugar só pra esse aviso: gráfico diário, card executivo e painel da Central.
 */
const ProjecaoModoAviso = ({ modo, contexto, tone = 'claro', className }: ProjecaoModoAvisoProps) => {
  const d = descreverProjecaoModo(modo)
  if (!d) return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1',
        tone === 'navy'
          ? 'bg-amber-400/20 text-amber-100 ring-amber-300/30'
          : 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-300/25',
        className,
      )}
    >
      <TriangleAlert className="h-3 w-3" />
      {d.curto}
      {contexto ? ` · ${contexto}` : ''}
      <InfoHint
        text={d.longo}
        className={tone === 'navy' ? 'text-amber-100/70 hover:text-amber-50 dark:text-amber-100/70 dark:hover:text-amber-50' : 'text-amber-700/70 hover:text-amber-800 dark:text-amber-200/70 dark:hover:text-amber-100'}
      />
    </span>
  )
}

export default ProjecaoModoAviso

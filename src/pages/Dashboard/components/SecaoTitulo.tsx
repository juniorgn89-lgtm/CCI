import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Título de seção da Visão Geral da Central: separa os blocos da página
 * (resultado, vendas, tanques, financeiro, detalhamento) para quem rola a tela
 * achar cada assunto pelo nome. Só rótulo — não muda o conteúdo abaixo.
 */
const SecaoTitulo = ({ titulo, subtitulo, children, className }: {
  titulo: string
  subtitulo?: string
  /** Ações à direita do título (opcional). */
  children?: ReactNode
  className?: string
}) => (
  <div className={cn('flex flex-wrap items-end justify-between gap-2 pt-2', className)}>
    <div className="min-w-0">
      <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-100">{titulo}</h2>
      {subtitulo && <p className="text-[13px] text-gray-500 dark:text-gray-400">{subtitulo}</p>}
    </div>
    {children}
  </div>
)

export default SecaoTitulo

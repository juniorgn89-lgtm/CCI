import { ChevronLeft, ChevronRight } from 'lucide-react'

interface TablePagerProps {
  /** Página atual (0-based). */
  page: number
  /** Total de páginas. */
  pageCount: number
  onPrev: () => void
  onNext: () => void
  /** Texto opcional à direita (ex.: "16–30 de 45 dias"). */
  info?: string
}

/**
 * Paginação de tabela: setas ‹ › + "Página X de Y". Some quando há 0 ou 1
 * página (nada a paginar). Substitui a navegação por semana (WeekNav) nas
 * tabelas "Realizado dia a dia".
 */
const TablePager = ({ page, pageCount, onPrev, onNext, info }: TablePagerProps) => {
  if (pageCount <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 px-4 pb-1 pt-3">
      <button
        type="button"
        aria-label="Página anterior"
        disabled={page <= 0}
        onClick={onPrev}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-default disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-xs font-medium tabular-nums text-gray-600 dark:text-gray-300">
        Página {page + 1} de {pageCount}
        {info && <span className="ml-1.5 font-normal text-gray-400">· {info}</span>}
      </span>
      <button
        type="button"
        aria-label="Próxima página"
        disabled={page >= pageCount - 1}
        onClick={onNext}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:cursor-default disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export default TablePager

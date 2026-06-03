import { type ReactNode, useState, useMemo } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  label: string
  render?: (row: T) => ReactNode
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
  className?: string
}

/** Grupo de colunas (cabeçalho superior). `label` vazio = espaçador (sem título). */
export interface ColumnGroup {
  label: string
  span: number
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string | number
  /**
   * Agrupa as colunas com um cabeçalho superior (Operação · Financeiro · …).
   * A soma dos `span` deve bater com o nº de colunas. O 1º grupo com título
   * não recebe divisor à esquerda; os seguintes, sim.
   */
  groups?: ColumnGroup[]
  /**
   * Linha de totalizador no rodapé. Mapa indexado por column.key → conteúdo.
   * Colunas sem entrada renderizam vazio. Não é afetada pela ordenação.
   */
  footer?: Partial<Record<string, ReactNode>>
  /** Se fornecido, cada linha vira clicável (cursor + onClick). */
  onRowClick?: (row: T) => void
  /**
   * Habilita destaque visual ao clicar — uma linha por vez fica marcada
   * com fundo âmbar, clique de novo desseleciona. Útil pra usuário marcar
   * uma linha enquanto compara valores entre colunas. NÃO ativar em tabelas
   * que abrem modal/drawer no onRowClick — fica confuso.
   */
  enableRowHighlight?: boolean
}

type SortDirection = 'asc' | 'desc' | null

const DataTable = <T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  footer,
  groups,
  onRowClick,
  enableRowHighlight = false,
}: DataTableProps<T>) => {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [selectedKey, setSelectedKey] = useState<string | number | null>(null)

  // Grupos de coluna → células do cabeçalho superior + índices que iniciam grupo
  // (recebem divisor vertical no corpo). 1º grupo com título não tem divisor.
  const { groupCells, dividerCols } = useMemo(() => {
    if (!groups) return { groupCells: null, dividerCols: new Set<number>() }
    const set = new Set<number>()
    let idx = 0
    let labeled = 0
    const cells = groups.map((g) => {
      const isLabeled = !!g.label
      let divider = false
      if (isLabeled) { labeled++; if (labeled > 1) { divider = true; set.add(idx) } }
      idx += g.span
      return { label: g.label, span: g.span, divider }
    })
    return { groupCells: cells, dividerCols: set }
  }, [groups])
  const divCls = 'border-l border-gray-200 dark:border-gray-700'

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) =>
        prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc'
      )
      if (sortDirection === 'desc') setSortKey(null)
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data

    return [...data].sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]

      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1

      let comparison = 0
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        comparison = aVal - bVal
      } else {
        comparison = String(aVal).localeCompare(String(bVal), 'pt-BR')
      }

      return sortDirection === 'desc' ? -comparison : comparison
    })
  }, [data, sortKey, sortDirection])

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortKey !== columnKey || !sortDirection) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    )
  }

  return (
    <Table className="min-w-[600px]">
      <TableHeader>
        {groupCells && (
          <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
            {groupCells.map((g, gi) => (
              <TableHead
                key={gi}
                colSpan={g.span}
                className={cn(
                  'h-auto py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider',
                  g.label && 'bg-gray-100/60 text-gray-400 dark:bg-gray-800/60 dark:text-gray-500',
                  g.divider && divCls,
                )}
              >
                {g.label}
              </TableHead>
            ))}
          </TableRow>
        )}
        <TableRow className="bg-gray-100 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-800">
          {columns.map((col, ci) => (
            <TableHead
              key={col.key}
              className={cn(
                'text-xs font-medium uppercase text-gray-600 dark:text-gray-400',
                col.align === 'right' && 'text-right',
                col.align === 'center' && 'text-center',
                col.sortable && 'cursor-pointer select-none',
                dividerCols.has(ci) && divCls,
                col.className
              )}
              onClick={col.sortable ? () => handleSort(col.key) : undefined}
              aria-sort={
                col.sortable && sortKey === col.key && sortDirection
                  ? sortDirection === 'asc' ? 'ascending' : 'descending'
                  : undefined
              }
              role={col.sortable ? 'button' : undefined}
              tabIndex={col.sortable ? 0 : undefined}
              onKeyDown={col.sortable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSort(col.key) } } : undefined}
              aria-label={col.sortable ? `Ordenar por ${col.label}` : undefined}
            >
              <div
                className={cn(
                  'flex items-center gap-1',
                  col.align === 'right' && 'justify-end',
                  col.align === 'center' && 'justify-center'
                )}
              >
                {col.label}
                {col.sortable && <SortIcon columnKey={col.key} />}
              </div>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody className="divide-y divide-gray-200 dark:divide-gray-700">
        {sortedData.map((row, index) => {
          const rowKey = keyExtractor(row)
          const isSelected = enableRowHighlight && selectedKey === rowKey
          const clickable = !!onRowClick || enableRowHighlight
          const handleClick = clickable
            ? () => {
                if (enableRowHighlight) {
                  setSelectedKey((curr) => (curr === rowKey ? null : rowKey))
                }
                onRowClick?.(row)
              }
            : undefined
          return (
          <TableRow
            key={rowKey}
            onClick={handleClick}
            aria-selected={isSelected || undefined}
            className={cn(
              isSelected
                ? 'bg-amber-100 hover:bg-amber-200/70 dark:bg-amber-900/30 dark:hover:bg-amber-900/40'
                : index % 2 === 1
                  ? 'bg-gray-50 hover:bg-blue-50/50 dark:bg-gray-800/30 dark:hover:bg-gray-800/50'
                  : 'hover:bg-blue-50/50 dark:hover:bg-gray-800/50',
              clickable && 'cursor-pointer'
            )}
          >
            {columns.map((col, ci) => (
              <TableCell
                key={col.key}
                className={cn(
                  'text-sm',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  dividerCols.has(ci) && divCls,
                  col.className
                )}
              >
                {col.render ? col.render(row) : (row[col.key] as ReactNode)}
              </TableCell>
            ))}
          </TableRow>
          )
        })}
        {footer && (
          <TableRow className="border-t-2 border-gray-300 bg-gray-100 font-semibold hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-800">
            {columns.map((col, ci) => (
              <TableCell
                key={col.key}
                className={cn(
                  'text-sm',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  dividerCols.has(ci) && divCls,
                  col.className
                )}
              >
                {footer[col.key] ?? ''}
              </TableCell>
            ))}
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}

export default DataTable

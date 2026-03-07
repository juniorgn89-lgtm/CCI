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

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string | number
}

type SortDirection = 'asc' | 'desc' | null

const DataTable = <T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
}: DataTableProps<T>) => {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)

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
        <TableRow className="bg-gray-100 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-800">
          {columns.map((col) => (
            <TableHead
              key={col.key}
              className={cn(
                'text-xs font-medium uppercase text-gray-600 dark:text-gray-400',
                col.align === 'right' && 'text-right',
                col.align === 'center' && 'text-center',
                col.sortable && 'cursor-pointer select-none',
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
        {sortedData.map((row, index) => (
          <TableRow
            key={keyExtractor(row)}
            className={cn(
              'hover:bg-blue-50/50 dark:hover:bg-gray-800/50',
              index % 2 === 1 && 'bg-gray-50 dark:bg-gray-800/30'
            )}
          >
            {columns.map((col) => (
              <TableCell
                key={col.key}
                className={cn(
                  'text-sm',
                  col.align === 'right' && 'text-right',
                  col.align === 'center' && 'text-center',
                  col.className
                )}
              >
                {col.render ? col.render(row) : (row[col.key] as ReactNode)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default DataTable

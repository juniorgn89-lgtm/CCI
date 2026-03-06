import { Skeleton } from '@/components/ui/skeleton'

interface TableSkeletonProps {
  rows?: number
  showHeader?: boolean
}

const TableSkeleton = ({ rows = 5, showHeader = false }: TableSkeletonProps) => (
  <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
    {showHeader && (
      <div className="border-b border-gray-200 px-6 py-4">
        <Skeleton className="h-5 w-40" />
      </div>
    )}
    <div className="space-y-3 p-6">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  </div>
)

export default TableSkeleton

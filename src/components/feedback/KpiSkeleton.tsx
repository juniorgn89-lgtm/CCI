import { Skeleton } from '@/components/ui/skeleton'

const KpiSkeleton = () => (
  <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
    <div className="flex items-center gap-2">
      <Skeleton className="h-5 w-5" />
      <Skeleton className="h-3 w-24" />
    </div>
    <Skeleton className="mt-3 h-8 w-36" />
    <Skeleton className="mt-2 h-4 w-28" />
  </div>
)

export default KpiSkeleton

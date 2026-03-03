import type { ReactNode } from 'react'

interface KpiGridProps {
  children: ReactNode
}

const KpiGrid = ({ children }: KpiGridProps) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
      {children}
    </div>
  )
}

export default KpiGrid

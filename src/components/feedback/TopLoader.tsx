import { useEffect, useRef, useState } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'

const TopLoader = () => {
  const isFetching = useIsFetching()
  const loading = isFetching > 0
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const [showRefreshBanner, setShowRefreshBanner] = useState(false)
  const hasLoadedOnce = useRef(false)

  useEffect(() => {
    if (loading) {
      setVisible(true)
      setProgress(10)
      const t1 = setTimeout(() => setProgress(30), 100)
      const t2 = setTimeout(() => setProgress(60), 500)
      const t3 = setTimeout(() => setProgress(80), 1500)

      // Show refresh banner only on subsequent fetches (not initial load)
      if (hasLoadedOnce.current) {
        setShowRefreshBanner(true)
      }

      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    } else {
      setProgress(100)
      hasLoadedOnce.current = true
      const t = setTimeout(() => {
        setVisible(false)
        setProgress(0)
        setShowRefreshBanner(false)
      }, 300)
      return () => clearTimeout(t)
    }
  }, [loading])

  if (!visible) return null

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-[9999] h-0.5">
        <div
          className="h-full bg-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {showRefreshBanner && (
        <div className="fixed bottom-4 right-4 z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 shadow-md dark:border-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            <span>Atualizando dados...</span>
          </div>
        </div>
      )}
    </>
  )
}

export default TopLoader

import { useEffect, useRef, useState } from 'react'
import { useIsFetching } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'

const TopLoader = () => {
  const isFetching = useIsFetching()
  const { empresaCodigos } = useFilterStore()
  const loading = isFetching > 0
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const hasLoadedOnce = useRef(false)
  const lastCompanyKey = useRef(empresaCodigos.slice().sort().join(','))
  const suppressUntilDone = useRef(false)

  // Detect company change — suppress while LoadingOverlay handles it
  useEffect(() => {
    const key = empresaCodigos.slice().sort().join(',')
    if (key !== lastCompanyKey.current) {
      lastCompanyKey.current = key
      suppressUntilDone.current = true
    }
  }, [empresaCodigos])

  useEffect(() => {
    if (suppressUntilDone.current && !loading) {
      suppressUntilDone.current = false
    }
  }, [loading])

  useEffect(() => {
    if (suppressUntilDone.current) return

    if (loading && hasLoadedOnce.current) {
      setVisible(true)
      setProgress(10)
      const t1 = setTimeout(() => setProgress(30), 100)
      const t2 = setTimeout(() => setProgress(60), 500)
      const t3 = setTimeout(() => setProgress(80), 1500)
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    } else if (!loading) {
      if (visible) {
        setProgress(100)
        const t = setTimeout(() => {
          setVisible(false)
          setProgress(0)
        }, 300)
        return () => clearTimeout(t)
      }
      hasLoadedOnce.current = true
    }
  }, [loading, visible])

  if (!visible || suppressUntilDone.current) return null

  return (
    <div className="fixed left-0 right-0 top-0 z-[9999] h-0.5">
      <div
        className="h-full bg-blue-500 transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

export default TopLoader

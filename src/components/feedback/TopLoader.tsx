import { useEffect, useState } from 'react'
import { useNavigation, useLocation } from 'react-router-dom'
import { useIsFetching } from '@tanstack/react-query'

const TopLoader = () => {
  const isFetching = useIsFetching()
  const loading = isFetching > 0
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (loading) {
      setVisible(true)
      setProgress(10)
      const t1 = setTimeout(() => setProgress(30), 100)
      const t2 = setTimeout(() => setProgress(60), 500)
      const t3 = setTimeout(() => setProgress(80), 1500)
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
    } else {
      setProgress(100)
      const t = setTimeout(() => { setVisible(false); setProgress(0) }, 300)
      return () => clearTimeout(t)
    }
  }, [loading])

  if (!visible) return null

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

import { useRef } from 'react'

/**
 * Returns true only on the very first load (when data transitions from undefined to loaded).
 * After the first load, returns false — so skeletons are not shown on subsequent navigations.
 * This ensures only the LoadingOverlay handles the visual loading state after company selection.
 */
const useShowSkeleton = (isLoading: boolean, hasData: boolean): boolean => {
  const hasLoadedOnce = useRef(false)

  if (hasData && !hasLoadedOnce.current) {
    hasLoadedOnce.current = true
  }

  // Only show skeleton if we're loading AND we've never had data before
  return isLoading && !hasLoadedOnce.current
}

export default useShowSkeleton

import { useState } from 'react'

/**
 * Returns true only on the very first load (when data transitions from undefined to loaded).
 * After the first load, returns false — so skeletons are not shown on subsequent navigations.
 * This ensures only the LoadingOverlay handles the visual loading state after company selection.
 *
 * Implementação: state em vez de ref, set-state-during-render pattern.
 */
const useShowSkeleton = (isLoading: boolean, hasData: boolean): boolean => {
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  if (hasData && !hasLoadedOnce) {
    setHasLoadedOnce(true)
  }

  return isLoading && !hasLoadedOnce
}

export default useShowSkeleton

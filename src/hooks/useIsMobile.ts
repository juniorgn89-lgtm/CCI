import { useSyncExternalStore } from 'react'

/** Breakpoint mobile: abaixo de 768px (md do Tailwind) usamos o shell mobile. */
const MOBILE_QUERY = '(max-width: 767px)'

const subscribe = (cb: () => void): (() => void) => {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener('change', cb)
  return () => mql.removeEventListener('change', cb)
}

const getSnapshot = (): boolean => window.matchMedia(MOBILE_QUERY).matches
const getServerSnapshot = (): boolean => false

/**
 * `true` quando a viewport está em largura mobile (<768px). Reativo a
 * resize/rotação via matchMedia + useSyncExternalStore (sem flicker no SSR).
 */
const useIsMobile = (): boolean =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

export default useIsMobile

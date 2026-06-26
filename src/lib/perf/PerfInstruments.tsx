import { Profiler, useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useIsFetching } from '@tanstack/react-query'
import { isOn, beginScreen, onFetchingChange, recordComponent } from '@/lib/perf/perfStore'

/**
 * Tracker invisível: detecta troca de tela (rota + ?tab) e o "carregamento
 * completo" (quando o nº de queries em voo volta a zero). Montado uma vez,
 * dentro do Router + QueryClientProvider. No-op quando a flag perf está off.
 */
export const PerfScreenTracker = () => {
  const { pathname, search } = useLocation()
  const isFetching = useIsFetching()
  const tab = new URLSearchParams(search).get('tab')
  const screen = tab ? `${pathname}?tab=${tab}` : pathname

  useEffect(() => {
    if (isOn()) beginScreen(screen)
  }, [screen])

  useEffect(() => {
    if (isOn()) onFetchingChange(isFetching)
  }, [isFetching])

  return null
}

/**
 * Envolve uma subárvore num <Profiler> do React pra medir o tempo de render
 * (actualDuration) e atribuir à tela atual. Quando a flag está off, é passthrough
 * (zero overhead). Envolva painéis específicos com <PerfProfiler id="..."> pra
 * adicioná-los ao ranking de componentes.
 */
export const PerfProfiler = ({ id, children }: { id: string; children: ReactNode }) => {
  if (!isOn()) return <>{children}</>
  return (
    <Profiler id={id} onRender={(pid, _phase, actualDuration) => recordComponent(pid, actualDuration)}>
      {children}
    </Profiler>
  )
}

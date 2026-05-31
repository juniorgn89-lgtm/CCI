import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * Aba controlada pela URL (`?tab=`) — deep link do menu/atalhos e do flyout de
 * sub-opções da sidebar. A aba default não aparece no `?tab=` (URL limpa).
 *
 * Padrão "store info from previous renders" pra sincronizar quando o `?tab=`
 * muda por fora (flyout, voltar do browser) sem useEffect.
 */
export const useTabParam = <T extends string>(
  defaultTab: T,
  isValid: (v: string | null) => v is T,
): [T, (tab: T) => void] => {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryTab = searchParams.get('tab')
  const [active, setActive] = useState<T>(isValid(queryTab) ? queryTab : defaultTab)

  const [prevQueryTab, setPrevQueryTab] = useState(queryTab)
  if (queryTab !== prevQueryTab) {
    setPrevQueryTab(queryTab)
    const next = isValid(queryTab) ? queryTab : defaultTab
    if (next !== active) setActive(next)
  }

  const setTab = (tab: T) => {
    setActive(tab)
    const next = new URLSearchParams(searchParams)
    if (tab === defaultTab) next.delete('tab')
    else next.set('tab', tab)
    setSearchParams(next, { replace: true })
  }

  return [active, setTab]
}

export default useTabParam

import { useCallback, useState } from 'react'

/**
 * Navegação "visualizador de fotos" pra modais de detalhe abertos de uma lista.
 *
 * Guarda a lista clicada (snapshot) + o índice e expõe `current` (item atual),
 * `prev/next` com limites (para nas pontas), `canPrev/canNext` e `position`
 * ("3 / 24"). Read-only — só anda no índice, não muta nada.
 *
 * Caso COMUM (lista homogênea → um modal). Para o caso heterogêneo (um modal
 * servindo várias listas de tipos diferentes, via adapter lazy) use um contexto
 * próprio + os componentes <DialogNavArrows>/useArrowKeyNav diretamente.
 */
export interface ListNavigator<T> {
  isOpen: boolean
  /** Item atual (null quando fechado). */
  current: T | null
  /** Abre o modal posicionado no índice clicado dentro da lista visível. */
  open: (items: T[], index: number) => void
  close: () => void
  prev: () => void
  next: () => void
  canPrev: boolean
  canNext: boolean
  /** Ex.: "3 / 24" (undefined quando fechado). */
  position: string | undefined
}

export function useListNavigator<T>(): ListNavigator<T> {
  const [state, setState] = useState<{ items: T[]; index: number } | null>(null)

  const open = useCallback((items: T[], index: number) => setState({ items, index }), [])
  const close = useCallback(() => setState(null), [])
  const prev = useCallback(() => setState((s) => (s && s.index > 0 ? { ...s, index: s.index - 1 } : s)), [])
  const next = useCallback(() => setState((s) => (s && s.index < s.items.length - 1 ? { ...s, index: s.index + 1 } : s)), [])

  const isOpen = state !== null
  const current = state ? state.items[state.index] : null
  const canPrev = !!state && state.index > 0
  const canNext = !!state && state.index < state.items.length - 1
  const position = state ? `${state.index + 1} / ${state.items.length}` : undefined

  return { isOpen, current, open, close, prev, next, canPrev, canNext, position }
}

export default useListNavigator

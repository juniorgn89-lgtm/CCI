import { useEffect } from 'react'

/**
 * Atalho de teclado ←/→ pra navegação estilo visualizador de fotos. Só dispara
 * quando `enabled` e respeitando os limites (`canPrev/canNext`). Esc fica a cargo
 * do próprio Dialog. Isolado pra não duplicar o listener em cada modal.
 */
export const useArrowKeyNav = ({
  enabled, canPrev, canNext, onPrev, onNext,
}: {
  enabled: boolean
  canPrev: boolean
  canNext: boolean
  onPrev: () => void
  onNext: () => void
}) => {
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && canPrev) { e.preventDefault(); onPrev() }
      else if (e.key === 'ArrowRight' && canNext) { e.preventDefault(); onNext() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, canPrev, canNext, onPrev, onNext])
}

export default useArrowKeyNav

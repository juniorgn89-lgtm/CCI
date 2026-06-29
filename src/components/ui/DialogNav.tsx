import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Setas translúcidas estilo visualizador de fotos do Windows. Posicionam-se
 * absolutas — devem ficar DENTRO de um container posicionado (o DialogContent
 * do Radix já é `fixed`, então serve). Somem nas pontas (`disabled` → opacity-0).
 * Fonte ÚNICA do visual: mudou aqui, mudou em todos os modais.
 */
export const DialogNavArrows = ({
  onPrev, onNext, canPrev, canNext, prevLabel = 'anterior', nextLabel = 'próximo',
}: {
  onPrev: () => void
  onNext: () => void
  canPrev: boolean
  canNext: boolean
  /** Rótulo a11y do item (ex.: "cupom", "cliente"). */
  prevLabel?: string
  nextLabel?: string
}) => {
  const base =
    'absolute top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-gray-900/5 text-gray-700 opacity-50 backdrop-blur-sm transition hover:bg-gray-900/15 hover:opacity-100 disabled:pointer-events-none disabled:opacity-0 dark:bg-white/10 dark:text-gray-100 dark:hover:bg-white/20'
  return (
    <>
      <button type="button" onClick={onPrev} disabled={!canPrev} aria-label={`Item ${prevLabel}`} className={`${base} left-1.5`}>
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button type="button" onClick={onNext} disabled={!canNext} aria-label={`Item ${nextLabel}`} className={`${base} right-1.5`}>
        <ChevronRight className="h-5 w-5" />
      </button>
    </>
  )
}

/** Contador "3 / 24" — pílula pro header do modal navegável. Some sem posição. */
export const DialogNavCounter = ({ position }: { position?: string }) =>
  position ? (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-gray-500 dark:bg-gray-800 dark:text-gray-400">
      {position}
    </span>
  ) : null

import { useEffect, useState } from 'react'
import { ChevronLeft, Sparkles, AlertTriangle } from 'lucide-react'
import { DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { PotencialSlide } from '@/lib/moduleRegistry'

/**
 * Carrossel paginado do "Potencial desta tela" (estilo onboarding WhatsApp/
 * Samsung): 1 conceito por slide com ilustração flat + título + texto, navegado
 * por Voltar/Avançar (vira "Entendi" no último), bolinhas e setas ←/→. Sem
 * rolagem. Renderizado DENTRO do DialogContent (p-0) do PotencialButton.
 */
interface Props {
  title: string
  description: string
  slides: PotencialSlide[]
  onDone: () => void
}

const PotencialCarousel = ({ title, description, slides, onDone }: Props) => {
  const [i, setI] = useState(0)
  const last = i === slides.length - 1
  const go = (n: number) => setI(Math.max(0, Math.min(slides.length - 1, n)))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(Math.min(slides.length - 1, i + 1))
      if (e.key === 'ArrowLeft') go(Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [i, slides.length])

  return (
    <div className="flex w-full min-w-0 flex-col">
      {/* Header: voltar + selo + título do módulo (âncora de a11y do Dialog) */}
      <div className="flex items-center gap-3 pb-3 pl-5 pr-12 pt-5">
        <button
          type="button"
          onClick={() => go(i - 1)}
          disabled={i === 0}
          aria-label="Voltar"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-0 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#1e3a5f] text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <DialogTitle className="truncate text-[15px] font-bold leading-tight">{title}</DialogTitle>
          <DialogDescription className="truncate text-[11.5px] text-gray-400">{description}</DialogDescription>
        </div>
      </div>

      {/* Viewport dos slides */}
      <div className="w-full overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${i * 100}%)` }}
        >
          {slides.map((s, k) => {
            const nota = s.tom === 'nota'
            const Ilustracao = s.Ilustracao
            return (
              <div key={k} className="w-full shrink-0 px-6 pb-4" aria-hidden={k !== i}>
                <div
                  className={cn(
                    'grid h-56 place-items-center overflow-hidden rounded-2xl border',
                    nota
                      ? 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20'
                      : 'border-gray-100 bg-gradient-to-br from-[#eaf0fb] to-[#dfe8f8] dark:border-gray-800 dark:from-[#12203a] dark:to-[#0e1a30]',
                  )}
                >
                  <Ilustracao className="h-auto w-[72%]" />
                </div>
                <p
                  className={cn(
                    'mt-4 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide',
                    nota ? 'text-amber-500' : 'text-[#2563eb] dark:text-blue-400',
                  )}
                >
                  {nota && <AlertTriangle className="h-3 w-3" />}
                  {s.tag}
                </p>
                <h3 className="mt-1.5 text-lg font-bold leading-snug tracking-tight text-gray-900 [text-wrap:balance] dark:text-gray-100">
                  {s.titulo}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-300">{s.texto}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer: bolinhas + Voltar/Avançar */}
      <div className="flex items-center justify-between gap-3 px-5 pb-5 pt-3">
        <div className="flex gap-1.5">
          {slides.map((_, k) => (
            <button
              key={k}
              type="button"
              onClick={() => go(k)}
              aria-label={`Ir para o slide ${k + 1}`}
              className={cn(
                'h-1.5 rounded-full transition-all',
                k === i ? 'w-5 bg-[#2563eb]' : 'w-1.5 bg-gray-300 dark:bg-gray-600',
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => go(i - 1)}
            disabled={i === 0}
            className="rounded-xl px-3.5 py-2 text-[13.5px] font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-0 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={() => (last ? onDone() : go(i + 1))}
            className="rounded-xl bg-[#2563eb] px-6 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-[filter] hover:brightness-110"
          >
            {last ? 'Entendi' : 'Avançar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PotencialCarousel

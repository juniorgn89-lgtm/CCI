import { useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { Lightbulb, Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { potencialFor } from '@/lib/moduleRegistry'
import PotencialCarousel from '@/components/potencial/PotencialCarousel'

/**
 * Botão global "Potencial desta tela" + modal explicativo, dirigido pela rota
 * (+ `?tab=`). Some silenciosamente nas telas sem conteúdo cadastrado no
 * registro (`@/lib/moduleRegistry`).
 */
const PotencialButton = () => {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const [open, setOpen] = useState(false)
  const conteudo = potencialFor(pathname, params.get('tab'))
  if (!conteudo) return null
  const carrossel = !!conteudo.slides?.length

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-[#27496f]"
      >
        <Lightbulb className="h-3.5 w-3.5" /> Potencial desta tela
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        {carrossel ? (
          <DialogContent className="block w-[95vw] max-w-lg gap-0 overflow-hidden p-0">
            <PotencialCarousel
              title={conteudo.title}
              description={conteudo.description}
              slides={conteudo.slides!}
              onDone={() => setOpen(false)}
            />
          </DialogContent>
        ) : (
          <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-2xl flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#1e3a5f] text-white"><Sparkles className="h-4 w-4" /></span>
                {conteudo.title}
              </DialogTitle>
              <DialogDescription>{conteudo.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 overflow-y-auto pr-1 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-300">
              {conteudo.body}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}

export default PotencialButton

import { useEffect, useId, useState, useSyncExternalStore, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import GuiaBalao, { TecnicoCaderno } from '@/components/guia/GuiaBalao'
import { useGuia } from '@/components/guia/useGuia'
import { GUIA_ATTR, type GuiaModal } from '@/components/guia/tipos'
import { entrarNaPilha, sairDaPilha, assinarPilha, topoDaPilha } from '@/components/guia/pilhaGuias'

const LARGURA = 264 // w-64 + folga
const MARGEM = 20

/**
 * Personagem + balão ao lado do modal e o botão "Dica" para trazê-lo de volta.
 * O balão vai num portal no body (fora do modal, para não ser cortado pelo
 * scroll dele) e é posicionado pela caixa do modal: à esquerda quando cabe;
 * senão, no canto inferior esquerdo da tela.
 */
const GuiaDoModal = ({ guia, contentRef }: { guia: GuiaModal; contentRef: RefObject<HTMLElement | null> }) => {
  const g = useGuia(`visor360.guia.${guia.id}`)
  const [caixa, setCaixa] = useState<DOMRect | null>(null)
  // Modal por cima de modal: só o de cima fala (ver pilhaGuias).
  const id = useId()
  useEffect(() => { entrarNaPilha(id); return () => sairDaPilha(id) }, [id])
  const noTopo = useSyncExternalStore(assinarPilha, topoDaPilha) === id

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const medir = () => setCaixa(el.getBoundingClientRect())
    // a animação de abertura mexe na caixa: mede de novo depois dela
    const t = window.setTimeout(medir, 250)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    window.addEventListener('resize', medir)
    return () => { window.clearTimeout(t); ro.disconnect(); window.removeEventListener('resize', medir) }
  }, [contentRef])

  const cabeAoLado = caixa != null && caixa.left >= LARGURA + MARGEM
  const corpo = guia.texto.map((p, i) => <p key={i}>{p}</p>)

  return (
    <>
      {!g.visivel && (
        <button
          type="button"
          onClick={g.mostrar}
          aria-label={`Mostrar a dica: ${guia.titulo}`}
          className="absolute right-11 top-3 z-10 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-0.5 pl-0.5 pr-2.5 text-[11px] font-semibold text-[#1e3a5f] transition-colors hover:border-[#2563eb] hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300"
        >
          <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-white dark:bg-gray-900"><TecnicoCaderno className="mt-3 h-9 w-8" /></span>
          Dica
        </button>
      )}
      {g.visivel && noTopo && caixa && createPortal(
        <div
          {...{ [GUIA_ATTR]: '' }}
          className="fixed z-[60]"
          style={cabeAoLado
            ? { left: caixa.left - LARGURA - MARGEM + 16, top: Math.max(16, caixa.top + 8), width: LARGURA - 16, pointerEvents: 'auto' }
            : { left: 16, bottom: 16, width: 320, pointerEvents: 'auto' }}
        >
          <GuiaBalao titulo={guia.titulo} lado={cabeAoLado ? 'esquerda' : 'topo'} onEntendi={g.entendi} onNaoMostrarMais={g.naoMostrarMais}>
            {corpo}
          </GuiaBalao>
        </div>,
        document.body,
      )}
    </>
  )
}

export default GuiaDoModal

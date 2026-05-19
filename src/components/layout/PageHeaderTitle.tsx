import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * ID do slot esquerdo da sub-bar do AppLayout. Páginas usam <PageHeaderTitle>
 * pra portar o bloco de título (ícone + h1 + subtítulo) pra essa posição,
 * ficando na mesma linha horizontal dos filtros globais (que vivem à direita).
 */
export const PAGE_HEADER_TITLE_SLOT_ID = 'page-header-title-slot'

interface PageHeaderTitleProps {
  children: React.ReactNode
}

/**
 * Renderiza `children` no slot esquerdo da sub-bar do AppLayout via Portal.
 * Idêntico ao PageHeaderActions, mas pra título — assim filtros, engrenagem
 * e título dividem a mesma linha sem cada página replicar o layout.
 */
const PageHeaderTitle = ({ children }: PageHeaderTitleProps) => {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let raf = 0
    const find = () => {
      const el = document.getElementById(PAGE_HEADER_TITLE_SLOT_ID)
      if (el) {
        setSlot(el)
      } else {
        raf = requestAnimationFrame(find)
      }
    }
    find()
    return () => {
      cancelAnimationFrame(raf)
      setSlot(null)
    }
  }, [])

  if (!slot) return null
  return createPortal(children, slot)
}

export default PageHeaderTitle

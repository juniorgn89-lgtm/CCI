import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * ID do slot esquerdo da sub-bar do AppLayout. Páginas usam <PageHeaderTitle>
 * pra portar o bloco de título (ícone + h1 + subtítulo) pra essa posição,
 * ficando na mesma linha horizontal dos filtros globais (que vivem à direita).
 */
export const PAGE_HEADER_TITLE_SLOT_ID = 'page-header-title-slot'

/**
 * Slot alternativo no Header (chrome, ao lado do logo). Usado por páginas que
 * passam `placement="header"` — o título sobe pra barra de topo em vez da
 * TopBar. Piloto: Central da Rede (Dashboard).
 */
export const HEADER_TITLE_SLOT_ID = 'header-title-slot'

interface PageHeaderTitleProps {
  children: React.ReactNode
  /** Onde portar o título: TopBar (default) ou Header (ao lado do logo/☰). */
  placement?: 'topbar' | 'header'
}

/**
 * Renderiza `children` no slot esquerdo da sub-bar do AppLayout via Portal
 * (ou no slot do Header quando `placement="header"`). Assim filtros, engrenagem
 * e título dividem a mesma linha sem cada página replicar o layout.
 */
const PageHeaderTitle = ({ children, placement = 'topbar' }: PageHeaderTitleProps) => {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const slotId = placement === 'header' ? HEADER_TITLE_SLOT_ID : PAGE_HEADER_TITLE_SLOT_ID

  useEffect(() => {
    let raf = 0
    const find = () => {
      const el = document.getElementById(slotId)
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
  }, [slotId])

  if (!slot) return null
  return createPortal(children, slot)
}

export default PageHeaderTitle

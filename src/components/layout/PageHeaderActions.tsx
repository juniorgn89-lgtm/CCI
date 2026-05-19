import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * ID do slot que o AppLayout renderiza dentro da sub-bar de filtros.
 * Páginas usam <PageHeaderActions> pra portar conteúdo (ex: engrenagem de
 * configurações de módulo) pra esse slot, ficando alinhado com os filtros
 * na mesma linha horizontal.
 */
export const PAGE_HEADER_ACTIONS_SLOT_ID = 'page-header-actions-slot'

interface PageHeaderActionsProps {
  children: React.ReactNode
}

/**
 * Renderiza `children` no slot da sub-bar do AppLayout via Portal. Útil pra
 * elementos por página (engrenagem, botões de ação) que precisam ficar na
 * mesma linha dos filtros globais.
 *
 * O slot só existe quando o AppLayout monta — se o componente for usado fora
 * dele (improvável), nada acontece silenciosamente.
 */
const PageHeaderActions = ({ children }: PageHeaderActionsProps) => {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    // O slot pode não existir no primeiro render (timing entre AppLayout
    // e a página mounting). Re-busca por algumas iterações até achar.
    let raf = 0
    const find = () => {
      const el = document.getElementById(PAGE_HEADER_ACTIONS_SLOT_ID)
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

export default PageHeaderActions

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * ID do slot renderizado dentro do Header global, entre os filtros de
 * comparação e o botão de refresh. Páginas usam <HeaderTray> pra portar
 * controles que devem ficar alinhados com refresh/bell (ex: engrenagem de
 * configurações de módulo).
 */
export const HEADER_TRAY_SLOT_ID = 'header-tray-slot'

interface HeaderTrayProps {
  children: React.ReactNode
}

const HeaderTray = ({ children }: HeaderTrayProps) => {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let raf = 0
    const find = () => {
      const el = document.getElementById(HEADER_TRAY_SLOT_ID)
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

export default HeaderTray

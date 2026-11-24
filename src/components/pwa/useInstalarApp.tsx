import { useEffect, useState } from 'react'
import { getInstallPrompt, clearInstallPrompt, subscribeInstall, rodandoInstalado } from '@/lib/pwaInstall'
import InstallAppModal from '@/components/pwa/InstallAppModal'

const ehCelular = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent)

/** No navegador do celular (app não instalado)? E a ação de baixar. */
export const useInstalarApp = () => {
  const [instalado, setInstalado] = useState(rodandoInstalado)
  const [ajuda, setAjuda] = useState(false)
  useEffect(() => subscribeInstall(() => setInstalado(rodandoInstalado())), [])

  const baixar = async () => {
    const p = getInstallPrompt()
    if (!p) { setAjuda(true); return }
    await p.prompt()
    const { outcome } = await p.userChoice
    clearInstallPrompt()
    if (outcome === 'accepted') setInstalado(true)
  }

  return {
    noNavegador: !instalado && ehCelular(),
    baixar,
    dialogo: <InstallAppModal open={ajuda} onClose={() => setAjuda(false)} />,
  }
}

import { useEffect, useState } from 'react'
import InstallAppModal, { isStandalone } from '@/components/pwa/InstallAppModal'

/**
 * Deep link de instalação: abrir o app com `?instalar=1` (é o que o launcher dos
 * OUTROS apps da suíte usa — um site não consegue instalar um PWA de outro
 * domínio, então ele manda pra cá já pedindo pra instalar). Remove o parâmetro
 * da URL e abre o modal se ainda não estiver instalado.
 */
const InstallDeepLink = () => {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('instalar') !== '1') return
    sp.delete('instalar')
    const q = sp.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`)
    if (!isStandalone()) setOpen(true)
  }, [])

  return <InstallAppModal open={open} onClose={() => setOpen(false)} />
}

export default InstallDeepLink

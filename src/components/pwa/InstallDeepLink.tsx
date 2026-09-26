import { useState } from 'react'
import InstallAppModal, { isStandalone } from '@/components/pwa/InstallAppModal'

/**
 * Deep link de instalação: abrir o app com `?instalar=1` (é o que o launcher dos
 * OUTROS apps da suíte usa — um site não consegue instalar um PWA de outro
 * domínio, então ele manda pra cá já pedindo pra instalar). Montado na raiz
 * (App.tsx): o pedido chega em /login, antes de autenticar, e os redirects de
 * rota reescrevem a URL — por isso o parâmetro é lido de forma SÍNCRONA no
 * primeiro render, removido da barra e o modal abre se ainda não instalado.
 */
const lerPedido = () => {
  if (typeof window === 'undefined') return false
  const sp = new URLSearchParams(window.location.search)
  if (sp.get('instalar') !== '1') return false
  sp.delete('instalar')
  const q = sp.toString()
  window.history.replaceState(null, '', `${window.location.pathname}${q ? `?${q}` : ''}${window.location.hash}`)
  return !isStandalone()
}

const InstallDeepLink = () => {
  const [open, setOpen] = useState(lerPedido)
  return <InstallAppModal open={open} onClose={() => setOpen(false)} />
}

export default InstallDeepLink

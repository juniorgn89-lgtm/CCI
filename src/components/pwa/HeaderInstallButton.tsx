import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { getInstallPrompt, clearInstallPrompt, subscribeInstall } from '@/lib/pwaInstall'

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true

/**
 * Botão "Instalar app" no cabeçalho do desktop — o equivalente do convite mobile
 * pra PC (Windows/Mac com Chrome ou Edge). Só aparece quando o navegador oferece
 * instalar (evento `beforeinstallprompt` capturado no boot); some se já estiver
 * instalado ou em navegador sem suporte (Firefox/Safari desktop).
 */
const HeaderInstallButton = () => {
  const [prompt, setPrompt] = useState(getInstallPrompt())
  useEffect(() => subscribeInstall(() => setPrompt(getInstallPrompt())), [])

  if (!prompt || isStandalone()) return null

  const instalar = async () => {
    await prompt.prompt()
    await prompt.userChoice
    clearInstallPrompt()
  }

  return (
    <button
      onClick={instalar}
      title="Instalar o Visor360 no computador"
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#0F766E]/40 px-2.5 text-[13px] font-semibold text-[#0F766E] transition-colors hover:bg-[#0F766E]/10 dark:border-[#14b8a6]/40 dark:text-[#14b8a6] dark:hover:bg-[#14b8a6]/10"
    >
      <Download className="h-4 w-4" />
      <span className="hidden lg:inline">Instalar app</span>
    </button>
  )
}

export default HeaderInstallButton

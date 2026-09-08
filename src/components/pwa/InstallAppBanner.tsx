import { useEffect, useState } from 'react'
import { Download, X, Share, Plus } from 'lucide-react'
import { getInstallPrompt, clearInstallPrompt, subscribeInstall } from '@/lib/pwaInstall'

const KEY = 'visor360.installBannerDismissed'

/** Já está rodando como app instalado (tela de início / standalone)? */
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/**
 * Convite pra instalar o Visor no celular como app (PWA — adicionar à tela de
 * início), SEM passar por loja. No Android/Chrome usa o `beforeinstallprompt`
 * (botão "Instalar" nativo); no iOS/Safari, que não expõe esse evento, mostra o
 * passo a passo manual (Compartilhar → Adicionar à Tela de Início).
 *
 * Dispensável (lembra a escolha em localStorage) e some quando já instalado.
 */
const InstallAppBanner = () => {
  const [prompt, setPrompt] = useState(getInstallPrompt())
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(KEY) === '1' } catch { return false }
  })
  const [iosHelp, setIosHelp] = useState(false)

  useEffect(() => subscribeInstall(() => setPrompt(getInstallPrompt())), [])

  if (dismissed || isStandalone()) return null
  const ios = isIOS()
  // Aparece se: Android com prompt disponível OU iOS (instruções). Fora disso,
  // o navegador não suporta instalar — não mostra nada.
  if (!prompt && !ios) return null

  const fechar = () => {
    setDismissed(true)
    try { localStorage.setItem(KEY, '1') } catch { /* ignore */ }
  }

  const instalar = async () => {
    if (!prompt) { setIosHelp(true); return }
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    clearInstallPrompt()
    if (outcome === 'accepted') fechar()
  }

  return (
    <div className="mb-3 overflow-hidden rounded-xl border border-[#14b8a6]/40 bg-gradient-to-br from-[#0f766e] to-[#115e59] text-white shadow-sm">
      <div className="flex items-center gap-3 p-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/15 text-lg">📲</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold leading-tight">Instale o Visor360 no celular</p>
          <p className="text-[11.5px] leading-snug text-white/80">Tela cheia e acesso rápido — direto da tela de início, sem loja.</p>
        </div>
        {prompt ? (
          <button
            onClick={instalar}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[13px] font-semibold text-[#0f766e] active:opacity-80"
          >
            <Download className="h-4 w-4" /> Instalar
          </button>
        ) : (
          <button
            onClick={() => setIosHelp((v) => !v)}
            className="shrink-0 rounded-lg bg-white/15 px-3 py-2 text-[13px] font-semibold active:opacity-80"
          >
            Como instalar
          </button>
        )}
        <button onClick={fechar} aria-label="Dispensar" className="shrink-0 rounded-md p-1 text-white/70 active:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {ios && iosHelp && (
        <div className="border-t border-white/15 bg-black/10 px-3 py-2.5 text-[12px] leading-relaxed text-white/90">
          No Safari, toque em{' '}
          <Share className="inline h-3.5 w-3.5 align-text-bottom" /> <strong>Compartilhar</strong> e escolha{' '}
          <Plus className="inline h-3.5 w-3.5 align-text-bottom" /> <strong>Adicionar à Tela de Início</strong>.
        </div>
      )}
    </div>
  )
}

export default InstallAppBanner

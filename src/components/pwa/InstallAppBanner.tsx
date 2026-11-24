import { useState } from 'react'
import { Download, Smartphone, X } from 'lucide-react'
import { useInstalarApp } from '@/components/pwa/useInstalarApp'

/**
 * "Baixe o app" dentro do Visor, depois do login (mesmo desenho do NotaOK).
 * Quando a pessoa usa pelo NAVEGADOR do celular (não pelo app instalado),
 * aparece o convite no alto das telas principais e a linha "Baixar o app" no
 * Mais. Android/Chrome com o pedido do navegador: abre a janela "Instalar"
 * (precisa do toque). iPhone ou sem o pedido: passo a passo (InstallAppModal).
 * Instalado, tudo some.
 */

const CHAVE_CONVITE = 'visor360.instalarConvite' // adiado até (timestamp)
const DIAS_ADIADO = 3
const adiadoAte = () => { try { return Number(localStorage.getItem(CHAVE_CONVITE)) || 0 } catch { return 0 } }
/** Convite no alto das telas principais (só no navegador do celular). */
const InstallAppBanner = () => {
  const { noNavegador, baixar, dialogo } = useInstalarApp()
  const [oculto, setOculto] = useState(() => adiadoAte() > Date.now())
  if (!noNavegador || oculto) return dialogo

  const adiar = () => {
    try { localStorage.setItem(CHAVE_CONVITE, String(Date.now() + DIAS_ADIADO * 864e5)) } catch { /* ignore */ }
    setOculto(true)
  }

  return (
    <>
      <div className="mb-3.5 flex items-center gap-3 rounded-2xl border border-teal-600/30 bg-teal-50 px-3.5 py-3 dark:bg-teal-500/[0.12]">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white">
          <Smartphone className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100">Você está no navegador</p>
          <p className="mt-0.5 text-[12px] leading-snug text-gray-600 dark:text-gray-400">
            Baixe o app do Visor360: abre direto da tela inicial, em tela cheia, e recebe os avisos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void baixar()}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-teal-600 px-3 text-[13px] font-semibold text-white active:bg-teal-700"
        >
          <Download className="h-4 w-4" /> Baixar
        </button>
        <button type="button" onClick={adiar} aria-label="Agora não" className="-mr-1 shrink-0 rounded-lg p-1.5 text-gray-400 active:bg-black/5 dark:active:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>
      {dialogo}
    </>
  )
}

/** Linha "Baixar o app" no Mais do celular (some com o app instalado). */
export const LinhaInstalar = ({ onClick }: { onClick?: () => void }) => {
  const { noNavegador, baixar, dialogo } = useInstalarApp()
  if (!noNavegador) return dialogo
  return (
    <>
      <button
        type="button"
        onClick={() => { onClick?.(); void baixar() }}
        className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 active:bg-gray-100 dark:text-gray-300 dark:active:bg-white/10"
      >
        <Download className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-300" />
        <span className="flex-1 text-left">Baixar o app</span>
        <span className="text-xs text-gray-400">você está no navegador</span>
      </button>
      {dialogo}
    </>
  )
}

export default InstallAppBanner

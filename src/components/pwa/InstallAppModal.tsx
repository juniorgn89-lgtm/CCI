import { useEffect, useRef, useState } from 'react'
import { X, Download } from 'lucide-react'
import { getInstallPrompt, clearInstallPrompt, subscribeInstall } from '@/lib/pwaInstall'

/** Já está rodando como app instalado (tela de início / standalone)? */
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const isDesktop = () => !/android|iphone|ipad|ipod/i.test(navigator.userAgent)

interface InstallAppModalProps {
  open: boolean
  onClose: () => void
  nome?: string
}

/**
 * Modal "Instalar o app" reutilizável (launcher da suíte, deep link `?instalar=1`).
 * Com o prompt nativo disponível (Chromium: Android + Chrome/Edge no PC) dispara
 * a instalação direto ao abrir; sem ele, mostra o passo a passo da plataforma —
 * iPhone não tem clique único (limitação da Apple), PC usa o ícone da barra.
 */
const InstallAppModal = ({ open, onClose, nome = 'Visor360' }: InstallAppModalProps) => {
  const disparado = useRef(false)
  // O `beforeinstallprompt` costuma chegar um pouco DEPOIS do load (caso do deep
  // link `?instalar=1`, que abre o modal no primeiro render): quando ele chega
  // com o modal aberto, re-renderiza e dispara o prompt nativo no lugar dos passos.
  const [, tick] = useState(0)
  useEffect(() => subscribeInstall(() => tick((n) => n + 1)), [])

  useEffect(() => {
    if (!open) { disparado.current = false; return }
    const p = getInstallPrompt()
    if (!p || disparado.current) return
    disparado.current = true
    void (async () => {
      await p.prompt()
      await p.userChoice
      clearInstallPrompt()
      onClose()
    })()
  })

  if (!open) return null
  // Prompt nativo em andamento — o navegador mostra a própria caixa.
  if (getInstallPrompt()) return null

  const ios = isIOS()
  const desktop = isDesktop()
  const subtitle = desktop
    ? `Instale o ${nome} como um app no seu computador — sem passar por loja.`
    : `Adicione o ${nome} à tela de início do seu celular — sem passar por loja.`
  const passos = ios
    ? [
        <>Toque no ícone <strong>Compartilhar</strong> (o quadrado com a seta ↑) na barra do navegador.</>,
        <>Escolha <strong>Adicionar à Tela de Início</strong>.</>,
        <>Confirme em <strong>Adicionar</strong> — pronto, o {nome} vira um app.</>,
      ]
    : desktop
      ? [
          <>Na barra de endereço, clique no ícone de <strong>instalar</strong> (um monitor com seta ↓) — ou abra o menu do navegador (<strong>⋮</strong> no Chrome, <strong>⋯</strong> no Edge).</>,
          <>Escolha <strong>Instalar {nome}</strong>.</>,
          <>Confirme em <strong>Instalar</strong> — pronto, o {nome} abre como app.</>,
        ]
      : [
          <>Abra o menu do navegador (<strong>⋮</strong>).</>,
          <>Toque em <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>).</>,
          <>Confirme — pronto, o {nome} vira um app.</>,
        ]

  return (
    <div onClick={onClose} className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <div className="relative bg-[#1e3a5f] px-5 py-4 text-white">
          <button onClick={onClose} aria-label="Fechar" className="absolute right-3 top-3 rounded-md p-1 text-white/70 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><Download className="h-5 w-5 text-[#FCB619]" /></span>
            <div>
              <h2 className="text-base font-bold leading-tight">Instalar o {nome}</h2>
              <p className="text-[11px] text-white/70">{subtitle}</p>
            </div>
          </div>
        </div>
        <div className="px-5 py-4">
          <ol className="flex flex-col gap-3">
            {passos.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-sm leading-relaxed text-gray-700 dark:text-gray-200">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-[#0F766E] dark:bg-emerald-900/30 dark:text-emerald-300">{i + 1}</span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
          <button onClick={onClose} className="mt-5 w-full rounded-lg bg-[#1e3a5f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#162d4a]">
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}

export default InstallAppModal

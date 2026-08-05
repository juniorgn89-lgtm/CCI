import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Copy, Check, MessageCircle, KeyRound } from 'lucide-react'

/**
 * Mostra o LINK de redefinição de senha gerado (sem e-mail) pra o master copiar
 * ou mandar no WhatsApp. O usuário abre o link e define a própria senha — a
 * senha nunca passa pelo admin. Link de uso único, expira conforme o projeto
 * (padrão ~1h).
 */
interface RecoveryLinkModalProps {
  open: boolean
  onClose: () => void
  /** Nome ou e-mail do usuário — só pra exibir "gerado para …". */
  userLabel: string
  link: string
}

const RecoveryLinkModal = ({ open, onClose, userLabel, link }: RecoveryLinkModalProps) => {
  const [copied, setCopied] = useState(false)
  if (!open) return null

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard indisponível — o usuário seleciona manualmente */ }
  }

  const msg = `Olá! Para redefinir sua senha do Visor360, abra este link (uso único, expira em ~1 hora) e defina uma nova senha:\n\n${link}`
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
              <KeyRound className="h-4 w-4" />
            </span>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Link de redefinição de senha</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Gerado para <span className="font-medium text-gray-900 dark:text-gray-100">{userLabel}</span>. Mande o link
            pro usuário — ele abre e define a própria senha. A senha nunca passa por você; o link é de
            <span className="font-medium"> uso único</span> e expira em <span className="font-medium">~1 hora</span>.
          </p>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800/50">
            <p className="break-all font-mono text-[11px] leading-relaxed text-gray-700 dark:text-gray-300">{link}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={copiar}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {copied ? <Check className="h-4 w-4 text-green-600 dark:text-green-400" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado!' : 'Copiar link'}
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1fb855]"
            >
              <MessageCircle className="h-4 w-4" />
              Enviar no WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default RecoveryLinkModal

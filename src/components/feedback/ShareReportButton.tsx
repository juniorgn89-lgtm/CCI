import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Share2, Loader2, AlertCircle, X, Download, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReportPayload } from '@/lib/report/reportTypes'

interface Props {
  /** Nome do arquivo PDF (sem depender de acento/espaço). */
  filename: string
  /** Monta o payload no clique (dados frescos da tela naquele momento). */
  build: () => ReportPayload
  label?: string
  className?: string
}

interface Preview { url: string; blob: Blob; title: string; text?: string }
type ShareState = 'idle' | 'sharing' | 'shared' | 'downloaded'

const primaryBtn =
  'inline-flex items-center gap-1.5 rounded-lg bg-[#1e3a5f] px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-[#27496f] disabled:opacity-60 dark:bg-blue-700 dark:hover:bg-blue-600'
const secondaryBtn =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-gray-600 transition-colors hover:border-[#2563eb] hover:text-[#2563eb] disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-blue-500 dark:hover:text-blue-300'

/**
 * Gera um PDF de resumo da tela, abre uma PRÉVIA (iframe) e, de lá, compartilha
 * (WhatsApp e cia. no celular) ou baixa. jsPDF e o gerador entram por import
 * dinâmico — só baixam no 1º clique.
 */
const ShareReportButton = ({ filename, build, label = 'Compartilhar', className }: Props) => {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [shareState, setShareState] = useState<ShareState>('idle')
  const [canShare, setCanShare] = useState(false)
  const errTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(errTimer.current), [])

  // Revoga o object URL quando a prévia troca/fecha (ou no unmount).
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url) }, [preview])

  // Com a prévia aberta: Esc fecha, trava o scroll do body e checa se dá pra
  // compartilhar ESTE arquivo (senão só baixa — caso da maioria dos desktops).
  useEffect(() => {
    if (!preview) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreview(null) }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    try {
      const f = new File([preview.blob], filename, { type: 'application/pdf' })
      setCanShare(typeof navigator.canShare === 'function' && navigator.canShare({ files: [f] }))
    } catch {
      setCanShare(false)
    }
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [preview, filename])

  const gerar = async () => {
    if (busy) return
    setBusy(true); setError(false)
    try {
      const payload = build()
      const geradoEm = new Date().toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
      const { buildReportPdf } = await import('@/lib/report/reportPdf')
      const blob = await buildReportPdf(payload, geradoEm)
      setPreview({ url: URL.createObjectURL(blob), blob, title: payload.title, text: payload.subtitle })
      setShareState('idle')
    } catch (err) {
      console.error('Falha ao gerar o PDF', err)
      setError(true)
      clearTimeout(errTimer.current)
      errTimer.current = setTimeout(() => setError(false), 2500)
    } finally {
      setBusy(false)
    }
  }

  const compartilhar = async () => {
    if (!preview || shareState === 'sharing') return
    setShareState('sharing')
    const { sharePdf } = await import('@/lib/report/shareReport')
    const res = await sharePdf(preview.blob, filename, { title: preview.title, text: preview.text })
    setShareState(res === 'cancelled' ? 'idle' : res === 'shared' ? 'shared' : 'downloaded')
  }

  const baixar = () => {
    if (!preview) return
    const a = document.createElement('a')
    a.href = preview.url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setShareState('downloaded')
  }

  const shareLabel = shareState === 'sharing' ? 'Abrindo…' : shareState === 'shared' ? 'Enviado' : shareState === 'downloaded' ? 'Baixado' : 'Compartilhar'
  const ShareIcon = shareState === 'sharing' ? Loader2 : shareState === 'shared' || shareState === 'downloaded' ? Check : Share2

  return (
    <>
      <button
        type="button"
        onClick={gerar}
        disabled={busy}
        className={cn(secondaryBtn, error && 'border-red-300 text-red-600 dark:border-red-800 dark:text-red-400', className)}
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : error ? <AlertCircle className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
        {busy ? 'Gerando…' : error ? 'Tentar de novo' : label}
      </button>

      {preview && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6"
          onClick={() => setPreview(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Pré-visualização do PDF"
        >
          <div
            className="flex h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Pré-visualização</h3>
                <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{preview.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                aria-label="Fechar"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <iframe
              src={preview.url}
              title="Pré-visualização do PDF"
              className="min-h-0 w-full flex-1 border-0 bg-gray-100 dark:bg-gray-800"
            />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
              <span className="text-[11px] text-gray-400 dark:text-gray-500">Se a prévia não abrir aqui, use Baixar ou Compartilhar.</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={baixar} className={canShare ? secondaryBtn : primaryBtn}>
                  <Download className="h-3.5 w-3.5" />Baixar
                </button>
                {canShare && (
                  <button type="button" onClick={compartilhar} disabled={shareState === 'sharing'} className={primaryBtn}>
                    <ShareIcon className={cn('h-3.5 w-3.5', shareState === 'sharing' && 'animate-spin')} />
                    {shareLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

export default ShareReportButton

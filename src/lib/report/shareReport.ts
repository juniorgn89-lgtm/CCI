/**
 * Compartilha um PDF via Web Share API (bandeja nativa do celular → WhatsApp,
 * e-mail, etc.). Onde o navegador não suporta compartilhar ARQUIVO (a maioria dos
 * desktops), cai no download. Sem backend, sem dependência.
 */

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

export async function sharePdf(
  blob: Blob,
  filename: string,
  meta: { title: string; text?: string },
): Promise<ShareResult> {
  const file = new File([blob], filename, { type: 'application/pdf' })
  const shareData: ShareData = { files: [file], title: meta.title, text: meta.text }

  // Só tenta o share nativo se o navegador aceitar compartilhar ESTE arquivo
  // (`share`/`canShare` podem não existir — daí o guard por typeof).
  const canShareFiles = typeof navigator.canShare === 'function' && navigator.canShare(shareData)
  if (typeof navigator.share === 'function' && canShareFiles) {
    try {
      await navigator.share(shareData)
      return 'shared'
    } catch (err) {
      // Usuário fechou a bandeja: respeita, não baixa por baixo.
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      // Falha real → cai no download.
    }
  }

  downloadBlob(blob, filename)
  return 'downloaded'
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

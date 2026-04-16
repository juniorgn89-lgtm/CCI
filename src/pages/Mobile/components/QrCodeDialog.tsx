import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Check, MessageCircle, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface QrCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  frentistaName: string
  frentistaCode: string
}

const QrCodeDialog = ({
  open,
  onOpenChange,
  frentistaName,
  frentistaCode,
}: QrCodeDialogProps) => {
  const [copied, setCopied] = useState(false)

  const url = `${window.location.origin}/frentista/auto?code=${frentistaCode}&pin=1234`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
    }
  }

  const handleWhatsApp = () => {
    const text = `Olá ${frentistaName.split(' ')[0]}! Acesse o app CCISGA pelo link abaixo:`
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}%0A%0A${encodeURIComponent(url)}`,
      '_blank'
    )
  }

  const handleEmail = () => {
    const body = `Olá ${frentistaName.split(' ')[0]},\n\nAcesse o app CCISGA pelo link abaixo:\n\n${url}\n\nApós abrir, clique em "Adicionar à tela inicial" para instalar.`
    window.open(
      `mailto:?subject=CCISGA - Acesso ao App&body=${encodeURIComponent(body)}`,
      '_blank'
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">Acesso Mobile</DialogTitle>
          <DialogDescription className="text-center">
            {frentistaName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <QRCodeSVG
              value={url}
              size={200}
              level="M"
              includeMargin={false}
            />
          </div>

          <p className="max-w-[280px] truncate text-center text-xs text-gray-500 dark:text-gray-400">
            {url}
          </p>

          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              className={cn(
                'flex-1 gap-2 text-sm',
                copied && 'border-green-300 text-green-600'
              )}
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar
                </>
              )}
            </Button>

            <Button
              variant="outline"
              className="flex-1 gap-2 text-sm text-green-600 hover:bg-green-50 hover:text-green-700 dark:hover:bg-green-950"
              onClick={handleWhatsApp}
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>

            <Button
              variant="outline"
              className="flex-1 gap-2 text-sm"
              onClick={handleEmail}
            >
              <Mail className="h-4 w-4" />
              E-mail
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default QrCodeDialog

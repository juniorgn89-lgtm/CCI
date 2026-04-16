import { QRCodeSVG } from 'qrcode.react'

interface LoginQrCodeProps {
  code: string
  pin: string
}

const LoginQrCode = ({ code, pin }: LoginQrCodeProps) => {
  const origin = window.location.origin
  const url =
    code && pin
      ? `${origin}/frentista/auto?code=${code}&pin=${pin}`
      : `${origin}/frentista`

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <div className="rounded-lg border border-gray-200 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
        <QRCodeSVG value={url} size={120} level="M" includeMargin={false} />
      </div>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        Escaneie para acessar pelo celular
      </p>
    </div>
  )
}

export default LoginQrCode

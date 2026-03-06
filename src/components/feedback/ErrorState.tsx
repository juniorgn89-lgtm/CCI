import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorStateProps {
  message?: string
  detail?: string
  onRetry?: () => void
}

const ErrorState = ({
  message = 'Não foi possível carregar os dados.',
  detail = 'Verifique sua conexão e tente novamente.',
  onRetry = () => window.location.reload(),
}: ErrorStateProps) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
    <AlertCircle className="h-10 w-10 text-red-400" />
    <p className="mt-3 text-sm font-medium text-gray-700">{message}</p>
    <p className="mt-1 text-sm text-gray-500">{detail}</p>
    <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
      <RefreshCw className="mr-1.5 h-4 w-4" />
      Tentar novamente
    </Button>
  </div>
)

export default ErrorState

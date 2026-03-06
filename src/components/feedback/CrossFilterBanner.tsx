import { useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, X } from 'lucide-react'

const CrossFilterBanner = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const from = searchParams.get('from')

  if (from !== 'dashboard') return null

  const handleClear = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('from')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5">
      <div className="flex items-center gap-2 text-sm text-blue-700">
        <Link
          to="/dashboard"
          className="flex items-center gap-1 font-medium hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <span className="text-blue-400">/</span>
        <span className="font-medium">Visualizando setor selecionado</span>
      </div>
      <button
        onClick={handleClear}
        className="rounded p-1 text-blue-400 hover:bg-blue-100 hover:text-blue-600"
        aria-label="Fechar indicador de navegação"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export default CrossFilterBanner

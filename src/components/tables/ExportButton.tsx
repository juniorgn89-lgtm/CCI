import { Download } from 'lucide-react'

interface ExportButtonProps {
  onExport: () => void
  label?: string
}

const ExportButton = ({ onExport, label = 'Exportar' }: ExportButtonProps) => {
  return (
    <button
      onClick={onExport}
      className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

export default ExportButton

import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title?: string
  description?: string
}

const EmptyState = ({
  title = 'Nenhum dado encontrado',
  description = 'Não há dados disponíveis para o período e empresa selecionados.',
}: EmptyStateProps) => (
  <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
    <Inbox className="h-10 w-10 text-gray-300" />
    <p className="mt-3 text-sm font-medium text-gray-600">{title}</p>
    <p className="mt-1 text-sm text-gray-400">{description}</p>
  </div>
)

export default EmptyState

import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Botão que abre/recolhe o "Detalhamento de informações" das telas de Vendas
 * (Combustível, Automotivo, Conveniência). As telas abrem RECOLHIDAS: o dono
 * vê os cards e a projeção primeiro e só desce nas tabelas quando quer.
 */
const VerDetalhamentoButton = ({ aberto, onToggle, className }: { aberto: boolean; onToggle: () => void; className?: string }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-expanded={aberto}
    className={cn(
      'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[11px] font-semibold uppercase tracking-wide transition-colors',
      aberto
        ? 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-[#0f0f0f] dark:text-gray-300 dark:hover:bg-gray-800'
        : 'bg-[#1e3a5f] text-white shadow-sm hover:bg-[#162d4a] dark:bg-blue-700 dark:hover:bg-blue-600',
      className,
    )}
  >
    {aberto ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
    {aberto ? 'Recolher' : 'Ver detalhamento'}
  </button>
)

export default VerDetalhamentoButton

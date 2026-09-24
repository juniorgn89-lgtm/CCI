import { Presentation } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { useDemoStore } from '@/store/demo'

/**
 * Botão "Demonstração" do Header — liga/desliga o Modo Demonstração (mascara
 * nome da rede/postos, CNPJ e endereço em todo o app). Só aparece pra quem tem
 * a permissão `pode_demonstrar` (ou master). Ao alternar, invalida TODAS as
 * queries: os dados voltam já com (ou sem) a máscara aplicada no fetch.
 *
 * Quando ativo fica âmbar e pulsando de propósito — quem apresenta precisa
 * enxergar de relance que os nomes estão escondidos.
 */
const DemoModeToggle = () => {
  const canDemonstrar = useAuthStore((s) => s.canDemonstrar)
  const ativo = useDemoStore((s) => s.ativo)
  const set = useDemoStore((s) => s.set)
  const queryClient = useQueryClient()

  if (!canDemonstrar) return null

  const onToggle = () => {
    set(!ativo)
    queryClient.invalidateQueries()
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={ativo}
      title={
        ativo
          ? 'Modo Demonstração ATIVO — nomes da rede e dos postos estão mascarados. Clique pra desligar.'
          : 'Modo Demonstração — esconde o nome da rede e dos postos pra apresentar o sistema'
      }
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold uppercase tracking-wider transition-colors',
        ativo
          ? 'border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:border-amber-600/50 dark:bg-amber-900/40 dark:text-amber-200'
          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-amber-700 dark:hover:bg-amber-900/30 dark:hover:text-amber-300',
      )}
    >
      <Presentation className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{ativo ? 'Demonstração ativa' : 'Demonstração'}</span>
      {ativo && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />}
    </button>
  )
}

export default DemoModeToggle

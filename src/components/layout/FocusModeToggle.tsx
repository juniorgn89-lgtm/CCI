import { Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFocusMode } from '@/store/focusMode'

/**
 * Botão "Modo Foco" — ativa o modo leitura/análise: esconde a sidebar e
 * coloca o navegador em tela cheia. Pra usar inline com o título da página
 * (dentro do PageHeaderTitle).
 *
 * Estado é global (`useFocusMode`), então qualquer instância reflete o estado
 * atual e qualquer click alterna pra todas as telas.
 */
const FocusModeToggle = () => {
  const active = useFocusMode((s) => s.active)
  const toggle = useFocusMode((s) => s.toggle)

  return (
    <button
      type="button"
      onClick={toggle}
      title={active ? 'Sair do modo foco (ESC)' : 'Modo Foco — esconde a sidebar e usa tela cheia'}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors',
        active
          ? 'border-blue-200 bg-blue-100 text-blue-700 hover:bg-blue-200 dark:border-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
          : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-blue-800 dark:hover:bg-blue-900/30 dark:hover:text-blue-300',
      )}
    >
      {active ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
      Modo Foco
    </button>
  )
}

export default FocusModeToggle

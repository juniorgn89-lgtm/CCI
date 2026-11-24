import { cn } from '@/lib/utils'
import { nomeLegivel } from '@/lib/nomeLegivel'

interface Posto { codigo: number; fantasia: string }

/**
 * Seletor de posto LOCAL do celular (padrão CCI): pílulas numa linha que rola
 * para o lado, nome legível, escolhida em petróleo. Some com ≤1 posto.
 */
const PostoChips = ({ postos, value, onChange }: { postos: Posto[]; value: number | null; onChange: (c: number) => void }) => {
  if (postos.length <= 1) return null
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]" role="tablist" aria-label="Posto">
      {postos.map((p) => {
        const ativo = p.codigo === value
        return (
          <button
            key={p.codigo}
            type="button"
            role="tab"
            aria-selected={ativo}
            onClick={() => onChange(p.codigo)}
            className={cn(
              'h-9 shrink-0 whitespace-nowrap rounded-full border px-4 text-[13.5px] font-semibold transition-colors',
              ativo
                ? 'border-[#0d9488] bg-[#0d9488] text-[#fff]'
                : 'border-gray-200 bg-white text-gray-600 active:bg-gray-50 dark:border-[#2f3b4f] dark:bg-[#1e293b] dark:text-[#94a3b8]',
            )}
          >
            {nomeLegivel(p.fantasia)}
          </button>
        )
      })}
    </div>
  )
}

export default PostoChips

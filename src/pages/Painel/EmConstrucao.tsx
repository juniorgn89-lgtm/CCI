import type { LucideIcon } from 'lucide-react'
import { Hammer } from 'lucide-react'

/**
 * Esqueleto/shell de um módulo do painel ainda não aprovado no handoff. Mostra
 * o cabeçalho do módulo + linhas de skeleton + um aviso honesto. NÃO é o
 * conteúdo final (esse vem quando o design da aba for aprovado).
 */
const EmConstrucao = ({ title, subtitle, Icon }: { title: string; subtitle?: string; Icon: LucideIcon }) => (
  <div className="space-y-5">
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1e3a5f]">
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
        {subtitle && <p className="text-[13px] text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
    </div>

    <div className="rounded-[15px] border border-dashed border-gray-300 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-2 text-[13px] font-medium text-gray-500 dark:text-gray-400">
        <Hammer className="h-4 w-4" /> Módulo em construção — layout aprovado só para a navegação e Selecionar rede.
      </div>
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            <div className="h-9 flex-1 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          </div>
        ))}
      </div>
    </div>
  </div>
)

export default EmConstrucao

import { cn } from '@/lib/utils'

/**
 * Caixinha "Projeção por <item>" dentro dos cards de KPI das abas de Vendas
 * (combustível, categoria, grupo). Sempre aberta e na mesma altura em todos os
 * cards: logo abaixo da linha de projeção ("Fecha em" / "Proj. fim do mês").
 */
export interface ItemProjecao {
  nome: string
  /** Classe de cor do quadradinho (ex.: 'bg-blue-500'). */
  cor: string
  valor: string
}

const ProjecaoPorItemBox = ({ titulo, itens, rodape, className }: { titulo: string; itens: ItemProjecao[]; rodape?: string; className?: string }) => {
  if (itens.length === 0) return null
  return (
    <div className={cn('mt-2 rounded-lg bg-indigo-50/70 px-2.5 py-2 dark:bg-indigo-950/20', className)}>
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-indigo-500 dark:text-indigo-400">{titulo}</p>
      <div className="space-y-1 text-[10px] tabular-nums">
        {itens.map((it) => (
          <div key={it.nome} className="flex items-center justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-gray-500 dark:text-gray-400">
              <span className={cn('h-2 w-2 shrink-0 rounded-sm', it.cor)} />
              <span className="truncate">{it.nome}</span>
            </span>
            <span className="shrink-0 font-semibold text-indigo-600 dark:text-indigo-400">{it.valor}</span>
          </div>
        ))}
      </div>
      {rodape && <p className="mt-1 text-[9.5px] text-gray-400 dark:text-gray-500">{rodape}</p>}
    </div>
  )
}

export default ProjecaoPorItemBox

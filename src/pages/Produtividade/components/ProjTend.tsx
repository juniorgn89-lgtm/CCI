import { TrendingUp } from 'lucide-react'

/** Linha "proj. …" — projeção de fim de mês no ritmo atual.
 *  Destaque sutil (teal da logo + seta minúscula) pra separar do realizado sem
 *  gritar. Fonte única: usada na tabela de Equipe e nos KPIs de Funcionários,
 *  então a cor/estilo nunca divergem entre as abas. A projeção é sempre ≥ o
 *  realizado (extrapola o mês-a-data), por isso a seta pra cima é honesta. */
const ProjTend = ({ value }: { value: string }) => (
  <span
    title="Projeção de fim de mês no ritmo atual"
    className="inline-flex items-center gap-0.5 text-[10px] font-medium tabular-nums text-teal-600/80 dark:text-teal-400/70"
  >
    <TrendingUp className="h-2.5 w-2.5 shrink-0" />
    proj. {value}
  </span>
)

export default ProjTend

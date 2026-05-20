import { formatLiters } from '@/lib/formatters'
import type { ReabastTanque } from '@/pages/Dashboard/hooks/useReabastecimento'

export interface ReposicaoLinha {
  produtoCodigo: number
  produto: string
  estoque: number
  capacidade: number
  ritmoDia: number
  sugestao: number
  tanques: number
}

/** Consolida tanques por combustível (produto), ordenado por maior sugestão. */
export const aggregarPorProduto = (tanques: ReabastTanque[]): ReposicaoLinha[] => {
  const map = new Map<number, ReposicaoLinha>()
  for (const t of tanques) {
    let l = map.get(t.produtoCodigo)
    if (!l) {
      l = { produtoCodigo: t.produtoCodigo, produto: t.produtoNome, estoque: 0, capacidade: 0, ritmoDia: 0, sugestao: 0, tanques: 0 }
      map.set(t.produtoCodigo, l)
    }
    l.estoque += t.estoqueAtual
    l.capacidade += t.capacidade
    l.ritmoDia += t.consumoDiarioMedio
    l.sugestao += t.necessidadeFimDoMes
    l.tanques += 1
  }
  return Array.from(map.values()).sort((a, b) => b.sugestao - a.sugestao)
}

/** Nº aproximado de abastecimentos que a sugestão representa (sugestão ÷ capacidade). */
const entregas = (sugestao: number, capacidade: number): number =>
  sugestao > 0 && capacidade > 0 ? Math.ceil(sugestao / capacidade) : 0

/** Tabela "Reposição de estoque" por combustível (estilo relatório). */
const ReposicaoTabela = ({ linhas }: { linhas: ReposicaoLinha[] }) => (
  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
    <table className="w-full text-xs">
      <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
        <tr>
          <th className="px-3 py-2 text-left font-medium">Ref.</th>
          <th className="px-3 py-2 text-left font-medium">Produto</th>
          <th className="px-3 py-2 text-right font-medium">Estoque atual</th>
          <th className="px-3 py-2 text-right font-medium">Capacidade</th>
          <th className="px-3 py-2 text-right font-medium">Ritmo/dia</th>
          <th className="px-3 py-2 text-right font-medium">Sugestão</th>
          <th className="px-3 py-2 text-right font-medium" title="Nº aproximado de abastecimentos (sugestão ÷ capacidade)">
            Entregas
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
        {linhas.map((r) => {
          const n = entregas(r.sugestao, r.capacidade)
          return (
            <tr key={r.produtoCodigo}>
              <td className="px-3 py-2 font-mono text-[11px] text-gray-400 dark:text-gray-500">
                {String(r.produtoCodigo).padStart(6, '0')}
              </td>
              <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{r.produto}</td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                {formatLiters(r.estoque)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                {formatLiters(r.capacidade)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                {formatLiters(r.ritmoDia)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-blue-700 dark:text-blue-400">
                {formatLiters(r.sugestao)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                {n > 0 ? `≈ ${n}×` : '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  </div>
)

export default ReposicaoTabela

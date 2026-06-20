import { useState } from 'react'
import BarCell from '@/components/tables/BarCell'
import InfoHint from '@/components/ui/InfoHint'
import { formatLiters } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { calcularMaxes, type ReposicaoLinha, type ReposicaoMaxes } from '@/pages/Dashboard/components/reposicao'

interface ReposicaoTabelaProps {
  linhas: ReposicaoLinha[]
  /** Máximos compartilhados (todas as tabelas do mesmo relatório). Se omitido,
   *  cada tabela calcula o próprio (perde comparabilidade entre postos). */
  maxes?: ReposicaoMaxes
}

/** Tabela "Reposição de estoque" por combustível (estilo relatório).
 *  Usa `table-fixed` + colgroup pra alinhar colunas idênticas quando várias
 *  tabelas são renderizadas no mesmo container (uma por posto). */
const ReposicaoTabela = ({ linhas, maxes }: ReposicaoTabelaProps) => {
  const localMaxes = maxes ?? calcularMaxes([{ linhas }])
  // Linha destacada — útil pra comparar estoque/ritmo/sugestão entre combustíveis
  const [selected, setSelected] = useState<number | null>(null)
  const toggleSelected = (codigo: number) => {
    setSelected((curr) => (curr === codigo ? null : codigo))
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="w-full table-fixed text-xs">
        <colgroup>
          <col className="w-[70px]" />
          <col className="w-[28%]" />
          <col className="w-[16%]" />
          <col className="w-[14%]" />
          <col className="w-[12%]" />
          <col className="w-[16%]" />
        </colgroup>
        <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-500 dark:bg-gray-800/50 dark:text-gray-400">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Ref.</th>
            <th className="px-3 py-2 text-left font-medium">Produto</th>
            <th className="px-3 py-2 text-right font-medium">Estoque atual</th>
            <th className="px-3 py-2 text-right font-medium">Capacidade</th>
            <th className="px-3 py-2 text-right font-medium">Ritmo/dia</th>
            <th className="px-3 py-2 text-right font-medium">Sugestão</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {linhas.map((r) => {
            const rowSelected = selected === r.produtoCodigo
            return (
              <tr
                key={r.produtoCodigo}
                onClick={() => toggleSelected(r.produtoCodigo)}
                aria-selected={rowSelected}
                className={cn(
                  'cursor-pointer transition-colors',
                  rowSelected
                    ? 'bg-amber-100 hover:bg-amber-200/70 dark:bg-amber-900/30 dark:hover:bg-amber-900/40'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                )}
              >
                <td className="px-3 py-2 font-mono text-[11px] text-gray-400 dark:text-gray-500">
                  {String(r.produtoCodigo).padStart(6, '0')}
                </td>
                <td className="truncate px-3 py-2 font-medium text-gray-900 dark:text-gray-100">{r.produto}</td>
                <td className="px-2 py-1.5">
                  {/* Cor reflete a criticidade: vermelho < 20%, âmbar < 30%, azul >= 30%. */}
                  {(() => {
                    const pct = r.capacidade > 0 ? (r.estoque / r.capacidade) * 100 : 0
                    const cor: 'blue' | 'amber' | 'red' = pct < 20 ? 'red' : pct < 30 ? 'amber' : 'blue'
                    return (
                      <BarCell
                        value={r.estoque}
                        max={localMaxes.estoque}
                        formatted={formatLiters(r.estoque)}
                        color={cor}
                        align="near"
                        maxWidthPct={60}
                      />
                    )
                  })()}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                  {/* Capacidade é referência estática (tamanho do tanque) — sem barra. */}
                  {formatLiters(r.capacidade)}
                </td>
                <td className="px-2 py-1.5">
                  {/* Verde = consumo/vendas (positivo). */}
                  <BarCell value={r.ritmoDia} max={localMaxes.ritmoDia} formatted={formatLiters(r.ritmoDia)} color="green" align="near" maxWidthPct={60} />
                </td>
                <td className="px-2 py-1.5">
                  {r.sugestao > 0 ? (
                    /* Azul = ação primária recomendada (quanto comprar). */
                    <BarCell value={r.sugestao} max={localMaxes.sugestao} formatted={formatLiters(r.sugestao)} color="blue" align="near" maxWidthPct={60} />
                  ) : (
                    <span className="inline-flex h-6 w-full items-center justify-end gap-1 px-1.5 text-right text-xs tabular-nums text-gray-400 dark:text-gray-500">
                      {formatLiters(0)}
                      <InfoHint text="Sem consumo registrado nesse tanque no período. Sem ritmo de venda, o sistema não consegue projetar quanto comprar." side="left" />
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default ReposicaoTabela

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle } from 'lucide-react'
import BarCell from '@/components/tables/BarCell'
import { formatLiters } from '@/lib/formatters'
import type { ReabastTanque } from '@/pages/Dashboard/hooks/useReabastecimento'

/** Tooltip via Portal — escapa do `overflow-x-auto` da tabela. */
const InfoTooltip = ({ text }: { text: string }) => {
  const [pos, setPos] = useState<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false })
  const ref = useRef<HTMLSpanElement>(null)
  const show = () => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    // Posiciona à esquerda do ícone, vertical-center.
    setPos({ x: rect.left - 8, y: rect.top + rect.height / 2, visible: true })
  }
  const hide = () => setPos((p) => ({ ...p, visible: false }))
  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      tabIndex={0}
      aria-label="Por que está zero?"
      className="inline-flex cursor-help"
    >
      <HelpCircle className="h-3 w-3 shrink-0" />
      {pos.visible && typeof document !== 'undefined' && createPortal(
        <span
          style={{ left: pos.x, top: pos.y, transform: 'translate(-100%, -50%)', position: 'fixed', zIndex: 9999 }}
          className="pointer-events-none w-56 rounded-md bg-gray-900 px-3 py-2 text-[11px] leading-snug text-white shadow-lg dark:bg-gray-700"
        >
          {text}
        </span>,
        document.body,
      )}
    </span>
  )
}

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

/** Máximos por coluna — para escala compartilhada entre múltiplas tabelas. */
export interface ReposicaoMaxes {
  estoque: number
  capacidade: number
  ritmoDia: number
  sugestao: number
}

export const calcularMaxes = (postos: { linhas: ReposicaoLinha[] }[]): ReposicaoMaxes => {
  const linhas = postos.flatMap((p) => p.linhas)
  return {
    estoque: linhas.reduce((m, l) => Math.max(m, l.estoque), 0),
    capacidade: linhas.reduce((m, l) => Math.max(m, l.capacidade), 0),
    ritmoDia: linhas.reduce((m, l) => Math.max(m, l.ritmoDia), 0),
    sugestao: linhas.reduce((m, l) => Math.max(m, l.sugestao), 0),
  }
}

/** Nº aproximado de abastecimentos que a sugestão representa (sugestão ÷ capacidade). */
const entregas = (sugestao: number, capacidade: number): number =>
  sugestao > 0 && capacidade > 0 ? Math.ceil(sugestao / capacidade) : 0

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
          <col className="w-[80px]" />
        </colgroup>
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
                      <InfoTooltip text="Sem consumo registrado nesse tanque no período. Sem ritmo de venda, o sistema não consegue projetar quanto comprar." />
                    </span>
                  )}
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
}

export default ReposicaoTabela

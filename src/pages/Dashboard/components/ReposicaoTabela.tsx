import { Fragment, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import BarCell from '@/components/tables/BarCell'
import InfoHint from '@/components/ui/InfoHint'
import { formatLiters, formatPercent } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { calcularMaxes, type ReposicaoLinha, type ReposicaoMaxes } from '@/pages/Dashboard/components/reposicao'

interface ReposicaoTabelaProps {
  linhas: ReposicaoLinha[]
  /** Máximos compartilhados (todas as tabelas do mesmo relatório). Se omitido,
   *  cada tabela calcula o próprio (perde comparabilidade entre postos). */
  maxes?: ReposicaoMaxes
  /** Abre todos os combustíveis com mais de um tanque de cara (sem chevron). */
  expandirTanques?: boolean
  /** Visual LIMPO: números puros + cor só onde importa (sem as barras coloridas).
   *  Usado no modal, onde as barras ficavam pesadas. */
  plain?: boolean
}

/* Status por combustível derivado do nível (estoque ÷ capacidade) — MESMOS
   limiares dos cards/tanques: crítico < 20%, alerta < 30%, OK ≥ 30%. */
const STATUS_PILL: Record<'critico' | 'alerta' | 'ok', { label: string; cls: string }> = {
  critico: { label: 'Crítico', cls: 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300' },
  alerta: { label: 'Alerta', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300' },
  ok: { label: 'OK', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300' },
}
const nivelToStatus = (pct: number): 'critico' | 'alerta' | 'ok' => (pct < 20 ? 'critico' : pct < 30 ? 'alerta' : 'ok')
const nivelCor = (pct: number) => (pct < 20 ? 'text-red-600 dark:text-red-400' : pct < 30 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')

/** Tabela "Reposição de estoque" por combustível (estilo relatório), com drill
 *  por tanque. `plain` deixa o visual limpo (sem barras); `expandirTanques` abre
 *  todos os tanques de cara. */
const ReposicaoTabela = ({ linhas, maxes, expandirTanques = false, plain = false }: ReposicaoTabelaProps) => {
  const localMaxes = maxes ?? calcularMaxes([{ linhas }])
  // Linha destacada — útil pra comparar estoque/ritmo/sugestão entre combustíveis.
  const [selected, setSelected] = useState<number | null>(null)
  const toggleSelected = (codigo: number) => setSelected((curr) => (curr === codigo ? null : codigo))
  // Drill por TANQUE (quando não é `expandirTanques`): expande sob demanda.
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const toggleExpanded = (codigo: number) => setExpanded((prev) => {
    const next = new Set(prev)
    if (next.has(codigo)) next.delete(codigo)
    else next.add(codigo)
    return next
  })
  const valPad = plain ? 'px-3 py-2 text-right' : 'px-2 py-1.5'

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
      <table className="w-full table-fixed text-xs">
        <colgroup>
          <col className="w-[62px]" />
          <col className="w-[24%]" />
          <col className="w-[14%]" />
          <col className="w-[12%]" />
          <col className="w-[9%]" />
          <col className="w-[11%]" />
          <col className="w-[12%]" />
          <col className="w-[14%]" />
        </colgroup>
        <thead className="bg-gray-50 text-[10px] uppercase tracking-wide text-gray-400 dark:bg-transparent dark:text-gray-500">
          <tr className="border-b border-gray-100 dark:border-gray-800">
            <th className="px-3 py-2 text-left font-medium">Ref.</th>
            <th className="px-3 py-2 text-left font-medium">Produto</th>
            <th className="px-3 py-2 text-right font-medium">Estoque atual</th>
            <th className="px-3 py-2 text-right font-medium">Capacidade</th>
            <th className="px-3 py-2 text-right font-medium">Nível</th>
            <th className="px-3 py-2 text-center font-medium">
              <span className="inline-flex items-center justify-center gap-1">Status <InfoHint text="Situação do combustível pelo nível. Quando o combustível tem vários tanques, o nível é o conjunto SOMADO (por isso pode diferir dos pontos por tanque). Crítico abaixo de 20% · Alerta entre 20% e 30% · OK acima de 30%." /></span>
            </th>
            <th className="px-3 py-2 text-right font-medium">Ritmo/dia</th>
            <th className="px-3 py-2 text-right font-medium">Sugestão</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {linhas.map((r) => {
            const rowSelected = selected === r.produtoCodigo
            const podeExpandir = r.detalhes.length > 1
            const showTanques = podeExpandir && (expandirTanques || expanded.has(r.produtoCodigo))
            const isOpen = expandirTanques || expanded.has(r.produtoCodigo)
            const pct = r.capacidade > 0 ? (r.estoque / r.capacidade) * 100 : 0
            const s = STATUS_PILL[nivelToStatus(pct)]
            return (
              <Fragment key={r.produtoCodigo}>
                <tr
                  onClick={() => toggleSelected(r.produtoCodigo)}
                  aria-selected={rowSelected}
                  className={cn(
                    'transition-colors',
                    !expandirTanques && 'cursor-pointer',
                    rowSelected
                      ? 'bg-amber-100 hover:bg-amber-200/70 dark:bg-amber-900/30 dark:hover:bg-amber-900/40'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800/40',
                  )}
                >
                  <td className="px-3 py-2 font-mono text-[11px] text-gray-400 dark:text-gray-500">{String(r.produtoCodigo).padStart(6, '0')}</td>
                  <td className="truncate px-3 py-2 font-semibold text-gray-900 dark:text-gray-100">
                    {podeExpandir && !expandirTanques && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleExpanded(r.produtoCodigo) }}
                        aria-label={isOpen ? 'Ocultar tanques' : 'Ver tanques'}
                        className="mr-1 inline-flex align-middle text-gray-400 transition-colors hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-90')} />
                      </button>
                    )}
                    {r.produto}
                    {r.tanques > 1 && !expandirTanques && <span className="ml-1.5 text-[10px] font-normal text-gray-400 dark:text-gray-500">· {r.tanques} tanques</span>}
                  </td>
                  {/* Estoque atual */}
                  <td className={valPad}>
                    {plain
                      ? <span className="font-medium tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(r.estoque)}</span>
                      : (() => {
                          const cor: 'blue' | 'amber' | 'red' = pct < 20 ? 'red' : pct < 30 ? 'amber' : 'blue'
                          return <BarCell value={r.estoque} max={localMaxes.estoque} formatted={formatLiters(r.estoque)} color={cor} align="near" maxWidthPct={60} />
                        })()}
                  </td>
                  {/* Capacidade */}
                  <td className="px-3 py-2 text-right tabular-nums text-gray-400 dark:text-gray-500">{formatLiters(r.capacidade)}</td>
                  {/* Nível (a cor que carrega a criticidade) */}
                  <td className="px-3 py-2 text-right"><span className={cn('font-semibold tabular-nums', nivelCor(pct))}>{formatPercent(pct)}</span></td>
                  {/* Status */}
                  <td className="px-3 py-2 text-center"><span className={cn('inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold', s.cls)}>{s.label}</span></td>
                  {/* Ritmo/dia */}
                  <td className={valPad}>
                    {plain
                      ? <span className="tabular-nums text-gray-600 dark:text-gray-300">{formatLiters(r.ritmoDia)}</span>
                      : <BarCell value={r.ritmoDia} max={localMaxes.ritmoDia} formatted={formatLiters(r.ritmoDia)} color="green" align="near" maxWidthPct={60} />}
                  </td>
                  {/* Sugestão (azul = ação: quanto comprar) */}
                  <td className={valPad}>
                    {r.sugestao > 0 ? (
                      plain
                        ? <span className="font-semibold tabular-nums text-blue-600 dark:text-blue-400">{formatLiters(r.sugestao)}</span>
                        : <BarCell value={r.sugestao} max={localMaxes.sugestao} formatted={formatLiters(r.sugestao)} color="blue" align="near" maxWidthPct={60} />
                    ) : (
                      <span className={cn('inline-flex items-center justify-end gap-1 tabular-nums text-gray-400 dark:text-gray-500', !plain && 'h-6 w-full px-1.5 text-xs')}>
                        {formatLiters(0)}
                        <InfoHint text="Sem consumo registrado nesse tanque no período. Sem ritmo de venda, o sistema não consegue projetar quanto comprar." side="left" />
                      </span>
                    )}
                  </td>
                </tr>

                {/* Drill por TANQUE: os tanques individuais do combustível. */}
                {showTanques && r.detalhes.map((t) => (
                  <tr key={t.tanqueCodigo} className="bg-gray-50/60 text-[11px] dark:bg-white/[0.02]">
                    <td className="px-3 py-1.5 font-mono text-[10px] text-gray-400 dark:text-gray-500">{String(t.tanqueCodigo).padStart(6, '0')}</td>
                    <td className="truncate px-3 py-1.5 pl-7 text-gray-500 dark:text-gray-400">
                      <span className="mr-1 text-gray-300 dark:text-gray-600">↳</span>{t.tanqueNome || `Tanque ${t.tanqueCodigo}`}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{formatLiters(t.estoqueAtual)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-400 dark:text-gray-500">{formatLiters(t.capacidade)}</td>
                    <td className={cn('px-3 py-1.5 text-right font-semibold tabular-nums', nivelCor(t.nivelPct))}>{formatPercent(t.nivelPct)}</td>
                    <td className="px-3 py-1.5 text-center"><span className={cn('inline-flex whitespace-nowrap rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold', STATUS_PILL[t.nivel].cls)}>{STATUS_PILL[t.nivel].label}</span></td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{formatLiters(t.consumoDiarioMedio)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-500 dark:text-gray-400">{t.necessidadeFimDoMes > 0 ? formatLiters(t.necessidadeFimDoMes) : '—'}</td>
                  </tr>
                ))}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default ReposicaoTabela

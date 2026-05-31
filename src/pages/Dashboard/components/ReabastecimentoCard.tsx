import { useMemo, useState } from 'react'
import { AlertTriangle, Clock, Building2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatLiters } from '@/lib/formatters'
import useReabastecimento, { type ReabastTanque } from '@/pages/Dashboard/hooks/useReabastecimento'
import ReposicaoTabela from '@/pages/Dashboard/components/ReposicaoTabela'
import { aggregarPorProduto, calcularMaxes, type ReposicaoLinha } from '@/pages/Dashboard/components/reposicao'

// A Central só lista tanques baixos (crítico/alerta), então não há filtro "OK".
// 'negativo' é ortogonal aos níveis — filtra por estoqueAtual < 0 (operador
// não baixou nota de entrada ou houve erro contábil).
type FilterStatus = 'todos' | 'critico' | 'alerta' | 'negativo'

interface ResumoPosto {
  empresaCodigo: number
  empresaNome: string
  linhas: ReposicaoLinha[]
  totalSugestao: number
}

/**
 * Painel de Reabastecimento na Central da Rede — visão "Resumo": relatório de
 * reposição por posto (consolidado por combustível, estilo planilha).
 * Renderiza só quando há ao menos 1 tanque abaixo de 30%.
 *
 * Visibilidade é controlada pelo Dashboard (isMaster || canVerReabastecimento).
 */
const ReabastecimentoCard = () => {
  // includeDetalhes=true puxa LMC dos últimos 90 dias pra preencher
  // ultimaCompra + necessidadeFimDoMes em cada tanque baixo.
  const { baixos, criticos, isLoading } = useReabastecimento({ includeDetalhes: true })
  const [expanded, setExpanded] = useState(true)
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos')

  // Resumo estável pro cabeçalho do painel.
  const postosCount = useMemo(() => new Set(baixos.map((t) => t.empresaCodigo)).size, [baixos])

  // Helper de predicate do filtro de status.
  const matchesStatus = (t: ReabastTanque, f: FilterStatus): boolean => {
    if (f === 'todos') return true
    if (f === 'negativo') return t.estoqueAtual < 0
    return t.nivel === f
  }

  // Resumo de reposição: por posto, e dentro de cada posto consolidado por
  // combustível (estilo relatório "Reposição de Estoque").
  const resumoPostos = useMemo<ResumoPosto[]>(() => {
    const postoMap = new Map<number, { empresaNome: string; tanques: ReabastTanque[] }>()
    for (const t of baixos) {
      if (!matchesStatus(t, filterStatus)) continue
      const g = postoMap.get(t.empresaCodigo) ?? { empresaNome: t.empresaNome, tanques: [] }
      g.tanques.push(t)
      postoMap.set(t.empresaCodigo, g)
    }
    const arr: ResumoPosto[] = Array.from(postoMap.entries()).map(([empresaCodigo, g]) => ({
      empresaCodigo,
      empresaNome: g.empresaNome,
      linhas: aggregarPorProduto(g.tanques),
      totalSugestao: g.tanques.reduce((s, t) => s + t.necessidadeFimDoMes, 0),
    }))
    return arr.sort((a, b) => b.totalSugestao - a.totalSugestao)
  }, [baixos, filterStatus])

  const totalSugestao = resumoPostos.reduce((s, rp) => s + rp.totalSugestao, 0)
  // Máximos globais (todos os postos) — barras das tabelas compartilham a mesma
  // escala, viabilizando comparação visual cross-posto.
  const resumoMaxes = useMemo(() => calcularMaxes(resumoPostos), [resumoPostos])

  if (isLoading || baixos.length === 0) return null

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-800/40',
          expanded && 'border-b border-gray-100 dark:border-gray-800',
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Reabastecimento</h2>
            {criticos.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                <AlertTriangle className="h-2.5 w-2.5" />
                {criticos.length} crítico{criticos.length === 1 ? '' : 's'}
              </span>
            )}
            <span className="text-[10px] text-gray-400 dark:text-gray-500">
              · {postosCount} {postosCount === 1 ? 'posto' : 'postos'}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Tanques com estoque baixo · crítico abaixo de 20% · alerta abaixo de 30% · clique pra {expanded ? 'minimizar' : 'expandir'}
          </p>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-gray-400 transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      {expanded && (
        <>
          {/* Filtro de status + total a comprar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-4 py-2 dark:border-gray-800">
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
              {(
                [
                  { v: 'todos', l: 'Todos' },
                  { v: 'critico', l: 'Críticos' },
                  { v: 'alerta', l: 'Alerta' },
                  { v: 'negativo', l: 'Negativo' },
                ] as { v: FilterStatus; l: string }[]
              ).map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => setFilterStatus(opt.v)}
                  className={cn(
                    'inline-flex h-7 items-center rounded-md px-3 text-xs font-medium transition-colors',
                    filterStatus === opt.v
                      ? 'bg-[#1e3a5f] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50',
                  )}
                >
                  {opt.l}
                </button>
              ))}
            </div>

            <span className="ml-auto text-[11px] text-gray-500 dark:text-gray-400">
              Total a comprar:{' '}
              <span className="font-semibold tabular-nums text-blue-700 dark:text-blue-400">
                {formatLiters(totalSugestao)}
              </span>
            </span>
          </div>

          {/* Resumo: relatório de reposição por posto */}
          <div className="space-y-4 px-4 py-3">
            {resumoPostos.map((rp) => (
              <div key={rp.empresaCodigo}>
                <div className="mb-1.5 flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <p className="truncate text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    {rp.empresaNome}
                  </p>
                  <span className="ml-auto text-[11px] text-gray-500 dark:text-gray-400">
                    Comprar{' '}
                    <span className="font-semibold tabular-nums text-blue-700 dark:text-blue-400">
                      {formatLiters(rp.totalSugestao)}
                    </span>
                  </span>
                </div>
                <ReposicaoTabela linhas={rp.linhas} maxes={resumoMaxes} />
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 px-4 py-2 dark:border-gray-800">
            <p className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
              <Clock className="h-3 w-3" />
              Baseado no estoque escritural atual de cada tanque
            </p>
          </div>
        </>
      )}
    </section>
  )
}

export default ReabastecimentoCard

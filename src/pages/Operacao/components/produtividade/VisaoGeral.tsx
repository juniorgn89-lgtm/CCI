import { useMemo, useState } from 'react'
import { Target, Trophy, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, formatLiters, formatNumber } from '@/lib/formatters'
import { useMetasStore } from '@/store/metas'
import type { FrentistaProdRow, PeriodInfo } from '@/pages/Operacao/components/ProdutividadeTab'

interface Props {
  frentistas: FrentistaProdRow[]
  periodInfo: PeriodInfo
}

type SortKey = 'nome' | 'litros' | 'faturamento' | 'gasolina' | 'etanol' | 'diesel' | 'combustivelTotal' | 'variacao' | 'meta' | 'progresso'
type SortDir = 'asc' | 'desc'

type PrimarySort = 'litros' | 'faturamento' | 'combustivel' | 'progresso'

const PRIMARY_OPTIONS: { key: PrimarySort; label: string }[] = [
  { key: 'litros', label: 'Litros' },
  { key: 'faturamento', label: 'Faturamento' },
  { key: 'combustivel', label: 'Combustível' },
  { key: 'progresso', label: 'Progresso' },
]

const PRIMARY_TO_SORT_KEY: Record<PrimarySort, SortKey> = {
  litros: 'litros',
  faturamento: 'faturamento',
  combustivel: 'combustivelTotal',
  progresso: 'progresso',
}

const computeMeta = (
  f: FrentistaProdRow,
  manualMode: boolean,
  manualMetas: Record<number, number>,
): number => (manualMode ? manualMetas[f.funcionarioCodigo] ?? 0 : f.prevLitros)

// Variações fora desse range indicam ausência de histórico real no mês anterior:
// > 150%  → mês anterior teve volume insignificante; frentista é virtualmente "novo"
// < -90%  → idem, ratio extremo mostra que comparativo não é confiável
const isOutlierVariation = (pct: number) => pct > 150 || pct < -90

const VisaoGeral = ({ frentistas, periodInfo }: Props) => {
  const { manualMode, metas: manualMetas } = useMetasStore()
  const [primarySort, setPrimarySort] = useState<PrimarySort>('litros')
  const [sortKey, setSortKey] = useState<SortKey>('litros')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const enriched = useMemo(
    () =>
      frentistas.map((f) => {
        const meta = computeMeta(f, manualMode, manualMetas)
        const progresso = meta > 0 ? Math.min(1, f.litros / meta) : 0
        const totalCombustivel = f.litrosGasolina + f.litrosEtanol + f.litrosDiesel
        return { ...f, meta, progresso, totalCombustivel }
      }),
    [frentistas, manualMode, manualMetas]
  )

  // Atualizar ordenação primária reflete na chave de ordenação interna
  const handlePrimarySort = (key: PrimarySort) => {
    setPrimarySort(key)
    setSortKey(PRIMARY_TO_SORT_KEY[key])
    setSortDir('desc')
  }

  const sorted = useMemo(() => {
    const arr = [...enriched]
    arr.sort((a, b) => {
      // Ao ordenar por progresso, frentistas sem meta (Novo) sempre ficam no fim
      // independente de asc/desc — o "0%" deles não compete com a % real dos demais.
      if (sortKey === 'progresso') {
        const aNoMeta = a.meta === 0
        const bNoMeta = b.meta === 0
        if (aNoMeta && !bNoMeta) return 1
        if (!aNoMeta && bNoMeta) return -1
      }
      let av: number | string = 0
      let bv: number | string = 0
      switch (sortKey) {
        case 'nome':
          av = a.nome
          bv = b.nome
          break
        case 'litros':
          av = a.litros
          bv = b.litros
          break
        case 'faturamento':
          av = a.faturamento
          bv = b.faturamento
          break
        case 'gasolina':
          av = a.litrosGasolina
          bv = b.litrosGasolina
          break
        case 'etanol':
          av = a.litrosEtanol
          bv = b.litrosEtanol
          break
        case 'diesel':
          av = a.litrosDiesel
          bv = b.litrosDiesel
          break
        case 'combustivelTotal':
          av = a.totalCombustivel
          bv = b.totalCombustivel
          break
        case 'variacao':
          av = a.varLitrosPct
          bv = b.varLitrosPct
          break
        case 'meta':
          av = a.meta
          bv = b.meta
          break
        case 'progresso':
          av = a.progresso
          bv = b.progresso
          break
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
    return arr
  }, [enriched, sortKey, sortDir])

  const handleColumnSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'nome' ? 'asc' : 'desc')
    }
  }

  // KPIs do topo
  const totalLitros = enriched.reduce((s, f) => s + f.litros, 0)
  const totalMeta = enriched.reduce((s, f) => s + f.meta, 0)
  const progressoMes = totalMeta > 0 ? totalLitros / totalMeta : 0

  // Projeção de fechamento (média geral diária × dias restantes + realizado)
  const allDaily = enriched.flatMap((f) => f.dailyLitros)
  const dailyTotalsMap = new Map<string, number>()
  for (const d of allDaily) {
    dailyTotalsMap.set(d.data, (dailyTotalsMap.get(d.data) ?? 0) + d.litros)
  }
  const sortedDaily = Array.from(dailyTotalsMap.entries()).sort(([a], [b]) => a.localeCompare(b))
  const last7 = sortedDaily.slice(-7)
  const avgDaily = last7.length > 0 ? last7.reduce((s, [, v]) => s + v, 0) / last7.length : 0
  const projecaoFechamento = totalLitros + avgDaily * periodInfo.daysRemaining

  // Destaque do mês: maior volume absoluto de litros (independente de ter prev)
  const destaque = enriched[0] ?? null

  // Atenção: maior queda %, apenas frentistas com referência no mês anterior
  const comPrev = enriched.filter((f) => f.hasPrev)
  const atencao = comPrev.length > 0
    ? [...comPrev].sort((a, b) => a.varLitrosPct - b.varLitrosPct)[0]
    : null

  return (
    <div className="space-y-5">
      {/* KPIs do topo */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Meta do mês */}
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-blue-950/30 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Meta do mês</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100">
            {formatLiters(totalLitros)}
          </p>
          <p className="text-xs tabular-nums text-gray-500">
            de {formatLiters(totalMeta)} ({(progressoMes * 100).toFixed(1)}%)
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
            <div
              className={cn(
                'h-1.5 rounded-full transition-all',
                progressoMes >= 1 ? 'bg-green-500' : progressoMes >= 0.6 ? 'bg-blue-500' : 'bg-amber-500'
              )}
              style={{ width: `${Math.min(100, progressoMes * 100)}%` }}
            />
          </div>
          {periodInfo.daysRemaining > 0 && avgDaily > 0 && (
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              Projeção fechamento: <span className="font-semibold tabular-nums text-gray-700 dark:text-gray-300">{formatLiters(projecaoFechamento)}</span> ({periodInfo.daysRemaining} dias restantes)
            </p>
          )}
        </div>

        {/* Destaque */}
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-green-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-green-950/30 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Destaque do mês</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <Trophy className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
          </div>
          {destaque ? (
            <>
              <p className="mt-2 truncate text-base font-bold text-gray-900 dark:text-gray-100" title={destaque.nome}>
                {destaque.nome}
              </p>
              <p className="text-xs tabular-nums text-gray-500">{formatLiters(destaque.litros)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {!destaque.hasPrev || destaque.varLitrosPct > 150 ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    Primeiro mês
                  </span>
                ) : (
                  <span className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums',
                    destaque.varLitrosPct >= 0
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  )}>
                    {destaque.varLitrosPct >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {Math.abs(destaque.varLitrosPct).toFixed(1)}% vs anterior
                  </span>
                )}
                {destaque.meta > 0 && destaque.litros >= destaque.meta && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Acima da meta
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-400">Sem dados</p>
          )}
        </div>

        {/* Atenção */}
        <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-red-50/60 to-white p-5 shadow-sm dark:border-gray-700 dark:from-red-950/30 dark:to-gray-900">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Atenção</p>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
          {atencao ? (
            <>
              <p className="mt-2 truncate text-base font-bold text-gray-900 dark:text-gray-100" title={atencao.nome}>
                {atencao.nome}
              </p>
              <p className="text-xs tabular-nums text-gray-500">{formatLiters(atencao.litros)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className={cn(
                  'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums',
                  atencao.varLitrosPct >= 0
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                )}>
                  {atencao.varLitrosPct >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {Math.abs(atencao.varLitrosPct).toFixed(1)}% vs anterior
                </span>
                {atencao.meta > 0 && atencao.litros < atencao.meta && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    Abaixo da meta
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-400">Sem comparativo</p>
          )}
        </div>
      </div>

      {/* Tabela comparativa */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Comparativo de Frentistas
            </h3>
            <p className="mt-0.5 text-xs italic text-gray-400">
              Meta: superar o volume do mês anterior por frentista
            </p>
          </div>
          <div className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
            {PRIMARY_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => handlePrimarySort(opt.key)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  primarySort === opt.key
                    ? 'bg-[#1e3a5f] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-700'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <Th className="w-10">#</Th>
                <ThSort label="Frentista" k="nome" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('nome')} align="left" />
                <ThSort label="Litros" k="litros" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('litros')} />
                <ThSort label="Faturamento" k="faturamento" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('faturamento')} />
                <ThSort label="Gasolina" k="gasolina" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('gasolina')} />
                <ThSort label="Etanol" k="etanol" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('etanol')} />
                <ThSort label="Diesel" k="diesel" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('diesel')} />
                <ThSort label="vs. Mês Anterior" k="variacao" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('variacao')} />
                <ThSort label="Meta" k="meta" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('meta')} align="center" width="w-[140px]" />
                <ThSort label="Progresso" k="progresso" sortKey={sortKey} sortDir={sortDir} onClick={() => handleColumnSort('progresso')} align="left" width="w-[120px]" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-sm text-gray-400">
                    Sem dados de frentistas no período.
                  </td>
                </tr>
              ) : (
                sorted.map((f, idx) => {
                  const metaStatus = f.meta === 0 ? 'na' : f.litros >= f.meta ? 'atingida' : f.litros >= f.meta * 0.7 ? 'parcial' : 'abaixo'
                  return (
                    <tr key={f.funcionarioCodigo} className={cn(idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30')}>
                      <td className="px-4 py-2.5 text-xs tabular-nums text-gray-400">{idx + 1}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-gray-100">{f.nome}</td>
                      <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(f.litros)}</td>
                      <td className="px-4 py-2.5 text-right text-sm tabular-nums text-gray-700 dark:text-gray-300">{formatCurrency(f.faturamento)}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-gray-500">{formatLiters(f.litrosGasolina)}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-gray-500">{formatLiters(f.litrosEtanol)}</td>
                      <td className="px-4 py-2.5 text-right text-xs tabular-nums text-gray-500">{formatLiters(f.litrosDiesel)}</td>
                      <td className={cn(
                        'px-4 py-2.5 text-right text-sm font-medium tabular-nums',
                        !f.hasPrev || isOutlierVariation(f.varLitrosPct)
                          ? 'text-gray-400'
                          : f.varLitrosPct >= 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      )}>
                        {!f.hasPrev || isOutlierVariation(f.varLitrosPct) ? (
                          <span
                            className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-normal text-blue-700 dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-400"
                            style={{ fontSize: '11px' }}
                            title="Sem histórico no mês anterior"
                          >
                            Novo frentista
                          </span>
                        ) : (
                          `${f.varLitrosPct >= 0 ? '+' : ''}${f.varLitrosPct.toFixed(1)}%`
                        )}
                      </td>
                      <td className="w-[140px] whitespace-nowrap px-4 py-2.5 text-center">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            metaStatus === 'atingida' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                            metaStatus === 'parcial' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                            metaStatus === 'abaixo' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                            metaStatus === 'na' && 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
                          )}
                          title={
                            metaStatus === 'atingida'
                              ? 'Meta atingida — acima do mês anterior'
                              : metaStatus === 'parcial'
                              ? `Abaixo do mês anterior — ${((1 - f.progresso) * 100).toFixed(0)}% restante para atingir`
                              : metaStatus === 'abaixo'
                              ? 'Significativamente abaixo do mês anterior'
                              : undefined
                          }
                        >
                          {metaStatus === 'atingida' && 'Atingida'}
                          {metaStatus === 'parcial' && 'Parcial'}
                          {metaStatus === 'abaixo' && 'Abaixo'}
                          {metaStatus === 'na' && 'Sem ref.'}
                          {f.meta > 0 && <span className="ml-1 tabular-nums opacity-75">{formatNumber(Math.round(f.meta))}L</span>}
                        </span>
                      </td>
                      <td className="w-[120px] whitespace-nowrap px-4 py-2.5">
                        {f.meta === 0 ? (
                          <span className="text-xs text-gray-400">—</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                              <div
                                className={cn(
                                  'h-1.5 rounded-full transition-all',
                                  f.progresso >= 1 ? 'bg-green-500' : f.progresso >= 0.6 ? 'bg-blue-500' : 'bg-amber-500'
                                )}
                                style={{ width: `${Math.min(100, f.progresso * 100)}%` }}
                              />
                            </div>
                            <span className="shrink-0 text-[10px] tabular-nums text-gray-500">{(f.progresso * 100).toFixed(0)}%</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

interface ThProps {
  children: React.ReactNode
  className?: string
}

const Th = ({ children, className }: ThProps) => (
  <th className={cn('px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400', className)}>
    {children}
  </th>
)

interface ThSortProps {
  label: string
  k: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onClick: () => void
  align?: 'left' | 'right' | 'center'
  width?: string
}

const ThSort = ({ label, k, sortKey, sortDir, onClick, align = 'right', width }: ThSortProps) => {
  const isActive = sortKey === k
  return (
    <th className={cn(
      'whitespace-nowrap px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400',
      align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right',
      width
    )}>
      <button
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-gray-700 dark:hover:text-gray-200',
          isActive && 'text-gray-900 dark:text-gray-100'
        )}
      >
        {label}
        {isActive ? (
          sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </th>
  )
}

export default VisaoGeral

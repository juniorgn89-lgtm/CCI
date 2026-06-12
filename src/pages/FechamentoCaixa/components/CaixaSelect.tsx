import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

/**
 * Opção normalizada de caixa pro seletor compartilhado. As telas (Visão Geral,
 * Caixa Geral, etc.) mapeiam sua fonte de dados pra esse shape — assim o
 * dropdown fica idêntico em todas as abas do Fechamento de Caixa.
 */
export interface CaixaOption {
  /** Chave única (ex.: `${caixaCodigo}-${dataMovimento}`). */
  key: string
  /** Data ISO (yyyy-MM-dd) — usada pra agrupar e ordenar. */
  dataIso: string
  /** Data formatada pt-BR (dd/mm/yyyy) — exibida no cabeçalho do grupo. */
  dataLabel: string
  /** Turno (ex.: "1º TURNO"). */
  turno: string
  /** Código do turno — ordena caixas dentro do dia. */
  turnoCodigo: number
  /** Título do caixa (ex.: "Caixa #4467072"). */
  caixaLabel: string
  /** Subtítulo (ex.: "CRISTIELE MAURICIO ALVES · A: 03:00 F: 03:02"). */
  subLabel: string
  /** PDV: 'Pista' | 'Conveniência' | 'PDV {código}'. */
  pdvLabel?: string
  fechado: boolean
  apurado: number
  diferenca: number
}

/** Badge do PDV (Pista azul / Conveniência roxo / PDV cinza). */
const pdvTone = (label: string): string =>
  label === 'Pista'
    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300'
    : label === 'Conveniência'
      ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300'
      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'

interface CaixaSelectProps {
  /** Opções JÁ filtradas por "incluir abertos" (o caller aplica o filtro). */
  options: CaixaOption[]
  selectedKeys: string[]
  onChange: (keys: string[]) => void
  includeAbertos: boolean
  onIncludeAbertosChange: (value: boolean) => void
  loading?: boolean
  emptyLabel?: string
  /** Conteúdo extra à direita (contador, tooltip de ajuda, etc.). */
  rightSlot?: ReactNode
}

const dataKeyDesc = (a: string, b: string) => b.localeCompare(a)

/**
 * Seletor de caixas compartilhado por todas as abas do Fechamento de Caixa.
 * Agrupa por dia, permite marcar dia inteiro / todos / limpar, e mostra
 * Apurado + diferença de cada caixa.
 */
const CaixaSelect = ({
  options,
  selectedKeys,
  onChange,
  includeAbertos,
  onIncludeAbertosChange,
  loading = false,
  emptyLabel = 'Nenhum caixa no período.',
  rightSlot,
}: CaixaSelectProps) => {
  const selectedSet = new Set(selectedKeys)
  const allSelected = options.length > 0 && selectedKeys.length === options.length
  const noneSelected = selectedKeys.length === 0
  const selected = options.filter((o) => selectedSet.has(o.key))

  // Agrupa por data (desc) e ordena caixas do dia por turno.
  const porData = (() => {
    const map = new Map<string, CaixaOption[]>()
    for (const o of options) {
      if (!map.has(o.dataIso)) map.set(o.dataIso, [])
      map.get(o.dataIso)!.push(o)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => dataKeyDesc(a, b))
      .map(([dataIso, lista]) => ({
        dataIso,
        dataLabel: lista[0].dataLabel,
        lista: [...lista].sort((x, y) => x.turnoCodigo - y.turnoCodigo),
      }))
  })()

  const toggle = (key: string) =>
    onChange(selectedKeys.includes(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key])
  const selectAll = () => onChange(options.map((o) => o.key))
  const clearAll = () => onChange([])

  const triggerLabel = noneSelected
    ? 'Selecione um caixa'
    : allSelected
      ? `Todos os caixas (${options.length})`
      : selected.length === 1
        ? `${selected[0].turno} · ${selected[0].dataLabel}`
        : `${selectedKeys.length} caixas selecionados`

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        Caixas
      </label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-9 min-w-[280px] items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500',
              'dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800',
            )}
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[70vh] w-[360px] overflow-y-auto">
          <DropdownMenuLabel className="flex items-center justify-between gap-3 text-xs">
            <span>Selecionar caixas</span>
            <div className="flex items-center gap-2 text-[11px] font-normal">
              <button type="button" onClick={selectAll} className="text-blue-600 hover:underline dark:text-blue-400">
                Todos
              </button>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <button type="button" onClick={clearAll} className="text-gray-500 hover:underline dark:text-gray-400">
                Limpar
              </button>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-gray-400">
              {loading ? 'Carregando...' : emptyLabel}
            </p>
          ) : (
            porData.map(({ dataIso, dataLabel, lista }, gi) => {
              const allDaySelected = lista.every((c) => selectedSet.has(c.key))
              const toggleDay = () => {
                const dayKeys = lista.map((c) => c.key)
                onChange(
                  allDaySelected
                    ? selectedKeys.filter((k) => !dayKeys.includes(k))
                    : [...new Set([...selectedKeys, ...dayKeys])],
                )
              }
              return (
                <div key={dataIso} className={cn(gi > 0 && 'mt-1 border-t border-gray-100 pt-1 dark:border-gray-800')}>
                  <div className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      {dataLabel}
                    </span>
                    <button
                      type="button"
                      onClick={toggleDay}
                      className="text-[10px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {allDaySelected ? 'Desmarcar dia' : 'Selecionar dia'}
                    </button>
                  </div>
                  {lista.map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.key}
                      checked={selectedSet.has(c.key)}
                      onCheckedChange={() => toggle(c.key)}
                      onSelect={(e) => e.preventDefault()}
                      className={cn(
                        'text-xs',
                        !c.fechado && 'border-l-2 border-amber-400 bg-amber-50/40 dark:border-amber-500/70 dark:bg-amber-900/10',
                      )}
                    >
                      <div className="flex w-full flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
                          <span>{c.turno} · {c.caixaLabel}</span>
                          {c.pdvLabel && (
                            <span className={cn('inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold', pdvTone(c.pdvLabel))}>
                              {c.pdvLabel}
                            </span>
                          )}
                          {!c.fechado && (
                            <span className="inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                              Em aberto
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          {c.subLabel}
                        </span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            <span className="opacity-70">Apurado</span>
                            <span className="tabular-nums">{formatCurrency(c.apurado)}</span>
                          </span>
                          {c.fechado && Math.abs(c.diferenca) > 0.005 && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
                                c.diferenca > 0
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                  : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                              )}
                            >
                              {c.diferenca > 0 ? '+' : ''}{formatCurrency(c.diferenca)}
                            </span>
                          )}
                        </div>
                      </div>
                    </DropdownMenuCheckboxItem>
                  ))}
                </div>
              )
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
        <input
          type="checkbox"
          checked={includeAbertos}
          onChange={(e) => onIncludeAbertosChange(e.target.checked)}
          className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
        />
        Incluir caixas abertos
      </label>
      {rightSlot}
    </div>
  )
}

export default CaixaSelect

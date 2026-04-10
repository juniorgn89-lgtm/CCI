import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, GitCompareArrows } from 'lucide-react'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { cn } from '@/lib/utils'
import PeriodSelect from '@/components/filters/PeriodSelect'
import DateRangePicker from '@/components/filters/DateRangePicker'

interface CompanyPickerProps {
  selected: number[]
  onCompare: (codigos: number[]) => void
}

const CompanyPicker = ({ selected, onCompare }: CompanyPickerProps) => {
  const [draft, setDraft] = useState<number[]>(selected)

  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 30 * 60 * 1000,
  })

  const empresas = empresasData?.resultados ?? []

  useEffect(() => {
    setDraft(selected)
  }, [selected])

  const toggleDraft = (codigo: number) => {
    setDraft((prev) =>
      prev.includes(codigo) ? prev.filter((c) => c !== codigo) : [...prev, codigo]
    )
  }

  const selectAll = () => {
    setDraft(empresas.map((e) => e.codigo))
  }

  const clearAll = () => {
    setDraft([])
  }

  const handleCompare = () => {
    onCompare(draft)
  }

  const draftChanged = JSON.stringify([...draft].sort()) !== JSON.stringify([...selected].sort())

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Selecione os postos para comparar</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={selectAll}
            className="text-xs font-medium text-purple-600 hover:text-purple-700 dark:text-purple-400"
          >
            Todos
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button
            onClick={clearAll}
            className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400"
          >
            Limpar
          </button>
        </div>
      </div>

      {/* Company chips */}
      <div className="flex flex-wrap gap-2">
        {empresas.map((empresa) => {
          const checked = draft.includes(empresa.codigo)
          return (
            <button
              key={empresa.codigo}
              onClick={() => toggleDraft(empresa.codigo)}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-all',
                checked
                  ? 'border-purple-500 bg-purple-50 font-medium text-purple-700 shadow-sm dark:border-purple-500 dark:bg-purple-900/30 dark:text-purple-300'
                  : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:border-gray-600'
              )}
            >
              <div
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                  checked
                    ? 'border-purple-500 bg-purple-500 text-white'
                    : 'border-gray-300 dark:border-gray-600'
                )}
              >
                {checked && <Check className="h-2.5 w-2.5" />}
              </div>
              {empresa.fantasia}
            </button>
          )
        })}
      </div>

      {/* Footer: period filters + compare button */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-gray-800">
        <div className="flex flex-wrap items-center gap-3">
          <PeriodSelect />
          <div className="h-6 w-px bg-gray-200 dark:bg-gray-700" />
          <DateRangePicker />
        </div>

        <button
          onClick={handleCompare}
          disabled={!draftChanged}
          className={cn(
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
            draftChanged
              ? 'bg-purple-600 text-white hover:bg-purple-500'
              : 'cursor-default bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'
          )}
        >
          <GitCompareArrows className="h-4 w-4" />
          {draft.length > 1
            ? `Comparar ${draft.length} postos`
            : draft.length === 1
              ? 'Ver 1 posto'
              : 'OK'}
        </button>
      </div>
    </div>
  )
}

export default CompanyPicker

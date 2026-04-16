import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { ChevronDown } from 'lucide-react'

const PERIODOS = [
  { label: 'Hoje', days: 0 },
  { label: '7 dias', days: 7 },
  { label: '15 dias', days: 15 },
  { label: 'Mês atual', days: -1 },
]

const getRange = (days: number): { dataInicial: string; dataFinal: string } => {
  const now = new Date()
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  if (days === 0) {
    const s = fmt(now)
    return { dataInicial: s, dataFinal: s }
  }
  if (days === -1) {
    const first = new Date(now.getFullYear(), now.getMonth(), 1)
    return { dataInicial: fmt(first), dataFinal: fmt(now) }
  }
  const from = new Date(now)
  from.setDate(from.getDate() - days + 1)
  return { dataInicial: fmt(from), dataFinal: fmt(now) }
}

const GerenteFiltros = () => {
  const { empresaCodigos, dataInicial, dataFinal, setEmpresas, setPeriodo } = useFilterStore()

  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })
  const empresas = empresasData?.resultados ?? []

  const activePeriodo = PERIODOS.find((p) => {
    const range = getRange(p.days)
    return range.dataInicial === dataInicial && range.dataFinal === dataFinal
  })

  return (
    <div className="flex flex-col gap-2">
      {/* Empresa selector */}
      <div className="relative">
        <select
          value={empresaCodigos[0] ?? ''}
          onChange={(e) => {
            const v = e.target.value
            setEmpresas(v ? [Number(v)] : [])
          }}
          className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 pr-8 text-sm font-medium text-gray-700 shadow-sm focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          <option value="">Selecione uma empresa</option>
          {empresas.map((e) => (
            <option key={e.codigo} value={e.codigo}>
              {e.fantasia}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      </div>

      {/* Period quick-select */}
      <div className="flex gap-1.5">
        {PERIODOS.map((p) => {
          const isActive = activePeriodo?.label === p.label
          return (
            <button
              key={p.label}
              onClick={() => {
                const range = getRange(p.days)
                setPeriodo(range.dataInicial, range.dataFinal)
              }}
              className={`flex-1 rounded-full py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-[#1e3a5f] text-white'
                  : 'bg-white text-gray-600 shadow-sm ring-1 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      {!activePeriodo && (
        <p className="text-center text-[10px] text-gray-400">
          {dataInicial.split('-').reverse().join('/')} – {dataFinal.split('-').reverse().join('/')}
        </p>
      )}
    </div>
  )
}

export default GerenteFiltros

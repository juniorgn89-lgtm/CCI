import { useFilterStore } from '@/store/filters'

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
  if (days === 0) { const s = fmt(now); return { dataInicial: s, dataFinal: s } }
  if (days === -1) {
    return { dataInicial: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), dataFinal: fmt(now) }
  }
  const from = new Date(now)
  from.setDate(from.getDate() - days + 1)
  return { dataInicial: fmt(from), dataFinal: fmt(now) }
}

const FrentistaPeriodBadges = () => {
  const { dataInicial, dataFinal, setPeriodo } = useFilterStore()

  const activePeriodo = PERIODOS.find((p) => {
    const range = getRange(p.days)
    return range.dataInicial === dataInicial && range.dataFinal === dataFinal
  })

  return (
    <div className="flex gap-1.5 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
      {PERIODOS.map((p) => {
        const isActive = activePeriodo?.label === p.label
        return (
          <button
            key={p.label}
            onClick={() => {
              const range = getRange(p.days)
              setPeriodo(range.dataInicial, range.dataFinal)
            }}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all duration-150 ${
              isActive
                ? 'bg-green-600 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
            }`}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}

export default FrentistaPeriodBadges

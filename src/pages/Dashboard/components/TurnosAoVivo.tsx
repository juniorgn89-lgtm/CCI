import { Activity, Building2, ArrowRight, Wallet, User, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import useTurnosAoVivo from '@/pages/Dashboard/hooks/useTurnosAoVivo'
import { useFilterStore } from '@/store/filters'
import { formatCurrency } from '@/lib/formatters'

const formatHora = (iso: string): string => {
  if (!iso) return '-'
  if (iso.includes('T')) return iso.split('T')[1]?.substring(0, 5) ?? '-'
  if (iso.includes(' ')) return iso.split(' ')[1]?.substring(0, 5) ?? '-'
  return iso.substring(0, 5)
}

const formatDataAbertura = (iso: string): string => {
  if (!iso || iso.length < 10) return '-'
  const datePart = iso.split('T')[0] ?? iso.split(' ')[0] ?? iso.substring(0, 10)
  const [y, m, d] = datePart.split('-')
  return `${d}/${m}/${y.slice(-2)}`
}

const TurnosAoVivo = () => {
  const navigate = useNavigate()
  const setEmpresas = useFilterStore((s) => s.setEmpresas)
  const { empresas, totalAoVivo, totalEmpresas, empresasComAoVivo, isLoading } = useTurnosAoVivo()

  const handleClick = (empresaCodigo: number) => {
    setEmpresas([empresaCodigo])
    navigate('/operacao?tab=caixa')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
            </span>
            Ao vivo na rede
          </h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {isLoading ? (
              'Carregando turnos da rede...'
            ) : totalAoVivo > 0 ? (
              <>
                {totalAoVivo} {totalAoVivo === 1 ? 'caixa aberto' : 'caixas abertos'} em{' '}
                {empresasComAoVivo} {empresasComAoVivo === 1 ? 'posto' : 'postos'} · Selecione um para ver detalhes
              </>
            ) : (
              'Selecione um posto no filtro acima para ver o dashboard completo'
            )}
          </p>
        </div>
        {totalEmpresas > 0 && (
          <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            {totalEmpresas} {totalEmpresas === 1 ? 'posto na rede' : 'postos na rede'}
          </span>
        )}
      </div>

      {/* Loading state inicial (ainda nem retornou empresas) */}
      {isLoading && totalEmpresas === 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[140px] animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
            />
          ))}
        </div>
      ) : totalAoVivo === 0 && !isLoading ? (
        // Nenhum caixa aberto na rede
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/50 p-12 text-center dark:border-gray-700 dark:bg-gray-900/50">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <Building2 className="h-5 w-5 text-gray-400" />
          </div>
          <p className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-300">
            Nenhum caixa aberto no momento
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Todos os turnos da rede estão fechados ou ainda não iniciaram no período selecionado
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {empresas
            .filter((emp) => emp.caixas.length > 0)
            .map((emp) => (
              <button
                key={emp.empresaCodigo}
                onClick={() => handleClick(emp.empresaCodigo)}
                className="group flex flex-col rounded-xl border border-l-4 border-gray-200 border-l-green-500 bg-white text-left shadow-sm transition-all hover:border-green-300 hover:shadow-md dark:border-gray-700 dark:border-l-green-500 dark:bg-gray-900 dark:hover:border-green-700"
              >
                {/* Header do posto */}
                <div className="flex items-start justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
                      <Activity className="h-3 w-3" />
                      Ao vivo · {emp.caixas.length} {emp.caixas.length === 1 ? 'caixa' : 'caixas'}
                    </p>
                    <p
                      className="mt-1 truncate text-sm font-semibold text-gray-900 dark:text-gray-100"
                      title={emp.empresaNome}
                    >
                      {emp.empresaNome}
                    </p>
                    {emp.apuradoParcial > 0 && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Wallet className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <span
                          className="tabular-nums text-sm font-bold text-gray-900 dark:text-gray-100"
                          title="Combustível bombeado desde a abertura do caixa mais antigo"
                        >
                          {formatCurrency(emp.apuradoParcial)}
                        </span>
                        <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                          parcial
                        </span>
                      </div>
                    )}
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-gray-500 dark:text-gray-600" />
                </div>

                {/* Lista de caixas do posto */}
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {emp.caixas.map((c) => (
                    <li
                      key={`${c.empresaCodigo}-${c.caixaCodigo}`}
                      className="flex flex-col gap-1 px-4 py-2.5 text-xs"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          {c.turno}
                        </span>
                        <Clock className="h-3 w-3 shrink-0 text-gray-400" />
                        <span className="tabular-nums text-gray-500 dark:text-gray-400">
                          {formatDataAbertura(c.abertura)} {formatHora(c.abertura)}
                        </span>
                      </div>
                      <div
                        className="flex items-center gap-1.5 truncate text-gray-700 dark:text-gray-300"
                        title={c.responsavelNome}
                      >
                        <User className="h-3 w-3 shrink-0 text-gray-400" />
                        <span className="truncate">{c.responsavelNome}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

export default TurnosAoVivo

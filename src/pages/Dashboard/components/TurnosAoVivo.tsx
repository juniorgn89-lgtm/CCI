import { Building2, Wallet } from 'lucide-react'
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
    navigate('/caixas-turnos')
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
        <div className="grid grid-cols-[repeat(auto-fill,21rem)] gap-3">
          {empresas
            .filter((emp) => emp.caixas.length > 0)
            .map((emp) => (
              <button
                key={emp.empresaCodigo}
                onClick={() => handleClick(emp.empresaCodigo)}
                className="group flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-all hover:border-green-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:hover:border-green-700"
              >
                {/* Header: nome do posto + badge "Ao vivo" */}
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold text-gray-900 dark:text-gray-100" title={emp.empresaNome}>
                      {emp.empresaNome}
                    </p>
                    <p className="truncate text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {emp.caixas.length} {emp.caixas.length === 1 ? 'caixa aberto' : 'caixas abertos'}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                    </span>
                    Ao vivo
                  </span>
                </div>

                {/* Apurado parcial em destaque */}
                {emp.apuradoParcial > 0 && (
                  <div className="flex items-center gap-2">
                    <Wallet className="h-5 w-5 shrink-0 text-amber-500" />
                    <span
                      className="text-2xl font-bold tabular-nums text-gray-900 dark:text-gray-100"
                      title="Combustível bombeado desde a abertura do caixa mais antigo"
                    >
                      {formatCurrency(emp.apuradoParcial)}
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      parcial
                    </span>
                  </div>
                )}

                {/* Lista de caixas no rodapé */}
                <div className="mt-auto flex flex-col gap-1 border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
                  {emp.caixas.map((c) => (
                    <span
                      key={`${c.empresaCodigo}-${c.caixaCodigo}`}
                      className="flex items-center gap-1.5"
                      title={`${c.turno} · ${formatDataAbertura(c.abertura)} ${formatHora(c.abertura)} · ${c.responsavelNome}`}
                    >
                      <span className="shrink-0 rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {c.turno}
                      </span>
                      <span className="shrink-0 tabular-nums text-gray-500 dark:text-gray-400">
                        {formatHora(c.abertura)}
                      </span>
                      <span className="truncate text-gray-700 dark:text-gray-300">
                        {c.responsavelNome}
                      </span>
                    </span>
                  ))}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}

export default TurnosAoVivo

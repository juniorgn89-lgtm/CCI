import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trophy, RefreshCw } from 'lucide-react'
import { useFreentistaStore } from '@/store/frentista'
import { useFilterStore } from '@/store/filters'
import { fetchAbastecimentos } from '@/api/endpoints/combustiveis'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { formatLiters, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'

const MeuRanking = () => {
  const { session } = useFreentistaStore()
  const { dataInicial, dataFinal } = useFilterStore()

  const { data: abastData, isFetching: fetchingAbast } = useQuery({
    queryKey: ['abastecimentos-frentista', dataInicial, dataFinal],
    queryFn: () => fetchAllPages((p) => fetchAbastecimentos({ dataInicial, dataFinal, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 50),
    enabled: !!session,
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
  })

  const { data: funcData } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: () => fetchFuncionarios({ limite: 1000 }),
    enabled: !!session,
    staleTime: 30 * 60 * 1000,
  })

  const ranking = useMemo(() => {
    if (!session || !abastData) return []

    const funcionarios = funcData?.resultados ?? []
    const funcMap = new Map<number, string>()
    for (const f of funcionarios) {
      funcMap.set(f.funcionarioCodigo, f.nome)
    }

    // Resolve my real code
    const funcMatch = funcionarios.find((f) => f.nome.toUpperCase() === session.nome.toUpperCase())
    const meuCodigo = funcMatch?.funcionarioCodigo ?? session.funcionarioCodigo

    const filtered = abastData
    const byFrentista = new Map<number, { litros: number; valor: number; count: number }>()
    for (const a of filtered) {
      const prev = byFrentista.get(a.codigoFrentista) ?? { litros: 0, valor: 0, count: 0 }
      byFrentista.set(a.codigoFrentista, {
        litros: prev.litros + a.quantidade,
        valor: prev.valor + a.valorTotal,
        count: prev.count + 1,
      })
    }

    return Array.from(byFrentista.entries())
      .map(([cod, d]) => ({
        codigo: cod,
        nome: funcMap.get(cod) ?? `Frentista ${cod}`,
        ...d,
        isMe: cod === meuCodigo,
      }))
      .sort((a, b) => b.litros - a.litros)
      .map((r, i) => ({ ...r, posicao: i + 1 }))
  }, [session, abastData, funcData])

  const myPosition = ranking.find((r) => r.isMe)

  if (!session) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Meu Ranking</h2>
        {fetchingAbast && (
          <div className="flex items-center gap-1.5 text-xs text-blue-500">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Atualizando...
          </div>
        )}
      </div>

      {/* My position highlight */}
      {myPosition && (
        <div className={cn(
          'rounded-xl border-2 p-5 shadow-sm',
          myPosition.posicao <= 3
            ? 'border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-900/20'
            : 'border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20'
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold',
              myPosition.posicao === 1 ? 'bg-amber-200 text-amber-800' :
              myPosition.posicao === 2 ? 'bg-gray-200 text-gray-700' :
              myPosition.posicao === 3 ? 'bg-orange-200 text-orange-800' :
              'bg-blue-200 text-blue-800'
            )}>
              {myPosition.posicao}º
            </div>
            <div>
              <p className="text-base font-bold text-gray-900 dark:text-gray-100">{myPosition.nome}</p>
              <p className="text-xs text-gray-500">{myPosition.posicao}º lugar de {ranking.length} frentistas</p>
            </div>
            {myPosition.posicao <= 3 && (
              <Trophy className="ml-auto h-6 w-6 text-amber-500" />
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="text-center">
              <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(myPosition.litros)}</p>
              <p className="text-[10px] text-gray-400">Litros</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(myPosition.count)}</p>
              <p className="text-[10px] text-gray-400">Atendimentos</p>
            </div>
          </div>
        </div>
      )}

      {/* Full ranking */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ranking Completo</h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {ranking.map((r) => (
            <div
              key={r.codigo}
              className={cn(
                'flex items-center gap-3 px-4 py-3',
                r.isMe && 'bg-green-50/50 dark:bg-green-900/10'
              )}
            >
              <span className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                r.posicao === 1 ? 'bg-amber-100 text-amber-700' :
                r.posicao === 2 ? 'bg-gray-200 text-gray-600' :
                r.posicao === 3 ? 'bg-orange-100 text-orange-700' :
                'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              )}>
                {r.posicao}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('truncate text-sm', r.isMe ? 'font-bold text-green-700 dark:text-green-400' : 'text-gray-900 dark:text-gray-100')}>
                  {r.nome} {r.isMe && '(Você)'}
                </p>
                <p className="text-[10px] text-gray-400">{formatNumber(r.count)} abast.</p>
              </div>
              <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(r.litros)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default MeuRanking

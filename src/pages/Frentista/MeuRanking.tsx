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
import InsightBanner from '@/pages/Frentista/components/InsightBanner'

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

      {/* My position highlight — strip style */}
      {myPosition && (
        <div className={cn(
          'flex flex-col gap-3 rounded-lg border border-gray-200/60 px-4 py-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-gray-700/60',
          myPosition.posicao <= 3
            ? 'bg-gradient-to-r from-amber-50/60 to-white dark:from-amber-950/20 dark:to-gray-900'
            : 'bg-gradient-to-r from-blue-50/60 to-white dark:from-blue-950/20 dark:to-gray-900'
        )}>
          {/* Left: position + name */}
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
              myPosition.posicao === 1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
              myPosition.posicao === 2 ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300' :
              myPosition.posicao === 3 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
              'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            )}>
              {myPosition.posicao}º
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{myPosition.nome}</h3>
                {myPosition.posicao <= 3 && <Trophy className="h-4 w-4 text-amber-500" />}
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{myPosition.posicao}º lugar de {ranking.length} frentistas</p>
            </div>
          </div>
          {/* Right: metric mini-cards */}
          <div className="flex gap-2">
            <div className="min-w-[90px] rounded-md border border-gray-200/80 bg-white px-3 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Litros</p>
              <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatLiters(myPosition.litros)}</p>
            </div>
            <div className="min-w-[90px] rounded-md border border-gray-200/80 bg-white px-3 py-1.5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <p className="text-[9px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">Atendimentos</p>
              <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(myPosition.count)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Insight banner */}
      {myPosition && (() => {
        if (myPosition.posicao === 1) return <InsightBanner type="champion" message="Parabéns, campeão! Você está na liderança do ranking. Mantenha o ritmo!" />
        if (myPosition.posicao <= 3) return <InsightBanner type="success" message={`Você está no top 3! Faltam ${formatLiters(ranking[myPosition.posicao - 2].litros - myPosition.litros)} litros para subir para o ${myPosition.posicao - 1}º lugar.`} />
        const nextUp = ranking[myPosition.posicao - 2]
        if (nextUp) return <InsightBanner type="motivate" message={`Você está em ${myPosition.posicao}º lugar. Faltam ${formatLiters(nextUp.litros - myPosition.litros)} litros para ultrapassar ${nextUp.nome.split(' ')[0]} e subir para ${myPosition.posicao - 1}º!`} />
        return null
      })()}

      {/* Full ranking */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ranking Completo</h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {ranking.map((r, idx) => (
            <div
              key={r.codigo}
              className={cn(
                'flex items-center gap-3 px-4 py-3',
                r.isMe ? 'bg-green-50/50 dark:bg-green-900/10' : idx % 2 === 1 && 'bg-gray-50/70 dark:bg-gray-800/30'
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

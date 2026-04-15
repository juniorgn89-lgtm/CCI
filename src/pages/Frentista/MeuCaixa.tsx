import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Wallet, Clock, ArrowUpDown, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { useFreentistaStore } from '@/store/frentista'
import { useFilterStore } from '@/store/filters'
import { fetchCaixas } from '@/api/endpoints/financeiro'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'

const extractTime = (raw: string | null | undefined): string => {
  if (!raw) return ''
  if (raw.includes(' ')) return raw.split(' ')[1]?.substring(0, 5) ?? ''
  if (raw.includes('T')) return raw.split('T')[1]?.substring(0, 5) ?? ''
  return raw.substring(0, 5)
}

const MeuCaixa = () => {
  const { session } = useFreentistaStore()
  const { dataInicial, dataFinal } = useFilterStore()

  const { data: caixasRaw, isFetching } = useQuery({
    queryKey: ['caixas-frentista', session?.empresaCodigo, dataInicial, dataFinal],
    queryFn: () => fetchCaixas({ empresaCodigo: session!.empresaCodigo, dataInicial, dataFinal, limite: 1000 }),
    enabled: !!session,
    refetchInterval: 2 * 60 * 1000,
    staleTime: 60 * 1000,
  })

  const computed = useMemo(() => {
    if (!session || !caixasRaw) return null

    const caixas = (caixasRaw.resultados ?? []).filter((c) => c.funcionarioCodigo === session.funcionarioCodigo)
    const abertos = caixas.filter((c) => !c.fechado)
    const fechados = caixas.filter((c) => c.fechado)
    const totalApurado = caixas.reduce((s, c) => s + c.apurado, 0)
    const totalDiferenca = fechados.reduce((s, c) => s + c.diferenca, 0)

    return {
      abertos,
      fechados,
      total: caixas.length,
      totalApurado,
      totalDiferenca,
      turnos: caixas
        .map((c) => ({
          caixaCodigo: c.caixaCodigo,
          turno: c.turno || `Turno ${c.turnoCodigo}`,
          dataMovimento: c.dataMovimento,
          abertura: extractTime(c.abertura),
          fechamento: extractTime(c.fechamento),
          fechado: c.fechado,
          apurado: c.apurado,
          diferenca: c.diferenca,
        }))
        .sort((a, b) => {
          if (a.fechado !== b.fechado) return a.fechado ? 1 : -1
          return b.dataMovimento.localeCompare(a.dataMovimento)
        }),
    }
  }, [session, caixasRaw])

  if (!session) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Meu Caixa</h2>
        {isFetching && (
          <div className="flex items-center gap-1.5 text-xs text-blue-500">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Atualizando...
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border-l-4 border-blue-500 bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-blue-500" />
            <p className="text-xs text-gray-400">Apurado Total</p>
          </div>
          <p className="mt-1 text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatCurrency(computed?.totalApurado ?? 0)}</p>
        </div>
        <div className="rounded-xl border-l-4 border-amber-500 bg-white p-4 shadow-sm dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-amber-500" />
            <p className="text-xs text-gray-400">Diferença Total</p>
          </div>
          <p className={cn(
            'mt-1 text-xl font-bold tabular-nums',
            (computed?.totalDiferenca ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
          )}>
            {(computed?.totalDiferenca ?? 0) >= 0 ? '+' : ''}{formatCurrency(computed?.totalDiferenca ?? 0)}
          </p>
        </div>
      </div>

      {/* Active shift */}
      {(computed?.abertos ?? []).length > 0 && (
        <div className="rounded-xl border-2 border-green-400 bg-green-50 p-4 shadow-sm dark:border-green-700 dark:bg-green-900/20">
          <div className="mb-2 flex items-center gap-2">
            <div className="relative flex h-2.5 w-2.5">
              <span className="absolute h-2.5 w-2.5 animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative h-2.5 w-2.5 rounded-full bg-green-500" />
            </div>
            <p className="text-sm font-semibold text-green-700 dark:text-green-400">Em turno agora</p>
          </div>
          {computed!.abertos.map((t) => (
            <div key={t.caixaCodigo} className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
                <Clock className="h-3 w-3" />
                <span>Início: {extractTime(t.abertura)}</span>
                <span>&middot;</span>
                <span>{t.turno}</span>
              </div>
              <p className="text-sm font-semibold tabular-nums text-green-700 dark:text-green-400">
                {formatCurrency(t.apurado)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Shifts list */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Meus Turnos
            <span className="ml-2 text-xs font-normal text-gray-400">{computed?.total ?? 0} no período</span>
          </h3>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {(computed?.turnos ?? []).map((t) => (
            <div key={`${t.caixaCodigo}-${t.dataMovimento}`} className="flex items-center gap-3 px-4 py-3">
              <div className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                t.fechado ? 'bg-gray-100 dark:bg-gray-800' : 'bg-green-100 dark:bg-green-900/30'
              )}>
                {t.fechado ? <CheckCircle2 className="h-4 w-4 text-gray-500" /> : <AlertCircle className="h-4 w-4 text-green-600" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t.dataMovimento.split('-').reverse().join('/')}
                </p>
                <p className="text-[10px] text-gray-400">
                  {t.turno} &middot; {t.abertura || '-'} - {t.fechado ? t.fechamento || '-' : 'Aberto'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                  {formatCurrency(t.apurado)}
                </p>
                {t.fechado && t.diferenca !== 0 && (
                  <p className={cn(
                    'text-[10px] tabular-nums',
                    t.diferenca > 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {t.diferenca > 0 ? '+' : ''}{formatCurrency(t.diferenca)}
                  </p>
                )}
              </div>
            </div>
          ))}
          {(computed?.turnos ?? []).length === 0 && (
            <div className="flex h-32 items-center justify-center text-sm text-gray-400">Sem turnos no período.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MeuCaixa

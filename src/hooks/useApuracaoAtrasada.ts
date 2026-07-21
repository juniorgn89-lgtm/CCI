import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useTenantStore } from '@/store/tenant'
import { useFilterStore } from '@/store/filters'
import { splitPeriodAtToday, enumerateDays } from '@/api/supabase/apuracao'

export interface ApuracaoAtraso {
  /** Há dias FECHADOS no período aplicado que a apuração ainda não cobriu. */
  atrasada: boolean
  /** Quantos dias fechados do período estão sem apuração. */
  faltando: number
  /** Último dia apurado (yyyy-MM-dd) até o fim do período. null = nenhum. */
  ultimoApurado: string | null
  /** Último dia fechado do período (o que DEVERIA estar apurado). */
  fechadoAte: string | null
}

/**
 * Detecta se a apuração está ATRASADA para o período aplicado no filtro global.
 *
 * A barra de data promete "dados até dia X", mas os módulos consomem o cache
 * (apuracao_diaria); se a apuração automática parou, os dias fechados recentes
 * NÃO estão no cache e o usuário vê número incompleto achando que é completo.
 * Aqui comparamos o último dia apurado da rede com o último dia FECHADO do
 * período — se ficou pra trás, sinalizamos (a UI avisa em vez de enganar).
 *
 * Só olha dias FECHADOS (o dia corrente é sempre live, nunca "apurável").
 */
const useApuracaoAtrasada = (): ApuracaoAtraso => {
  const rede = useTenantStore((s) => s.rede)
  const dataInicial = useFilterStore((s) => s.dataInicial)
  const dataFinal = useFilterStore((s) => s.dataFinal)

  const split = useMemo(() => splitPeriodAtToday(dataInicial, dataFinal), [dataInicial, dataFinal])
  const closedIni = split.closedDays?.dataInicial ?? ''
  const closedEnd = split.closedDays?.dataFinal ?? ''

  // Último dia apurado (<= fim fechado do período) da rede. Query mínima (1 row).
  const { data: ultimoApurado = null } = useQuery({
    queryKey: ['apuracao-ultimo-dia', rede?.id, closedEnd],
    queryFn: async () => {
      if (!supabase || !rede) return null
      const { data, error } = await supabase
        .from('apuracao_diaria')
        .select('data')
        .eq('rede_id', rede.id)
        .lte('data', closedEnd)
        .order('data', { ascending: false })
        .limit(1)
      if (error) return null
      return (data?.[0] as { data: string } | undefined)?.data ?? null
    },
    enabled: !!rede && !!closedEnd,
    staleTime: 60 * 1000,
  })

  return useMemo(() => {
    if (!split.closedDays || !closedEnd) {
      return { atrasada: false, faltando: 0, ultimoApurado, fechadoAte: null }
    }
    const dias = enumerateDays(closedIni, closedEnd)
    const faltando = ultimoApurado ? dias.filter((d) => d > ultimoApurado).length : dias.length
    return { atrasada: faltando > 0, faltando, ultimoApurado, fechadoAte: closedEnd }
  }, [split.closedDays, closedIni, closedEnd, ultimoApurado])
}

export default useApuracaoAtrasada

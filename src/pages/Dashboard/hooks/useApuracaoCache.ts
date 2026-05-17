import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant'
import {
  fetchApuracaoDiaria,
  splitPeriodAtToday,
  enumerateDays,
  type ApuracaoDiariaRow,
  type PeriodSplit,
} from '@/api/supabase/apuracao'

interface UseApuracaoCacheInput {
  /** Lista de empresas que o user PODE ver (depois de useEmpresasPermitidas). */
  empresasPermitidas: number[]
  /** Filtro global de empresa — se !== [] significa "ver 1 posto"; cache só aplica em Central view. */
  empresaCodigosFiltro: number[]
  dataInicial: string
  dataFinal: string
}

export interface UseApuracaoCacheResult {
  /** Período tem dias fechados E é Central view (cache faz sentido). */
  isEligible: boolean
  /** Query do Supabase ainda rolando. */
  isChecking: boolean
  /**
   * Cache cobre TODOS os dias fechados do período? Quando true, a query live
   * de [closedDays] é dispensada — só hoje (se aplicável) precisa ir na API.
   */
  isCacheHit: boolean
  /** Rows lidas do Supabase (só dias fechados). Vazio se inelegível ou ainda carregando. */
  rows: ApuracaoDiariaRow[]
  /** Split do período entre dias fechados (cacheáveis) e hoje (sempre live). */
  split: PeriodSplit
  /** Útil pra debug. */
  expectedCount: number
  actualCount: number
}

/**
 * Cache da apuração diária — versão v2 que cobre tanto meses fechados quanto
 * dias fechados do mês corrente.
 *
 * O período do filtro é dividido em duas faixas:
 *  - closedDays: dias < hoje → vão pro Supabase. Imutáveis em prática.
 *  - todayPart : hoje (se está no período) → sempre live na API Quality.
 *
 * Critérios de elegibilidade:
 *  - Sem filtro de empresa específica (Central view, não tela de 1 posto)
 *  - User tem rede ativa
 *  - Lista de empresas permitidas não vazia
 *  - Período tem pelo menos 1 dia fechado (closedDays != null)
 *
 * Detecção de HIT: contagem(rows do Supabase) >= empresas × dias_fechados.
 * As 0-rows escritas pelo upsert garantem cobertura — count menor indica que
 * pelo menos um dia da faixa fechada ainda não foi apurado.
 */
const useApuracaoCache = (input: UseApuracaoCacheInput): UseApuracaoCacheResult => {
  const rede = useTenantStore((s) => s.rede)
  const { dataInicial, dataFinal, empresasPermitidas, empresaCodigosFiltro } = input

  const isCentralView = empresaCodigosFiltro.length === 0
  const split = useMemo(
    () => splitPeriodAtToday(dataInicial, dataFinal),
    [dataInicial, dataFinal]
  )

  const isEligible =
    !!rede &&
    isCentralView &&
    !!split.closedDays &&
    empresasPermitidas.length > 0

  const empresaKey = empresasPermitidas.slice().sort((a, b) => a - b).join(',')

  // Query do cache cobre apenas a faixa de dias fechados.
  const closedIni = split.closedDays?.dataInicial ?? ''
  const closedEnd = split.closedDays?.dataFinal ?? ''

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['apuracao-cache', rede?.id, closedIni, closedEnd, empresaKey],
    queryFn: () =>
      fetchApuracaoDiaria({
        empresaCodigos: empresasPermitidas,
        dataInicial: closedIni,
        dataFinal: closedEnd,
      }),
    enabled: isEligible,
    staleTime: 5 * 60 * 1000,
  })

  const expectedCount = useMemo(() => {
    if (!isEligible || !split.closedDays) return 0
    return (
      empresasPermitidas.length *
      enumerateDays(split.closedDays.dataInicial, split.closedDays.dataFinal).length
    )
  }, [isEligible, split.closedDays, empresasPermitidas.length])

  const isCacheHit = isEligible && !isLoading && rows.length >= expectedCount && expectedCount > 0

  return {
    isEligible,
    isChecking: isEligible && isLoading,
    isCacheHit,
    rows,
    split,
    expectedCount,
    actualCount: rows.length,
  }
}

export default useApuracaoCache

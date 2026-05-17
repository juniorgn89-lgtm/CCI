import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant'
import {
  fetchApuracaoDiaria,
  isFechadoMonth,
  enumerateDays,
  type ApuracaoDiariaRow,
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
  /** Cache faz sentido nesse cenário? (mês fechado + Central view + tenant + lista de empresas) */
  isEligible: boolean
  /** Query do Supabase ainda rolando. */
  isChecking: boolean
  /** Há cobertura completa (empresas × dias) no cache. */
  isCacheHit: boolean
  /** Rows lidas (vazio se ainda tá carregando ou inelegível). */
  rows: ApuracaoDiariaRow[]
  /** Útil pra debug: quantas rows tem vs quantas esperadas. */
  expectedCount: number
  actualCount: number
}

/**
 * Tenta servir a Central da Rede a partir do cache em Supabase.
 *
 * Critérios de elegibilidade (v1):
 *  - Período é exatamente um mês fechado (01..último dia, anterior ao mês corrente)
 *  - Sem filtro de empresa específica (Central view, não tela de 1 posto)
 *  - User tem rede ativa
 *  - Lista de empresas permitidas não está vazia
 *
 * Detecção de HIT: contagem(rows) >= empresas × dias. As 0-rows escritas pelo
 * upsert (veja computeApuracaoRows) garantem cobertura, então um count menor
 * indica que aquele mês nunca foi apurado ainda.
 */
const useApuracaoCache = (input: UseApuracaoCacheInput): UseApuracaoCacheResult => {
  const rede = useTenantStore((s) => s.rede)
  const { dataInicial, dataFinal, empresasPermitidas, empresaCodigosFiltro } = input

  const isCentralView = empresaCodigosFiltro.length === 0
  const fechado = useMemo(
    () => isFechadoMonth(dataInicial, dataFinal),
    [dataInicial, dataFinal]
  )

  const isEligible =
    !!rede &&
    isCentralView &&
    fechado &&
    empresasPermitidas.length > 0

  const empresaKey = empresasPermitidas.slice().sort((a, b) => a - b).join(',')

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['apuracao-cache', rede?.id, dataInicial, dataFinal, empresaKey],
    queryFn: () =>
      fetchApuracaoDiaria({
        empresaCodigos: empresasPermitidas,
        dataInicial,
        dataFinal,
      }),
    enabled: isEligible,
    // Cache lê do Supabase — uma vez carregado, não precisa refazer no mesmo session.
    staleTime: 5 * 60 * 1000,
  })

  const expectedCount = useMemo(() => {
    if (!isEligible) return 0
    return empresasPermitidas.length * enumerateDays(dataInicial, dataFinal).length
  }, [isEligible, empresasPermitidas.length, dataInicial, dataFinal])

  const isCacheHit = isEligible && !isLoading && rows.length >= expectedCount && expectedCount > 0

  return {
    isEligible,
    isChecking: isEligible && isLoading,
    isCacheHit,
    rows,
    expectedCount,
    actualCount: rows.length,
  }
}

export default useApuracaoCache

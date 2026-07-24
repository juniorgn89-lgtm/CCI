import { useMemo } from 'react'
import { useFilterStore } from '@/store/filters'
import { useRedeSetorDiaria } from './useRedeVendasCache'

export interface PostoFuelAgg {
  litros: number
  faturamento: number
}

/**
 * Litros + faturamento de COMBUSTÍVEL por posto no período, rede-wide, a partir
 * do cache leve `apuracao_vendas_setor_diaria` (1–3 páginas). Usado no badge das
 * pílulas de posto (Bombas/Reabastecimento) E na Visão Geral da Operação — a
 * chave é rede-wide, então trocar de posto NÃO refaz fetch (React Query dedup).
 * `hasCache=false` = período sem apuração (front trata como "—", nunca inventa).
 */
const usePostosLitros = () => {
  const dataInicial = useFilterStore((s) => s.dataInicial)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const { data, isLoading } = useRedeSetorDiaria(dataInicial, dataFinal)

  const byPosto = useMemo(() => {
    const m = new Map<number, PostoFuelAgg>()
    for (const r of data ?? []) {
      if (r.setor !== 'combustivel') continue
      const cur = m.get(r.empresa_codigo) ?? { litros: 0, faturamento: 0 }
      cur.litros += r.quantidade
      cur.faturamento += r.total_venda
      m.set(r.empresa_codigo, cur)
    }
    return m
  }, [data])

  return { byPosto, isLoading, hasCache: (data?.length ?? 0) > 0 }
}

export default usePostosLitros

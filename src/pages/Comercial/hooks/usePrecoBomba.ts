import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant'
import { fetchPrecoBombaAtual } from '@/api/supabase/concorrencia'

/**
 * Preço de BOMBA atual (o de tabela que está valendo) por posto × produto.
 * Mesma fonte para a régua, a Concorrência e a análise do posto, para o "seu
 * preço" ser o mesmo número em todas as telas. `null` = sem preço de tabela
 * nos últimos 10 dias (a tela cai na média vendida e diz isso).
 */
const usePrecoBomba = () => {
  const redeId = useTenantStore((s) => s.rede?.id ?? null)
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['preco-bomba-atual', redeId],
    queryFn: () => fetchPrecoBombaAtual(redeId!),
    enabled: !!redeId,
    staleTime: 5 * 60 * 1000,
  })
  return useMemo(() => {
    const m = new Map<string, { preco: number; data: string }>()
    for (const r of rows) m.set(`${r.empresa_codigo}|${r.codigo_produto}`, { preco: r.preco, data: r.data_fiscal })
    return {
      isLoading,
      get: (empresaCodigo: number, produtoCodigo: number) => m.get(`${empresaCodigo}|${produtoCodigo}`) ?? null,
    }
  }, [rows, isLoading])
}

export default usePrecoBomba

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { fetchVendaCodigosAutorizados } from '@/api/endpoints/vendas'

/** Ref estável p/ default (evita novo Set por render). */
const EMPTY: Set<number> = new Set()

/**
 * Set de `vendaCodigo` AUTORIZADOS (`/VENDA` com `situacao='A'`) no período,
 * unindo todas as empresas passadas.
 *
 * O `/VENDA_ITEM` NÃO retorna o flag `cancelada`, então pra excluir cancelados
 * corretamente (e descartar itens órfãos) cruzamos `venda_item.vendaCodigo` com
 * este set e mantemos só os itens cuja venda está autorizada. Ver
 * project_venda_item_sem_cancelada.
 */
export const useVendaCodigosAutorizados = (
  empresaCodigos: number[],
  dataInicial: string,
  dataFinal: string,
  enabled = true,
): { autorizados: Set<number>; isLoading: boolean } => {
  const { data = EMPTY, isLoading } = useQuery({
    queryKey: ['venda-autorizados', empresaCodigos.join(','), dataInicial, dataFinal],
    queryFn: async () => {
      const sets = await Promise.all(
        empresaCodigos.map((emp) =>
          fetchVendaCodigosAutorizados({ empresaCodigo: emp, dataInicial, dataFinal }),
        ),
      )
      const all = new Set<number>()
      for (const s of sets) for (const c of s) all.add(c)
      return all
    },
    enabled: enabled && empresaCodigos.length > 0 && !!dataInicial && !!dataFinal,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
  return { autorizados: data, isLoading }
}

export default useVendaCodigosAutorizados

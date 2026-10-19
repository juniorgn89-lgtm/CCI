import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchProdutos, fetchGrupos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'

export type SetorEstoque = 'combustivel' | 'automotivos' | 'conveniencia'

export const SETOR_ESTOQUE_LABEL: Record<SetorEstoque, string> = { combustivel: 'Combustíveis', automotivos: 'Automotivos', conveniencia: 'Conveniência' }

/**
 * Setor de cada produto, pela mesma regra do Compras: combustível = tipo C;
 * grupo do tipo "Pista" = automotivos; o resto = conveniência.
 * Usa o mesmo cache de ['produtos'] e ['grupos'] do resto do app.
 */
const useSetorProduto = () => {
  const produtos = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages((p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })
  const grupos = useQuery({
    queryKey: ['grupos'],
    queryFn: () => fetchAllPages((p) => fetchGrupos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 100),
    staleTime: 30 * 60 * 1000,
  })
  const setorDe = useMemo(() => {
    const m = new Map<number, SetorEstoque>()
    const grupoTipo = new Map((grupos.data ?? []).map((g) => [g.grupoCodigo, g.tipoGrupo]))
    for (const p of produtos.data ?? []) {
      if (p.tipoProduto === 'C' || p.combustivel) m.set(p.produtoCodigo, 'combustivel')
      else if ((grupoTipo.get(p.grupoCodigo) ?? '') === 'Pista') m.set(p.produtoCodigo, 'automotivos')
      else m.set(p.produtoCodigo, 'conveniencia')
    }
    return (codigo: number): SetorEstoque => m.get(codigo) ?? 'conveniencia'
  }, [produtos.data, grupos.data])
  return { setorDe, carregando: produtos.isLoading || grupos.isLoading }
}

export default useSetorProduto

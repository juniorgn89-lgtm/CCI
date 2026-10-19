import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPedidos, fetchTetos, fetchFornecedores, type PedidoRow } from '@/api/supabase/compras'
import { mesAtualYm, ymDe } from '@/pages/Compras/comum'

/** Pedidos, tetos e fornecedores da rede, com a invalidação num lugar só. */
export const usePedidos = (redeId: string | null) => {
  const qc = useQueryClient()
  const pedidos = useQuery({ queryKey: ['compras-pedidos', redeId], queryFn: () => fetchPedidos(redeId!), enabled: !!redeId, staleTime: 30_000, refetchOnWindowFocus: true })
  const tetos = useQuery({ queryKey: ['compras-tetos', redeId], queryFn: () => fetchTetos(redeId!), enabled: !!redeId, staleTime: 5 * 60_000 })
  const fornecedores = useQuery({ queryKey: ['compras-fornecedores', redeId], queryFn: () => fetchFornecedores(redeId!), enabled: !!redeId, staleTime: 5 * 60_000 })
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['compras-pedidos', redeId] })
    qc.invalidateQueries({ queryKey: ['compras-tetos', redeId] })
    qc.invalidateQueries({ queryKey: ['compras-fornecedores', redeId] })
    qc.invalidateQueries({ queryKey: ['compras-itens'] })
    qc.invalidateQueries({ queryKey: ['compras-eventos'] })
  }
  return { pedidos: pedidos.data ?? [], tetos: tetos.data ?? [], fornecedores: fornecedores.data ?? [], carregando: pedidos.isLoading, erro: pedidos.error as Error | null, invalidar }
}

/** Quanto já foi LIBERADO no mês corrente num posto × setor (base do teto). */
export const liberadoNoMes = (pedidos: PedidoRow[], empresaCodigo: number, setor: string, excetoId?: string) => {
  const ym = mesAtualYm()
  return pedidos
    .filter((p) => p.empresa_codigo === empresaCodigo && p.setor === setor && p.id !== excetoId && (p.status === 'liberado' || p.status === 'liberado_parcial' || p.status === 'recebido') && p.liberado_em && ymDe(p.liberado_em) === ym)
    .reduce((s, p) => s + (p.total_liberado ?? p.total_solicitado), 0)
}

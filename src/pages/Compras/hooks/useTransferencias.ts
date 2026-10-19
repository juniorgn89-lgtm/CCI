import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTransferencias, fetchTransfItensDaRede, type TransfItemRow } from '@/api/supabase/compras'

export const useTransferencias = (redeId: string | null) => {
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['compras-transferencias', redeId], queryFn: () => fetchTransferencias(redeId!), enabled: !!redeId, staleTime: 30_000, refetchOnWindowFocus: true })
  const itensQ = useQuery({ queryKey: ['compras-transf-itens', 'rede', redeId], queryFn: () => fetchTransfItensDaRede(redeId!), enabled: !!redeId, staleTime: 30_000 })
  const itensPor = new Map<string, TransfItemRow[]>()
  for (const i of itensQ.data ?? []) { const l = itensPor.get(i.transferencia_id) ?? []; l.push(i); itensPor.set(i.transferencia_id, l) }
  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['compras-transferencias', redeId] })
    qc.invalidateQueries({ queryKey: ['compras-transf-itens'] })
    qc.invalidateQueries({ queryKey: ['compras-transf-eventos'] })
  }
  return { transferencias: q.data ?? [], itensPor, carregando: q.isLoading, erro: q.error as Error | null, invalidar }
}

import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { useTenantStore } from '@/store/tenant'
import { useAuthStore } from '@/store/auth'
import {
  fetchQualidadeArquivados,
  arquivarLancamentos as arquivarFn,
  reabrirArquivado as reabrirFn,
  type ArquivadoRow,
  type ArquivarInput,
} from '@/api/supabase/qualidadeArquivados'

/**
 * Hook que centraliza o estado de arquivamento da Qualidade de Dados.
 *
 * - `arquivados`: lista bruta (inclui restaurados — usado pela aba "Arquivados")
 * - `ativos`: subconjunto não-restaurado (usado pra filtrar issues vivos)
 * - `keysAtivas`: Set de chaves "tipo:codigo" pra lookup O(1)
 * - `arquivar(items)`: bulk archive + invalidação da query
 * - `reabrir(id)`: soft-restore + invalidação
 *
 * Sem useMutation — manda direto via async function (regra do projeto).
 */

const keyOf = (tipo: string, codigo: string) => `${tipo}:${codigo}`

export interface UseQualidadeArquivadosResult {
  arquivados: ArquivadoRow[]
  ativos: ArquivadoRow[]
  /** Set de "tipo:codigo" das entradas ativas (não-restauradas). */
  keysAtivas: Set<string>
  isLoading: boolean
  arquivar: (items: ArquivarInput[]) => Promise<{ arquivados: number; erros: number }>
  reabrir: (arquivadoId: string) => Promise<void>
  /** True se tem tudo configurado pra arquivar (rede + empresa + user logado). */
  canArchive: boolean
}

const useQualidadeArquivados = (): UseQualidadeArquivadosResult => {
  const { empresaCodigos } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const rede = useTenantStore((s) => s.rede)
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const canArchive = !!rede && empresaCodigo !== null && !!user

  const queryKey = useMemo(() => ['qualidade-arquivados', rede?.id, empresaCodigo], [rede?.id, empresaCodigo])

  const { data: arquivados = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchQualidadeArquivados(rede!.id, empresaCodigo!),
    enabled: canArchive,
    staleTime: 60_000,
  })

  const ativos = useMemo(
    () => arquivados.filter((a) => a.restaurado_em === null),
    [arquivados],
  )

  const keysAtivas = useMemo(
    () => new Set(ativos.map((a) => keyOf(a.tipo_issue, a.registro_codigo))),
    [ativos],
  )

  const arquivar = useCallback(
    async (items: ArquivarInput[]) => {
      if (!canArchive) return { arquivados: 0, erros: 0 }
      const ctx = {
        redeId: rede!.id,
        empresaCodigo: empresaCodigo!,
        userId: user!.id,
        userNome: user!.email ?? 'desconhecido',
      }
      const result = await arquivarFn(items, ctx)
      // Invalida pra recarregar e refletir nas tabelas
      queryClient.invalidateQueries({ queryKey })
      return result
    },
    [canArchive, rede, empresaCodigo, user, queryClient, queryKey],
  )

  const reabrir = useCallback(
    async (arquivadoId: string) => {
      if (!user) return
      await reabrirFn(arquivadoId, { userId: user.id, userNome: user.email ?? 'desconhecido' })
      queryClient.invalidateQueries({ queryKey })
    },
    [user, queryClient, queryKey],
  )

  return { arquivados, ativos, keysAtivas, isLoading, arquivar, reabrir, canArchive }
}

export default useQualidadeArquivados
export { keyOf }

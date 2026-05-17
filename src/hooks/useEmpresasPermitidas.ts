import { useMemo } from 'react'
import { useAuthStore } from '@/store/auth'

/**
 * Filtra uma lista de empresas pelos `empresa_codigos` permitidos do user logado.
 *
 * - Sem restrição (null/vazio no profile) → retorna a lista original
 * - Com restrição → retorna só as empresas cujo `codigo` está na whitelist
 *
 * Funciona com qualquer formato de empresa que tenha um campo `codigo` numérico
 * (Empresa do tipo do Quality já tem). Genérico via constraint do TS.
 */
export const useEmpresasPermitidas = <T extends { codigo: number }>(empresas: T[]): T[] => {
  const empresaCodigos = useAuthStore((s) => s.empresaCodigos)
  return useMemo(() => {
    if (!empresaCodigos || empresaCodigos.length === 0) return empresas
    const set = new Set(empresaCodigos)
    return empresas.filter((e) => set.has(e.codigo))
  }, [empresas, empresaCodigos])
}

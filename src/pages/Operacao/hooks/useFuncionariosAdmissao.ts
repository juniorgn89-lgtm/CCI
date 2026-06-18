import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'

export interface FuncionarioAdmissao {
  funcionarioCodigo: number
  nome: string
  /** yyyy-MM-dd (ou '' quando a rede não preenche). */
  dataAdmissao: string
  ativo: boolean
}

/**
 * Data de admissão por funcionário — base do "novato" em Destaques. Reusa a
 * MESMA queryKey de funcionários do useOperacaoData (React Query deduplica, sem
 * fetch extra). Retorna um mapa funcionarioCodigo → admissão.
 */
const useFuncionariosAdmissao = () => {
  const { empresaCodigos } = useFilterStore()
  const empresaCodigo = empresaCodigos[0] ?? null
  const hasEmpresa = empresaCodigos.length > 0

  const { data, isLoading } = useQuery({
    queryKey: ['funcionarios', empresaCodigo],
    queryFn: () => fetchFuncionarios({ empresaCodigo: empresaCodigo!, limite: 1000 }),
    enabled: hasEmpresa && empresaCodigo !== null,
    staleTime: 30 * 60 * 1000,
  })

  const admissaoMap = useMemo(() => {
    const map = new Map<number, FuncionarioAdmissao>()
    for (const f of data?.resultados ?? []) {
      map.set(f.funcionarioCodigo, {
        funcionarioCodigo: f.funcionarioCodigo,
        nome: f.nome,
        dataAdmissao: (f.dataAdmissao ?? '').slice(0, 10),
        ativo: f.ativo,
      })
    }
    return map
  }, [data])

  /** True quando ao menos um funcionário tem data de admissão preenchida. */
  const hasAdmissaoData = useMemo(
    () => Array.from(admissaoMap.values()).some((f) => f.dataAdmissao !== ''),
    [admissaoMap],
  )

  return { admissaoMap, hasAdmissaoData, isLoading }
}

export default useFuncionariosAdmissao

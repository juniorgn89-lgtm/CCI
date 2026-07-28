import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchPlanoContaGerencial } from '@/api/endpoints/financeiro'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'

/**
 * Mapa `planoContaGerencialCodigo → descrição` do cadastro (/PLANO_CONTA_GERENCIAL).
 * Usado pra resolver o NOME do plano de contas — essencial no Contas a Receber,
 * cujo título só traz o código (o A Pagar já traz a descrição, mas resolvemos
 * pelos dois pela MESMA fonte pra os rótulos do filtro baterem). Cadastro leve
 * (~276 linhas), cache longo.
 */
const usePlanoContasMap = (): Map<number, string> => {
  const { data = [] } = useQuery({
    queryKey: ['planoContaGerencial'],
    queryFn: () =>
      fetchAllPages((p) => fetchPlanoContaGerencial({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 5),
    staleTime: 30 * 60 * 1000,
  })

  return useMemo(() => {
    const m = new Map<number, string>()
    for (const pc of data) {
      const nome = (pc.descricao ?? '').trim()
      if (pc.codigo && nome) m.set(pc.codigo, nome)
    }
    return m
  }, [data])
}

export default usePlanoContasMap

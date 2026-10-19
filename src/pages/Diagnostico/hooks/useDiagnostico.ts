import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchVendasProdutoMensal } from '@/api/supabase/apuracao'
import { todayLocal } from '@/lib/period'
import { calcularDiagnostico, janelaMesAnterior, janelas, type Achado, type Diagnostico, type ModoJanela, type PeriodoCustom, type Sujeito } from '@/pages/Diagnostico/lib/diagnostico'
import { compararPostos, type PostoAPosto } from '@/pages/Diagnostico/lib/postos'

/**
 * Dados do Diagnóstico: a view mensal por produto dos postos pedidos (um posto
 * ou a rede inteira) e o cálculo puro em cima. Só cache apurado — nada ao vivo.
 *
 * - `empresaCodigos`: um código (posto) ou todos os permitidos (rede).
 * - modo "mes": além do mês contra o mesmo mês do ano anterior, calcula a
 *   leitura contra o mês imediatamente anterior (`mesAnterior`).
 * - sujeito "rede": calcula também o posto a posto (`postos`).
 */
const useDiagnostico = (
  empresaCodigos: number[] | null,
  modo: ModoJanela,
  custom: PeriodoCustom | undefined,
  mes: string | null,
  sujeito: Sujeito,
  nomeDe: (codigo: number) => string,
  /** Marco do "antes e depois da CCI" (yyyy-MM-dd); só usado no modo 'cci'. */
  marco: string | null = null,
) => {
  const hoje = todayLocal()
  const { a, b } = useMemo(() => janelas(hoje, modo, custom, mes, marco), [hoje, modo, custom, mes, marco])
  const bAnt = useMemo(() => (modo === 'mes' ? janelaMesAnterior(a) : null), [modo, a])

  // No modo personalizado o comparativo pode vir DEPOIS do atual: lê do menor ao maior mês.
  const mesIni = [a.ini, b.ini, bAnt?.ini].filter((x): x is string => !!x).sort()[0]
  const mesFim = [a.fim, b.fim].sort().reverse()[0]
  const chave = (empresaCodigos ?? []).join(',')

  const q = useQuery({
    queryKey: ['diagnostico-mensal', chave, mesIni, mesFim],
    enabled: !!empresaCodigos && empresaCodigos.length > 0,
    staleTime: 10 * 60 * 1000,
    // Rede: um pedido por posto, em paralelo. A view agrega por (rede, empresa) e
    // a paginação do PostgREST refaz o agregado a cada página: com o filtro de
    // empresa cada página sai do índice do posto (~0,4 s); sem ele, a rede
    // inteira (dezenas de milhares de linhas) era recalculada 60+ vezes.
    queryFn: async () => {
      const partes = await Promise.all(empresaCodigos!.map((c) => fetchVendasProdutoMensal({ empresaCodigos: [c], mesInicial: mesIni, mesFinal: mesFim })))
      return partes.flat()
    },
  })

  const diagnostico: Diagnostico | null = useMemo(
    () => (q.data ? calcularDiagnostico(q.data, a, b, sujeito) : null),
    [q.data, a, b, sujeito],
  )
  const mesAnterior: Diagnostico | null = useMemo(
    () => (q.data && bAnt ? calcularDiagnostico(q.data, a, bAnt, sujeito) : null),
    [q.data, a, bAnt, sujeito],
  )
  const postos: PostoAPosto | null = useMemo(
    () => (q.data && sujeito === 'rede' ? compararPostos(q.data, a, b, nomeDe, empresaCodigos ?? []) : null),
    [q.data, a, b, sujeito, nomeDe, empresaCodigos],
  )

  // Rede: a mesma conta posto a posto, pra dizer em QUAIS postos cada achado aparece.
  const achadosPorPosto = useMemo(() => {
    if (!q.data || sujeito !== 'rede') return null
    const m = new Map<number, Achado[]>()
    for (const c of empresaCodigos ?? []) {
      const linhas = q.data.filter((r) => r.empresa_codigo === c)
      if (linhas.length) m.set(c, calcularDiagnostico(linhas, a, b, 'posto').achados)
    }
    return m
  }, [q.data, a, b, sujeito, empresaCodigos])

  return { ...q, diagnostico, mesAnterior, postos, achadosPorPosto, a, b }
}

export default useDiagnostico

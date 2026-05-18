import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTanques } from '@/api/endpoints/combustiveis'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchProdutos } from '@/api/endpoints/produtos'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'

export type ReabastNivel = 'critico' | 'alerta' | 'ok'

export interface ReabastTanque {
  empresaCodigo: number
  empresaNome: string
  tanqueCodigo: number
  tanqueNome: string
  produtoCodigo: number
  produtoNome: string
  capacidade: number
  estoqueAtual: number
  nivelPct: number
  nivel: ReabastNivel
}

const CRITICO_THRESHOLD = 20 // < 20% → crítico
const ALERTA_THRESHOLD = 30 // < 30% → alerta

interface UseReabastecimentoOptions {
  /** Quando informado, fetcha tanques só dessa empresa (single-posto view). */
  empresaCodigo?: number | null
}

/**
 * Calcula o nível de cada tanque (capacidade vs estoque escritural) e
 * destaca os que estão abaixo do limite pra alertar o gerente sobre
 * reabastecimento.
 *
 *  - Sem `empresaCodigo`: agrega tanques de todas as empresas permitidas
 *    (uso na Central da Rede).
 *  - Com `empresaCodigo`: fetcha só dessa empresa (uso no ResumoOperacao).
 */
const useReabastecimento = (options: UseReabastecimentoOptions = {}) => {
  const { empresaCodigo } = options

  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 30 * 60 * 1000,
  })
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const empresaMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const e of empresasPermitidas) {
      m.set(e.codigo, e.fantasia || e.razao || `Empresa ${e.codigo}`)
    }
    return m
  }, [empresasPermitidas])

  // Produtos pra resolver nome do combustível
  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => fetchAllPages(
      (p) => fetchProdutos({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
      1000, 100
    ),
    staleTime: 30 * 60 * 1000,
  })
  const produtoMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const p of produtos) {
      m.set(p.produtoCodigo, p.nome)
      if (p.produtoLmcCodigo) m.set(p.produtoLmcCodigo, p.nome)
      if (p.codigo) m.set(p.codigo, p.nome)
    }
    return m
  }, [produtos])

  // Tanques: 1 fetch por empresa em paralelo (endpoint exige empresaCodigo).
  // Quando empresaCodigo é informado E está nas permitidas, fetcha só dela.
  const allowedEmpresasCodes = useMemo(
    () => empresasPermitidas.map((e) => e.codigo),
    [empresasPermitidas]
  )
  const empresasCodes = useMemo(() => {
    if (empresaCodigo != null && allowedEmpresasCodes.includes(empresaCodigo)) {
      return [empresaCodigo]
    }
    return allowedEmpresasCodes.slice().sort((a, b) => a - b)
  }, [empresaCodigo, allowedEmpresasCodes])
  const { data: tanquesAll = [], isLoading } = useQuery({
    queryKey: ['tanques-reabast', empresasCodes.join(',')],
    queryFn: async () => {
      if (empresasCodes.length === 0) return []
      const results = await Promise.all(
        empresasCodes.map((ec) =>
          fetchTanques({ empresaCodigo: ec, limite: 200 }).then((r) => r.resultados ?? [])
        )
      )
      return results.flat()
    },
    enabled: empresasCodes.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  const tanques: ReabastTanque[] = useMemo(() => {
    return tanquesAll
      .map((t) => {
        const capacidade = Number(t.capacidade) || 0
        const estoqueAtual = Number(t.estoqueEscritural) || 0
        const nivelPct = capacidade > 0 ? (estoqueAtual / capacidade) * 100 : 0
        const nivel: ReabastNivel =
          nivelPct < CRITICO_THRESHOLD ? 'critico' :
          nivelPct < ALERTA_THRESHOLD ? 'alerta' : 'ok'
        return {
          empresaCodigo: t.empresaCodigo,
          empresaNome: empresaMap.get(t.empresaCodigo) ?? `Empresa ${t.empresaCodigo}`,
          tanqueCodigo: t.tanqueCodigo,
          tanqueNome: t.name || `Tanque ${t.tanqueCodigo}`,
          produtoCodigo: t.produtoCodigo,
          produtoNome: produtoMap.get(t.produtoCodigo) ?? `Produto ${t.produtoCodigo}`,
          capacidade,
          estoqueAtual,
          nivelPct,
          nivel,
        }
      })
      // Ordena crítico → alerta → ok; dentro de cada nível, menor % primeiro.
      .sort((a, b) => {
        const order: Record<ReabastNivel, number> = { critico: 0, alerta: 1, ok: 2 }
        if (order[a.nivel] !== order[b.nivel]) return order[a.nivel] - order[b.nivel]
        return a.nivelPct - b.nivelPct
      })
  }, [tanquesAll, empresaMap, produtoMap])

  const baixos = useMemo(() => tanques.filter((t) => t.nivel !== 'ok'), [tanques])
  const criticos = useMemo(() => tanques.filter((t) => t.nivel === 'critico'), [tanques])

  return {
    tanques,
    baixos,
    criticos,
    isLoading,
    /** Há pelo menos 1 tanque baixo? — usado pra decidir se renderiza o card. */
    hasAlertas: baixos.length > 0,
  }
}

export default useReabastecimento

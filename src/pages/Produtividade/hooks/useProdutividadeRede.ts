import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTenantStore } from '@/store/tenant'
import { useFilterStore } from '@/store/filters'
import { fetchVendasFuncionarioCache } from '@/api/supabase/apuracao'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import type { PostoOption } from '@/components/filters/PostoLocalSelect'

export interface FrentistaProd {
  codigo: number
  nome: string
  litros: number
  abastecimentos: number
  faturamento: number
}

export interface PostoProd {
  litros: number
  abastecimentos: number
  faturamento: number
  /** Frentistas DISTINTOS com venda de combustível no período. */
  frentistas: number
  /** Litros ÷ frentistas — a métrica-mãe da produtividade da pista. */
  litrosPorFrentista: number
}

/**
 * Produtividade da PISTA rede-wide, por posto, a partir do cache FISCAL
 * `apuracao_vendas_funcionario` (setor='combustivel') — leitura única sem
 * `empresaCodigos` = toda a rede, sem fan-out. A base é o fiscal (`/VENDA`)
 * porque o `/ABASTECIMENTO` físico está indisponível; funciona porque no posto o
 * FRENTISTA registra a venda de combustível (funcionarioCodigo = frentista).
 * Dá litros, "abastecimentos" (cupons de combustível), nº de frentistas e
 * litros/frentista por posto + o ranking de frentistas (drill). Nomes vêm do
 * /FUNCIONARIO. `hasCache=false` = sem apuração de combustível-por-frentista no
 * período (front mostra "—"; some quando a apuração re-rodar com o combustível).
 */
const useProdutividadeRede = (postos: PostoOption[]) => {
  const rede = useTenantStore((s) => s.rede)
  const dataInicial = useFilterStore((s) => s.dataInicial)
  const dataFinal = useFilterStore((s) => s.dataFinal)
  const postoCodes = useMemo(() => postos.map((p) => p.codigo), [postos])

  const { data: rowsRaw = [], isLoading } = useQuery({
    queryKey: ['prod-rede-func', rede?.id, dataInicial, dataFinal],
    queryFn: () => fetchVendasFuncionarioCache({ dataInicial, dataFinal }),
    enabled: !!rede && !!dataInicial && !!dataFinal,
    staleTime: 5 * 60 * 1000,
  })
  const combustivel = useMemo(() => rowsRaw.filter((r) => r.setor === 'combustivel'), [rowsRaw])

  // Nomes dos frentistas (só pro drill). funcionarioCodigo pode repetir entre
  // postos, então a chave é `empresa-funcionario`.
  const { data: funcionarios = [] } = useQuery({
    queryKey: ['prod-rede-funcs', rede?.id, postoCodes.join(',')],
    queryFn: async () => {
      const lists = await Promise.all(postoCodes.map((ec) => fetchFuncionarios({ empresaCodigo: ec, limite: 1000 })))
      return lists.flatMap((l) => l.resultados)
    },
    enabled: !!rede && postoCodes.length > 0,
    staleTime: 10 * 60 * 1000,
  })
  const nomeByFunc = useMemo(() => {
    const m = new Map<string, string>()
    for (const f of funcionarios) m.set(`${f.empresaCodigo}-${f.funcionarioCodigo}`, f.nome)
    return m
  }, [funcionarios])

  const { byPosto, frentistasByPosto } = useMemo(() => {
    const byPosto = new Map<number, PostoProd>()
    const pf = new Map<string, FrentistaProd>() // `empresa-frentista`
    const frentSet = new Map<number, Set<number>>()

    for (const r of combustivel) {
      const emp = r.empresa_codigo
      const qty = r.quantidade || 0
      const val = r.faturamento || 0
      const cup = r.cupons || 0
      const p = byPosto.get(emp) ?? { litros: 0, abastecimentos: 0, faturamento: 0, frentistas: 0, litrosPorFrentista: 0 }
      p.litros += qty; p.abastecimentos += cup; p.faturamento += val
      byPosto.set(emp, p)

      const fc = r.funcionario_codigo
      if (fc != null) {
        const set = frentSet.get(emp) ?? new Set<number>()
        set.add(fc); frentSet.set(emp, set)
        const key = `${emp}-${fc}`
        const fr = pf.get(key) ?? { codigo: fc, nome: '', litros: 0, abastecimentos: 0, faturamento: 0 }
        fr.litros += qty; fr.abastecimentos += cup; fr.faturamento += val
        pf.set(key, fr)
      }
    }

    for (const [emp, p] of byPosto) {
      const n = frentSet.get(emp)?.size ?? 0
      p.frentistas = n
      p.litrosPorFrentista = n > 0 ? p.litros / n : 0
    }

    const frentistasByPosto = new Map<number, FrentistaProd[]>()
    for (const [key, fr] of pf) {
      const emp = Number(key.slice(0, key.indexOf('-')))
      fr.nome = nomeByFunc.get(key) || `Frentista ${fr.codigo}`
      const arr = frentistasByPosto.get(emp) ?? []
      arr.push(fr); frentistasByPosto.set(emp, arr)
    }
    for (const arr of frentistasByPosto.values()) arr.sort((a, b) => b.litros - a.litros)

    return { byPosto, frentistasByPosto }
  }, [combustivel, nomeByFunc])

  return { byPosto, frentistasByPosto, isLoading, hasCache: combustivel.length > 0 }
}

export default useProdutividadeRede

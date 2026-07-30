import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendasFuncionarioCache } from '@/api/supabase/apuracao'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import type { FrentistaProdData, FuncProdRow, Podio } from '@/pages/Produtividade/hooks/useFrentistaProdutividade'

/**
 * Produtividade da REDE direto do cache `apuracao_vendas_funcionario` — UMA leitura
 * rede-wide no lugar do fan-out ao vivo posto a posto. Monta o mesmo
 * `FrentistaProdData` por posto (o `RedeView` consome igual). Só dias APURADOS
 * (o cache não tem "hoje" enquanto não fecha/apura); `hasCache=false` quando não
 * há nada apurado no período → o Resumo cai no fan-out ao vivo (fallback).
 *
 * Automotivos (setor=automotivos: faturamento/cupons) e combustível (setor=
 * combustivel: aditivada_litros/gasolina_litros/cupons/quantidade) — o mix, o
 * ticket e os abastecimentos saem tudo daqui. Sem projeção (dado fechado).
 */
const useRedeProdutividadeCache = (
  empresaCodigos: number[],
): { byPosto: Map<number, FrentistaProdData>; isLoading: boolean; hasCache: boolean } => {
  const { dataInicial, dataFinal } = useFilterStore()
  const hasEmpresa = empresaCodigos.length > 0

  const { data: cacheRows = [], isLoading: lCache } = useQuery({
    queryKey: ['rede-produtividade-cache', empresaCodigos.join(','), dataInicial, dataFinal],
    queryFn: () => fetchVendasFuncionarioCache({ empresaCodigos, dataInicial, dataFinal }),
    enabled: hasEmpresa && !!dataInicial && !!dataFinal,
    staleTime: 5 * 60 * 1000,
  })

  const { data: funcionarios = [], isLoading: lFunc } = useQuery({
    queryKey: ['funcionarios-multi', empresaCodigos.join(',')],
    queryFn: async () => {
      const lists = await Promise.all(empresaCodigos.map((ec) => fetchFuncionarios({ empresaCodigo: ec, limite: 1000 })))
      return lists.flatMap((l) => l.resultados)
    },
    enabled: hasEmpresa,
    staleTime: 10 * 60 * 1000,
  })

  const byPosto = useMemo(() => {
    const meta = new Map(funcionarios.map((f) => [f.funcionarioCodigo, { nome: f.nome, ativo: f.ativo }]))
    // empresa → funcionario → agregado
    const acc = new Map<number, Map<number, { auto: number; cupAuto: number; itens: number; adit: number; gas: number; abast: number; litros: number }>>()
    for (const r of cacheRows) {
      let m = acc.get(r.empresa_codigo)
      if (!m) { m = new Map(); acc.set(r.empresa_codigo, m) }
      const f = m.get(r.funcionario_codigo) ?? { auto: 0, cupAuto: 0, itens: 0, adit: 0, gas: 0, abast: 0, litros: 0 }
      if (r.setor === 'automotivos') {
        f.auto += r.faturamento; f.cupAuto += r.cupons; f.itens += r.quantidade
      } else if (r.setor === 'combustivel') {
        f.adit += r.aditivada_litros ?? 0
        f.gas += r.gasolina_litros ?? 0
        f.abast += r.cupons
        f.litros += r.quantidade
      }
      m.set(r.funcionario_codigo, f)
    }

    const out = new Map<number, FrentistaProdData>()
    for (const [empresa, funcs] of acc) {
      const rows: FuncProdRow[] = [...funcs.entries()].map(([cod, v]) => {
        const info = meta.get(cod)
        return {
          funcionarioCodigo: cod,
          nome: info?.nome ?? `Funcionário ${cod}`,
          ativo: info?.ativo ?? true,
          automotivo: v.auto,
          automotivoTend: v.auto, // dado apurado → sem projeção
          cupons: v.cupAuto,
          ticket: v.cupAuto > 0 ? v.auto / v.cupAuto : 0,
          itens: v.itens,
          aditivadaLitros: v.adit,
          aditivadaTend: v.adit,
          gasolinaLitros: v.gas,
          mixPct: v.gas > 0 ? (v.adit / v.gas) * 100 : 0,
          abastecimentos: v.abast,
          abastTend: v.abast,
          litros: v.litros,
          faturamentoCombustivel: 0,
          combustiveis: [], // quebra por produto não vem do cache (só o detalhe live usa)
        }
      }).sort((a, b) => b.automotivo - a.automotivo || b.aditivadaLitros - a.aditivadaLitros)

      const totAdit = rows.reduce((s, r) => s + r.aditivadaLitros, 0)
      const totGas = rows.reduce((s, r) => s + r.gasolinaLitros, 0)
      const totAuto = rows.reduce((s, r) => s + r.automotivo, 0)
      const totCupons = rows.reduce((s, r) => s + r.cupons, 0)
      const podio = (sel: (r: FuncProdRow) => number): Podio[] =>
        rows.filter((r) => sel(r) > 0).map((r) => ({ funcionarioCodigo: r.funcionarioCodigo, nome: r.nome, valor: sel(r) }))
          .sort((a, b) => b.valor - a.valor).slice(0, 7)

      out.set(empresa, {
        rows,
        kpis: {
          automotivo: totAuto,
          aditivadaLitros: totAdit,
          mixPct: totGas > 0 ? (totAdit / totGas) * 100 : 0,
          abastecimentos: rows.reduce((s, r) => s + r.abastecimentos, 0),
          ticketMedio: totCupons > 0 ? totAuto / totCupons : 0,
        },
        podios: {
          automotivo: podio((r) => r.automotivo),
          aditivada: podio((r) => r.aditivadaLitros),
          atendimentos: podio((r) => r.abastecimentos),
        },
        projFactor: 1,
        isLoading: false,
        hasEmpresa: true,
      })
    }
    return out
  }, [cacheRows, funcionarios])

  return { byPosto, isLoading: hasEmpresa && (lCache || lFunc), hasCache: cacheRows.length > 0 }
}

export default useRedeProdutividadeCache

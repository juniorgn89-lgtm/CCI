import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchVendasFuncionarioCache } from '@/api/supabase/apuracao'
import { fetchFuncionarios, fetchFuncoes } from '@/api/endpoints/funcionarios'
import { todayLocal } from '@/lib/period'
import type { FrentistaProdData, FuncProdRow, Podio } from '@/pages/Produtividade/hooks/useFrentistaProdutividade'

/**
 * Fator de projeção de fim de mês, LINEAR pelo ritmo dos DIAS APURADOS (não do
 * calendário — honra o lag da apuração). Só projeta janela mês-a-data do mês
 * CORRENTE (começa no dia 1, mesmo mês de hoje); qualquer outra janela (mês
 * passado, range custom, multi-mês) devolve 1 = sem projeção. O gate visual
 * (`projFactor <= 3`) fica no componente — cedo demais a extrapolação é ruído.
 */
const monthToDateProjFactor = (
  dataInicial: string | null,
  dataFinal: string | null,
  diasApurados: number,
): number => {
  if (!dataInicial || !dataFinal || diasApurados < 1) return 1
  const [iy, im, id] = dataInicial.split('-').map(Number)
  const [fy, fm] = dataFinal.split('-').map(Number)
  const [ty, tm] = todayLocal().split('-').map(Number)
  if (id !== 1 || iy !== fy || im !== fm || fy !== ty || fm !== tm) return 1
  const daysInMonth = new Date(fy, fm, 0).getDate() // fm 1-based → último dia do mês
  const f = daysInMonth / diasApurados
  return f > 1 ? f : 1
}

/**
 * Produtividade da REDE direto do cache `apuracao_vendas_funcionario` — UMA leitura
 * rede-wide no lugar do fan-out ao vivo posto a posto. Monta o mesmo
 * `FrentistaProdData` por posto (o `RedeView` consome igual). Só dias APURADOS
 * (o cache não tem "hoje" enquanto não fecha/apura); `hasCache=false` quando não
 * há nada apurado no período → o Resumo cai no fan-out ao vivo (fallback).
 *
 * Automotivos (setor=automotivos: faturamento/cupons) e combustível (setor=
 * combustivel: aditivada_litros/gasolina_litros/cupons/quantidade) — o mix, o
 * ticket e os abastecimentos saem tudo daqui. A tendência (`*Tend`) é projeção
 * linear de fim de mês pelo ritmo dos dias APURADOS, só em janela mês-a-data do
 * mês corrente (senão `projFactor=1` = sem projeção).
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

  // Catálogo de cargos (/FUNCOES): funcaoCodigo → nome ("FRENTISTA", "CAIXA."…).
  // Poucas linhas, rede-wide, cacheado longo (o cargo não muda no dia a dia).
  const { data: funcoes = [] } = useQuery({
    queryKey: ['funcoes'],
    queryFn: () => fetchFuncoes({ limite: 1000 }).then((r) => r.resultados ?? []),
    enabled: hasEmpresa,
    staleTime: 30 * 60 * 1000,
  })

  const byPosto = useMemo(() => {
    const funcoesMap = new Map(funcoes.map((f) => [f.funcaoCodigo, f.nome]))
    const meta = new Map(funcionarios.map((f) => [f.funcionarioCodigo, { nome: f.nome, ativo: f.ativo, funcaoCodigo: f.funcaoCodigo }]))
    // Projeção de fim de mês (mês-a-data) pelo ritmo dos DIAS que o cache tem.
    const diasApurados = new Set(cacheRows.map((r) => r.data)).size
    const projFactor = monthToDateProjFactor(dataInicial, dataFinal, diasApurados)
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
          funcao: funcoesMap.get(info?.funcaoCodigo ?? -1) ?? 'Sem cargo',
          automotivo: v.auto,
          automotivoTend: v.auto * projFactor, // projeção de fim de mês (=apurado quando projFactor=1)
          cupons: v.cupAuto,
          ticket: v.cupAuto > 0 ? v.auto / v.cupAuto : 0,
          itens: v.itens,
          aditivadaLitros: v.adit,
          aditivadaTend: v.adit * projFactor,
          gasolinaLitros: v.gas,
          mixPct: v.gas > 0 ? (v.adit / v.gas) * 100 : 0,
          abastecimentos: v.abast,
          abastTend: Math.round(v.abast * projFactor), // contagem → inteiro (sem casas decimais)
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
        projFactor,
        isLoading: false,
        hasEmpresa: true,
      })
    }
    return out
  }, [cacheRows, funcionarios, funcoes, dataInicial, dataFinal])

  return { byPosto, isLoading: hasEmpresa && (lCache || lFunc), hasCache: cacheRows.length > 0 }
}

export default useRedeProdutividadeCache

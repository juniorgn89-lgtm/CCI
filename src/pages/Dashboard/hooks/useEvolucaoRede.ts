import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { useTenantStore } from '@/store/tenant'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { fetchVendasSetorMensal } from '@/api/supabase/apuracao'
import { todayLocal } from '@/lib/period'

/** Granularidade do gráfico "Evolução da rede": por dia (período do filtro), por mês (12 meses) ou por ano (5 anos). */
export type Granularidade = 'dia' | 'mes' | 'ano'

export interface PontoEvolucao {
  idx: number
  /** Chave do ponto: yyyy-MM-dd (dia), yyyy-MM (mês) ou yyyy (ano). */
  data: string
  /** Texto do eixo: "16/10", "out/26" ou "2026". */
  rotulo: string
  faturamento: number
  lucroBruto: number
  margem: number
  /** Período ainda em andamento (mês/ano atual) ou com dias sem apuração. */
  parcial: boolean
  nota?: string
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const rotuloMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`
const diasNoMes = (mes: string) => new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate()
const mesMenos = (mes: string, n: number) => {
  const d = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)) - 1 - n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Quantos meses / anos cada visão mostra. */
export const JANELA_MESES = 12
export const JANELA_ANOS = 5

/**
 * Série longa da "Evolução da rede" (mês ou ano), lida da view
 * `apuracao_vendas_setor_mensal` (poucas dezenas de linhas por rede). Não
 * depende do período do filtro: mês = últimos 12 meses, ano = últimos 5 anos,
 * sempre terminando no mês atual. Respeita o filtro de posto.
 *
 * Mês/ano atual vêm marcados como parciais (ainda em andamento). Mês fechado
 * com dias sem apuração também é marcado, com a nota "apuração incompleta",
 * pra barra baixa não ser lida como queda de venda.
 */
const useEvolucaoRede = (gran: Granularidade) => {
  const { empresaCodigos } = useFilterStore()
  const rede = useTenantStore((s) => s.rede)
  const { data: empresasData } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 30 * 60 * 1000,
  })
  const empresas = useMemo(
    () => (empresasData?.resultados ?? []).map((e) => ({ codigo: e.empresaCodigo, nome: e.fantasia || e.razao || `Posto ${e.empresaCodigo}` })),
    [empresasData],
  )
  const permitidas = useEmpresasPermitidas(empresas)
  const codes = useMemo(() => {
    const ok = new Set(permitidas.map((e) => e.codigo))
    const sel = empresaCodigos.filter((c) => ok.has(c))
    return sel.length > 0 ? sel : [...ok]
  }, [permitidas, empresaCodigos])

  const hoje = todayLocal()
  const mesAtual = hoje.slice(0, 7)
  const anoAtual = hoje.slice(0, 4)
  const mesInicial = gran === 'ano' ? `${Number(anoAtual) - (JANELA_ANOS - 1)}-01` : mesMenos(mesAtual, JANELA_MESES - 1)
  const ativo = gran !== 'dia' && !!rede && codes.length > 0

  const { data: rows = [], isLoading, isError } = useQuery({
    queryKey: ['evolucao-rede-mensal', rede?.id, codes.join(','), mesInicial, mesAtual],
    queryFn: () => fetchVendasSetorMensal({ empresaCodigos: codes, mesInicial, mesFinal: mesAtual }),
    enabled: ativo,
    staleTime: 10 * 60 * 1000,
  })

  const pontos = useMemo<PontoEvolucao[]>(() => {
    if (gran === 'dia') return []
    // Soma por chave (mês ou ano) e guarda, por mês, o maior nº de dias apurados
    // entre postos/setores — base da marca "apuração incompleta".
    const acc = new Map<string, { fat: number; lb: number; diasPorMes: Map<string, number> }>()
    for (const r of rows) {
      const k = gran === 'mes' ? r.mes : r.mes.slice(0, 4)
      const e = acc.get(k) ?? { fat: 0, lb: 0, diasPorMes: new Map() }
      e.fat += Number(r.total_venda) || 0
      e.lb += (Number(r.total_venda) || 0) - (Number(r.total_custo) || 0)
      e.diasPorMes.set(r.mes, Math.max(e.diasPorMes.get(r.mes) ?? 0, Number(r.dias) || 0))
      acc.set(k, e)
    }
    // Eixo completo (mesmo sem venda no período) pra não "pular" meses/anos.
    const chaves: string[] = []
    if (gran === 'mes') for (let i = JANELA_MESES - 1; i >= 0; i--) chaves.push(mesMenos(mesAtual, i))
    else for (let i = JANELA_ANOS - 1; i >= 0; i--) chaves.push(String(Number(anoAtual) - i))
    // Começa no primeiro período com venda apurada (rede nova não mostra 4 anos vazios).
    const primeiro = chaves.findIndex((k) => (acc.get(k)?.fat ?? 0) > 0)
    const eixo = primeiro < 0 ? [] : chaves.slice(primeiro)
    return eixo.map((k, idx) => {
      const e = acc.get(k)
      const fat = e?.fat ?? 0, lb = e?.lb ?? 0
      const emAndamento = gran === 'mes' ? k === mesAtual : k === anoAtual
      let incompleto = false
      if (!emAndamento && e) {
        if (gran === 'mes') incompleto = (e.diasPorMes.get(k) ?? 0) < diasNoMes(k) - 3
        else incompleto = e.diasPorMes.size < 12
      }
      const nota = emAndamento ? 'em andamento' : incompleto ? 'apuração incompleta' : !e ? 'sem apuração' : undefined
      return {
        idx, data: k,
        rotulo: gran === 'mes' ? rotuloMes(k) : k,
        faturamento: fat, lucroBruto: lb, margem: fat > 0 ? (lb / fat) * 100 : 0,
        parcial: emAndamento || incompleto || !e,
        nota,
      }
    })
  }, [rows, gran, mesAtual, anoAtual])

  return { pontos, isLoading: ativo && isLoading, isError: ativo && isError }
}

export default useEvolucaoRede

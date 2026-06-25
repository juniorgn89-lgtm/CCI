import { useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchCaixas } from '@/api/endpoints/financeiro'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchVendaResumo } from '@/api/endpoints/vendas'
import { useFilterStore } from '@/store/filters'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { todayLocal } from '@/lib/period'
import type { Caixa } from '@/api/types/financeiro'

export interface CaixaAoVivoCard {
  empresaCodigo: number
  empresaNome: string
  caixaCodigo: number
  turno: string
  abertura: string
  responsavelNome: string
}

export interface EmpresaAoVivo {
  empresaCodigo: number
  empresaNome: string
  caixas: CaixaAoVivoCard[]
  /** Faturamento fiscal TOTAL de hoje (combustível + pista + conveniência), via /VENDA_RESUMO. */
  apuradoParcial: number
  isLoading: boolean
  error: boolean
}

const useTurnosAoVivo = () => {
  const { dataInicial, dataFinal, empresaCodigos } = useFilterStore()

  const { data: empresasData, isLoading: loadingEmpresas } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 30 * 60 * 1000,
  })
  // Filtra pelas empresas permitidas (profiles.empresa_codigos) e DEPOIS pelo
  // filtro de posto da Central (empresaCodigos). `[]` = Todos os postos. Narrar
  // reduz as queries ao vivo (1 por posto), então também é mais leve.
  const empresasPermitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const empresas = useMemo(
    () => empresaCodigos.length === 0
      ? empresasPermitidas
      : empresasPermitidas.filter((e) => empresaCodigos.includes(e.empresaCodigo)),
    [empresasPermitidas, empresaCodigos],
  )

  // Caixas por empresa — query primária (leve), refresh frequente para o "ao vivo"
  const caixasQueries = useQueries({
    queries: empresas.map((emp) => ({
      queryKey: ['caixas-aovivo', emp.empresaCodigo, dataInicial, dataFinal],
      queryFn: () =>
        fetchCaixas({
          empresaCodigo: emp.empresaCodigo,
          dataInicial,
          dataFinal,
          limite: 200,
        }),
      enabled: !!dataInicial && !!dataFinal,
      staleTime: 30 * 1000,
      // "Ao vivo": revalida sozinho a cada 60s (mesmo sem foco na aba).
      refetchInterval: 60 * 1000,
      refetchIntervalInBackground: true,
    })),
  })

  // Detecta quais empresas têm caixas abertos (após caixas resolverem).
  // Funcionários só carregam pra essas (load instantâneo se nenhuma aberta).
  const empresasComAbertos = empresas.map((_, idx) => {
    const cQuery = caixasQueries[idx]
    return cQuery?.data?.resultados?.some((c) => !c.fechado) ?? false
  })

  // Funcionários por empresa — só carrega quando aquela empresa tem caixa aberto
  const funcionariosQueries = useQueries({
    queries: empresas.map((emp, idx) => ({
      queryKey: ['funcionarios-aovivo', emp.empresaCodigo],
      queryFn: () => fetchFuncionarios({ empresaCodigo: emp.empresaCodigo, limite: 1000 }),
      staleTime: 30 * 60 * 1000,
      enabled: empresasComAbertos[idx],
    })),
  })

  // Faturamento fiscal TOTAL de HOJE por empresa (combustível + pista +
  // conveniência). /VENDA_RESUMO.total já é o total fiscal do dia (todos os
  // setores) — 1 call leve pra rede inteira. Inclui turnos já fechados hoje
  // (é o faturamento do dia, não só o dos caixas abertos agora).
  const hoje = todayLocal()
  const { data: vendaResumoHoje } = useQuery({
    queryKey: ['venda-resumo-aovivo', hoje],
    queryFn: () => fetchVendaResumo({ dataInicial: hoje, dataFinal: hoje }),
    enabled: empresas.length > 0,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: true,
  })
  const faturamentoHojePorEmpresa = (() => {
    const m = new Map<number, number>()
    for (const r of vendaResumoHoje ?? []) {
      m.set(r.codigoEmpresa, (m.get(r.codigoEmpresa) ?? 0) + (r.total ?? 0))
    }
    return m
  })()

  const empresasAoVivo: EmpresaAoVivo[] = empresas.map((emp, idx) => {
    const cQuery = caixasQueries[idx]
    const fQuery = funcionariosQueries[idx]

    const funcMap = new Map<number, string>()
    for (const f of fQuery?.data?.resultados ?? []) {
      funcMap.set(f.funcionarioCodigo, f.nome)
    }

    const allCaixas = cQuery?.data?.resultados ?? []
    const empresaNome = emp.fantasia || emp.razao || `Posto ${emp.empresaCodigo}`
    const openCaixas: Caixa[] = allCaixas.filter((c) => !c.fechado)

    const cards: CaixaAoVivoCard[] = openCaixas.map((c) => ({
      empresaCodigo: emp.empresaCodigo,
      empresaNome,
      caixaCodigo: c.caixaCodigo,
      turno: c.turno,
      abertura: c.abertura,
      responsavelNome: funcMap.get(c.funcionarioCodigo) ?? '—',
    }))

    // Parcial = faturamento fiscal TOTAL de hoje (todos os setores) da empresa.
    // Mostrado só pros postos com caixa aberto. Fallback no c.apurado dos caixas
    // abertos quando o dia ainda não tem venda fiscal lançada.
    let apuradoParcial = 0
    if (openCaixas.length > 0) {
      apuradoParcial = faturamentoHojePorEmpresa.get(emp.empresaCodigo) ?? 0
      if (apuradoParcial === 0) {
        apuradoParcial = openCaixas.reduce((s, c) => s + (c.apurado ?? 0), 0)
      }
    }

    return {
      empresaCodigo: emp.empresaCodigo,
      empresaNome,
      caixas: cards,
      apuradoParcial,
      isLoading: cQuery?.isLoading ?? false,
      error: cQuery?.isError ?? false,
    }
  })

  const allCards = empresasAoVivo.flatMap((e) => e.caixas)
  const isLoading = loadingEmpresas || (empresas.length > 0 && caixasQueries.every((q) => q.isLoading))
  // Momento da última atualização concluída (maior dataUpdatedAt entre as
  // queries de caixas) — base do contador "atualiza em 60s" da aba Ao Vivo.
  const dataUpdatedAt = caixasQueries.reduce((m, q) => Math.max(m, q.dataUpdatedAt ?? 0), 0)

  return {
    empresas: empresasAoVivo,
    cards: allCards,
    totalAoVivo: allCards.length,
    totalEmpresas: empresas.length,
    empresasComAoVivo: empresasAoVivo.filter((e) => e.caixas.length > 0).length,
    isLoading,
    dataUpdatedAt,
  }
}

export default useTurnosAoVivo

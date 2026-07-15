import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchCaixas } from '@/api/endpoints/financeiro'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchVendaResumo } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
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
  // Módulo "Ao Vivo" é SEM filtro: sempre HOJE e TODOS os postos permitidos —
  // ignora o filtro global de período/empresa (o store pode estar num mês
  // passado ou num posto específico por causa de outro módulo).
  const hoje = todayLocal()

  const { data: empresasData, isLoading: loadingEmpresas } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 30 * 60 * 1000,
  })
  // Escopo = todas as empresas permitidas (profiles.empresa_codigos).
  const empresas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const permittedCodes = useMemo(() => new Set(empresas.map((e) => e.empresaCodigo)), [empresas])
  const nomePorEmpresa = useMemo(() => {
    const m = new Map<number, string>()
    for (const e of empresas) m.set(e.empresaCodigo, e.fantasia || e.razao || `Posto ${e.empresaCodigo}`)
    return m
  }, [empresas])

  // UMA chamada REDE-WIDE: /CAIXA sem `empresaCodigo` traz os caixas de hoje de
  // TODOS os postos numa tacada (o endpoint, como /ABASTECIMENTO, devolve a rede
  // inteira quando a empresa é omitida). Antes era 1 query POR posto (fan-out de
  // N chamadas estranguladas no teto de ~6 conexões do navegador) — a causa da
  // lentidão. Paginado por robustez; caixas abertos do dia são poucos.
  const { data: caixasRede = [], isLoading: loadingCaixas, isError: errorCaixas, dataUpdatedAt } = useQuery({
    queryKey: ['caixas-aovivo-rede', hoje],
    queryFn: () => fetchAllPages((p) => fetchCaixas({ dataInicial: hoje, dataFinal: hoje, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 10),
    enabled: empresas.length > 0,
    staleTime: 30 * 1000,
    // "Ao vivo": revalida sozinho a cada 60s (mesmo sem foco na aba).
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: true,
  })

  // Caixas ABERTOS de hoje, restritos aos postos permitidos.
  const caixasAbertos = useMemo(
    () => caixasRede.filter((c) => !c.fechado && permittedCodes.has(c.empresaCodigo)),
    [caixasRede, permittedCodes],
  )
  const temAbertos = caixasAbertos.length > 0

  // Cadastro de funcionários em UMA chamada rede-wide — só serve pra mapear
  // código→nome, e só carrega quando há caixa aberto (render progressivo: os
  // cards pintam antes; o nome hidrata quando o cadastro chega). Cache longo.
  const { data: funcionariosRede = [] } = useQuery({
    queryKey: ['funcionarios-aovivo-rede'],
    queryFn: () => fetchAllPages((p) => fetchFuncionarios({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 10),
    enabled: temAbertos,
    staleTime: 30 * 60 * 1000,
  })
  const funcNome = useMemo(() => {
    const m = new Map<number, string>()
    for (const f of funcionariosRede) m.set(f.funcionarioCodigo, f.nome)
    return m
  }, [funcionariosRede])

  // Faturamento fiscal TOTAL de HOJE por empresa (combustível + pista +
  // conveniência). /VENDA_RESUMO.total já é o total fiscal do dia — 1 call leve
  // rede-wide. Só busca quando há caixa aberto (senão não há parcial a mostrar).
  const { data: vendaResumoHoje = [] } = useQuery({
    queryKey: ['venda-resumo-aovivo', hoje],
    queryFn: () => fetchVendaResumo({ dataInicial: hoje, dataFinal: hoje }),
    enabled: temAbertos,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: true,
  })
  const faturamentoHojePorEmpresa = useMemo(() => {
    const m = new Map<number, number>()
    for (const r of vendaResumoHoje) m.set(r.codigoEmpresa, (m.get(r.codigoEmpresa) ?? 0) + (r.total ?? 0))
    return m
  }, [vendaResumoHoje])

  // Agrupa os caixas abertos por posto (só os postos que têm algum aberto).
  const empresasAoVivo: EmpresaAoVivo[] = useMemo(() => {
    const porEmpresa = new Map<number, Caixa[]>()
    for (const c of caixasAbertos) {
      const arr = porEmpresa.get(c.empresaCodigo) ?? []
      arr.push(c)
      porEmpresa.set(c.empresaCodigo, arr)
    }
    return [...porEmpresa.entries()]
      .map(([empresaCodigo, abertos]) => {
        const empresaNome = nomePorEmpresa.get(empresaCodigo) ?? `Posto ${empresaCodigo}`
        const cards: CaixaAoVivoCard[] = abertos.map((c) => ({
          empresaCodigo,
          empresaNome,
          caixaCodigo: c.caixaCodigo,
          turno: c.turno,
          abertura: c.abertura,
          responsavelNome: funcNome.get(c.funcionarioCodigo) ?? '—',
        }))
        // Parcial = faturamento fiscal de hoje da empresa; fallback no apurado
        // dos caixas abertos enquanto o /VENDA_RESUMO não chegou (render progressivo).
        let apuradoParcial = faturamentoHojePorEmpresa.get(empresaCodigo) ?? 0
        if (apuradoParcial === 0) apuradoParcial = abertos.reduce((s, c) => s + (c.apurado ?? 0), 0)
        return { empresaCodigo, empresaNome, caixas: cards, apuradoParcial, isLoading: false, error: false }
      })
      .sort((a, b) => b.apuradoParcial - a.apuradoParcial)
  }, [caixasAbertos, nomePorEmpresa, funcNome, faturamentoHojePorEmpresa])

  const allCards = empresasAoVivo.flatMap((e) => e.caixas)
  const isLoading = loadingEmpresas || (empresas.length > 0 && loadingCaixas)

  return {
    empresas: empresasAoVivo,
    cards: allCards,
    totalAoVivo: allCards.length,
    totalEmpresas: empresas.length,
    empresasComAoVivo: empresasAoVivo.length,
    isLoading,
    dataUpdatedAt,
    error: errorCaixas,
  }
}

export default useTurnosAoVivo

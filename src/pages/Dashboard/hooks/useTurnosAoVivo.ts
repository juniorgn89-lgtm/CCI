import { useQueries, useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchCaixas } from '@/api/endpoints/financeiro'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchAbastecimentosChunked } from '@/api/helpers/fetchAbastecimentosChunked'
import { useFilterStore } from '@/store/filters'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import type { Abastecimento } from '@/api/types/combustivel'
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
  /** Combustível bombeado desde a abertura do caixa mais antigo aberto. Único valor por empresa pra evitar dupla contagem entre PDVs. */
  apuradoParcial: number
  isLoading: boolean
  error: boolean
}

const useTurnosAoVivo = () => {
  const { dataInicial, dataFinal } = useFilterStore()

  const { data: empresasData, isLoading: loadingEmpresas } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas({ limite: 200 }),
    staleTime: 30 * 60 * 1000,
  })
  // Filtra pelas empresas permitidas do user logado (profiles.empresa_codigos)
  const empresas = useEmpresasPermitidas(empresasData?.resultados ?? [])

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
  // Funcionários e abastecimentos só carregam pra essas — se nenhuma tem
  // caixa aberto, esses fetches pesados não disparam (load instantâneo).
  const empresasComAbertos = empresas.map((_, idx) => {
    const cQuery = caixasQueries[idx]
    return cQuery?.data?.resultados?.some((c) => !c.fechado) ?? false
  })
  const anyAbertos = empresasComAbertos.some(Boolean)

  // Funcionários por empresa — só carrega quando aquela empresa tem caixa aberto
  const funcionariosQueries = useQueries({
    queries: empresas.map((emp, idx) => ({
      queryKey: ['funcionarios-aovivo', emp.empresaCodigo],
      queryFn: () => fetchFuncionarios({ empresaCodigo: emp.empresaCodigo, limite: 1000 }),
      staleTime: 30 * 60 * 1000,
      enabled: empresasComAbertos[idx],
    })),
  })

  // Abastecimentos do período (call global, chunked) — só dispara se há ao
  // menos uma empresa com caixa aberto. Caso contrário, apurado parcial = 0
  // sem precisar baixar dezenas de milhares de abastecimentos.
  const { data: abastecimentos } = useQuery({
    queryKey: ['abastecimentos-aovivo', dataInicial, dataFinal],
    queryFn: () => fetchAbastecimentosChunked({ dataInicial, dataFinal }),
    enabled: !!dataInicial && !!dataFinal && anyAbertos,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: true,
  })

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

    // Apurado parcial calculado UMA vez por empresa para evitar dupla contagem
    // quando há múltiplos caixas (PDVs diferentes) com janelas de tempo sobrepostas.
    // Soma abastecimentos da empresa nas datas dos caixas abertos, a partir
    // da abertura do caixa mais antigo ainda aberto.
    let apuradoParcial = 0
    if (openCaixas.length > 0) {
      const abastEmpresa: Abastecimento[] = (abastecimentos ?? []).filter(
        (a) => a.empresaCodigo === emp.empresaCodigo
      )
      const datasAbertas = new Set(
        openCaixas.map((c) => c.dataMovimento?.substring(0, 10) ?? '').filter(Boolean)
      )
      const earliestAbertura = openCaixas.reduce((min, c) => {
        const ts = c.abertura ? new Date(c.abertura).getTime() : 0
        if (ts <= 0) return min
        return min === 0 || ts < min ? ts : min
      }, 0)
      for (const a of abastEmpresa) {
        const abastDate = (a.dataFiscal || a.dataHoraAbastecimento?.substring(0, 10)) ?? ''
        if (!datasAbertas.has(abastDate)) continue
        if (a.dataHoraAbastecimento && earliestAbertura > 0) {
          const ts = new Date(a.dataHoraAbastecimento).getTime()
          if (ts < earliestAbertura) continue
        }
        apuradoParcial += a.valorTotal
      }
      // Fallback: se ainda não há abastecimentos lançados (caixa recém-aberto),
      // usa a soma do c.apurado dos caixas abertos (a API pode preencher esse
      // campo em algumas situações, como vimos no POSTO DARWIN).
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

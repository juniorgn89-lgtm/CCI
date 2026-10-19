import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { fetchCaixas } from '@/api/endpoints/financeiro'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchVendaResumo } from '@/api/endpoints/vendas'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { todayLocal } from '@/lib/period'
import { mondayOf } from '@/lib/weekGroups'
import { weekdayIndices, diasOperacaoProxy } from '@/lib/projection'
import { MIN_DIAS_SAZONAL } from '@/lib/projecaoModo'
import { useRedeSetorDiaria } from '@/pages/Operacao/hooks/useRedeVendasCache'
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

/** Um caixa de um dia já encerrado (janela da semana). */
export interface CaixaDia {
  caixaCodigo: number
  turno: string
  abertura: string
  fechamento: string
  fechado: boolean
  responsavelNome: string
  apurado: number
  diferenca: number
}
export interface PostoDia {
  empresaCodigo: number
  empresaNome: string
  faturamento: number
  caixas: CaixaDia[]
}
export interface DiaSemana {
  /** yyyy-MM-dd */
  dia: string
  rotulo: string
  estado: 'passado' | 'hoje' | 'futuro'
  faturamento: number
  turnos: number
  postos: number
  porPosto: PostoDia[]
  /** Só em HOJE: média do mesmo dia da semana nas últimas semanas (fiscal). */
  previsao?: PrevisaoDia | null
}
export interface PrevisaoDia {
  valor: number
  /** Índice do dia da semana de hoje (1 = dia médio). */
  indice: number
  /** Faturamento de um "dia médio" no ritmo atual. */
  ritmo: number
  /** Dias fechados que formam o ritmo. */
  diasBase: number
  origem: 'mes' | 'ultimos7'
  /** true = histórico < 90 dias, sem peso por dia da semana. */
  linear: boolean
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const onlyDate = (s: string) => (s ?? '').split('T')[0].split(' ')[0]
const addDias = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`
}
const dow = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getDay() }

const useTurnosAoVivo = () => {
  // Módulo "Ao Vivo" é SEM filtro: sempre HOJE e TODOS os postos permitidos —
  // ignora o filtro global de período/empresa (o store pode estar num mês
  // passado ou num posto específico por causa de outro módulo).
  const hoje = todayLocal()
  // Janela da semana (segunda → domingo): os dias passados ficam com os dados,
  // apagados; hoje segue ao vivo; os futuros ficam vazios.
  const segunda = mondayOf(hoje)
  const ontem = addDias(hoje, -1)
  const temPassado = hoje > segunda

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

  // Dias JÁ ENCERRADOS da semana (segunda → ontem): caixas e faturamento, uma
  // chamada rede-wide cada, cache longo (não mudam mais).
  const { data: caixasPassado = [] } = useQuery({
    queryKey: ['caixas-aovivo-semana', segunda, ontem],
    queryFn: () => fetchAllPages((p) => fetchCaixas({ dataInicial: segunda, dataFinal: ontem, ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 10),
    enabled: empresas.length > 0 && temPassado,
    staleTime: 10 * 60 * 1000,
  })
  const { data: vendaResumoPassado = [] } = useQuery({
    queryKey: ['venda-resumo-aovivo-semana', segunda, ontem],
    queryFn: () => fetchVendaResumo({ dataInicial: segunda, dataFinal: ontem }),
    enabled: empresas.length > 0 && temPassado,
    staleTime: 10 * 60 * 1000,
  })

  // Previsão de HOJE = a MESMA projeção sazonal da Central: índice do dia da
  // semana (6 meses de histórico do cache, todos os setores) × ritmo do mês
  // (realizado dos dias fechados ÷ Σ índice desses dias). <90 dias de
  // histórico → ramo linear (índice 1), igual às outras telas.
  const histIni = (() => { const [y, m] = hoje.split('-').map(Number); const d = new Date(y, m - 7, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` })()
  const { data: histSetor = [] } = useRedeSetorDiaria(histIni, ontem, { enabled: empresas.length > 0, staleTime: 60 * 60 * 1000 })
  // prever(dia) = a previsão que a tela teria mostrado NAQUELE dia: ritmo dos dias
  // fechados do mês até a véspera × peso do dia da semana (índices de antes do mês).
  // Usada em hoje e nos dias encerrados (quanto fechou × quanto se esperava).
  const prever = useMemo(() => {
    const porDia = new Map<string, number>()
    let primeira: string | null = null
    for (const r of histSetor) {
      if (!permittedCodes.has(r.empresa_codigo) || r.quantidade <= 0) continue
      porDia.set(r.data, (porDia.get(r.data) ?? 0) + r.total_venda)
      if (!primeira || r.data < primeira) primeira = r.data
    }
    const serie = [...porDia.entries()].map(([data, value]) => ({ data, value })).sort((a, b) => a.data.localeCompare(b.data))
    return (dia: string): PrevisaoDia | null => {
      const mesDia = `${dia.slice(0, 7)}-01`
      const linear = diasOperacaoProxy(primeira, dia) < MIN_DIAS_SAZONAL
      const indices: Record<number, number> = linear ? {} : weekdayIndices(serie.filter((p) => p.data < mesDia))
      const idx = (iso: string) => indices[dow(iso)] ?? 1
      // Ritmo do mês até a véspera. No 1º dia do mês usa os últimos 7 dias fechados.
      let base = serie.filter((p) => p.data >= mesDia && p.data < dia)
      const origem: PrevisaoDia['origem'] = base.length > 0 ? 'mes' : 'ultimos7'
      if (base.length === 0) base = serie.filter((p) => p.data < dia).slice(-7)
      if (base.length === 0) return null
      const somaIdx = base.reduce((s, p) => s + idx(p.data), 0)
      if (somaIdx <= 0) return null
      const ritmo = base.reduce((s, p) => s + p.value, 0) / somaIdx
      return { valor: ritmo * idx(dia), indice: idx(dia), ritmo, diasBase: base.length, origem, linear }
    }
  }, [histSetor, permittedCodes])
  const previsaoHoje: PrevisaoDia | null = useMemo(() => prever(hoje), [prever, hoje])

  // Caixas ABERTOS de hoje, restritos aos postos permitidos.
  const caixasAbertos = useMemo(
    () => caixasRede.filter((c) => !c.fechado && permittedCodes.has(c.empresaCodigo)),
    [caixasRede, permittedCodes],
  )
  const temAbertos = caixasAbertos.length > 0

  // Cadastro de funcionários em UMA chamada rede-wide — só serve pra mapear
  // código→nome, e só carrega quando há caixa (aberto hoje ou da semana).
  // Render progressivo: os cards pintam antes; o nome hidrata quando chega.
  const { data: funcionariosRede = [] } = useQuery({
    queryKey: ['funcionarios-aovivo-rede'],
    queryFn: () => fetchAllPages((p) => fetchFuncionarios({ ultimoCodigo: p.ultimoCodigo, limite: p.limite }), 1000, 10),
    enabled: temAbertos || caixasPassado.length > 0,
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

  // ── Janela da semana ────────────────────────────────────────────────────
  const semana: DiaSemana[] = useMemo(() => {
    const totalHoje = empresasAoVivo.reduce((s, e) => s + e.apuradoParcial, 0)
    const dias: DiaSemana[] = []
    for (let i = 0; i < 7; i++) {
      const dia = addDias(segunda, i)
      const rotulo = DIAS[dow(dia)]
      if (dia === hoje) {
        dias.push({ dia, rotulo, estado: 'hoje', faturamento: totalHoje, turnos: caixasAbertos.length, postos: empresasAoVivo.length, porPosto: [], previsao: previsaoHoje })
        continue
      }
      if (dia > hoje) {
        dias.push({ dia, rotulo, estado: 'futuro', faturamento: 0, turnos: 0, postos: 0, porPosto: [] })
        continue
      }
      // Dia encerrado: caixas do dia (abertos ou fechados) + faturamento fiscal do dia.
      const fatPorEmp = new Map<number, number>()
      for (const r of vendaResumoPassado) {
        if (onlyDate(r.data) !== dia || !permittedCodes.has(r.codigoEmpresa)) continue
        fatPorEmp.set(r.codigoEmpresa, (fatPorEmp.get(r.codigoEmpresa) ?? 0) + (r.total ?? 0))
      }
      const caixasDia = caixasPassado.filter((c) => onlyDate(c.dataMovimento) === dia && permittedCodes.has(c.empresaCodigo))
      const porEmp = new Map<number, CaixaDia[]>()
      for (const c of caixasDia) {
        const arr = porEmp.get(c.empresaCodigo) ?? []
        arr.push({ caixaCodigo: c.caixaCodigo, turno: c.turno, abertura: c.abertura, fechamento: c.fechamento, fechado: c.fechado, responsavelNome: funcNome.get(c.funcionarioCodigo) ?? '—', apurado: c.apurado ?? 0, diferenca: c.diferenca ?? 0 })
        porEmp.set(c.empresaCodigo, arr)
      }
      const codigos = new Set<number>([...fatPorEmp.keys(), ...porEmp.keys()])
      const porPosto: PostoDia[] = [...codigos].map((codigo) => {
        const caixas = (porEmp.get(codigo) ?? []).sort((a, b) => (a.abertura ?? '').localeCompare(b.abertura ?? ''))
        let faturamento = fatPorEmp.get(codigo) ?? 0
        if (faturamento === 0) faturamento = caixas.reduce((s, c) => s + c.apurado, 0)
        return { empresaCodigo: codigo, empresaNome: nomePorEmpresa.get(codigo) ?? `Posto ${codigo}`, faturamento, caixas }
      }).sort((a, b) => b.faturamento - a.faturamento)
      dias.push({
        dia, rotulo, estado: 'passado',
        faturamento: porPosto.reduce((s, p) => s + p.faturamento, 0),
        turnos: caixasDia.length,
        postos: porPosto.length,
        porPosto,
        previsao: prever(dia),
      })
    }
    return dias
  }, [segunda, hoje, previsaoHoje, prever, empresasAoVivo, caixasAbertos.length, vendaResumoPassado, caixasPassado, permittedCodes, funcNome, nomePorEmpresa])

  return {
    empresas: empresasAoVivo,
    cards: allCards,
    totalAoVivo: allCards.length,
    totalEmpresas: empresas.length,
    empresasComAoVivo: empresasAoVivo.length,
    isLoading,
    dataUpdatedAt,
    error: errorCaixas,
    hoje,
    semana,
  }
}

export default useTurnosAoVivo

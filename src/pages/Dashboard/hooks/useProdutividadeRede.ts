import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchApuracaoDiaria, type ApuracaoDiariaRow } from '@/api/supabase/apuracao'
import { fetchFuncionarios, fetchFuncoes } from '@/api/endpoints/funcionarios'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import useRedeSetores from '@/pages/Dashboard/hooks/useRedeSetores'
import { offsetPeriod, todayLocal } from '@/lib/period'
import { classifyFuncaoRole, type FuncaoRole } from '@/lib/funcaoSetor'

/**
 * Setor da Produtividade. Cada setor tem um benchmark específico:
 *  - 'geral'        → faturamento ÷ colaboradores ativos
 *  - 'combustivel'  → litros ÷ frentistas ativos (throughput da pista)
 *  - 'conveniencia' → faturamento da loja ÷ caixas ativos
 *  - 'automotivos'  → só faturamento (sem por-colaborador nesta fase)
 */
export type ProdSetor = 'geral' | 'combustivel' | 'conveniencia' | 'automotivos'

/** Metadados da métrica-estrela do setor selecionado — dirigem os rótulos da UI. */
export interface ProdMetric {
  setor: ProdSetor
  /** Coluna/KPI-estrela. */
  starLabel: string
  starHelp: string
  starKind: 'brl' | 'litros'
  /** Denominador (coluna "Colab."). */
  denomLabel: string
  denomHelp: string
  /** Headline (KPI 1) — numerador agregado da rede. */
  headlineLabel: string
  headlineKind: 'brl' | 'litros'
  /** Palavra do denominador no rodapé/insights ("colaboradores"/"frentistas"). */
  denomWord: string
  /** Tem métrica por-colaborador? (automotivos = false). */
  hasPerColab: boolean
  /** Rótulos dos KPIs 2/3/4 (mudam quando não há por-colaborador). */
  kpiMaisLabel: string
  kpiMediaLabel: string
  kpiMediaSub: string
  kpiAbaixoLabel: string
}

/** Uma unidade (posto) no comparativo de produtividade. */
export interface UnidadeProdutividade {
  empresaCodigo: number
  nome: string
  /** Faturamento global do posto no período (combustível + loja). */
  faturamento: number
  litros: number
  /** Funcionários ATIVOS do posto (equipe total — denominador do 'geral'). */
  colaboradores: number
  /** Denominador-estrela do setor ativo (colaboradores | frentistas | caixas | trocadores). */
  denominador: number
  /** Numerador-estrela do setor ativo (faturamento do setor | litros). */
  numerador: number
  /** Ticket médio = faturamento ÷ itens vendidos. */
  ticketMedio: number
  /** Métrica-estrela do setor: numerador ÷ denominador (ou o próprio numerador se sem por-colab). */
  prod: number
  /** Posição (1-based) no ranking de produtividade — base do heatmap, fixo. */
  prodRank: number
  faturamentoPrev: number
  /** Variação % do NUMERADOR-estrela vs período comparativo (null sem base). */
  variacaoPct: number | null
}

export interface InsightRede {
  type: 'positive' | 'warning' | 'info'
  text: string
}

export interface ProdutividadeRedeData {
  unidades: UnidadeProdutividade[]
  /** Numerador-estrela agregado da rede (faturamento | litros), p/ o KPI headline. */
  headlineRede: number
  faturamentoRede: number
  colaboradoresRede: number
  /** Denominador-estrela agregado da rede (Σ frentistas | Σ colaboradores | …). */
  denominadorRede: number
  /** Produtividade média = headlineRede ÷ denominadorRede (ou ÷ nº postos se sem por-colab). */
  prodMedia: number
  maisProdutiva: UnidadeProdutividade | null
  abaixoMedia: UnidadeProdutividade | null
  variacaoRedePct: number | null
  cmpLabel: string
  metric: ProdMetric
  insights: InsightRede[]
  apuradoAte: string | null
  isLoading: boolean
  hasData: boolean
}

interface Agg { fat: number; litros: number; itens: number }
interface ColabSetor { total: number; frentistas: number; caixas: number; trocadores: number }

const EMPTY_COLAB: Map<number, ColabSetor> = new Map()

const aggregateByEmp = (rows: ApuracaoDiariaRow[]): Map<number, Agg> => {
  const m = new Map<number, Agg>()
  for (const r of rows) {
    const cur = m.get(r.empresa_codigo) ?? { fat: 0, litros: 0, itens: 0 }
    cur.fat += r.vendas_total
    cur.litros += r.fuel_litros
    cur.itens += r.vendas_qtd
    m.set(r.empresa_codigo, cur)
  }
  return m
}

const PROD_BASE = {
  kpiMaisLabel: 'Mais produtiva',
  kpiMediaLabel: 'Produtividade média',
  kpiMediaSub: 'média da rede no período',
  kpiAbaixoLabel: 'Abaixo da média',
}

/** Metadados da métrica por setor. */
const METRIC: Record<ProdSetor, ProdMetric> = {
  geral: {
    setor: 'geral', ...PROD_BASE,
    starLabel: 'R$ / colaborador', starHelp: 'Métrica-estrela = faturamento ÷ colaboradores ativos. Cor pela faixa de produtividade (alta/média/baixa), fixa pelo ranking.', starKind: 'brl',
    denomLabel: 'Colab.', denomHelp: 'Funcionários ativos do posto — denominador da produtividade (R$/colaborador).',
    headlineLabel: 'Faturamento da rede', headlineKind: 'brl',
    denomWord: 'colaboradores', hasPerColab: true,
  },
  combustivel: {
    setor: 'combustivel', ...PROD_BASE,
    starLabel: 'Litros / frentista', starHelp: 'Métrica-estrela do combustível = litros vendidos ÷ frentistas ativos. Mede o throughput operacional da pista (não distorcido por preço).', starKind: 'litros',
    denomLabel: 'Frentistas', denomHelp: 'Frentistas ATIVOS do posto — denominador da produtividade da pista (litros/frentista).',
    headlineLabel: 'Litros da rede', headlineKind: 'litros',
    denomWord: 'frentistas', hasPerColab: true,
  },
  conveniencia: {
    setor: 'conveniencia', ...PROD_BASE,
    starLabel: 'R$ / caixa', starHelp: 'Métrica-estrela da conveniência = faturamento da loja ÷ caixas ativos.', starKind: 'brl',
    denomLabel: 'Caixas', denomHelp: 'Caixas ATIVOS do posto — denominador da produtividade da loja (R$/caixa).',
    headlineLabel: 'Faturamento conveniência', headlineKind: 'brl',
    denomWord: 'caixas', hasPerColab: true,
  },
  automotivos: {
    setor: 'automotivos',
    starLabel: 'Fat. automotivos', starHelp: 'Faturamento de automotivos (lubrificantes/filtros/aditivos) no período. Sem métrica por-colaborador nesta fase — a venda é compartilhada entre trocador e frentista.', starKind: 'brl',
    denomLabel: 'Trocadores', denomHelp: 'Trocadores de óleo ATIVOS do posto (referência — NÃO é o denominador, a venda também sai do frentista).',
    headlineLabel: 'Faturamento automotivos', headlineKind: 'brl',
    denomWord: 'trocadores', hasPerColab: false,
    kpiMaisLabel: 'Maior faturamento', kpiMediaLabel: 'Faturamento médio', kpiMediaSub: 'média por posto', kpiAbaixoLabel: 'Menor faturamento',
  },
}

/**
 * Comparativo de produtividade ENTRE UNIDADES (postos) da rede, por SETOR.
 *
 * ESCOPO: comparativo de rede — sempre TODOS os postos permitidos do usuário
 * (ignora a seleção de posto do filtro global). Só período/comparativo se aplicam.
 *
 * Fontes: `apuracao_diaria` (fat global + litros por posto) + `useRedeSetores`
 * (faturamento por setor por posto, p/ conveniência/automotivos) + `/FUNCIONARIO`
 * ATIVO classificado por cargo (`/FUNCOES`) p/ o denominador por papel.
 *
 * NOTA: a API IGNORA o param `ativo`; filtramos o flag `ativo` no cliente.
 */
const useProdutividadeRede = (setor: ProdSetor = 'geral'): ProdutividadeRedeData => {
  const { dataInicial, dataFinal, comparisonMode } = useFilterStore()
  const cmpLabel = comparisonMode === 'prevYear' ? 'ano ant.' : 'mês ant.'
  const cmpOffset = comparisonMode === 'prevYear' ? 12 : 1
  const metric = METRIC[setor]
  const isComb = setor === 'combustivel'
  const isConv = setor === 'conveniencia'
  const isAuto = setor === 'automotivos'
  const usaRedeSetores = isConv || isAuto

  const hoje = todayLocal()
  const fimEf = dataFinal && dataFinal > hoje ? hoje : dataFinal
  const prevInicial = dataInicial ? offsetPeriod(dataInicial, cmpOffset) : ''
  const prevFinal = fimEf ? offsetPeriod(fimEf, cmpOffset) : ''

  const { data: empresasData, isLoading: lEmpresas } = useQuery({
    queryKey: ['empresas'],
    queryFn: () => fetchEmpresas(),
    staleTime: 10 * 60 * 1000,
  })
  const permitidas = useEmpresasPermitidas(empresasData?.resultados ?? [])
  const permittedCodes = useMemo(() => permitidas.map((e) => e.codigo), [permitidas])
  const permittedKey = permittedCodes.slice().sort((a, b) => a - b).join(',')
  const ready = permittedCodes.length > 0

  const { data: rowsAtual = [], isLoading: lAtual } = useQuery({
    queryKey: ['prod-rede-diaria', permittedKey, dataInicial, dataFinal],
    queryFn: () => fetchApuracaoDiaria({ empresaCodigos: permittedCodes, dataInicial, dataFinal }),
    enabled: ready && !!dataInicial && !!dataFinal,
    staleTime: 5 * 60 * 1000,
  })

  const { data: rowsPrev = [] } = useQuery({
    queryKey: ['prod-rede-diaria', permittedKey, prevInicial, prevFinal],
    queryFn: () => fetchApuracaoDiaria({ empresaCodigos: permittedCodes, dataInicial: prevInicial, dataFinal: prevFinal }),
    enabled: ready && !!prevInicial && !!prevFinal,
    staleTime: 5 * 60 * 1000,
  })

  // Faturamento por SETOR por posto (conveniência/automotivos). Fonte única de
  // setor da Central — compartilha cache com a aba Visão Geral. LAZY: só dispara
  // os fetches pesados quando o setor ativo realmente precisa (conv/auto).
  const redeSetores = useRedeSetores({ enabled: usaRedeSetores })

  // Colaboradores ATIVOS por posto, divididos por papel. A API ignora `ativo`
  // → filtra o flag no cliente. Classifica via catálogo /FUNCOES (campo `nome`).
  const { data: colabByEmp = EMPTY_COLAB } = useQuery({
    queryKey: ['prod-rede-colab', permittedKey],
    queryFn: async () => {
      const funcoesRes = await fetchFuncoes({ limite: 1000 })
      const roleByCodigo = new Map<number, FuncaoRole>()
      for (const f of funcoesRes.resultados) roleByCodigo.set(f.funcaoCodigo, classifyFuncaoRole(f.nome))
      const m = new Map<number, ColabSetor>()
      await Promise.all(
        permittedCodes.map(async (ec) => {
          const res = await fetchFuncionarios({ empresaCodigo: ec, ativo: true, limite: 1000 })
          const acc: ColabSetor = { total: 0, frentistas: 0, caixas: 0, trocadores: 0 }
          for (const f of res.resultados) {
            if (f.ativo !== true) continue
            acc.total++
            const role = roleByCodigo.get(f.funcaoCodigo) ?? 'outro'
            if (role === 'frentista') acc.frentistas++
            else if (role === 'caixa') acc.caixas++
            else if (role === 'trocador') acc.trocadores++
          }
          m.set(ec, acc)
        }),
      )
      return m
    },
    enabled: ready,
    staleTime: 10 * 60 * 1000,
  })

  return useMemo<ProdutividadeRedeData>(() => {
    const nome = new Map<number, string>(permitidas.map((e) => [e.codigo, e.fantasia]))
    const aggA = aggregateByEmp(rowsAtual)
    const aggP = aggregateByEmp(rowsPrev)

    // Faturamento por setor por posto (atual + comparativo) do useRedeSetores.
    const setorPostos = isConv ? redeSetores.conveniencia.postos : isAuto ? redeSetores.automotivos.postos : []
    const setorFat = new Map<number, number>()
    const setorFatPrev = new Map<number, number>()
    for (const p of setorPostos) {
      setorFat.set(p.empresaCodigo, p.faturamento)
      setorFatPrev.set(p.empresaCodigo, p.faturamentoAnoAnterior)
    }

    // Numerador / denominador da métrica-estrela conforme o setor.
    const numeradorDe = (ec: number, a: Agg): number =>
      isComb ? a.litros : isConv || isAuto ? (setorFat.get(ec) ?? 0) : a.fat
    const numeradorPrevDe = (ec: number, p: Agg): number =>
      isComb ? p.litros : isConv || isAuto ? (setorFatPrev.get(ec) ?? 0) : p.fat
    const denominadorDe = (c: ColabSetor): number =>
      isComb ? c.frentistas : isConv ? c.caixas : isAuto ? c.trocadores : c.total

    let unidades: UnidadeProdutividade[] = permittedCodes
      .map((ec) => {
        const a = aggA.get(ec) ?? { fat: 0, litros: 0, itens: 0 }
        const p = aggP.get(ec) ?? { fat: 0, litros: 0, itens: 0 }
        const colab = colabByEmp.get(ec) ?? { total: 0, frentistas: 0, caixas: 0, trocadores: 0 }
        const numerador = numeradorDe(ec, a)
        const numeradorPrev = numeradorPrevDe(ec, p)
        const denominador = denominadorDe(colab)
        // Sem por-colaborador (automotivos): a estrela é o próprio faturamento.
        const prod = metric.hasPerColab ? (denominador > 0 ? numerador / denominador : 0) : numerador
        return {
          empresaCodigo: ec,
          nome: nome.get(ec) ?? `Posto ${ec}`,
          faturamento: a.fat,
          litros: a.litros,
          colaboradores: colab.total,
          denominador,
          numerador,
          ticketMedio: a.itens > 0 ? a.fat / a.itens : 0,
          prod,
          prodRank: 0,
          faturamentoPrev: p.fat,
          variacaoPct: numeradorPrev > 0 ? ((numerador - numeradorPrev) / numeradorPrev) * 100 : null,
        }
      })
      // Setores de loja: só postos com faturamento no setor. Demais: atividade global.
      .filter((u) => (isConv || isAuto ? u.numerador > 0 : u.faturamento > 0 || u.litros > 0))

    unidades = [...unidades].sort((a, b) => b.prod - a.prod)
    unidades.forEach((u, i) => { u.prodRank = i + 1 })

    const faturamentoRede = unidades.reduce((s, u) => s + u.faturamento, 0)
    const headlineRede = unidades.reduce((s, u) => s + u.numerador, 0)
    const colaboradoresRede = unidades.reduce((s, u) => s + u.colaboradores, 0)
    const denominadorRede = unidades.reduce((s, u) => s + u.denominador, 0)
    // Sem por-colaborador: "média" = faturamento médio por posto.
    const prodMedia = metric.hasPerColab
      ? (denominadorRede > 0 ? headlineRede / denominadorRede : 0)
      : (unidades.length > 0 ? headlineRede / unidades.length : 0)
    const numPrevRede = unidades.reduce((s, u) => s + numeradorPrevDe(u.empresaCodigo, aggP.get(u.empresaCodigo) ?? { fat: 0, litros: 0, itens: 0 }), 0)
    const variacaoRedePct = numPrevRede > 0 ? ((headlineRede - numPrevRede) / numPrevRede) * 100 : null
    const maisProdutiva = unidades[0] ?? null
    const abaixoMedia = unidades.length > 0 ? unidades[unidades.length - 1] : null

    const apuradoAte = rowsAtual.reduce<string | null>(
      (max, r) => (r.computed_at && (!max || r.computed_at > max) ? r.computed_at : max),
      null,
    )

    // ── Insights ──
    const insights: InsightRede[] = []
    const nf = (v: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
    const pct1 = (v: number) => `${v.toFixed(1).replace('.', ',')}%`
    const pct0 = (v: number) => `${v.toFixed(0)}%`
    const fmtStar = (v: number) =>
      metric.starKind === 'litros' ? `${nf(v)} L por frentista`
        : metric.hasPerColab ? `R$ ${nf(v)} por ${metric.denomWord.replace(/s$/, '')}`
          : `R$ ${nf(v)}`

    if (maisProdutiva && prodMedia > 0) {
      if (metric.hasPerColab) {
        const acima = (maisProdutiva.prod / prodMedia - 1) * 100
        insights.push({
          type: 'positive',
          text: `${maisProdutiva.nome} é a unidade mais produtiva: ${fmtStar(maisProdutiva.prod)}${
            acima > 0.5 ? `, ${pct1(acima)} acima da média da rede` : ''
          }.`,
        })
      } else {
        insights.push({
          type: 'positive',
          text: `${maisProdutiva.nome} lidera o faturamento de automotivos: ${fmtStar(maisProdutiva.prod)}.`,
        })
      }
    }
    if (metric.hasPerColab && abaixoMedia && prodMedia > 0 && abaixoMedia.prod < prodMedia) {
      const abaixo = (1 - abaixoMedia.prod / prodMedia) * 100
      insights.push({
        type: 'warning',
        text: `${abaixoMedia.nome} está ${pct0(abaixo)} abaixo da produtividade média — avaliar dimensionamento da equipe.`,
      })
    }
    if (unidades.length >= 2) {
      const fatLeader = [...unidades].sort((a, b) => b.faturamento - a.faturamento)[0]
      if (metric.hasPerColab && fatLeader && maisProdutiva && fatLeader.empresaCodigo !== maisProdutiva.empresaCodigo) {
        insights.push({
          type: 'info',
          text: `${fatLeader.nome} lidera em faturamento, mas fica em ${fatLeader.prodRank}º em produtividade — equipe maior dilui o resultado por pessoa.`,
        })
      }
      const maxProd = maisProdutiva?.prod ?? 0
      const minProd = abaixoMedia?.prod ?? 0
      if (minProd > 0 && maxProd > minProd) {
        insights.push({
          type: 'info',
          text: `Diferença de ${pct0((maxProd / minProd - 1) * 100)} ${metric.hasPerColab ? 'em produtividade' : 'no faturamento de automotivos'} entre a 1ª e a última unidade.`,
        })
      }
    }

    return {
      unidades,
      headlineRede,
      faturamentoRede,
      colaboradoresRede,
      denominadorRede,
      prodMedia,
      maisProdutiva,
      abaixoMedia,
      variacaoRedePct,
      cmpLabel,
      metric,
      insights,
      apuradoAte,
      isLoading: lAtual || lEmpresas || (usaRedeSetores && redeSetores.isLoading),
      hasData: unidades.length > 0,
    }
  }, [rowsAtual, rowsPrev, colabByEmp, permitidas, permittedCodes, cmpLabel, metric, isComb, isConv, isAuto, usaRedeSetores, redeSetores, lAtual, lEmpresas])
}

export default useProdutividadeRede

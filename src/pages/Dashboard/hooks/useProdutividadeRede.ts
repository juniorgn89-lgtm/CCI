import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import { fetchApuracaoDiaria, type ApuracaoDiariaRow } from '@/api/supabase/apuracao'
import { fetchFuncionarios } from '@/api/endpoints/funcionarios'
import { fetchEmpresas } from '@/api/endpoints/empresas'
import { useEmpresasPermitidas } from '@/hooks/useEmpresasPermitidas'
import { offsetPeriod, todayLocal } from '@/lib/period'

/** Uma unidade (posto) no comparativo de produtividade. */
export interface UnidadeProdutividade {
  empresaCodigo: number
  nome: string
  /** Faturamento global do posto no período (combustível + loja). */
  faturamento: number
  litros: number
  /** Funcionários ativos do posto (tamanho da equipe — denominador da estrela). */
  colaboradores: number
  /** Ticket médio = faturamento ÷ itens vendidos. */
  ticketMedio: number
  /** Métrica-estrela = faturamento ÷ colaboradores. */
  prod: number
  /** Posição (1-based) no ranking de produtividade — base do heatmap, fixo. */
  prodRank: number
  faturamentoPrev: number
  /** Variação % do faturamento vs período comparativo (null sem base). */
  variacaoPct: number | null
}

export interface InsightRede {
  type: 'positive' | 'warning' | 'info'
  text: string
}

export interface ProdutividadeRedeData {
  /** Unidades ordenadas por produtividade desc (ordem default). */
  unidades: UnidadeProdutividade[]
  faturamentoRede: number
  colaboradoresRede: number
  /** Produtividade média da rede = faturamentoRede ÷ colaboradoresRede. */
  prodMedia: number
  maisProdutiva: UnidadeProdutividade | null
  abaixoMedia: UnidadeProdutividade | null
  variacaoRedePct: number | null
  cmpLabel: string
  insights: InsightRede[]
  /** Timestamp ISO da apuração mais recente no período (frescor do cache). */
  apuradoAte: string | null
  isLoading: boolean
  hasData: boolean
}

interface Agg { fat: number; litros: number; itens: number }

const EMPTY_COLAB: Map<number, number> = new Map()

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

/**
 * Comparativo de produtividade ENTRE UNIDADES (postos) da rede, para o gestor
 * da rede. Métrica-estrela: faturamento por colaborador (normaliza o resultado
 * pelo tamanho da equipe). Tudo GET/read-only.
 *
 * ESCOPO: por ser um comparativo de rede, sempre considera TODOS os postos
 * permitidos do usuário — IGNORA a seleção de posto do filtro global (que
 * continua valendo nas outras abas da Central). Só o período/comparativo do
 * filtro global se aplicam aqui. Restrição por usuário (profiles.empresa_codigos)
 * é respeitada via useEmpresasPermitidas + filtro explícito por empresa.
 *
 * Fonte por unidade: cache `apuracao_diaria` (1 row por empresa+dia) — já vem
 * por empresa, então deriva o recorte por posto sem N fetches à Quality. O mês
 * corrente é mantido fresco pelo cron de apuração (scope=today).
 * Colaboradores = funcionários ativos por posto (/FUNCIONARIO ativo=true).
 */
const useProdutividadeRede = (): ProdutividadeRedeData => {
  const { dataInicial, dataFinal, comparisonMode } = useFilterStore()
  const cmpLabel = comparisonMode === 'prevYear' ? 'ano ant.' : 'mês ant.'
  const cmpOffset = comparisonMode === 'prevYear' ? 12 : 1

  // "Mesmos dias decorridos": corta o fim em hoje antes de deslocar.
  const hoje = todayLocal()
  const fimEf = dataFinal && dataFinal > hoje ? hoje : dataFinal
  const prevInicial = dataInicial ? offsetPeriod(dataInicial, cmpOffset) : ''
  const prevFinal = fimEf ? offsetPeriod(fimEf, cmpOffset) : ''

  // Universo = TODOS os postos permitidos do usuário (rede inteira), não a
  // seleção do filtro global. Restrição por usuário aplicada via permitidas.
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

  const { data: colabByEmp = EMPTY_COLAB } = useQuery({
    queryKey: ['prod-rede-colab', permittedKey],
    queryFn: async () => {
      const m = new Map<number, number>()
      await Promise.all(
        permittedCodes.map(async (ec) => {
          const res = await fetchFuncionarios({ empresaCodigo: ec, ativo: true, limite: 1000 })
          m.set(ec, res.resultados.length)
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

    let unidades: UnidadeProdutividade[] = permittedCodes
      .map((ec) => {
        const a = aggA.get(ec) ?? { fat: 0, litros: 0, itens: 0 }
        const fatPrev = aggP.get(ec)?.fat ?? 0
        const colaboradores = colabByEmp.get(ec) ?? 0
        return {
          empresaCodigo: ec,
          nome: nome.get(ec) ?? `Posto ${ec}`,
          faturamento: a.fat,
          litros: a.litros,
          colaboradores,
          ticketMedio: a.itens > 0 ? a.fat / a.itens : 0,
          prod: colaboradores > 0 ? a.fat / colaboradores : 0,
          prodRank: 0,
          faturamentoPrev: fatPrev,
          variacaoPct: fatPrev > 0 ? ((a.fat - fatPrev) / fatPrev) * 100 : null,
        }
      })
      // Só postos com atividade no período (faturamento ou litros).
      .filter((u) => u.faturamento > 0 || u.litros > 0)

    // Rank de produtividade (base do heatmap, independente da ordenação da UI).
    unidades = [...unidades].sort((a, b) => b.prod - a.prod)
    unidades.forEach((u, i) => { u.prodRank = i + 1 })

    const faturamentoRede = unidades.reduce((s, u) => s + u.faturamento, 0)
    const colaboradoresRede = unidades.reduce((s, u) => s + u.colaboradores, 0)
    const prodMedia = colaboradoresRede > 0 ? faturamentoRede / colaboradoresRede : 0
    const fatPrevRede = unidades.reduce((s, u) => s + u.faturamentoPrev, 0)
    const variacaoRedePct = fatPrevRede > 0 ? ((faturamentoRede - fatPrevRede) / fatPrevRede) * 100 : null
    const maisProdutiva = unidades[0] ?? null
    const abaixoMedia = unidades.length > 0 ? unidades[unidades.length - 1] : null

    // Frescor: apuração mais recente no período (o cron re-apura o dia corrente).
    const apuradoAte = rowsAtual.reduce<string | null>(
      (max, r) => (r.computed_at && (!max || r.computed_at > max) ? r.computed_at : max),
      null,
    )

    // ── Insights (derivados, sem números inventados) ──
    const insights: InsightRede[] = []
    const fmtInt = (v: number) =>
      `R$ ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)}`
    const pct1 = (v: number) => `${v.toFixed(1).replace('.', ',')}%`
    const pct0 = (v: number) => `${v.toFixed(0)}%`

    if (maisProdutiva && prodMedia > 0) {
      const acima = (maisProdutiva.prod / prodMedia - 1) * 100
      insights.push({
        type: 'positive',
        text: `${maisProdutiva.nome} é a unidade mais produtiva: ${fmtInt(maisProdutiva.prod)} por colaborador${
          acima > 0.5 ? `, ${pct1(acima)} acima da média da rede` : ''
        }.`,
      })
    }
    if (abaixoMedia && prodMedia > 0 && abaixoMedia.prod < prodMedia) {
      const abaixo = (1 - abaixoMedia.prod / prodMedia) * 100
      insights.push({
        type: 'warning',
        text: `${abaixoMedia.nome} está ${pct0(abaixo)} abaixo da produtividade média — avaliar dimensionamento da equipe.`,
      })
    }
    if (unidades.length >= 2) {
      const fatLeader = [...unidades].sort((a, b) => b.faturamento - a.faturamento)[0]
      if (fatLeader && maisProdutiva && fatLeader.empresaCodigo !== maisProdutiva.empresaCodigo) {
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
          text: `Diferença de ${pct0((maxProd / minProd - 1) * 100)} em produtividade entre a 1ª e a última unidade.`,
        })
      }
    }

    return {
      unidades,
      faturamentoRede,
      colaboradoresRede,
      prodMedia,
      maisProdutiva,
      abaixoMedia,
      variacaoRedePct,
      cmpLabel,
      insights,
      apuradoAte,
      isLoading: lAtual || lEmpresas,
      hasData: unidades.length > 0,
    }
  }, [rowsAtual, rowsPrev, colabByEmp, permitidas, permittedCodes, cmpLabel, lAtual, lEmpresas])
}

export default useProdutividadeRede

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import useOperacaoData, { type TurnoRow, type ConferenciaCaixa } from '@/pages/Operacao/hooks/useOperacaoData'
import { fetchCartao } from '@/api/endpoints/financeiro'
import { difCaixa, isCartaoForma } from '@/lib/difCaixa'

/**
 * Motor DETERMINÍSTICO do "Fechamento por exceção" (Fase 1). Read-only, sem IA
 * generativa, sem escrita. Classifica cada caixa fechado em OK/Revisar/Investigar,
 * deriva causa provável + confiança + evidências (tagueadas dado-atual/histórico)
 * + recorrência (normalizada por exposição) — TUDO sobre o motor do Visor360
 * (`difCaixa` + `useOperacaoData`). Nenhum valor financeiro é "produzido pela IA".
 *
 * Guard-rails (handoff): confiança calibrada (= força do casamento de sinais, não
 * peso inventado); recorrência por TAXA (não penaliza PDV movimentado); evidências
 * marcadas por tier; OK entram em amostragem de auditoria (nota na UI).
 */

const EPS = 0.005

/** Tolerância do "OK" — CONFIGURÁVEL (não é por-PDV; a API não expõe isso).
 *  max(R$ 5, 1% do apurado): cobre caixa pequeno e grande. */
export const TOLERANCIA_FECHAMENTO = (apuradoBase: number): number =>
  Math.max(5, Math.abs(apuradoBase) * 0.01)
export const TOLERANCIA_LABEL = 'máx(R$ 5; 1% do apurado conferido) — tolerância configurável, não por PDV'

/** Acima disto (ou recorrência alta) → Investigar. */
const investigarValor = (apuradoBase: number): number => Math.max(100, Math.abs(apuradoBase) * 0.03)
const RECORRENCIA_MIN_COUNT = 3
const RECORRENCIA_MIN_RATE = 40 // %

export type ExcecaoClasse = 'ok' | 'revisar' | 'investigar'
export type EvidenciaTier = 'atual' | 'historico'
/** Tier da CAUSA: verificável agora, requer histórico, ou misto. */
export type CausaTier = 'atual' | 'historico' | 'misto'

export interface Evidencia {
  texto: string
  tier: EvidenciaTier
}

export interface Recorrencia {
  /** Caixas com diferença do operador no PERÍODO. */
  count: number
  /** Total de caixas do operador no período (denominador da exposição). */
  total: number
  ratePct: number
  /** Recorrente o bastante p/ escalar (count alto E taxa alta — normalizado). */
  alta: boolean
}

export interface ExcecaoCaixa {
  key: string
  caixaCodigo: number
  data: string
  turno: string
  pdvLabel: string
  operador: string
  funcionarioCodigo: number
  classe: ExcecaoClasse
  /** Números do MOTOR (a IA não recalcula). */
  apresentado: number | null
  apurado: number
  diferenca: number
  tolerancia: number
  causa: string
  causaTier: CausaTier
  /** 0–100, calibrada (força do casamento dos sinais). */
  confianca: number
  evidencias: Evidencia[]
  recorrencia: Recorrencia
  formaDominante: string | null
  isCartao: boolean
}

export interface FechamentoExcecaoData {
  totalCaixas: number
  okCount: number
  okPct: number
  revisarCount: number
  investigarCount: number
  /** Só Revisar + Investigar, ordenada por severidade. */
  fila: ExcecaoCaixa[]
  toleranciaLabel: string
  /** Taxa de cartão contratada média da REDE no período (ponderada por valor).
   *  null se /CARTAO não retornou — não inventar. */
  taxaContratadaMediaPct: number | null
  isLoading: boolean
  hasEmpresa: boolean
}

const up = (s: string) => (s ?? '').toUpperCase()
const isDinheiro = (nome: string) => up(nome).includes('DINHEIRO')
const isPix = (nome: string) => up(nome).includes('PIX')

const brl = (v: number) => `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct0 = (v: number) => `${Math.round(v)}%`
const clampConf = (v: number) => Math.max(50, Math.min(95, Math.round(v)))

interface FormaDif { nome: string; diferenca: number }

interface CausaResult {
  causa: string
  causaTier: CausaTier
  confianca: number
  evidencias: Evidencia[]
  formaDominante: string | null
  isCartao: boolean
}

/** Núcleo determinístico: deriva a causa provável a partir das formas. */
const analisarCausa = (
  dif: number,
  formas: FormaDif[],
  taxaContratada: number | null,
): CausaResult => {
  const absDif = Math.abs(dif)
  const dinheiro = formas.find((f) => isDinheiro(f.nome))
  const pix = formas.find((f) => isPix(f.nome))
  const cards = formas.filter((f) => isCartaoForma(f.nome))
  const somaCards = cards.reduce((s, f) => s + f.diferenca, 0)
  // Forma com maior |diferença| (dominante).
  const dom = [...formas].filter((f) => Math.abs(f.diferenca) > EPS).sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca))[0] ?? null
  const conc = (v: number) => (absDif > EPS ? Math.abs(v) / absDif : 0)

  // 1. PIX recebido não baixado — falta em dinheiro ≈ sobra em PIX.
  if (dinheiro && pix && dinheiro.diferenca < -EPS && pix.diferenca > EPS) {
    const falta = -dinheiro.diferenca
    const sobra = pix.diferenca
    const match = Math.min(falta, sobra) / Math.max(falta, sobra)
    return {
      causa: 'PIX recebido não baixado',
      causaTier: 'atual',
      confianca: clampConf(60 + 35 * match),
      formaDominante: 'PIX',
      isCartao: false,
      evidencias: [
        { texto: `Falta de ${brl(falta)} em Dinheiro casa com sobra de ${brl(sobra)} em PIX no mesmo caixa.`, tier: 'atual' },
        { texto: `Casamento das magnitudes: ${pct0(match * 100)} (PIX recebido provavelmente não foi baixado do dinheiro).`, tier: 'atual' },
      ],
    }
  }

  // 2. Diferença concentrada em cartão.
  if (cards.length > 0 && conc(somaCards) >= 0.6) {
    const ev: Evidencia[] = [
      { texto: `Diferença de ${brl(somaCards)} concentrada em ${dom?.nome ?? 'cartão'} (${pct0(conc(somaCards) * 100)} do total).`, tier: 'atual' },
    ]
    if (taxaContratada != null) {
      ev.push({ texto: `Taxa de cartão contratada média da rede: ~${taxaContratada.toFixed(2).replace('.', ',')}%.`, tier: 'atual' })
    }
    ev.push({ texto: 'Comparar com a taxa EFETIVA paga depende do valor líquido por transação (não exposto na API) — requer histórico.', tier: 'historico' })
    return {
      causa: 'Diferença de taxa de cartão',
      causaTier: 'misto',
      confianca: clampConf(50 + 45 * conc(somaCards)),
      formaDominante: dom?.nome ?? 'Cartão',
      isCartao: true,
      evidencias: ev,
    }
  }

  // 3. Falta concentrada em dinheiro — verificar sangria/troco (NÃO afirma sangria).
  if (dif < -EPS && dinheiro && conc(dinheiro.diferenca) >= 0.85 && dinheiro.diferenca < 0) {
    return {
      causa: 'Falta em dinheiro — verificar sangria/troco',
      causaTier: 'atual',
      confianca: clampConf(50 + 40 * conc(dinheiro.diferenca)),
      formaDominante: 'Dinheiro',
      isCartao: false,
      evidencias: [
        { texto: `Falta de ${brl(dif)} está ${pct0(conc(dinheiro.diferenca) * 100)} em Dinheiro, sem contrapartida em outra forma.`, tier: 'atual' },
        { texto: 'Confirmar cupom de sangria/retirada do turno — movimentos de sangria não são expostos pela API (requer histórico).', tier: 'historico' },
      ],
    }
  }

  // 4. Sobra concentrada em dinheiro — venda/registro a conferir.
  if (dif > EPS && dinheiro && conc(dinheiro.diferenca) >= 0.85 && dinheiro.diferenca > 0) {
    return {
      causa: 'Sobra em dinheiro — venda/registro a conferir',
      causaTier: 'atual',
      confianca: clampConf(50 + 40 * conc(dinheiro.diferenca)),
      formaDominante: 'Dinheiro',
      isCartao: false,
      evidencias: [
        { texto: `Sobra de ${brl(dif)} está ${pct0(conc(dinheiro.diferenca) * 100)} em Dinheiro — possível venda não registrada ou troco a maior.`, tier: 'atual' },
      ],
    }
  }

  // 5. Pequena e diluída — arredondamento / moedas.
  if (!dom || conc(dom.diferenca) < 0.6) {
    return {
      causa: 'Arredondamento / moedas',
      causaTier: 'atual',
      confianca: clampConf(60),
      formaDominante: dom?.nome ?? null,
      isCartao: false,
      evidencias: [
        { texto: `Diferença de ${brl(dif)} diluída entre as formas, sem concentração — padrão de arredondamento/troco em moedas.`, tier: 'atual' },
      ],
    }
  }

  // 6. Fallback — concentração identificável mas sem regra específica.
  return {
    causa: `Diferença concentrada em ${dom.nome}`,
    causaTier: 'atual',
    confianca: clampConf(50 + 30 * conc(dom.diferenca)),
    formaDominante: dom.nome,
    isCartao: isCartaoForma(dom.nome),
    evidencias: [
      { texto: `Diferença de ${brl(dif)} concentrada em ${dom.nome} (${pct0(conc(dom.diferenca) * 100)}). Causa específica a conferir.`, tier: 'atual' },
    ],
  }
}

const useFechamentoExcecao = (): FechamentoExcecaoData => {
  const { turnoRows, conferenciaPdv, isLoading, hasEmpresa } = useOperacaoData()
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()

  // Taxa contratada média da rede (ponderada por valor) — /CARTAO do período.
  // Read-only; não bloqueia o motor (se faltar, fica null e a evidência some).
  const { data: taxaContratadaMediaPct = null } = useQuery({
    queryKey: ['excecao-cartao-taxa', empresaCodigos.join(','), dataInicial, dataFinal],
    queryFn: async () => {
      const lists = await Promise.all(
        (empresaCodigos.length > 0 ? empresaCodigos : [undefined]).map((ec) =>
          fetchCartao({ empresaCodigo: ec, dataInicial, dataFinal, limite: 1000 }).then((r) => r.resultados ?? []),
        ),
      )
      const rows = lists.flat()
      const somaValor = rows.reduce((s, c) => s + (c.valor ?? 0), 0)
      const somaTaxaValor = rows.reduce((s, c) => s + (c.valor ?? 0) * (c.taxaPercentual ?? 0), 0)
      return somaValor > 0 ? somaTaxaValor / somaValor : null
    },
    enabled: hasEmpresa && !!dataInicial && !!dataFinal,
    staleTime: 10 * 60 * 1000,
  })

  return useMemo<FechamentoExcecaoData>(() => {
    const fechados = turnoRows.filter((c) => c.fechado)
    const confByCaixa = new Map<number, ConferenciaCaixa>(conferenciaPdv.map((c) => [c.caixaCodigo, c]))

    // ── Recorrência por operador (normalizada por exposição) ──
    const opStats = new Map<number, { total: number; comDif: number }>()
    for (const c of fechados) {
      const apuradoBase = c.apuradoConferido ?? c.apurado
      const tol = TOLERANCIA_FECHAMENTO(apuradoBase)
      const st = opStats.get(c.funcionarioCodigo) ?? { total: 0, comDif: 0 }
      st.total++
      if (Math.abs(difCaixa(c)) > tol) st.comDif++
      opStats.set(c.funcionarioCodigo, st)
    }
    const recorrenciaDe = (c: TurnoRow): Recorrencia => {
      const st = opStats.get(c.funcionarioCodigo) ?? { total: 0, comDif: 0 }
      const ratePct = st.total > 0 ? (st.comDif / st.total) * 100 : 0
      return {
        count: st.comDif,
        total: st.total,
        ratePct,
        alta: st.comDif >= RECORRENCIA_MIN_COUNT && ratePct >= RECORRENCIA_MIN_RATE,
      }
    }

    // ── Classificação por caixa ──
    let okCount = 0
    const fila: ExcecaoCaixa[] = []
    for (const c of fechados) {
      const apuradoBase = c.apuradoConferido ?? c.apurado
      const tol = TOLERANCIA_FECHAMENTO(apuradoBase)
      const dif = difCaixa(c)

      if (Math.abs(dif) <= tol) { okCount++; continue }

      const formas: FormaDif[] = (confByCaixa.get(c.caixaCodigo)?.formas ?? [])
        .map((f) => ({ nome: f.nome, diferenca: f.diferenca }))
      const causa = analisarCausa(dif, formas, taxaContratadaMediaPct)
      const rec = recorrenciaDe(c)

      const classe: ExcecaoClasse =
        Math.abs(dif) >= investigarValor(apuradoBase) || rec.alta ? 'investigar' : 'revisar'

      const evidencias = [...causa.evidencias]
      if (rec.count > 0) {
        evidencias.push({
          texto: `Operador com ${rec.count} de ${rec.total} caixas com diferença no período (${pct0(rec.ratePct)} — normalizado pela exposição).`,
          tier: 'atual',
        })
      }

      fila.push({
        key: `${c.caixaCodigo}-${c.dataMovimento.slice(0, 10)}`,
        caixaCodigo: c.caixaCodigo,
        data: c.dataMovimento.slice(0, 10),
        turno: c.turno,
        pdvLabel: c.pdvLabel,
        operador: c.funcionarioNome,
        funcionarioCodigo: c.funcionarioCodigo,
        classe,
        apresentado: c.apresentadoTotal,
        apurado: apuradoBase,
        diferenca: dif,
        tolerancia: tol,
        causa: causa.causa,
        causaTier: causa.causaTier,
        confianca: causa.confianca,
        evidencias,
        recorrencia: rec,
        formaDominante: causa.formaDominante,
        isCartao: causa.isCartao,
      })
    }

    // Ordena por severidade: Investigar antes de Revisar; dentro, por |dif| desc.
    const sev: Record<ExcecaoClasse, number> = { investigar: 0, revisar: 1, ok: 2 }
    fila.sort((a, b) => (sev[a.classe] - sev[b.classe]) || (Math.abs(b.diferenca) - Math.abs(a.diferenca)))

    const investigarCount = fila.filter((f) => f.classe === 'investigar').length
    const revisarCount = fila.filter((f) => f.classe === 'revisar').length
    const totalCaixas = fechados.length

    return {
      totalCaixas,
      okCount,
      okPct: totalCaixas > 0 ? Math.round((okCount / totalCaixas) * 100) : 0,
      revisarCount,
      investigarCount,
      fila,
      toleranciaLabel: TOLERANCIA_LABEL,
      taxaContratadaMediaPct,
      isLoading,
      hasEmpresa,
    }
  }, [turnoRows, conferenciaPdv, taxaContratadaMediaPct, isLoading, hasEmpresa])
}

export default useFechamentoExcecao

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@/store/filters'
import useOperacaoData, { type ConferenciaCaixa } from '@/pages/Operacao/hooks/useOperacaoData'
import { fetchCartao, fetchCaixas } from '@/api/endpoints/financeiro'
import { fetchAllPages } from '@/api/helpers/fetchAllPages'
import { todayLocal } from '@/lib/period'
import { difCaixa, isCartaoForma } from '@/lib/difCaixa'

/**
 * Motor DETERMINÍSTICO do "Fechamento por exceção". Read-only, sem IA generativa,
 * sem escrita. Classifica caixas fechados (OK/Revisar/Investigar) + causa/confiança/
 * evidências/recorrência sobre `difCaixa` + `useOperacaoData`. A IA não recalcula.
 *
 * FASE 2: tolerância ADAPTATIVA por PDV (p90 das diferenças dos últimos 90d, piso
 * R$5) no lugar da constante fixa; e HISTÓRICO 90d por operador (sparkline + padrão
 * + métricas normalizadas por exposição vs média da rede).
 *
 * ⚠️ Caveat de base (exibido na UI): o histórico/banda 90d usa `/CAIXA.diferenca`
 * (oficial, leve); o caixa ATUAL usa `difCaixa` (apresentado − apurado conferido).
 * São bases ligeiramente diferentes — mantido de propósito p/ não mexer nos
 * números da Fase 1 já validados (96–98% OK).
 */

const EPS = 0.005

/** Tolerância FIXA (fallback quando o PDV não tem histórico suficiente).
 *  CONFIGURÁVEL, não por-PDV. max(R$5, 1% do apurado). */
export const TOLERANCIA_FECHAMENTO = (apuradoBase: number): number =>
  Math.max(5, Math.abs(apuradoBase) * 0.01)

/** Janela do histórico — CONFIGURÁVEL (afinável sem deploy). */
export const JANELA_HISTORICO_DIAS = 90
/** Piso da banda adaptativa — nunca menor que isto. */
export const BANDA_PISO = 5
/** Mín. de caixas no PDV pra a banda 90d ser confiável (senão cai na fixa). */
const HIST_MIN_CAIXAS = 5

export const TOLERANCIA_LABEL = `Banda adaptativa por PDV (p90 das diferenças dos últimos ${JANELA_HISTORICO_DIAS}d, piso R$5). PDV sem histórico cai na tolerância fixa máx(R$5; 1% do apurado).`

const investigarValor = (apuradoBase: number): number => Math.max(100, Math.abs(apuradoBase) * 0.03)

export type ExcecaoClasse = 'ok' | 'revisar' | 'investigar'
export type EvidenciaTier = 'atual' | 'historico'
export type CausaTier = 'atual' | 'historico' | 'misto'

export interface Evidencia {
  texto: string
  tier: EvidenciaTier
}

/** Banda de tolerância aplicada a este caixa. */
export interface BandaAdaptativa {
  valor: number
  /** 'pdv90d' = aprendida do histórico; 'fixa' = fallback (sem histórico). */
  fonte: 'pdv90d' | 'fixa'
  /** Quanto a |diferença| excede a banda, em % (0 se dentro). */
  excedePct: number
}

export interface SparkPonto {
  data: string
  dif: number
  status: 'sobra' | 'falta' | 'ok'
  /** Caixa mais recente da janela (destacado no sparkline). */
  hoje: boolean
}

/** Histórico 90d do operador — normalizado por exposição (taxa vs média da rede). */
export interface HistoricoOperador {
  serie: SparkPonto[]      // últimas ~12 aberturas
  comDif: number
  total: number
  ratePct: number
  redeRatePct: number
  /** "Falta recorrente" / "Sobra recorrente" / null. Sinal-based (a FORMA não
   *  está no histórico 90d — só na conferência do caixa atual). */
  padrao: string | null
  /** Recorrência alta = taxa bem acima da média da rede (normalizada). */
  alta: boolean
}

export interface ExcecaoCaixa {
  key: string
  caixaCodigo: number
  data: string
  turno: string
  pdvLabel: string
  pdvCodigo: number
  operador: string
  funcionarioCodigo: number
  classe: ExcecaoClasse
  apresentado: number | null
  apurado: number
  diferenca: number
  banda: BandaAdaptativa
  causa: string
  causaTier: CausaTier
  confianca: number
  evidencias: Evidencia[]
  historico: HistoricoOperador
  formaDominante: string | null
  isCartao: boolean
}

export interface FechamentoExcecaoData {
  totalCaixas: number
  /** Postos (PDVs) distintos entre os caixas fechados. */
  unidades: number
  /** Turnos distintos entre os caixas fechados. */
  turnos: number
  okCount: number
  okPct: number
  revisarCount: number
  investigarCount: number
  fila: ExcecaoCaixa[]
  toleranciaLabel: string
  taxaContratadaMediaPct: number | null
  /** Caveat de base (90d oficial × caixa conferido) — exibir no "?". */
  baseCaveat: string
  isLoading: boolean
  hasEmpresa: boolean
}

const up = (s: string) => (s ?? '').toUpperCase()
const isDinheiro = (nome: string) => up(nome).includes('DINHEIRO')
const isPix = (nome: string) => up(nome).includes('PIX')

const brl = (v: number) => `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct0 = (v: number) => `${Math.round(v)}%`
const clampConf = (v: number) => Math.max(50, Math.min(95, Math.round(v)))
const p90 = (vals: number[]): number => {
  if (vals.length === 0) return 0
  const s = [...vals].sort((a, b) => a - b)
  return s[Math.floor(0.9 * (s.length - 1))]
}
const minusDays = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d - n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

interface FormaDif { nome: string; diferenca: number }
interface CausaResult {
  causa: string
  causaTier: CausaTier
  confianca: number
  evidencias: Evidencia[]
  formaDominante: string | null
  isCartao: boolean
}

/** Núcleo determinístico (Fase 1, validado): causa provável a partir das formas. */
const analisarCausa = (dif: number, formas: FormaDif[], taxaContratada: number | null): CausaResult => {
  const absDif = Math.abs(dif)
  const dinheiro = formas.find((f) => isDinheiro(f.nome))
  const pix = formas.find((f) => isPix(f.nome))
  const cards = formas.filter((f) => isCartaoForma(f.nome))
  const somaCards = cards.reduce((s, f) => s + f.diferenca, 0)
  const dom = [...formas].filter((f) => Math.abs(f.diferenca) > EPS).sort((a, b) => Math.abs(b.diferenca) - Math.abs(a.diferenca))[0] ?? null
  const conc = (v: number) => (absDif > EPS ? Math.abs(v) / absDif : 0)

  if (dinheiro && pix && dinheiro.diferenca < -EPS && pix.diferenca > EPS) {
    const falta = -dinheiro.diferenca, sobra = pix.diferenca
    const match = Math.min(falta, sobra) / Math.max(falta, sobra)
    return {
      causa: 'PIX recebido não baixado', causaTier: 'atual', confianca: clampConf(60 + 35 * match),
      formaDominante: 'PIX', isCartao: false,
      evidencias: [
        { texto: `Falta de ${brl(falta)} em Dinheiro casa com sobra de ${brl(sobra)} em PIX no mesmo caixa.`, tier: 'atual' },
        { texto: `Casamento das magnitudes: ${pct0(match * 100)} (PIX recebido provavelmente não foi baixado do dinheiro).`, tier: 'atual' },
      ],
    }
  }

  if (cards.length > 0 && conc(somaCards) >= 0.6) {
    const ev: Evidencia[] = [
      { texto: `Diferença de ${brl(somaCards)} concentrada em ${dom?.nome ?? 'cartão'} (${pct0(conc(somaCards) * 100)} do total).`, tier: 'atual' },
    ]
    if (taxaContratada != null) ev.push({ texto: `Taxa de cartão contratada média da rede: ~${taxaContratada.toFixed(2).replace('.', ',')}%.`, tier: 'atual' })
    ev.push({ texto: 'Comparar com a taxa EFETIVA paga depende do valor líquido por transação (não exposto na API) — requer histórico.', tier: 'historico' })
    return {
      causa: 'Diferença de taxa de cartão', causaTier: 'misto', confianca: clampConf(50 + 45 * conc(somaCards)),
      formaDominante: dom?.nome ?? 'Cartão', isCartao: true, evidencias: ev,
    }
  }

  if (dif < -EPS && dinheiro && conc(dinheiro.diferenca) >= 0.85 && dinheiro.diferenca < 0) {
    return {
      causa: 'Falta em dinheiro — verificar sangria/troco', causaTier: 'atual', confianca: clampConf(50 + 40 * conc(dinheiro.diferenca)),
      formaDominante: 'Dinheiro', isCartao: false,
      evidencias: [
        { texto: `Falta de ${brl(dif)} está ${pct0(conc(dinheiro.diferenca) * 100)} em Dinheiro, sem contrapartida em outra forma.`, tier: 'atual' },
        { texto: 'Confirmar cupom de sangria/retirada do turno — movimentos de sangria não são expostos pela API (requer histórico).', tier: 'historico' },
      ],
    }
  }

  if (dif > EPS && dinheiro && conc(dinheiro.diferenca) >= 0.85 && dinheiro.diferenca > 0) {
    return {
      causa: 'Sobra em dinheiro — venda/registro a conferir', causaTier: 'atual', confianca: clampConf(50 + 40 * conc(dinheiro.diferenca)),
      formaDominante: 'Dinheiro', isCartao: false,
      evidencias: [
        { texto: `Sobra de ${brl(dif)} está ${pct0(conc(dinheiro.diferenca) * 100)} em Dinheiro — possível venda não registrada ou troco a maior.`, tier: 'atual' },
      ],
    }
  }

  if (!dom || conc(dom.diferenca) < 0.6) {
    return {
      causa: 'Arredondamento / moedas', causaTier: 'atual', confianca: clampConf(60),
      formaDominante: dom?.nome ?? null, isCartao: false,
      evidencias: [{ texto: `Diferença de ${brl(dif)} diluída entre as formas, sem concentração — padrão de arredondamento/troco em moedas.`, tier: 'atual' }],
    }
  }

  return {
    causa: `Diferença concentrada em ${dom.nome}`, causaTier: 'atual', confianca: clampConf(50 + 30 * conc(dom.diferenca)),
    formaDominante: dom.nome, isCartao: isCartaoForma(dom.nome),
    evidencias: [{ texto: `Diferença de ${brl(dif)} concentrada em ${dom.nome} (${pct0(conc(dom.diferenca) * 100)}). Causa específica a conferir.`, tier: 'atual' }],
  }
}

const useFechamentoExcecao = (): FechamentoExcecaoData => {
  const { turnoRows, conferenciaPdv, isLoading, hasEmpresa } = useOperacaoData()
  const { empresaCodigos, dataInicial, dataFinal } = useFilterStore()

  // Taxa contratada média da rede (ponderada por valor) — /CARTAO do período.
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

  // Histórico 90d (rolling) — /CAIXA dos últimos JANELA dias. Base do banda
  // adaptativa por PDV + recorrência por operador. Usa /CAIXA.diferenca (leve).
  const hoje = todayLocal()
  const ini90 = useMemo(() => minusDays(hoje, JANELA_HISTORICO_DIAS), [hoje])
  const { data: hist90Raw = [] } = useQuery({
    queryKey: ['excecao-hist90', empresaCodigos.join(','), ini90, hoje],
    queryFn: async () => {
      const lists = await Promise.all(
        (empresaCodigos.length > 0 ? empresaCodigos : []).map((ec) =>
          fetchAllPages(
            (p) => fetchCaixas({ empresaCodigo: ec, dataInicial: ini90, dataFinal: hoje, ultimoCodigo: p.ultimoCodigo, limite: p.limite }),
            1000, 30,
          ),
        ),
      )
      return lists.flat()
    },
    enabled: hasEmpresa,
    staleTime: 30 * 60 * 1000,
  })

  // Deriva banda por PDV + histórico por operador + taxa média da rede.
  const hist90 = useMemo(() => {
    const fech = hist90Raw.filter((c) => c.fechado)
    // Banda por PDV = p90(|dif|), piso BANDA_PISO; só com histórico suficiente.
    const byPdvDifs = new Map<number, number[]>()
    for (const c of fech) {
      const arr = byPdvDifs.get(c.pdvCodigo) ?? []
      arr.push(c.diferenca ?? 0)
      byPdvDifs.set(c.pdvCodigo, arr)
    }
    const bandByPdv = new Map<number, number>()
    for (const [pdv, difs] of byPdvDifs) {
      if (difs.length < HIST_MIN_CAIXAS) continue
      bandByPdv.set(pdv, Math.max(BANDA_PISO, p90(difs.map(Math.abs))))
    }
    const bandaDe = (pdv: number) => bandByPdv.get(pdv) ?? BANDA_PISO

    // Taxa média da rede (caixas fora da banda / total).
    const redeComDif = fech.reduce((s, c) => s + (Math.abs(c.diferenca ?? 0) > bandaDe(c.pdvCodigo) ? 1 : 0), 0)
    const redeRatePct = fech.length > 0 ? (redeComDif / fech.length) * 100 : 0

    // Histórico por operador.
    const byOp = new Map<number, { data: string; dif: number; pdv: number }[]>()
    for (const c of fech) {
      const arr = byOp.get(c.funcionarioCodigo) ?? []
      arr.push({ data: c.dataMovimento.slice(0, 10), dif: c.diferenca ?? 0, pdv: c.pdvCodigo })
      byOp.set(c.funcionarioCodigo, arr)
    }
    const histByOp = new Map<number, HistoricoOperador>()
    for (const [func, caixas] of byOp) {
      caixas.sort((a, b) => a.data.localeCompare(b.data))
      const comDifList = caixas.filter((x) => Math.abs(x.dif) > bandaDe(x.pdv))
      const comDif = comDifList.length
      const total = caixas.length
      const ratePct = total > 0 ? (comDif / total) * 100 : 0
      const faltas = comDifList.filter((x) => x.dif < 0).length
      const sobras = comDif - faltas
      let padrao: string | null = null
      if (comDif >= 3) {
        if (faltas / comDif >= 0.6) padrao = 'Falta recorrente'
        else if (sobras / comDif >= 0.6) padrao = 'Sobra recorrente'
      }
      const ultimas = caixas.slice(-12)
      const serie: SparkPonto[] = ultimas.map((x, i) => ({
        data: x.data,
        dif: x.dif,
        status: Math.abs(x.dif) <= bandaDe(x.pdv) ? 'ok' : x.dif < 0 ? 'falta' : 'sobra',
        hoje: i === ultimas.length - 1,
      }))
      const alta = comDif >= 3 && ratePct >= Math.max(40, 2 * redeRatePct)
      histByOp.set(func, { serie, comDif, total, ratePct, redeRatePct, padrao, alta })
    }
    return { bandByPdv, histByOp, redeRatePct }
  }, [hist90Raw])

  return useMemo<FechamentoExcecaoData>(() => {
    const fechados = turnoRows.filter((c) => c.fechado)
    const confByCaixa = new Map<number, ConferenciaCaixa>(conferenciaPdv.map((c) => [c.caixaCodigo, c]))
    const emptyHist: HistoricoOperador = { serie: [], comDif: 0, total: 0, ratePct: 0, redeRatePct: hist90.redeRatePct, padrao: null, alta: false }

    let okCount = 0
    const fila: ExcecaoCaixa[] = []
    for (const c of fechados) {
      const apuradoBase = c.apuradoConferido ?? c.apurado
      const bandaPdv = hist90.bandByPdv.get(c.pdvCodigo)
      const tol = bandaPdv ?? TOLERANCIA_FECHAMENTO(apuradoBase)
      const dif = difCaixa(c)

      if (Math.abs(dif) <= tol) { okCount++; continue }

      const formas: FormaDif[] = (confByCaixa.get(c.caixaCodigo)?.formas ?? []).map((f) => ({ nome: f.nome, diferenca: f.diferenca }))
      const causa = analisarCausa(dif, formas, taxaContratadaMediaPct)
      const historico = hist90.histByOp.get(c.funcionarioCodigo) ?? emptyHist
      const classe: ExcecaoClasse = Math.abs(dif) >= investigarValor(apuradoBase) || historico.alta ? 'investigar' : 'revisar'

      const evidencias = [...causa.evidencias]
      if (historico.comDif > 0) {
        evidencias.push({
          texto: `Operador: ${historico.comDif} de ${historico.total} caixas com diferença em ${JANELA_HISTORICO_DIAS}d (${pct0(historico.ratePct)} vs ${pct0(historico.redeRatePct)} da rede — normalizado por exposição).`,
          tier: 'atual',
        })
      }

      fila.push({
        key: `${c.caixaCodigo}-${c.dataMovimento.slice(0, 10)}`,
        caixaCodigo: c.caixaCodigo,
        data: c.dataMovimento.slice(0, 10),
        turno: c.turno,
        pdvLabel: c.pdvLabel,
        pdvCodigo: c.pdvCodigo,
        operador: c.funcionarioNome,
        funcionarioCodigo: c.funcionarioCodigo,
        classe,
        apresentado: c.apresentadoTotal,
        apurado: apuradoBase,
        diferenca: dif,
        banda: { valor: tol, fonte: bandaPdv != null ? 'pdv90d' : 'fixa', excedePct: tol > 0 ? Math.max(0, ((Math.abs(dif) - tol) / tol) * 100) : 0 },
        causa: causa.causa,
        causaTier: causa.causaTier,
        confianca: causa.confianca,
        evidencias,
        historico,
        formaDominante: causa.formaDominante,
        isCartao: causa.isCartao,
      })
    }

    const sev: Record<ExcecaoClasse, number> = { investigar: 0, revisar: 1, ok: 2 }
    fila.sort((a, b) => (sev[a.classe] - sev[b.classe]) || (Math.abs(b.diferenca) - Math.abs(a.diferenca)))

    const totalCaixas = fechados.length
    return {
      totalCaixas,
      unidades: new Set(fechados.map((c) => c.pdvLabel)).size,
      turnos: new Set(fechados.map((c) => c.turno)).size,
      okCount,
      okPct: totalCaixas > 0 ? Math.round((okCount / totalCaixas) * 100) : 0,
      revisarCount: fila.filter((f) => f.classe === 'revisar').length,
      investigarCount: fila.filter((f) => f.classe === 'investigar').length,
      fila,
      toleranciaLabel: TOLERANCIA_LABEL,
      taxaContratadaMediaPct,
      baseCaveat: `O histórico ${JANELA_HISTORICO_DIAS}d e a banda usam a diferença OFICIAL do caixa (/CAIXA); o caixa atual usa o valor CONFERIDO (apresentado − apurado conferido). Bases ligeiramente diferentes — por isso a banda é referência, não regra contábil.`,
      isLoading,
      hasEmpresa,
    }
  }, [turnoRows, conferenciaPdv, taxaContratadaMediaPct, hist90, isLoading, hasEmpresa])
}

export default useFechamentoExcecao

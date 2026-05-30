/**
 * Score de frentistas (0–100) — combina 6 indicadores normalizados entre os
 * frentistas do período, por média ponderada. Pesos definidos com o usuário.
 *
 * Lucro bruto carrega a ressalva de cobertura de custo: soma só os litros que
 * têm custo apurado (precoCusto > 0), igual ao L.B./margem do Combustível —
 * litros sem custo ficam de fora pra não inflar a margem.
 */

/** Linha mínima de abastecimento usada pra montar os inputs do score. */
export interface ScoreAbastRow {
  frentistaCodigo: number
  combustivelNome: string
  litros: number
  valorTotal: number
  lucroBruto: number
  precoCusto: number
}

/** Agregados brutos por frentista (antes da normalização). */
export interface FrentistaScoreInput {
  litros: number
  litrosComCusto: number
  automotivoLitros: number
  gasolinaLitros: number
  aditivadaLitros: number
  abastecimentos: number
  faturamento: number
  faturamentoAutomotivo: number
  abastAutomotivo: number
  lucroBruto: number
}

/** Métricas derivadas + score final por frentista. */
export interface FrentistaScore {
  lucroBruto: number
  automotivo: number
  mixAditivadaPct: number
  ticketMedio: number
  ticketMedioAutomotivo: number
  abastecimentos: number
  /** % dos litros do frentista que têm custo apurado (cobertura). */
  coberturaCustoPct: number
  /** Score final 0–100 (média ponderada das 6 métricas normalizadas). */
  score: number
}

export const SCORE_WEIGHTS = {
  lucro: 0.3,
  automotivo: 0.2,
  mixAditivada: 0.15,
  ticketMedio: 0.15,
  ticketAutomotivo: 0.1,
  abastecimentos: 0.1,
} as const

export const SCORE_TOOLTIP =
  'O Score (0–100) ranqueia o frentista combinando 6 indicadores do período, ' +
  'cada um reescalado de 0 (o menor do grupo) a 100 (o maior do grupo) e somado por peso: ' +
  'Lucro bruto 30%, Automotivo/litros 20%, Mix aditivada 15%, Ticket médio 15%, ' +
  'Ticket médio automotivo 10% e Nº de abastecimentos 10%. ' +
  '100 = melhor do grupo em tudo. O lucro considera só os litros com custo apurado (cobertura).'

const upper = (s: string) => (s ?? '').toUpperCase()
const isAutomotivo = (nome: string): boolean => {
  const u = upper(nome)
  return (
    u.includes('GASOLINA') ||
    u.includes('ETANOL') ||
    u.includes('ALCOOL') ||
    u.includes('ÁLCOOL') ||
    u.includes('DIESEL') ||
    u.includes('S-10') ||
    u.includes('S10') ||
    u.includes('S500')
  )
}
const isGasolina = (nome: string) => upper(nome).includes('GASOLINA')
const isAditivada = (nome: string) => upper(nome).includes('ADITIVADA')

/** Monta os agregados por frentista a partir dos abastecimentos (com custo). */
export const buildScoreInputs = (
  rows: ScoreAbastRow[],
): Map<number, FrentistaScoreInput> => {
  const map = new Map<number, FrentistaScoreInput>()
  for (const r of rows) {
    const cur =
      map.get(r.frentistaCodigo) ?? {
        litros: 0,
        litrosComCusto: 0,
        automotivoLitros: 0,
        gasolinaLitros: 0,
        aditivadaLitros: 0,
        abastecimentos: 0,
        faturamento: 0,
        faturamentoAutomotivo: 0,
        abastAutomotivo: 0,
        lucroBruto: 0,
      }
    const auto = isAutomotivo(r.combustivelNome)
    cur.litros += r.litros
    cur.abastecimentos += 1
    cur.faturamento += r.valorTotal
    if (r.precoCusto > 0) {
      cur.litrosComCusto += r.litros
      cur.lucroBruto += r.lucroBruto
    }
    if (auto) {
      cur.automotivoLitros += r.litros
      cur.faturamentoAutomotivo += r.valorTotal
      cur.abastAutomotivo += 1
    }
    if (isGasolina(r.combustivelNome)) {
      cur.gasolinaLitros += r.litros
      if (isAditivada(r.combustivelNome)) cur.aditivadaLitros += r.litros
    }
    map.set(r.frentistaCodigo, cur)
  }
  return map
}

const normalize = (value: number, min: number, max: number): number => {
  if (max <= min) return 50 // todos iguais → neutro
  return ((value - min) / (max - min)) * 100
}

/**
 * Calcula o score 0–100 de cada frentista. A normalização é RELATIVA ao
 * conjunto passado (os frentistas do período), então o score só faz sentido
 * comparando frentistas entre si no mesmo período.
 */
export const computeScores = (
  inputs: Map<number, FrentistaScoreInput>,
): Map<number, FrentistaScore> => {
  const entries = [...inputs.entries()]
  const derived = entries.map(([codigo, i]) => ({
    codigo,
    lucroBruto: i.lucroBruto,
    automotivo: i.automotivoLitros,
    mixAditivadaPct: i.gasolinaLitros > 0 ? (i.aditivadaLitros / i.gasolinaLitros) * 100 : 0,
    ticketMedio: i.abastecimentos > 0 ? i.faturamento / i.abastecimentos : 0,
    ticketMedioAutomotivo: i.abastAutomotivo > 0 ? i.faturamentoAutomotivo / i.abastAutomotivo : 0,
    abastecimentos: i.abastecimentos,
    coberturaCustoPct: i.litros > 0 ? (i.litrosComCusto / i.litros) * 100 : 0,
  }))

  const range = (sel: (d: (typeof derived)[number]) => number) => {
    const vals = derived.map(sel)
    return { min: Math.min(...vals), max: Math.max(...vals) }
  }
  const rLucro = range((d) => d.lucroBruto)
  const rAuto = range((d) => d.automotivo)
  const rMix = range((d) => d.mixAditivadaPct)
  const rTicket = range((d) => d.ticketMedio)
  const rTicketAuto = range((d) => d.ticketMedioAutomotivo)
  const rAbast = range((d) => d.abastecimentos)

  const result = new Map<number, FrentistaScore>()
  for (const d of derived) {
    const score =
      normalize(d.lucroBruto, rLucro.min, rLucro.max) * SCORE_WEIGHTS.lucro +
      normalize(d.automotivo, rAuto.min, rAuto.max) * SCORE_WEIGHTS.automotivo +
      normalize(d.mixAditivadaPct, rMix.min, rMix.max) * SCORE_WEIGHTS.mixAditivada +
      normalize(d.ticketMedio, rTicket.min, rTicket.max) * SCORE_WEIGHTS.ticketMedio +
      normalize(d.ticketMedioAutomotivo, rTicketAuto.min, rTicketAuto.max) * SCORE_WEIGHTS.ticketAutomotivo +
      normalize(d.abastecimentos, rAbast.min, rAbast.max) * SCORE_WEIGHTS.abastecimentos
    result.set(d.codigo, {
      lucroBruto: d.lucroBruto,
      automotivo: d.automotivo,
      mixAditivadaPct: d.mixAditivadaPct,
      ticketMedio: d.ticketMedio,
      ticketMedioAutomotivo: d.ticketMedioAutomotivo,
      abastecimentos: d.abastecimentos,
      coberturaCustoPct: d.coberturaCustoPct,
      score,
    })
  }
  return result
}

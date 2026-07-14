/**
 * Projeção de fechamento suavizada por média móvel.
 *
 * A extrapolação linear ingênua (`realizado × diasTotais / diasDecorridos`)
 * usa a média de TODOS os dias decorridos como ritmo — então um único dia
 * atípico (feriado, pico, queda) distorce a projeção do mês inteiro.
 *
 * Aqui o ritmo diário vem da média dos últimos `window` dias FECHADOS (hoje
 * é excluído porque é parcial) e só os dias que ainda faltam são projetados:
 *
 *   projetado = realizado + médiaMóvel(últimos N dias fechados) × diasRestantes
 *
 * A janela default de 7 dias cobre o ciclo semanal completo (dias úteis vs
 * fim de semana), suavizando a sazonalidade da semana.
 */

export interface ProjectionDailyPoint {
  /** Data do dia em yyyy-MM-dd. */
  data: string
  /** Valor realizado nesse dia (faturamento, litros, apurado, etc.). */
  value: number
}

/**
 * Ritmo diário = média dos últimos `window` dias fechados. Dias `>= today`
 * são ignorados (hoje é parcial; futuro não existe). A série é ordenada
 * internamente, então o caller não precisa se preocupar com a ordem.
 */
export const movingAverageDailyRate = (
  dailySeries: ProjectionDailyPoint[],
  today: string,
  window = 7,
): number => {
  const closed = dailySeries
    .filter((d) => d.data < today)
    .sort((a, b) => a.data.localeCompare(b.data))
  if (closed.length === 0) return 0
  const recent = window > 0 ? closed.slice(-window) : closed
  return recent.reduce((s, d) => s + d.value, 0) / recent.length
}

export interface SmoothedProjectionInput {
  /** Total já realizado (autoritativo — pode incluir o parcial de hoje). */
  realizado: number
  /** Série diária dos dias com dados (hoje é excluído do cálculo do ritmo). */
  dailySeries: ProjectionDailyPoint[]
  /** Dias que ainda faltam até o fim do período (estritamente após hoje). */
  diasRestantes: number
  /** Data de hoje em yyyy-MM-dd. */
  today: string
  /** Janela da média móvel. Default 7 (ciclo semanal). */
  window?: number
}

export interface SmoothedProjectionResult {
  /** Ritmo diário suavizado usado na projeção. */
  dailyRate: number
  /** Valor projetado para o fim do período. */
  projetado: number
}

export const smoothedProjection = ({
  realizado,
  dailySeries,
  diasRestantes,
  today,
  window = 7,
}: SmoothedProjectionInput): SmoothedProjectionResult => {
  const dailyRate = movingAverageDailyRate(dailySeries, today, window)
  const projetado = realizado + dailyRate * Math.max(0, diasRestantes)
  return { dailyRate, projetado }
}

/**
 * Projeção LINEAR simples: ritmo = média de TODOS os dias FECHADOS (hoje é
 * excluído por ser parcial) e projeta os dias que faltam:
 *
 *   projetado = realizado + média(todos os dias fechados) × diasRestantes
 *
 * É o "ritmo dos dias fechados × dias abertos até o fim do mês" puro — mais
 * sensível a dias atípicos que a média móvel, mas mais previsível/transparente.
 * Implementado como `smoothedProjection` sem janela (usa todos os dias).
 */
export const linearProjection = (
  input: Omit<SmoothedProjectionInput, 'window'>,
): SmoothedProjectionResult => smoothedProjection({ ...input, window: 0 })

/**
 * Fator de extrapolação LINEAR por dias até o fim do mês — para telas que só têm
 * o AGREGADO do período (sem série diária). Multiplique o realizado por este
 * fator pra projetar o fechamento: `projetado = realizado × fator`, onde
 * `fator = dias totais até o fim do mês ÷ dias decorridos`.
 *
 * Equivale à projeção linear (média de todos os dias decorridos × dias
 * restantes), só que derivada do total. Em período já FECHADO (passado),
 * retorna 1 → projeção = realizado.
 */
export const monthEndFactor = (dataInicial: string, dataFinal: string): number => {
  if (!dataInicial) return 1
  const [y, m] = dataInicial.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const monthEndISO = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const now = new Date()
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const dia = (s: string) => { const [yy, mm, dd] = s.split('-').map(Number); return Date.UTC(yy, mm - 1, dd) }
  const fimProj = dataFinal > monthEndISO ? dataFinal : monthEndISO
  const fimReal = todayISO < dataFinal ? todayISO : dataFinal
  const decorridos = Math.max(1, Math.round((dia(fimReal) - dia(dataInicial)) / 86_400_000) + 1)
  const totais = Math.max(decorridos, Math.round((dia(fimProj) - dia(dataInicial)) / 86_400_000) + 1)
  return totais / decorridos
}

/* ─── Projeção AVANÇADA (tendência + sazonalidade + cenários + confiabilidade) ─── */

const weekdayOfIso = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return 0
  return new Date(y, m - 1, d).getDay() // 0=Dom .. 6=Sáb
}

const addDaysIso = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** Último dia do mês de uma data yyyy-MM-dd (horizonte padrão das projeções). */
export const fimDoMesIso = (iso: string): string => {
  const [y, m] = iso.split('-').map(Number)
  if (!y || !m) return iso
  const last = new Date(y, m, 0).getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`
}

export type Confiabilidade = 'alta' | 'media' | 'baixa'

export interface ProjecaoSparkPoint {
  data: string
  /** Valor real (dia fechado) — null nos dias projetados. */
  real: number | null
  /** Valor projetado (dias futuros) — null nos dias reais, exceto no ponto de junção. */
  projetado: number | null
}

export interface ProjecaoAvancadaInput {
  /** Série diária COM dados. Dias < hoje = apurados (base); hoje em diante é projetado. */
  dailySeries: ProjectionDailyPoint[]
  /** Data de hoje em yyyy-MM-dd. O dia corrente (parcial) NÃO entra no realizado. */
  today: string
  /** Horizonte da projeção (yyyy-MM-dd, inclusive) — tipicamente o último dia do mês. */
  dataFinal: string
  /** Janela do ritmo recente. Default 7. */
  recentWindow?: number
}

export interface ProjecaoAvancadaResult {
  realizado: number
  conservador: number
  esperado: number
  otimista: number
  mediaDiaria: number
  mediaRecente: number
  /** Variação do ritmo recente vs média do período (>0 crescimento, <0 queda). */
  tendenciaPct: number
  diasFechados: number
  diasRestantes: number
  confiabilidadePct: number
  confiabilidade: Confiabilidade
  sparkline: ProjecaoSparkPoint[]
}

/**
 * Projeção financeira "executiva": combina média dos dias apurados, tendência
 * recente, sazonalidade por dia-da-semana e a volatilidade da série pra gerar
 * 3 cenários (conservador / esperado / otimista) + um score de confiabilidade.
 *
 * SEMPRE projeta do último dia apurado até `dataFinal` (fim do mês), incluindo
 * o dia corrente — o parcial de HOJE não entra no realizado (é projetado como
 * dia faltante). Funciona igual em "Apurado", "Em andamento" e "Completo".
 *
 *   realizado   = Σ(dias apurados, < hoje)
 *   esperado    = realizado + Σ(dias faltantes × ritmo recente × fator do dia da semana)
 *   conservador = realizado + faltante × (1 − banda)
 *   otimista    = realizado + faltante × (1 + banda)   [banda = coef. de variação capado]
 */
export const projecaoAvancada = ({
  dailySeries,
  today,
  dataFinal,
  recentWindow = 7,
}: ProjecaoAvancadaInput): ProjecaoAvancadaResult => {
  const closed = dailySeries
    .filter((d) => d.data < today)
    .sort((a, b) => a.data.localeCompare(b.data))
  const n = closed.length
  const realizado = closed.reduce((s, d) => s + d.value, 0)

  if (n === 0) {
    return {
      realizado,
      conservador: realizado,
      esperado: realizado,
      otimista: realizado,
      mediaDiaria: 0,
      mediaRecente: 0,
      tendenciaPct: 0,
      diasFechados: 0,
      diasRestantes: 0,
      confiabilidadePct: 0,
      confiabilidade: 'baixa',
      sparkline: [],
    }
  }

  const valores = closed.map((d) => d.value)
  const mediaDiaria = realizado / n
  const recent = closed.slice(-recentWindow)
  const mediaRecente = recent.reduce((s, d) => s + d.value, 0) / recent.length
  const tendenciaPct = mediaDiaria > 0 ? (mediaRecente - mediaDiaria) / mediaDiaria : 0

  // Sazonalidade por dia-da-semana (fator 1 quando amostra insuficiente).
  const byWeekday = new Map<number, { soma: number; n: number }>()
  for (const d of closed) {
    const wd = weekdayOfIso(d.data)
    const cur = byWeekday.get(wd) ?? { soma: 0, n: 0 }
    cur.soma += d.value
    cur.n += 1
    byWeekday.set(wd, cur)
  }
  const weekdayFactor = (wd: number): number => {
    const e = byWeekday.get(wd)
    if (!e || e.n < 2 || mediaDiaria <= 0) return 1
    return e.soma / e.n / mediaDiaria
  }

  // Projeta do dia seguinte ao último apurado até dataFinal (inclui HOJE — o
  // dia corrente entra como faltante, não como realizado).
  let restanteEsperado = 0
  const projDays: { data: string; value: number }[] = []
  let cursor = addDaysIso(closed[n - 1].data, 1)
  let guard = 0
  while (cursor <= dataFinal && guard < 400) {
    const v = mediaRecente * weekdayFactor(weekdayOfIso(cursor))
    restanteEsperado += v
    projDays.push({ data: cursor, value: v })
    cursor = addDaysIso(cursor, 1)
    guard++
  }
  const diasRest = projDays.length
  const esperado = realizado + restanteEsperado

  // Banda dos cenários = coeficiente de variação dos dias fechados, capado.
  const variancia = valores.reduce((s, v) => s + (v - mediaDiaria) ** 2, 0) / n
  const coefVar = mediaDiaria > 0 ? Math.sqrt(variancia) / mediaDiaria : 0
  const banda = Math.min(0.25, Math.max(0.05, coefVar))
  const conservador = realizado + restanteEsperado * (1 - banda)
  const otimista = realizado + restanteEsperado * (1 + banda)

  // Confiabilidade: cobertura (dias fechados/total) + estabilidade (1−coefVar) + amostra.
  const totalDias = n + diasRest
  const cobertura = totalDias > 0 ? n / totalDias : 0
  const estabilidade = 1 - Math.min(1, coefVar)
  const amostra = Math.min(1, n / 7)
  const confiabilidadePct = Math.round((cobertura * 0.4 + estabilidade * 0.4 + amostra * 0.2) * 100)
  const confiabilidade: Confiabilidade =
    confiabilidadePct >= 70 ? 'alta' : confiabilidadePct >= 45 ? 'media' : 'baixa'

  // Sparkline: dias reais + cauda projetada (o último real vira ponto de junção).
  const sparkline: ProjecaoSparkPoint[] = closed.map((d, idx) => ({
    data: d.data,
    real: d.value,
    projetado: idx === n - 1 ? d.value : null,
  }))
  for (const p of projDays) sparkline.push({ data: p.data, real: null, projetado: p.value })

  return {
    realizado,
    conservador,
    esperado,
    otimista,
    mediaDiaria,
    mediaRecente,
    tendenciaPct,
    diasFechados: n,
    diasRestantes: diasRest,
    confiabilidadePct,
    confiabilidade,
    sparkline,
  }
}

/* ─── Projeção SAZONAL (fator month-end ponderado por dia-da-semana) ───
 * Ver docs/SPEC-projecao-sazonal.md. Núcleo puro; o caller decide o ramo
 * (linear × ponderado) no dia 1 do mês via dias_operação e passa `indices`
 * reais ou todos = 1 (linear). */

/**
 * Índice de dia-da-semana a partir de uma série histórica diária (idealmente
 * ~6 meses). `indice[wd] = média(valor no wd) ÷ média(valor de todos os dias)`.
 * Devolve 1 (neutro) para dias-da-semana com amostra < `minSamples`.
 */
export const weekdayIndices = (
  dailySeries: ProjectionDailyPoint[],
  opts: { minSamples?: number } = {},
): Record<number, number> => {
  const minSamples = opts.minSamples ?? 2
  const geral = dailySeries.length ? dailySeries.reduce((s, d) => s + d.value, 0) / dailySeries.length : 0
  const acc = new Map<number, { soma: number; n: number }>()
  for (const d of dailySeries) {
    const wd = weekdayOfIso(d.data)
    const e = acc.get(wd) ?? { soma: 0, n: 0 }
    e.soma += d.value; e.n += 1
    acc.set(wd, e)
  }
  const out: Record<number, number> = {}
  for (let wd = 0; wd < 7; wd++) {
    const e = acc.get(wd)
    out[wd] = e && e.n >= minSamples && geral > 0 ? (e.soma / e.n) / geral : 1
  }
  return out
}

/**
 * `dias_operação` por PROXY: dias desde a PRIMEIRA venda conhecida no cache.
 * Retorna 0 quando não há venda. Cache raso (posto antigo com pouco histórico)
 * pode subestimar → a correção fina é o override manual (tabela Supabase).
 */
export const diasOperacaoProxy = (primeiraVendaISO: string | null, hojeISO: string): number => {
  if (!primeiraVendaISO) return 0
  const dia = (s: string) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  return Math.max(0, Math.round((dia(hojeISO) - dia(primeiraVendaISO)) / 86_400_000))
}

export interface ProjecaoSazonalInput {
  /** Série diária COM dados do MÊS corrente. Dias < hoje = fechados (base). */
  dailySeries: ProjectionDailyPoint[]
  /** Data de hoje (yyyy-MM-dd) — o dia corrente entra como restante. */
  today: string
  /** Horizonte (yyyy-MM-dd, inclusive) — o fim do mês. */
  dataFinal: string
  /** Índice por dia-da-semana (0=Dom..6=Sáb). Ramo LINEAR → passe 1 p/ todos. */
  indices: Record<number, number>
  /** Janela do ritmo recente (só p/ os chips informativos). Default 7. */
  recentWindow?: number
}

/**
 * Projeção sazonal = `realizado + Σ(dias restantes)[ ritmo × índice[dia] ]`,
 * onde `ritmo = realizado ÷ Σ índice[dias fechados]`. Equivale a
 * `realizado × (Σíndice_todos ÷ Σíndice_fechados)`. Com `indices` todos = 1 vira
 * o `monthEndFactor` (linear). Mesmo contrato de retorno do `projecaoAvancada`
 * (cenários/confiabilidade/sparkline preservados em volta do novo `esperado`).
 */
export const projecaoSazonal = ({
  dailySeries,
  today,
  dataFinal,
  indices,
  recentWindow = 7,
}: ProjecaoSazonalInput): ProjecaoAvancadaResult => {
  const closed = dailySeries.filter((d) => d.data < today).sort((a, b) => a.data.localeCompare(b.data))
  const n = closed.length
  const realizado = closed.reduce((s, d) => s + d.value, 0)
  const idx = (iso: string) => indices[weekdayOfIso(iso)] ?? 1

  if (n === 0) {
    return {
      realizado, conservador: realizado, esperado: realizado, otimista: realizado,
      mediaDiaria: 0, mediaRecente: 0, tendenciaPct: 0, diasFechados: 0, diasRestantes: 0,
      confiabilidadePct: 0, confiabilidade: 'baixa', sparkline: [],
    }
  }

  const valores = closed.map((d) => d.value)
  const mediaDiaria = realizado / n
  const recent = closed.slice(-recentWindow)
  const mediaRecente = recent.reduce((s, d) => s + d.value, 0) / recent.length
  const tendenciaPct = mediaDiaria > 0 ? (mediaRecente - mediaDiaria) / mediaDiaria : 0

  // Ritmo desazonalizado: realizado ÷ Σ índice dos dias JÁ FECHADOS (com dado).
  const sumFechados = closed.reduce((s, d) => s + idx(d.data), 0)
  const ritmo = sumFechados > 0 ? realizado / sumFechados : mediaDiaria

  // Dias restantes = do dia seguinte ao último fechado até dataFinal (inclui hoje).
  const projDays: { data: string; value: number }[] = []
  let cursor = addDaysIso(closed[n - 1].data, 1)
  let guard = 0
  while (cursor <= dataFinal && guard < 400) {
    projDays.push({ data: cursor, value: ritmo * idx(cursor) })
    cursor = addDaysIso(cursor, 1)
    guard++
  }
  const diasRest = projDays.length
  const restanteEsperado = projDays.reduce((s, p) => s + p.value, 0)
  const esperado = realizado + restanteEsperado

  // Banda de cenários = coeficiente de variação dos dias fechados, capado.
  const variancia = valores.reduce((s, v) => s + (v - mediaDiaria) ** 2, 0) / n
  const coefVar = mediaDiaria > 0 ? Math.sqrt(variancia) / mediaDiaria : 0
  const banda = Math.min(0.25, Math.max(0.05, coefVar))
  const conservador = realizado + restanteEsperado * (1 - banda)
  const otimista = realizado + restanteEsperado * (1 + banda)

  // Confiabilidade: cobertura + estabilidade + amostra (igual à avançada).
  const totalDias = n + diasRest
  const cobertura = totalDias > 0 ? n / totalDias : 0
  const estabilidade = 1 - Math.min(1, coefVar)
  const amostra = Math.min(1, n / 7)
  const confiabilidadePct = Math.round((cobertura * 0.4 + estabilidade * 0.4 + amostra * 0.2) * 100)
  const confiabilidade: Confiabilidade =
    confiabilidadePct >= 70 ? 'alta' : confiabilidadePct >= 45 ? 'media' : 'baixa'

  const sparkline: ProjecaoSparkPoint[] = closed.map((d, i) => ({
    data: d.data, real: d.value, projetado: i === n - 1 ? d.value : null,
  }))
  for (const p of projDays) sparkline.push({ data: p.data, real: null, projetado: p.value })

  return {
    realizado, conservador, esperado, otimista, mediaDiaria, mediaRecente, tendenciaPct,
    diasFechados: n, diasRestantes: diasRest, confiabilidadePct, confiabilidade, sparkline,
  }
}

/**
 * Texto padrão de tooltip pra qualquer label/coluna "Projeção" no app. Usar
 * sempre essa string pra manter a explicação consistente (em vez de variantes
 * diferentes em cada tela). Quando em períodos fechados (sem dias futuros),
 * a projeção fica igual ao realizado.
 */
export const PROJECAO_TOOLTIP =
  'Estimativa (não é valor fechado): projeção pro fim do período = realizado até agora + média diária dos últimos 7 dias fechados × dias restantes. É uma previsão pelo ritmo recente — pode diferir de uma projeção linear simples. Em períodos fechados, é igual ao Faturamento.'

/**
 * Tooltip da projeção LINEAR (ritmo de todos os dias fechados × dias restantes).
 */
export const PROJECAO_TOOLTIP_LINEAR =
  'Projeção pro fim do período: realizado + (média diária de TODOS os dias fechados × dias restantes). Em períodos fechados, é igual ao Faturamento.'

/**
 * Tooltip da projeção EXECUTIVA (projecaoAvancada) — explica o método pro usuário.
 */
export const PROJECAO_TOOLTIP_EXECUTIVA =
  'Projeção até o FIM DO MÊS: soma o realizado dos dias já apurados + projeta os dias que faltam (inclui hoje, sem contar o parcial do dia). O ritmo dos dias futuros usa a média recente (últimos 7 dias) ajustada por tendência e sazonalidade do dia da semana. Os cenários conservador/otimista abrem conforme a volatilidade dos dias apurados. A confiabilidade combina cobertura (quanto do mês já fechou), estabilidade e tamanho da amostra.'

/**
 * Variante do tooltip pra Projeção POR PRODUTO individual (Top 20 / Catálogo) —
 * alerta sobre o ruído típico de SKUs com vendas esporádicas.
 */
export const PROJECAO_TOOLTIP_PRODUTO =
  'Projeção pro fim do período: realizado + (média diária dos últimos 7 dias × dias restantes). Pode ser ruidoso pra SKUs com vendas esporádicas (poucos dias de movimento) — use como referência, não como número exato.'

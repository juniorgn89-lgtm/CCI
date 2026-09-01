/**
 * Desloca uma data ISO (`yyyy-MM-dd`) N meses pra trás, preservando o dia.
 *
 * Usado pra montar o período comparativo dos KPIs (mês anterior = 1, ano
 * anterior = 12). Sempre deslocar o MESMO span do período atual (início e fim)
 * — comparar um período parcial contra o mês-calendário cheio infla/desinfla o
 * comparativo.
 *
 * Dois cuidados que o `new Date('yyyy-MM-dd')` ingênuo erra:
 * 1. **Fuso** — `new Date('2026-05-01')` é interpretado como UTC; em fusos atrás
 *    de Greenwich (ex.: America/Sao_Paulo, −03) vira 30/04 local, e o offset sai
 *    1 dia (às vezes 1 mês) errado. Aqui montamos a data em horário LOCAL.
 * 2. **Overflow de mês** — 31/05 − 1 mês não existe em abril; clampa pro último
 *    dia do mês alvo (30/04) em vez de transbordar pra 01/05.
 */
/** Hoje em horário LOCAL como `yyyy-MM-dd` (evita o off-by-one de fuso do `toISOString`). */
export const todayLocal = (): string => {
  const d = new Date()
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * Fator de projeção de fim de mês, LINEAR pelo ritmo dos DIAS APURADOS (não do
 * calendário — honra o lag da apuração). Só projeta janela mês-a-data do mês
 * CORRENTE (começa no dia 1, mesmo mês de hoje); qualquer outra janela (mês
 * passado, range custom, multi-mês) devolve 1 = sem projeção. O gate visual
 * (`projFactor <= 3`) fica no componente — cedo demais a extrapolação é ruído.
 *
 * `diasApurados` = nº de DATAS distintas que o cache tem no período. Usado pela
 * Pista (frentistas) e pela Loja (vendedores de conveniência) — mesma regra.
 */
export const monthToDateProjFactor = (
  dataInicial: string | null,
  dataFinal: string | null,
  diasApurados: number,
): number => {
  if (!dataInicial || !dataFinal || diasApurados < 1) return 1
  const [iy, im, id] = dataInicial.split('-').map(Number)
  const [fy, fm] = dataFinal.split('-').map(Number)
  const [ty, tm] = todayLocal().split('-').map(Number)
  if (id !== 1 || iy !== fy || im !== fm || fy !== ty || fm !== tm) return 1
  const daysInMonth = new Date(fy, fm, 0).getDate() // fm 1-based → último dia do mês
  const f = daysInMonth / diasApurados
  return f > 1 ? f : 1
}

/** Abreviações pt-BR dos meses (índice 0 = janeiro). */
const MESES_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/**
 * Mês-CALENDÁRIO anterior ao mês de `dateStr` (mês inteiro, dia 1 → último dia),
 * com rótulo curto (ex.: "jul/2026"). Usado pelos pódios do "Mês anterior".
 *
 * Ex.: `dateStr` em ago/2026 → { dataInicial: '2026-07-01', dataFinal:
 * '2026-07-31', label: 'jul/2026' }. Ignora o dia de `dateStr` — sempre o mês
 * cheio anterior. `null`/vazio cai no mês atual local como base.
 */
export const previousCalendarMonth = (
  dateStr: string | null,
): { dataInicial: string; dataFinal: string; label: string } => {
  const base = dateStr && dateStr.length >= 7 ? dateStr : todayLocal()
  const [y, m] = base.split('-').map(Number)
  // m é 1-based; `m - 2` (0-based) = mês anterior; o Date normaliza a virada de ano.
  const first = new Date(y, m - 2, 1)
  const py = first.getFullYear()
  const pm = first.getMonth() + 1 // 1-based
  const lastDay = new Date(py, pm, 0).getDate()
  const p2 = String(pm).padStart(2, '0')
  return {
    dataInicial: `${py}-${p2}-01`,
    dataFinal: `${py}-${p2}-${String(lastDay).padStart(2, '0')}`,
    label: `${MESES_ABBR[pm - 1]}/${py}`,
  }
}

export const offsetPeriod = (dateStr: string, monthsBack: number): string => {
  if (!dateStr) return ''
  const [y, m, day] = dateStr.split('-').map(Number)
  const targetMonth = m - 1 - monthsBack // índice 0-based, pode ser negativo (JS normaliza o ano)
  const lastDayOfTarget = new Date(y, targetMonth + 1, 0).getDate()
  const d = new Date(y, targetMonth, Math.min(day, lastDayOfTarget))
  const yy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * Builder da matriz posto × dia — extraído de PostoDiaTabela.tsx pra o arquivo
 * do componente exportar SÓ componente (react-refresh/only-export-components).
 * Consumido por Combustível, Automotivo e Conveniência.
 */

export interface PostoDiaMatrix {
  dayList: string[]
  postos: { code: number; nome: string; valores: number[]; total: number; media: number; diasOp: number }[]
  redeDia: number[]
  totalRede: number
}

interface PostoDiaSource<T> {
  rows: T[]
  /** Código do posto (linhas sem código são ignoradas). */
  empresa: (r: T) => number | undefined
  /** Data (yyyy-MM-dd) — casada com `dayList`. */
  date: (r: T) => string
  /** Valor da métrica (litros, faturamento, …). */
  value: (r: T) => number
}

/**
 * Monta a matriz posto × dia a partir de linhas cruas por (posto, dia). `dayList`
 * é o eixo de dias (mesmo do gráfico); postos vêm ordenados por total desc.
 */
export function buildPostoDiaMatrix<T>(
  dayList: string[],
  src: PostoDiaSource<T>,
  postoNomes: Map<number, string>,
): PostoDiaMatrix | null {
  if (dayList.length === 0) return null
  const dayIdx = new Map(dayList.map((d, i) => [d, i]))
  const byPosto = new Map<number, number[]>()
  for (const r of src.rows) {
    const code = src.empresa(r)
    if (code == null) continue
    const di = dayIdx.get(src.date(r))
    if (di === undefined) continue
    let arr = byPosto.get(code)
    if (!arr) { arr = new Array(dayList.length).fill(0); byPosto.set(code, arr) }
    arr[di] += src.value(r)
  }
  const postos = Array.from(byPosto.entries())
    .map(([code, valores]) => {
      const total = valores.reduce((s, v) => s + v, 0)
      const diasOp = valores.filter((v) => v > 0).length
      const media = diasOp > 0 ? total / diasOp : 0
      return { code, nome: postoNomes.get(code) ?? `Posto ${code}`, valores, total, media, diasOp }
    })
    .sort((a, b) => b.total - a.total)
  const redeDia = dayList.map((_, i) => postos.reduce((s, p) => s + p.valores[i], 0))
  const totalRede = redeDia.reduce((s, v) => s + v, 0)
  return { dayList, postos, redeDia, totalRede }
}

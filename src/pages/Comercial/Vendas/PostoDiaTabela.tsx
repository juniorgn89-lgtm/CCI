import { useState, type CSSProperties } from 'react'
import { Trophy, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import TablePager from '@/components/tables/TablePager'

/**
 * Tabela posto × dia — visão "por posto" do gráfico diário (Litros/Faturamento).
 * Compartilhada por Combustível, Automotivo e Conveniência (só muda a métrica,
 * via `formatValue`/`noun`). Cada célula é tingida vs a MÉDIA do próprio posto
 * (verde acima / vermelho abaixo) pra saltar quem puxou o dia da rede pra cima
 * ou pra baixo; setinha cinza = variação vs o dia anterior; faixa âmbar de fim
 * de semana; Total/Média destacam líder/lanterna; a linha Rede contorna o pico,
 * o pior dia e a média. Pagina de 15 em 15 dias, abrindo na quinzena recente.
 */

const DOW_SHORT = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM']
const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

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

interface PostoDiaTabelaProps {
  matrix: PostoDiaMatrix
  /** Título (ex.: "Litros vendidos por dia" / "Faturamento por dia"). */
  title: string
  /** Substantivo do subtítulo/legenda ("volume" / "faturamento"). */
  noun: string
  /** Formata o valor da métrica (com arredondamento). */
  formatValue: (v: number) => string
}

const PostoDiaTabela = ({ matrix, title, noun, formatValue }: PostoDiaTabelaProps) => {
  const dm = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
  // Dia-da-semana curto (SEG..DOM) + flag de fim de semana por dia da matriz.
  const dow = (d: string) => {
    const g = new Date(`${d}T00:00:00`).getDay()
    return { short: DOW_SHORT[(g + 6) % 7], weekend: g === 0 || g === 6 }
  }
  const meta = matrix.dayList.map(dow)
  // Variação SEMANAL: valor do mesmo dia 7 dias antes (por DATA, robusto a dia
  // faltando). Só compara quando o dia −7 está no período em tela.
  const idxByDate = new Map(matrix.dayList.map((d, i) => [d, i]))
  const shiftDays = (iso: string, delta: number): string => {
    const [y, m, d] = iso.split('-').map(Number)
    const dt = new Date(y, m - 1, d + delta)
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
  }
  const weekAgo = (valores: number[], gi: number): number => {
    const j = idxByDate.get(shiftDays(matrix.dayList[gi], -7))
    return j !== undefined ? valores[j] : 0
  }
  // Faixa de fim de semana — mesma cor do gráfico (#f8b73a a ~8%).
  const WK: CSSProperties = { backgroundColor: 'rgba(248,183,58,0.08)' }
  // Desvio do dia vs a média do próprio posto → cor. Alpha funciona nos 2 temas.
  const tint = (v: number, media: number): CSSProperties => {
    if (v <= 0 || media <= 0) return {}
    const dev = (v - media) / media
    if (Math.abs(dev) < 0.04) return {}
    const a = Math.min(0.3, Math.abs(dev) * 0.55)
    return { backgroundColor: dev > 0 ? `rgba(16,185,129,${a})` : `rgba(239,68,68,${a})` }
  }
  const divisor = 'border-r border-gray-100 dark:border-gray-800'
  // Ranking da MÉDIA/dia é próprio (depende de dias abertos) — não segue o total.
  const medias = matrix.postos.map((p) => p.media)
  const mediaMax = matrix.postos.length > 1 ? Math.max(...medias) : Infinity
  const mediaMin = matrix.postos.length > 1 ? Math.min(...medias) : -Infinity
  // KPIs do cabeçalho (mesmos do gráfico): média/dia da rede e pico do período.
  const n = matrix.dayList.length
  const mediaRede = n > 0 ? matrix.totalRede / n : 0
  const picoRede = matrix.redeDia.length ? Math.max(...matrix.redeDia) : 0
  const picoIdx = picoRede > 0 ? matrix.redeDia.indexOf(picoRede) : -1
  // Pior dia = menor dia COM venda (ignora dia sem dado). Espelha a baixa do gráfico.
  const comVenda = matrix.redeDia.filter((v) => v > 0)
  const baixaRede = comVenda.length ? Math.min(...comVenda) : 0
  const baixaIdx = baixaRede > 0 ? matrix.redeDia.indexOf(baixaRede) : -1
  const rangeLabel = (ini: string, fim: string) => {
    const [ya, ma, da] = ini.split('-')
    const [yb, mb, db] = fim.split('-')
    if (ya === yb && ma === mb) return `${da}–${db} ${MESES_PT[+ma - 1]} ${yb}`
    if (ya === yb) return `${da} ${MESES_PT[+ma - 1]} – ${db} ${MESES_PT[+mb - 1]} ${yb}`
    return `${da} ${MESES_PT[+ma - 1]} ${ya} – ${db} ${MESES_PT[+mb - 1]} ${yb}`
  }
  const range = n > 0 ? rangeLabel(matrix.dayList[0], matrix.dayList[n - 1]) : ''
  // Paginação alinhada à DIREITA (15/página): abre na janela mais recente e o
  // paginador volta no tempo. Evita barra de rolagem em meses cheios.
  const DIAS_PAGINA = 15
  const pageCount = Math.max(1, Math.ceil(n / DIAS_PAGINA))
  const [pagesBack, setPagesBack] = useState(0) // 0 = janela mais recente
  const safeBack = Math.min(pagesBack, pageCount - 1)
  const winEnd = n - safeBack * DIAS_PAGINA
  const winStart = Math.max(0, winEnd - DIAS_PAGINA)
  const visIdx = Array.from({ length: winEnd - winStart }, (_, j) => winStart + j)
  const winRange = n > 0 ? `${dm(matrix.dayList[winStart])}–${dm(matrix.dayList[winEnd - 1])}` : ''
  // Clique num dia acende o par com o mesmo dia da semana anterior (−7). O traço
  // de conexão só aparece quando os DOIS estão na mesma página (senão perde o
  // sentido visual); fora disso, só realça o dia clicado.
  const [selDay, setSelDay] = useState<number | null>(null)
  const pickDay = (gi: number) => setSelDay((s) => (s === gi ? null : gi))
  const pairIdx = selDay != null ? (idxByDate.get(shiftDays(matrix.dayList[selDay], -7)) ?? -1) : -1
  const selSet = new Set<number>(selDay != null ? (pairIdx >= 0 ? [selDay, pairIdx] : [selDay]) : [])
  const pairOn = selDay != null && pairIdx >= 0 && visIdx.includes(selDay) && visIdx.includes(pairIdx)
  const lo = pairOn ? Math.min(selDay!, pairIdx) : -1
  const hi = pairOn ? Math.max(selDay!, pairIdx) : -1
  const midGi = pairOn ? visIdx[Math.floor((visIdx.indexOf(lo) + visIdx.indexOf(hi)) / 2)] : -1
  const selDelta = pairOn && matrix.redeDia[pairIdx] > 0
    ? ((matrix.redeDia[selDay!] - matrix.redeDia[pairIdx]) / matrix.redeDia[pairIdx]) * 100
    : null
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-transparent">
      {/* Cabeçalho igual ao gráfico: título + subtítulo + mini-KPIs. */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{range} · por posto · {noun} diário da rede</p>
        </div>
        <div className="flex shrink-0 items-stretch gap-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-2.5 py-1 text-center dark:border-gray-700 dark:bg-gray-800/50">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">Média/dia</p>
            <p className="text-sm font-bold tabular-nums text-gray-800 dark:text-gray-100">{formatValue(mediaRede)}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-center dark:border-emerald-800/50 dark:bg-emerald-900/20">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Pico</p>
            <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatValue(picoRede)}</p>
          </div>
        </div>
      </div>
      <TablePager
        page={(pageCount - 1) - safeBack}
        pageCount={pageCount}
        onPrev={() => setPagesBack((b) => Math.min(pageCount - 1, b + 1))}
        onNext={() => setPagesBack((b) => Math.max(0, b - 1))}
        info={winRange}
      />
      <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <thead className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
          {/* Traço de conexão dia ↔ mesmo dia da semana anterior (−7). */}
          {pairOn && (
            <tr aria-hidden="true">
              <th className="p-0" />
              {visIdx.map((gi) => (
                <th key={gi} className="relative h-5 p-0">
                  {gi >= lo && gi <= hi && <span className="absolute inset-x-0 bottom-0 border-t border-blue-400/70 dark:border-blue-400/60" />}
                  {(gi === lo || gi === hi) && <span className="absolute bottom-0 left-1/2 h-1.5 w-px -translate-x-1/2 bg-blue-400/70 dark:bg-blue-400/60" />}
                  {gi === midGi && selDelta != null && (
                    <span className={cn('absolute left-1/2 top-0 -translate-x-1/2 rounded px-1 text-[9px] font-bold tabular-nums text-white', selDelta >= 0 ? 'bg-emerald-500' : 'bg-red-500')}>
                      {selDelta >= 0 ? '▲' : '▼'}{Math.abs(Math.round(selDelta))}%
                    </span>
                  )}
                </th>
              ))}
              <th className="p-0" />
              <th className="p-0" />
            </tr>
          )}
          <tr>
            <th className={cn('py-2 pl-1 pr-3 text-left font-semibold', divisor)}>Posto</th>
            {visIdx.map((gi) => (
              <th
                key={gi}
                onClick={() => pickDay(gi)}
                title="Comparar com o mesmo dia da semana anterior"
                className={cn(
                  'cursor-pointer rounded px-2 py-2 text-right font-semibold transition-colors',
                  selSet.has(gi) ? 'bg-blue-500/10 text-blue-600 ring-1 ring-inset ring-blue-400/60 dark:text-blue-300' : 'hover:bg-blue-500/[0.05]',
                )}
                style={meta[gi].weekend && !selSet.has(gi) ? WK : undefined}
              >
                <div className="tabular-nums">{dm(matrix.dayList[gi])}</div>
                <div className={cn('text-[9px] font-normal', selSet.has(gi) ? 'text-blue-500 dark:text-blue-300' : meta[gi].weekend ? 'text-amber-600 dark:text-amber-500/90' : 'text-gray-400 dark:text-gray-600')}>{meta[gi].short}</div>
              </th>
            ))}
            <th className="border-l border-gray-200 px-3 py-2 text-right font-semibold dark:border-gray-700">Total</th>
            <th className="px-3 py-2 text-right font-semibold">Média/dia</th>
          </tr>
        </thead>
        <tbody>
          {matrix.postos.map((p, rowIdx) => (
            <tr key={p.code}>
              <td className={cn('py-1.5 pl-1 pr-3 text-gray-700 dark:text-gray-300', divisor)}>
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-medium" title={p.nome}>{p.nome}</span>
                  {rowIdx === 0 && (
                    <span className="inline-flex shrink-0" title="Maior volume do período" aria-label="Maior volume do período">
                      <Trophy className="h-3 w-3 text-amber-500" />
                    </span>
                  )}
                  {rowIdx === matrix.postos.length - 1 && matrix.postos.length > 1 && (
                    <span className="inline-flex shrink-0" title="Menor volume do período" aria-label="Menor volume do período">
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    </span>
                  )}
                </span>
              </td>
              {visIdx.map((gi) => {
                const v = p.valores[gi]
                // Variação vs o MESMO dia da semana anterior (−7). Seta cinza,
                // discreta — a cor da tinta já é a comparação com a média.
                const prev = weekAgo(p.valores, gi)
                const vd = prev > 0 && v > 0 ? ((v - prev) / prev) * 100 : null
                return (
                <td key={gi} className="p-0.5" style={meta[gi].weekend ? WK : undefined}>
                  <div
                    className={cn('rounded-md px-2 py-1 text-right tabular-nums', v > 0 ? 'font-medium text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600')}
                    style={tint(v, p.media)}
                  >
                    <div className="leading-tight">{v > 0 ? formatValue(v) : '·'}</div>
                    {vd !== null && (
                      <div className="text-[9px] font-normal leading-tight text-gray-400 dark:text-gray-500">
                        {vd > 0 ? '▲' : vd < 0 ? '▼' : ''}{Math.abs(Math.round(vd))}%
                      </div>
                    )}
                  </div>
                </td>
                )
              })}
              <td
                className={cn(
                  'border-l border-gray-200 px-3 py-1.5 text-right font-bold tabular-nums dark:border-gray-700',
                  matrix.postos.length > 1 && rowIdx === 0
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : matrix.postos.length > 1 && rowIdx === matrix.postos.length - 1
                      ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                      : 'text-[#1e3a5f] dark:text-gray-100',
                )}
              >
                {formatValue(p.total)}
              </td>
              <td
                className={cn(
                  'px-3 py-1.5 text-right font-semibold tabular-nums',
                  p.media === mediaMax
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : p.media === mediaMin
                      ? 'bg-red-500/10 text-red-700 dark:text-red-300'
                      : 'font-normal text-gray-500 dark:text-gray-400',
                )}
              >
                {formatValue(p.media)}
              </td>
            </tr>
          ))}
          {/* Rede = soma por dia (bate com a linha do gráfico). Faixa de fim de
              semana também nos totais, pra a coluna destacar de cima a baixo. */}
          <tr className="border-t-2 border-gray-300 font-bold text-gray-700 dark:border-gray-600 dark:text-gray-200">
            <td className={cn('pt-2.5 pl-1 pr-3', divisor)}>Rede</td>
            {visIdx.map((gi) => {
              const v = matrix.redeDia[gi]
              const prev = weekAgo(matrix.redeDia, gi)
              const vd = prev > 0 && v > 0 ? ((v - prev) / prev) * 100 : null
              return (
              <td
                key={gi}
                className={cn(
                  'px-2 pb-1 pt-2.5 text-right tabular-nums',
                  gi === picoIdx && 'rounded ring-1 ring-inset ring-emerald-400 dark:ring-emerald-500/70',
                  gi === baixaIdx && 'rounded ring-1 ring-inset ring-amber-400 dark:ring-amber-500/70',
                )}
                style={meta[gi].weekend ? WK : undefined}
                title={gi === picoIdx ? 'Pico da rede no período' : gi === baixaIdx ? 'Pior dia da rede no período' : undefined}
              >
                <div className="leading-tight">{formatValue(v)}</div>
                {vd !== null && (
                  <div className="text-[9px] font-normal leading-tight text-gray-400 dark:text-gray-500">
                    {vd > 0 ? '▲' : vd < 0 ? '▼' : ''}{Math.abs(Math.round(vd))}%
                  </div>
                )}
              </td>
              )
            })}
            <td className="border-l border-gray-200 px-3 pt-2.5 text-right tabular-nums text-[#1e3a5f] dark:border-gray-700 dark:text-gray-100">
              {formatValue(matrix.totalRede)}
            </td>
            <td className="px-3 pb-1 pt-2.5 text-right" title="Média/dia da rede no período">
              <span className="rounded px-2 py-1 text-right tabular-nums text-gray-700 ring-1 ring-inset ring-slate-300 dark:text-gray-200 dark:ring-slate-500/70">
                {formatValue(mediaRede)}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
      <p className="mt-3 px-1 text-[11px] text-gray-400">
        Cada célula é tingida vs a média do próprio posto no período: <span className="text-emerald-600 dark:text-emerald-400">verde</span> = dia acima da média · <span className="text-red-600 dark:text-red-400">vermelho</span> = abaixo. A setinha cinza (<span className="text-gray-500">▲/▼ %</span>) é a variação vs o mesmo dia da semana anterior. Assim dá pra ver quem puxou o {noun} da rede pra cima ou pra baixo em cada dia. Colunas em <span className="text-amber-600 dark:text-amber-500">âmbar</span> = fim de semana · “·” = posto não vendeu no dia. <span className="text-blue-600 dark:text-blue-300">Clique num dia</span> pra ligá-lo ao mesmo dia da semana anterior.
      </p>
    </div>
  )
}

export default PostoDiaTabela

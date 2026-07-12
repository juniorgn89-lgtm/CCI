import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { formatCurrency, formatNumber } from '@/lib/formatters'
import { cn } from '@/lib/utils'

/**
 * Card premium "Litros vendidos por dia" da aba Análise semanal.
 *
 * SVG desenhado à mão (Recharts não dá o acabamento do mock): linha suavizada
 * (Catmull-Rom → bézier) + área com gradiente, gridlines, linha de média,
 * faixa de fim de semana, callouts de pico/baixa e TOOLTIP dinâmico ao passar o
 * mouse (com % vs o dia anterior). Média e pico são DERIVADOS (client-side) — o
 * componente só é renderizado quando há série (≥ 2 dias), então nunca inventa.
 *
 * Dimensionamento: o viewBox mapeia 1:1 com a largura REAL (medida por
 * ResizeObserver) e ALTURA FIXA (`height`), então o gráfico não "estica" nem os
 * rótulos incham em cards largos — a altura fica sempre contida.
 *
 * Nota técnica: todos os rótulos são nós <text> reais com o valor como filho
 * direto (sem <span>/<tspan> wrapper), senão o texto não mede (bbox 0) em
 * vários browsers.
 */
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

/** Teto "redondo" acima de v pra escala do eixo Y. */
const niceCeil = (v: number): number => {
  if (v <= 0) return 1
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / mag
  const step = n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 6 ? 6 : n <= 8 ? 8 : 10
  return step * mag
}

/** dd/MM a partir do ISO yyyy-MM-dd. */
const ddmm = (iso: string): string => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}
const dowLabel = (iso: string): string => DOW[new Date(`${iso}T00:00:00`).getDay()] ?? ''

/** "01–10 Jul 2026" (ou "28 Jun – 05 Jul 2026" cruzando meses). */
const rangeLabel = (ini: string, fim: string): string => {
  const [ya, ma, da] = ini.split('-').map(Number)
  const [yb, mb, db] = fim.split('-').map(Number)
  const pad = (n: number) => String(n).padStart(2, '0')
  if (ya === yb && ma === mb) return `${pad(da)}–${pad(db)} ${MESES[ma - 1]} ${yb}`
  if (ya === yb) return `${pad(da)} ${MESES[ma - 1]} – ${pad(db)} ${MESES[mb - 1]} ${yb}`
  return `${pad(da)} ${MESES[ma - 1]} ${ya} – ${pad(db)} ${MESES[mb - 1]} ${yb}`
}

/** Path suave (Catmull-Rom → cúbicas de bézier). */
const splinePath = (pts: { x: number; y: number }[]): string => {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x} ${pts[0].y}` : ''
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return d
}

interface AnaliseSemanalLineCardProps {
  /** Série diária real (yyyy-MM-dd + valor + L.B./unidade opcional), ordenada por data. */
  data: { data: string; litros: number; lbPorLitro?: number }[]
  /** Título do card. Default "Litros vendidos por dia". */
  title?: string
  /** Substantivo do subtítulo ("volume"/"quantidade"). Default "volume". */
  noun?: string
  /** Unidade no tooltip ("litros"/"unidades"). Default "litros". */
  unit?: string
  /** Rótulo do L.B. por unidade no tooltip. Default "L.B./litro". */
  lbLabel?: string
  /** Cor da linha/área (navy do Visor360 por padrão). */
  accent?: string
  /** Faixa de fim de semana (sáb/dom). Default true. */
  showWeekend?: boolean
  /** Altura fixa do gráfico em px (default 300). */
  height?: number
}

const AnaliseSemanalLineCard = ({ data, title = 'Litros vendidos por dia', noun = 'volume', unit = 'litros', lbLabel = 'L.B./litro', accent = '#1e3a5f', showWeekend = true, height = 300 }: AnaliseSemanalLineCardProps) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(720)

  // Largura real do container → viewBox 1:1 (altura fixa). Evita o SVG "inchar"
  // em cards largos (o problema de escalar tudo junto com a largura).
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    // Medição inicial síncrona (antes do paint) → sem flash distorcido.
    const cw0 = el.getBoundingClientRect().width
    if (cw0) setW((prev) => (Math.abs(cw0 - prev) > 1 ? cw0 : prev))
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width
      if (cw) setW((prev) => (Math.abs(cw - prev) > 1 ? cw : prev))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const VBW = Math.max(320, Math.round(w))
  const VBH = height

  const g = useMemo(() => {
    const values = data.map((d) => d.litros)
    const n = values.length
    const sum = values.reduce((s, v) => s + v, 0)
    const media = n > 0 ? sum / n : 0
    let picoIdx = 0, baixaIdx = 0
    for (let i = 1; i < n; i++) {
      if (values[i] > values[picoIdx]) picoIdx = i
      if (values[i] < values[baixaIdx]) baixaIdx = i
    }
    const yMax = niceCeil(Math.max(...values, 1) * 1.08)

    const x0 = 56, x1 = VBW - 18, yTop = 36, yBase = VBH - 42
    const X = (i: number) => (n === 1 ? (x0 + x1) / 2 : x0 + (i / (n - 1)) * (x1 - x0))
    const Y = (v: number) => yBase - (v / yMax) * (yBase - yTop)
    const slot = n > 1 ? (x1 - x0) / (n - 1) : x1 - x0
    const pts = values.map((v, i) => ({ x: X(i), y: Y(v), v, i }))
    const line = splinePath(pts)
    const area = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${yBase} L ${pts[0].x.toFixed(1)} ${yBase} Z`

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: yMax * f, y: Y(yMax * f) }))

    // Faixas de fim de semana (sáb=6, dom=0).
    const weekendBands = showWeekend
      ? pts
          .filter((p) => {
            const d = new Date(`${data[p.i].data}T00:00:00`).getDay()
            return d === 0 || d === 6
          })
          .map((p) => ({ x: Math.max(x0, p.x - slot / 2), w: Math.min(slot, x1 - Math.max(x0, p.x - slot / 2)) }))
      : []

    // Rótulos do eixo X — passo uniforme, ~1 a cada ~70px de largura (nunca colam).
    const maxLabels = Math.max(4, Math.floor((x1 - x0) / 70))
    const step = Math.max(1, Math.ceil(n / maxLabels))
    const idxSet = new Set<number>()
    for (let i = 0; i < n; i += step) idxSet.add(i)
    const maxMarked = Math.max(...idxSet)
    if (maxMarked !== n - 1) {
      if (n - 1 - maxMarked < step * 0.6) idxSet.delete(maxMarked)
      idxSet.add(n - 1)
    }
    const xLabels = [...idxSet].sort((a, b) => a - b).map((i) => ({ x: X(i), label: ddmm(data[i].data) }))

    return { n, media, picoIdx, baixaIdx, yMax, x0, x1, yTop, yBase, pts, line, area, ticks, weekendBands, xLabels, slot }
  }, [data, showWeekend, VBW, VBH])

  const pico = g.pts[g.picoIdx]
  const baixa = g.pts[g.baixaIdx]
  const yMedia = g.yBase - (g.media / g.yMax) * (g.yBase - g.yTop)

  // Callouts — clampa dentro da área e escolhe acima/abaixo conforme a folga.
  const CW = 74, CH = 28
  const clampX = (x: number) => Math.min(g.x1 - CW / 2, Math.max(g.x0 + CW / 2, x))
  const picoAbove = pico.y - g.yTop > CH + 12
  const picoCallout = { x: clampX(pico.x), y: picoAbove ? pico.y - CH - 10 : pico.y + 10 }
  const baixaBelow = g.yBase - baixa.y > CH + 12
  const baixaCallout = { x: clampX(baixa.x), y: baixaBelow ? baixa.y + 10 : baixa.y - CH - 10 }

  // Hover: mapeia a posição do mouse pro dia mais próximo (snap ao índice).
  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    if (!rect.width) return
    const svgX = ((e.clientX - rect.left) / rect.width) * VBW
    const raw = g.n === 1 ? 0 : Math.round((svgX - g.x0) / g.slot)
    const idx = Math.max(0, Math.min(g.n - 1, raw))
    if (idx !== hoverIdx) setHoverIdx(idx)
  }
  const onLeave = () => setHoverIdx(null)

  const hp = hoverIdx != null ? g.pts[hoverIdx] : null
  const hoverLeftPct = hp ? (hp.x / VBW) * 100 : 0
  const hoverTopPct = hp ? (hp.y / VBH) * 100 : 0
  const hoverFlip = hp == null ? '-50%' : hoverLeftPct < 14 ? '-8%' : hoverLeftPct > 86 ? '-92%' : '-50%'

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      {/* Cabeçalho: título + subtítulo + mini-KPIs */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
            {rangeLabel(data[0].data, data[data.length - 1].data)} · {noun} diário da rede
          </p>
        </div>
        <div className="flex shrink-0 items-stretch gap-2">
          <div className="rounded-lg border border-gray-200 bg-gray-50/60 px-2.5 py-1 text-center dark:border-gray-700 dark:bg-gray-800/50">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">Média/dia</p>
            <p className="text-sm font-bold tabular-nums text-gray-800 dark:text-gray-100">{formatNumber(Math.round(g.media))}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-1 text-center dark:border-emerald-800/50 dark:bg-emerald-900/20">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Pico</p>
            <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{formatNumber(Math.round(pico.v))}</p>
          </div>
        </div>
      </div>

      <div ref={wrapRef} className="relative mt-3" style={{ height: VBH }} onMouseMove={onMove} onMouseLeave={onLeave}>
        <svg viewBox={`0 0 ${VBW} ${VBH}`} width="100%" height={VBH} preserveAspectRatio="none" role="img" aria-label="Gráfico de litros vendidos por dia">
          <defs>
            <linearGradient id="asArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.2} />
              <stop offset="55%" stopColor={accent} stopOpacity={0.03} />
              <stop offset="100%" stopColor={accent} stopOpacity={0} />
            </linearGradient>
            <filter id="asPtShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" floodColor={accent} floodOpacity={0.35} />
            </filter>
          </defs>

          {/* Faixas de fim de semana */}
          {g.weekendBands.map((b, i) => (
            <rect key={`wk${i}`} x={b.x} y={g.yTop} width={b.w} height={g.yBase - g.yTop} fill="#f8b73a" opacity={0.07} />
          ))}

          {/* Gridlines + rótulos do eixo Y */}
          {g.ticks.map((t, i) => (
            <line key={`gl${i}`} x1={g.x0} y1={t.y} x2={g.x1} y2={t.y} stroke="#eef2f7" strokeWidth={1} />
          ))}
          {g.ticks.filter((t) => t.v > 0).map((t, i) => (
            <text key={`yl${i}`} x={g.x0 - 10} y={t.y + 3.5} textAnchor="end" fontSize={11} fill="#94a3b8" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(Math.round(t.v))}</text>
          ))}

          {/* Área + linha */}
          <path d={g.area} fill="url(#asArea)" />
          <path d={g.line} fill="none" stroke={accent} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />

          {/* Linha de média (tracejada) + rótulo */}
          <line x1={g.x0} y1={yMedia} x2={g.x1} y2={yMedia} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={g.x0 + 4} y={yMedia - 5} fontSize={10.5} fill="#94a3b8">média</text>

          {/* Rótulos do eixo X (datas) */}
          {g.xLabels.map((l, i) => (
            <text key={`xl${i}`} x={l.x} y={g.yBase + 20} textAnchor="middle" fontSize={10.5} fill="#94a3b8" style={{ fontVariantNumeric: 'tabular-nums' }}>{l.label}</text>
          ))}

          {/* Guia vertical do hover */}
          {hp && <line x1={hp.x} y1={g.yTop} x2={hp.x} y2={g.yBase} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />}

          {/* Pontos */}
          {g.pts.map((p) => {
            if (p.i === g.picoIdx) return <circle key={p.i} cx={p.x} cy={p.y} r={6} fill="#15803d" stroke="#fff" strokeWidth={2} filter="url(#asPtShadow)" />
            if (p.i === g.baixaIdx) return <circle key={p.i} cx={p.x} cy={p.y} r={6} fill="#b45309" stroke="#fff" strokeWidth={2} filter="url(#asPtShadow)" />
            return <circle key={p.i} cx={p.x} cy={p.y} r={4} fill="#fff" stroke={accent} strokeWidth={2} />
          })}

          {/* Realce do ponto sob o cursor */}
          {hp && <circle cx={hp.x} cy={hp.y} r={5.5} fill="none" stroke={accent} strokeWidth={2.5} />}

          {/* Callout do pico (verde) */}
          <g>
            <rect x={picoCallout.x - CW / 2} y={picoCallout.y} width={CW} height={CH} rx={8} fill="#15803d" />
            <text x={picoCallout.x} y={picoCallout.y + CH / 2 + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(Math.round(pico.v))}</text>
          </g>

          {/* Callout da baixa (âmbar) */}
          <g>
            <rect x={baixaCallout.x - CW / 2} y={baixaCallout.y} width={CW} height={CH} rx={8} fill="#b45309" />
            <text x={baixaCallout.x} y={baixaCallout.y + CH / 2 + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill="#fff" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(Math.round(baixa.v))}</text>
          </g>
        </svg>

        {/* Tooltip dinâmico (HTML sobre o SVG) */}
        {hp && (
          <div
            className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-gray-100 bg-white px-3 py-2 shadow-xl dark:border-gray-700 dark:bg-gray-800"
            style={{ left: `${hoverLeftPct}%`, top: `${hoverTopPct}%`, transform: `translate(${hoverFlip}, calc(-100% - 14px))` }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              {dowLabel(data[hp.i].data)}, {ddmm(data[hp.i].data)}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
              <span className="text-[13px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatNumber(Math.round(hp.v))}</span>
              <span className="text-[11px] text-gray-400">{unit}</span>
            </div>
            {/* L.B. por unidade do dia (quando a série trouxer o lucro bruto). */}
            {data[hp.i].lbPorLitro != null && (
              <div className="mt-0.5 flex items-center justify-between gap-3">
                <span className="text-[10px] text-gray-400">{lbLabel}</span>
                <span className="text-[11px] font-semibold tabular-nums text-gray-700 dark:text-gray-200">{formatCurrency(data[hp.i].lbPorLitro ?? 0)}</span>
              </div>
            )}
            {/* Variação vs o dia anterior (— no primeiro dia da série). */}
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-gray-100 pt-1 dark:border-gray-700">
              <span className="text-[10px] text-gray-400">vs dia anterior</span>
              {(() => {
                const prev = hp.i > 0 ? g.pts[hp.i - 1].v : null
                if (prev == null || prev === 0) return <span className="text-[11px] font-semibold text-gray-400">—</span>
                const pct = ((hp.v - prev) / prev) * 100
                const up = pct >= 0
                return (
                  <span className={cn('text-[11px] font-bold tabular-nums', up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
                    {up ? '▲ +' : '▼ '}{pct.toFixed(1).replace('.', ',')}%
                  </span>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AnaliseSemanalLineCard

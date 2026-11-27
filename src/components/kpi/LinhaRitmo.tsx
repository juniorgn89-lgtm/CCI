import { useState } from 'react'
import { formatCurrencyInt } from '@/lib/formatters'

/**
 * Linha do dia a dia nos cartões de resultado: o valor DE CADA DIA do mês até
 * ontem (linha cheia, cor do setor) e, emendada, a projeção de cada dia que falta
 * (tracejada, mesma cor mais clara) — sazonal: cada dia pesa pelo seu dia da
 * semana, o mesmo cálculo do "Fecha em".
 * Mostra os dias fortes e fracos e para onde o mês vai. Passando o mouse, o dia.
 */
interface Props {
  /** Valor de cada dia: índice 0 = dia 1, até o último dia com venda. */
  diario: number[]
  /** Valor projetado de cada dia que falta (índice 0 = o dia seguinte ao último do diário). null = sem projeção. */
  projecao: number[] | null
  /** Dias do mês (largura do eixo). */
  diasNoMes: number
  /** Cor da linha (a do setor). */
  cor: string
  /** Formato do valor no hover (padrão: R$ sem centavos). */
  fmt?: (v: number) => string
}

const W = 100
const H = 44

const LinhaRitmo = ({ diario, projecao, diasNoMes, cor, fmt = formatCurrencyInt }: Props) => {
  const [hover, setHover] = useState<number | null>(null)
  const n = diario.length
  const ult = n - 1
  const temProj = !!projecao && projecao.length > 0 && n > 0
  // Série completa para o eixo: realizado + projeção dos dias restantes.
  const proj = temProj ? projecao!.map((v) => Math.max(0, v)) : []
  const todos = [...diario, ...proj]
  const max = Math.max(1, ...todos)
  const min = Math.min(0, ...todos)
  const x = (i: number) => (diasNoMes <= 1 ? 0 : (i / (diasNoMes - 1)) * W)
  const y = (v: number) => H - 3 - ((v - min) / (max - min || 1)) * (H - 8)
  const caminho = (serie: number[], deslocamento = 0) => serie.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i + deslocamento).toFixed(2)},${y(v).toFixed(2)}`).join(' ')
  const area = n > 1 ? `${caminho(diario)} L${x(ult).toFixed(2)},${H} L0,${H} Z` : ''
  // A tracejada sai do último dia real e segue até o fim do mês.
  const trilhaProj = temProj ? caminho([diario[ult], ...proj], ult) : ''
  const idGrad = `lr-${cor.replace('#', '')}`

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left) / r.width) * (diasNoMes - 1))
    setHover(Math.max(0, Math.min((temProj ? diasNoMes : n) - 1, i)))
  }
  const h = hover
  const hProj = h !== null && h > ult
  const hValor = h === null ? 0 : hProj ? proj[h - n] : diario[h]
  const media = n ? diario.reduce((a, b) => a + b, 0) / n : 0

  return (
    <div className="relative w-full">
      {/* Legenda só com o mouse em cima (por cima do gráfico, sem empurrar nada). */}
      {h !== null && (
        <div className="pointer-events-none absolute -top-6 left-0 right-0 z-10 flex items-center justify-between gap-2 text-[10.5px] text-gray-500 dark:text-gray-400">
          <span className="rounded-md bg-white/95 px-1.5 py-0.5 shadow-sm dark:bg-[#1e293b]/95">
            dia {h + 1}{hProj && ' · projeção'}: <b className="font-semibold text-gray-800 dark:text-gray-100">{fmt(hValor)}</b>
          </span>
          {n > 0 && <span className="rounded-md bg-white/95 px-1.5 py-0.5 tabular-nums shadow-sm dark:bg-[#1e293b]/95">média {fmt(media)}/dia</span>}
        </div>
      )}
      <div className="relative h-16 cursor-crosshair" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
          <defs>
            <linearGradient id={idGrad} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={cor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={cor} stopOpacity="0" />
            </linearGradient>
          </defs>
          {n > 1 && <path d={area} fill={`url(#${idGrad})`} />}
          {n > 1 && <path d={caminho(diario)} fill="none" stroke={cor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
          {temProj && <path d={trilhaProj} fill="none" stroke={cor} strokeOpacity="0.55" strokeWidth="1.75" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />}
          {h !== null && <line x1={x(h)} x2={x(h)} y1={0} y2={H} stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" className="text-gray-300 dark:text-gray-600" />}
        </svg>
        {/* Ponto do último dia real (HTML, para não deformar com o SVG esticado) */}
        {n > 0 && (
          <span className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-[#0b1220]"
            style={{ left: `${(x(ult) / W) * 100}%`, top: `${(y(diario[ult]) / H) * 100}%`, background: cor }} />
        )}
        {h !== null && h !== ult && (
          <span className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(x(h) / W) * 100}%`, top: `${(y(hValor) / H) * 100}%`, background: cor, opacity: hProj ? 0.6 : 1 }} />
        )}
      </div>
    </div>
  )
}

export default LinhaRitmo

import { useThemeStore } from '@/store/theme'

/**
 * Fonte ÚNICA de cores de gráfico sensíveis ao tema.
 *
 * Problema que resolve: cor hardcoded em SVG/Recharts (`fill="#..."`,
 * `stroke="#..."`, `style={{ fill }}`) NÃO passa pelo override global de dark do
 * `index.css` nem pelas variantes `dark:` — fica congelada no tema claro. Aqui a
 * cor deriva de `useThemeStore(s => s.dark)`, generalizando o que o chart mobile
 * (`src/components/mobile/charts.tsx`) já fazia.
 */
export interface ChartTheme {
  dark: boolean
  /** Cor principal (linha/área/barra dominante). */
  accent: string
  /** Gridlines horizontais/verticais. */
  grid: string
  /** Texto de eixos, ticks e rótulos leves. */
  axis: string
  /** Rótulo de VALOR impresso sobre o fundo do card (Recharts LabelList). */
  label: string
  /** Linha de média (tracejada). */
  mediaLine: string
  /** Tooltip (Recharts `contentStyle` / tooltip HTML). */
  tooltip: { backgroundColor: string; border: string; color: string }
  /** Sequência categórica (séries múltiplas). */
  series: string[]
}

const LIGHT: ChartTheme = {
  dark: false,
  accent: '#1e3a5f',
  grid: '#eef2f7',
  axis: '#94a3b8',
  label: '#374151',
  mediaLine: '#cbd5e1',
  tooltip: { backgroundColor: '#ffffff', border: '1px solid #e5e7eb', color: '#111827' },
  series: ['#1e3a5f', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'],
}

const DARK: ChartTheme = {
  dark: true,
  // Navy é invisível no fundo escuro (~1.2:1) → azul claro legível (harmoniza
  // com a paleta e com o remapeamento azul→teal do dark).
  accent: '#60a5fa',
  grid: '#2a3542',
  axis: '#8b98a9',
  label: '#cbd5e1',
  mediaLine: '#4b5768',
  tooltip: { backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' },
  series: ['#60a5fa', '#3b82f6', '#2563eb', '#93c5fd', '#a5b4fc'],
}

/** Hook: tokens de cor de gráfico do tema atual. */
export const useChartTheme = (): ChartTheme => (useThemeStore((s) => s.dark) ? DARK : LIGHT)

/**
 * Célula de heatmap (fundo + texto) sensível ao tema. `t` ∈ [0,1] = intensidade.
 * Light: lerp claro (#eef4fb) → navy (#1e3a5f), texto branco no forte.
 * Dark: lerp navy-escuro → azul saturado sobre o card, texto sempre claro.
 */
export const heatCell = (t: number, dark: boolean): { bg: string; text: string } => {
  const c = Math.max(0, Math.min(1, t))
  const mix = (a: number, b: number) => Math.round(a + (b - a) * c)
  if (dark) {
    // #1c2836 (fraco, ~cor do card) → #3b82f6 (forte).
    const r = mix(28, 59), g = mix(40, 130), b = mix(54, 246)
    return { bg: `rgb(${r}, ${g}, ${b})`, text: c > 0.42 ? '#f8fafc' : '#cbd5e1' }
  }
  const r = mix(238, 30), g = mix(244, 58), b = mix(251, 95)
  return { bg: `rgb(${r}, ${g}, ${b})`, text: c > 0.58 ? '#ffffff' : '#334155' }
}

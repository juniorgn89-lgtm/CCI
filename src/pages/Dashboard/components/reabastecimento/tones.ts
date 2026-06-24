import type { Tone } from '@/pages/Dashboard/components/reabastecimento/types'

/** Classes Tailwind por tom de status. Fonte única de cor — os componentes
 *  burros só leem daqui (não decidem cor por setor). Cores do design token
 *  do handoff (docs/DESIGN-SYSTEM.md). */
export interface ToneClasses {
  /** Texto do valor/destaque. */
  text: string
  /** Fundo claro (badge, chip de ícone). */
  bg: string
  /** Borda do card. */
  border: string
  /** Cor sólida da barra de nível. */
  bar: string
}

const TONES: Record<Tone, ToneClasses> = {
  critico: { text: 'text-[#b91c1c] dark:text-red-400', bg: 'bg-[#fee2e2] dark:bg-red-900/30', border: 'border-[#fecaca] dark:border-red-900/50', bar: 'bg-[#ef4444]' },
  ruptura: { text: 'text-[#b91c1c] dark:text-red-400', bg: 'bg-[#fee2e2] dark:bg-red-900/30', border: 'border-[#fecaca] dark:border-red-900/50', bar: 'bg-[#ef4444]' },
  alerta: { text: 'text-[#b45309] dark:text-amber-400', bg: 'bg-[#fef3c7] dark:bg-amber-900/30', border: 'border-[#fde68a] dark:border-amber-900/50', bar: 'bg-[#f59e0b]' },
  vencendo: { text: 'text-[#c2410c] dark:text-orange-400', bg: 'bg-[#ffedd5] dark:bg-orange-900/30', border: 'border-[#fed7aa] dark:border-orange-900/50', bar: 'bg-[#fb923c]' },
  negativo: { text: 'text-[#7e22ce] dark:text-violet-400', bg: 'bg-[#f3e8ff] dark:bg-violet-900/30', border: 'border-[#e9d5ff] dark:border-violet-900/50', bar: 'bg-[#a855f7]' },
  curvaA: { text: 'text-[#1e3a5f] dark:text-blue-300', bg: 'bg-[#dbeafe] dark:bg-blue-900/30', border: 'border-[#bfdbfe] dark:border-blue-900/50', bar: 'bg-[#2563eb]' },
  neutral: { text: 'text-gray-700 dark:text-gray-300', bg: 'bg-gray-100 dark:bg-gray-800', border: 'border-gray-200 dark:border-gray-700', bar: 'bg-[#2563eb]' },
}

export const toneClasses = (tone: Tone): ToneClasses => TONES[tone]

import { cn } from '@/lib/utils'

/* Visual "premium" dos formulários em painel lateral (rotina, tarefa…). */

export const CAMPO =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-[14px] text-gray-900 placeholder:text-gray-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/15 dark:border-[#3e4c63] dark:bg-[#0f172a] dark:text-gray-100 dark:focus:border-teal-500 dark:focus:ring-teal-500/20'
export const CAMPO_ERRO = 'border-red-400 focus:border-red-500 focus:ring-red-500/15 dark:border-red-500/70'
export const ROTULO = 'mb-1.5 flex items-center gap-1 text-[13px] font-semibold text-gray-800 dark:text-gray-200'
export const AJUDA = 'mt-1.5 text-[12px] text-gray-500 dark:text-gray-400'
export const ERRO_CAMPO = 'mt-1.5 text-[12px] font-medium text-red-600 dark:text-red-400'

/** Botão-pílula de escolha (uma entre várias, sem fundo de grupo). */
export const pilula = (ativo: boolean) => cn('rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors',
  ativo ? 'border-[#1e3a5f] bg-[#1e3a5f] text-white dark:border-teal-600 dark:bg-teal-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-[#3e4c63] dark:text-gray-300 dark:hover:bg-white/[0.05]')

/** Grupo segmentado (botões colados num trilho cinza). */
export const TRILHO = 'flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-white/[0.05]'
export const segmento = (ativo: boolean) => cn('flex-1 rounded-md px-2 py-2 text-[12.5px] font-semibold transition-colors',
  ativo ? 'bg-white text-[#1e3a5f] shadow-sm dark:bg-teal-600 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100')

/** Cor do segmento de prioridade escolhido (Alta âmbar, Urgente vermelho). */
export const corPrioridade = (p: string, ativo: boolean) => cn(
  ativo && p === 'urgente' && 'text-red-600 dark:bg-red-600 dark:text-white',
  ativo && p === 'alta' && 'text-amber-700 dark:bg-amber-600 dark:text-white',
)

/** Dispara a comemoração de tarefa concluída (ver Celebracao.tsx). */
export const EVENTO_CONCLUIDA = 'visor360:tarefa-concluida'
export const celebrarConclusao = (titulo: string) => window.dispatchEvent(new CustomEvent(EVENTO_CONCLUIDA, { detail: titulo }))

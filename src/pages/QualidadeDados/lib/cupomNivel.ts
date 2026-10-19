/** Selo de risco do cupom "montado": rótulo e cores (texto e ponto), por score. */
export const nivelCupom = (score: 1 | 2 | 3) =>
  score === 3
    ? { label: 'Risco alto', cls: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' }
    : score === 2
      ? { label: 'Risco médio', cls: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' }
      : { label: 'Risco baixo', cls: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' }

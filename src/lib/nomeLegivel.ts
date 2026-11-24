/**
 * "POSTO ITAPOA" → "Posto Itapoa". O ERP manda nomes em maiúsculas; em
 * botões e pílulas lê melhor assim. Mantém "de/da/do/e" em minúsculo e
 * siglas (LTDA, ME, UF...) em maiúsculo.
 */
const PEQUENAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
const SIGLAS = /^(ltda|me|epp|sa|s\/a|br|ac|al|am|ap|ba|ce|df|es|go|ma|mg|ms|mt|pa|pb|pe|pi|pr|rj|rn|ro|rr|rs|sc|se|sp|to)$/

export const nomeLegivel = (s: string): string =>
  s.toLowerCase().split(/(\s+)/).map((w, i) => {
    if (!w || /^\s+$/.test(w)) return w
    if (i > 0 && PEQUENAS.has(w)) return w
    if (SIGLAS.test(w)) return w.toUpperCase()
    return w.charAt(0).toUpperCase() + w.slice(1)
  }).join('')

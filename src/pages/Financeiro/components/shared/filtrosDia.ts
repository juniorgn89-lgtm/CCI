export type OrdemDia = 'valor' | 'nome' | 'emissao' | 'atraso'
export interface Opcao { valor: string; label: string; n: number }

/** Conta ocorrências por chave e devolve opções ordenadas pelo nome. */
export const opcoesDe = <T,>(linhas: T[], chave: (r: T) => string, label: (k: string) => string): Opcao[] => {
  const m = new Map<string, number>()
  for (const r of linhas) { const k = chave(r); if (k) m.set(k, (m.get(k) ?? 0) + 1) }
  return [...m.entries()].map(([valor, n]) => ({ valor, label: label(valor), n })).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
}

/** Busca sem acento/maiúscula. */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
